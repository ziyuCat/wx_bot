import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { Message as WechatyMessage, Contact } from 'wechaty';
import { FileBox } from 'file-box';
import sharp from 'sharp';
import { DownloaderClient, ParseResult, VideoSource, ImageInfo, VideoDetail } from '../downloader/api';
import { logger } from '../utils/logger';

// ---- Helpers ----

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}分${seconds.toString().padStart(2, '0')}秒`;
  }
  return `${seconds}秒`;
}

/**
 * Detect MIME type from filename extension.
 */
function detectMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.m4v': 'video/mp4',
    '.ts': 'video/mp2t',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Image formats that wechat4u puppet does NOT recognize as images.
 * These must be converted to JPEG before sending.
 */
const NEEDS_CONVERSION = new Set(['.webp', '.tiff', '.tif', '.gif']);

/**
 * Convert an image to JPEG using sharp.
 * Returns the output file path.
 */
async function convertToJpeg(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.[^.]+$/i, '.jpg');
  logger.info(`[格式转换] → JPEG: ${path.basename(inputPath)}`);
  await sharp(inputPath)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outputPath);
  return outputPath;
}

/**
 * Create a FileBox with an explicit MIME type.
 * For the wechat4u puppet, only the file extension in `name` matters for
 * determining message type (image/video/file). Image formats are converted
 * before this function is called, so only video format renaming remains.
 */
// wechat4u puppet recognized extensions
const PUPPET_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.bmp']);
const PUPPET_VIDEO_EXTS = new Set(['.mp4']);

function createMediaBox(filePath: string, fileName: string): FileBox {
  const ext = path.extname(fileName).toLowerCase();
  let sendName = fileName;

  // Rename unsupported video formats so puppet uses video upload API
  const UNSUPPORTED_VIDEO_EXTS = ['.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.ts'];
  const needsRename = UNSUPPORTED_VIDEO_EXTS.some(e => ext === e);
  if (needsRename) {
    sendName = fileName.replace(new RegExp(`\\${ext}$`, 'i'), '.mp4');
  }

  const fileBox = FileBox.fromFile(filePath, sendName);
  const mediaType = detectMimeType(fileName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fileBox as any)['_mediaType'] = mediaType;

  if (sendName !== fileName) {
    logger.info(`[MediaBox] 后缀重命名: "${fileName}" → "${sendName}"`);
  }
  return fileBox;
}

function buildInfoText(result: ParseResult): string {
  const platformName = result.platform === 'douyin' ? '抖音' : '哔哩哔哩';
  const meta = result.metadata;
  const isNote = meta?.mediaType === 'note';
  const lines: string[] = [];

  lines.push(`[${platformName}${isNote ? '图文' : '视频'}]`);

  if (meta) {
    if (meta.title) lines.push(`标题：${meta.title}`);
    if (meta.author?.nickname) lines.push(`作者：${meta.author.nickname}`);
    if (!isNote && meta.durationMs) lines.push(`时长：${formatDuration(meta.durationMs)}`);
    // Bilibili multi-page (多P) info
    if (!isNote && meta.pagesCount > 1) {
      const partStr = meta.part ? `「${meta.part}」` : `第${result.resolved.page || 1}P`;
      lines.push(`分P：${partStr} (共${meta.pagesCount}P)`);
    }
    if (isNote && meta.images) lines.push(`图片：${meta.images.length}张`);
    if (meta.statistics) {
      const s = meta.statistics;
      const parts: string[] = [];
      if (s.diggCount) parts.push(`赞${s.diggCount}`);
      if (s.commentCount) parts.push(`评${s.commentCount}`);
      if (s.shareCount) parts.push(`分${s.shareCount}`);
      if (parts.length > 0) lines.push(parts.join(' '));
    }
  } else {
    if (result.resolved.title) lines.push(`标题：${result.resolved.title}`);
  }

  return lines.join('\n');
}

/**
 * Select the best video source.
 * Priority: no watermark > unknown > with watermark.
 * Within same tier: higher bitrate, then larger dimensions.
 */
function pickBestSource(sources: VideoSource[]): VideoSource | null {
  if (sources.length === 0) return null;

  const wmScore = (wm: string): number => {
    if (wm === 'without_watermark') return 0;
    if (wm === 'unknown') return 1;
    return 2;
  };

  const sorted = [...sources].sort((a, b) => {
    const wmDiff = wmScore(a.watermark) - wmScore(b.watermark);
    if (wmDiff !== 0) return wmDiff;

    const brA = a.bitRate || 0;
    const brB = b.bitRate || 0;
    if (brB !== brA) return brB - brA;

    const pixelsA = a.width * a.height;
    const pixelsB = b.width * b.height;
    return pixelsB - pixelsA;
  });

  const best = sorted[0];
  logger.info(
    `[视频分享] 已选择视频源: id="${best.id}", 标签="${best.label}", ` +
    `水印=${best.watermark}, 码率=${best.bitRate || 'N/A'}, ` +
    `分辨率=${best.width}x${best.height}`
  );
  return best;
}

// ---- Video handler ----

async function handleVideo(
  msg: WechatyMessage,
  parseResult: ParseResult,
  downloader: DownloaderClient
): Promise<void> {
  const meta = parseResult.metadata!;

  // Send info text first for immediate user feedback
  logger.info('[视频分享] 发送视频信息文本');
  await msg.say(buildInfoText(parseResult));

  const bestSource = pickBestSource(meta.sources);
  if (!bestSource) {
    logger.warn('[视频分享] 无可用视频源（信息已发送）');
    return;
  }

  // Step 2: Prepare download
  logger.info(`[视频分享] 步骤 2/3: 准备下载 (sourceId=${bestSource.id}, "${bestSource.label}")` +
    (parseResult.resolved.page ? `, 第${parseResult.resolved.page}P` : ''));
  const prepareResult = await downloader.prepareDownload({
    platform: parseResult.platform,
    awemeId: parseResult.resolved.awemeId || parseResult.resolved.resourceId,
    resourceId: parseResult.resolved.resourceId,
    bvid: parseResult.resolved.bvid || undefined,
    aid: parseResult.resolved.aid || undefined,
    page: parseResult.resolved.page || undefined,
    sourceId: bestSource.id,
    typeHint: parseResult.type,
  });
  logger.info(`[视频分享] 下载凭证: ${prepareResult.ticket}, 文件="${prepareResult.fileName}"`);

  // Step 3: Download and send video
  const ext = path.extname(prepareResult.fileName) || '.mp4';
  const tmpPath = path.join(os.tmpdir(), `wxbot_video_${Date.now()}${ext}`);
  logger.info(`[视频分享] 步骤 3/3: 下载视频到 ${tmpPath}`);

  try {
    await downloader.downloadFile(prepareResult.downloadUrl, tmpPath);
    const stat = fs.statSync(tmpPath);
    logger.info(`[视频分享] 已下载: ${stat.size} 字节`);

    const fileBox = createMediaBox(tmpPath, prepareResult.fileName);
    await msg.say(fileBox);
    logger.info('[视频分享] 视频文件发送成功');
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

// ---- Note (image collection) handler ----

/**
 * Stitch multiple images vertically into a single long image.
 */
async function stitchImages(imagePaths: string[], outputPath: string): Promise<void> {
  if (imagePaths.length === 0) return;
  if (imagePaths.length === 1) {
    await fs.promises.copyFile(imagePaths[0], outputPath);
    return;
  }

  logger.info(`[拼图] 拼接 ${imagePaths.length} 张图片...`);

  // Get metadata for all images
  const metadatas = await Promise.all(imagePaths.map(p => sharp(p).metadata()));
  const valid = metadatas.map((m, i) => ({ m, i })).filter(x => x.m.width && x.m.height);

  if (valid.length === 0) {
    await fs.promises.copyFile(imagePaths[0], outputPath);
    return;
  }

  // Use max width, capped at 1080
  const maxWidth = Math.min(1080, Math.max(...valid.map(v => v.m.width!)));

  // Resize all to consistent width
  const layers: { buffer: Buffer; height: number }[] = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const meta = metadatas[i];
    const w = meta.width || 1;
    const h = meta.height || 1;
    const newHeight = Math.round((maxWidth / w) * h);
    const buffer = await sharp(imagePaths[i])
      .resize(maxWidth, newHeight, { fit: 'fill' })
      .jpeg()
      .toBuffer();
    layers.push({ buffer, height: newHeight });
  }

  const totalHeight = layers.reduce((s, l) => s + l.height, 0);

  await sharp({
    create: {
      width: maxWidth,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(
      layers.map((layer, i) => {
        const top = layers.slice(0, i).reduce((s, l) => s + l.height, 0);
        return { input: layer.buffer, top, left: 0 };
      })
    )
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outputPath);

  const stat = fs.statSync(outputPath);
  logger.info(`[拼图] 完成: ${maxWidth}x${totalHeight}, ${stat.size} 字节`);
}

async function handleNote(
  msg: WechatyMessage,
  parseResult: ParseResult,
  downloader: DownloaderClient,
  noteImageThreshold: number
): Promise<void> {
  const meta = parseResult.metadata!;
  const images = meta.images;

  if (!images || images.length === 0) {
    logger.warn('[图文分享] 无图片可下载，发送文字信息');
    await msg.say(buildInfoText(parseResult));
    return;
  }

  const shouldStitch = images.length > noteImageThreshold;
  logger.info(`[图文分享] 共 ${images.length} 张图片${shouldStitch ? `（超过${noteImageThreshold}张，将拼接为长图）` : '，逐张发送'}`);

  // Send info text first
  const infoText = buildInfoText(parseResult);
  await msg.say(infoText);

  const tmpPaths: string[] = [];
  const downloadedPaths: string[] = []; // final JPEG paths ready for sending

  try {
    // ── Phase 1: Download & convert all images ──
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      logger.info(`[图文分享] 下载 ${i + 1}/${images.length}: id="${img.id}"`);

      const prepareResult = await downloader.prepareDownload({
        platform: parseResult.platform,
        awemeId: parseResult.resolved.awemeId || parseResult.resolved.resourceId,
        resourceId: parseResult.resolved.resourceId,
        bvid: parseResult.resolved.bvid || undefined,
        aid: parseResult.resolved.aid || undefined,
        imageId: img.id,
        typeHint: 'note',
      });

      const ext = path.extname(prepareResult.fileName).toLowerCase() || '.jpg';
      const downloadPath = path.join(os.tmpdir(), `wxbot_img_${i}_dl_${Date.now()}${ext}`);
      tmpPaths.push(downloadPath);

      await downloader.downloadFile(prepareResult.downloadUrl, downloadPath);
      const stat = fs.statSync(downloadPath);
      logger.info(`[图文分享] 图片 ${i + 1}/${images.length} 已下载: ${stat.size} 字节, 格式=${ext}`);

      let finalPath = downloadPath;
      if (NEEDS_CONVERSION.has(ext)) {
        try {
          finalPath = await convertToJpeg(downloadPath);
          tmpPaths.push(finalPath);
        } catch (convErr) {
          logger.error(`[图文分享] 格式转换失败: ${convErr}`);
          // use original anyway
        }
      }
      downloadedPaths.push(finalPath);
    }

    // ── Phase 2: Send ──
    if (shouldStitch) {
      const stitchPath = path.join(os.tmpdir(), `wxbot_stitch_${Date.now()}.jpg`);
      tmpPaths.push(stitchPath);

      await stitchImages(downloadedPaths, stitchPath);

      const fileBox = createMediaBox(stitchPath, `图文_${images.length}张.jpg`);
      await msg.say(fileBox);
      logger.info(`[图文分享] 拼图发送成功: ${images.length} 张合为 1 张`);
    } else {
      for (let i = 0; i < downloadedPaths.length; i++) {
        const fileBox = createMediaBox(downloadedPaths[i], `image_${i + 1}.jpg`);
        await msg.say(fileBox);
        logger.info(`[图文分享] 图片 ${i + 1}/${images.length} 发送成功`);
      }
      logger.info(`[图文分享] 全部 ${images.length} 张图片发送完成`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[图文分享] 下载/发送失败: ${errMsg}`);

    try {
      await msg.say('图片下载失败，请稍后重试。');
    } catch {
      // ignore
    }

    throw error;
  } finally {
    for (const p of tmpPaths) {
      fs.unlink(p, () => {});
    }
    logger.debug(`[图文分享] 临时文件已清理: ${tmpPaths.length} 个`);
  }
}

// ---- Main entry ----

export async function handleVideoShare(
  msg: WechatyMessage,
  contact: Contact,
  text: string,
  downloader: DownloaderClient,
  noteImageThreshold: number
): Promise<void> {
  logger.info(`[分享处理] 正在为 ${contact.name()} 处理`);

  // Step 1: Parse
  logger.info('[分享处理] 步骤 1/3: 解析分享文本');
  const parseResult = await downloader.parse(text, true);
  logger.info(`[分享处理] 解析结果: 平台=${parseResult.platform}, 类型=${parseResult.type}, 标题="${parseResult.resolved.title}"`);

  const meta = parseResult.metadata;
  if (!meta) {
    logger.info('[分享处理] 无元数据，仅发送文字信息');
    await msg.say(buildInfoText(parseResult));
    return;
  }

  // Step 2-3: Route by media type
  if (meta.mediaType === 'note') {
    logger.info(`[分享处理] 检测到图文笔记，${meta.images?.length || 0} 张图片`);
    await handleNote(msg, parseResult, downloader, noteImageThreshold);
  } else {
    logger.info(`[分享处理] 检测到视频，${meta.sources?.length || 0} 个视频源`);
    await handleVideo(msg, parseResult, downloader);
  }
}
