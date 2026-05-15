import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { logger } from '../utils/logger';

// ---- API Response Types ----

export interface ParseResult {
  parseId: string;
  platform: 'douyin' | 'bilibili';
  type: 'video' | 'note' | 'video_or_note' | 'unknown';
  status: 'resolved' | 'partial';
  input: {
    rawText: string;
    shareCode: string;
    shareUrl: string;
  };
  resolved: {
    platform: string;
    finalUrl: string;
    resourceId: string;
    awemeId: string;
    bvid: string;
    aid: string;
    page: number | null;
    title: string;
    resourceTypeHint: string;
  };
  nextStep: string;
  metadata?: VideoDetail;
}

export interface PrepareDownloadRequest {
  platform?: string;
  awemeId?: string;
  resourceId?: string;
  bvid?: string;
  aid?: string;
  page?: number;
  resolvedUrl?: string;
  typeHint?: string;
  sourceId?: string;
  imageId?: string;
}

export interface PrepareDownloadResult {
  ticket: string;
  platform: string;
  resourceId: string;
  awemeId: string;
  bvid: string;
  aid: string;
  page: number | null;
  mediaType: 'video' | 'note';
  assetType: 'video' | 'image';
  assetId: string;
  fileName: string;
  expiresAt: number;
  downloadUrl: string;
  source: {
    label: string;
    contentTypeHint: string;
  };
}

export interface VideoDetail {
  platform: string;
  resourceId: string;
  awemeId: string;
  bvid: string;
  aid: string;
  page: number | null;
  part: string;
  pagesCount: number;
  mediaType: 'video' | 'note';
  title: string;
  description: string;
  author: {
    uid: string;
    secUid: string;
    nickname: string;
    avatar: string;
  };
  cover: string;
  durationMs: number;
  statistics: {
    commentCount: number;
    diggCount: number;
    playCount: number;
    shareCount: number;
    collectCount: number;
  };
  sharePage: {
    sourceUrl: string;
    pageUrl: string;
  };
  sources: VideoSource[];
  images: ImageInfo[];
}

export interface VideoSource {
  id: string;
  kind: string;
  label: string;
  watermark: 'with_watermark' | 'without_watermark' | 'unknown';
  url: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
  bitRate?: number;
  qualityType?: number;
  isH265?: boolean;
  videoId?: string;
}

export interface ImageInfo {
  id: string;
  url: string;
  downloadUrl: string;
}

interface ApiResponse<T> {
  success: boolean;
  requestId?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ---- HTTP Helper ----

function httpRequest(url: string, options: https.RequestOptions, body?: string): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const mod = isHttps ? https : http;

    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode || 0, data }));
      res.on('error', (err) => {
        logger.error(`[下载器] 响应流错误: ${err.message}`);
        reject(err);
      });
    });

    req.on('error', (err) => {
      logger.error(`[下载器] 连接错误: ${err.message}`);
      reject(new Error(`连接失败: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      logger.error(`[下载器] 请求超时 (30秒): ${url}`);
      reject(new Error(`请求超时 (30秒): ${url}`));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * Download a file from URL to a local path via streaming.
 * Uses a longer timeout (120s) since video files can be large.
 */
function httpDownloadFile(url: string, destPath: string): Promise<{ sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const mod = isHttps ? https : http;

    const req = mod.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`下载 HTTP ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        resolve({ sizeBytes: totalBytes });
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(new Error(`文件写入错误: ${err.message}`));
      });

      res.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(new Error(`下载流错误: ${err.message}`));
      });
    });

    req.on('error', (err) => {
      reject(new Error(`下载连接失败: ${err.message}`));
    });

    req.setTimeout(120000, () => {
      req.destroy();
      fs.unlink(destPath, () => {});
      reject(new Error('下载超时 (120秒)'));
    });
  });
}

async function postJson<T>(baseUrl: string, path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${baseUrl}${path}`;
  const bodyStr = JSON.stringify(body);

  logger.info(`[下载器] POST ${url}`);
  logger.debug(`[下载器] 请求体 (长度=${bodyStr.length}): ${bodyStr.slice(0, 300)}`);

  const startTime = Date.now();
  const { status, data } = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(bodyStr).toString(),
    },
  }, bodyStr);

  const elapsed = Date.now() - startTime;
  logger.info(`[下载器] 响应: HTTP ${status}, ${data.length} 字节, ${elapsed}ms`);

  if (status < 200 || status >= 300) {
    logger.error(`[下载器] HTTP 错误 ${status}: ${data.slice(0, 500)}`);
    throw new Error(`HTTP ${status}: ${data.slice(0, 500)}`);
  }

  let result: ApiResponse<T>;
  try {
    result = JSON.parse(data);
  } catch {
    logger.error(`[下载器] 无效 JSON: ${data.slice(0, 300)}`);
    throw new Error(`无效 JSON 响应: ${data.slice(0, 200)}`);
  }

  if (!result.success) {
    const err = result.error;
    logger.error(`[下载器] API 错误: code=${err?.code}, message="${err?.message}"`);
    throw new Error(`API 错误 [${err?.code || '未知'}]: ${err?.message || '未知错误'}`);
  }

  logger.debug(`[下载器] API 成功: requestId=${result.requestId}`);
  return result.data as T;
}

// ---- API Client ----

export class DownloaderClient {
  constructor(private baseUrl: string) {
    // 移除末尾斜杠
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * 更新下载服务 API 地址
   */
  updateBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl.replace(/\/$/, '');
    logger.info(`[下载器] API 地址已更新为: ${this.baseUrl}`);
  }

  /**
   * Parse share text to extract platform, video ID, and optionally metadata.
   */
  async parse(text: string, fetchMetadata = true): Promise<ParseResult> {
    return postJson<ParseResult>(this.baseUrl, '/api/parse', {
      text,
      resolveRedirect: true,
      fetchMetadata,
      includeDebug: false,
    });
  }

  /**
   * Prepare a download ticket for a video/image source.
   * Requires at minimum: platform + (awemeId | resourceId) for douyin, or platform + (bvid | aid) for bilibili.
   */
  async prepareDownload(params: PrepareDownloadRequest): Promise<PrepareDownloadResult> {
    return postJson<PrepareDownloadResult>(this.baseUrl, '/api/download/prepare', params as Record<string, unknown>);
  }

  /**
   * Download a file from a downloadUrl (returned by prepareDownload) to a local path.
   * Returns the number of bytes written.
   */
  async downloadFile(downloadUrl: string, destPath: string): Promise<{ sizeBytes: number }> {
    logger.info(`[下载器] 正在下载文件到: ${destPath}`);
    const startTime = Date.now();

    const result = await httpDownloadFile(downloadUrl, destPath);

    const elapsed = Date.now() - startTime;
    logger.info(`[下载器] 下载完成: ${result.sizeBytes} 字节, ${elapsed}ms`);
    return result;
  }
}
