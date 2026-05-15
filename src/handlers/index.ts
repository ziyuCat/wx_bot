import type { Message as WechatyMessage } from 'wechaty';
import { types } from 'wechaty';
import { LLMAdapter } from '../llm/interface';
import { ContextManager } from '../llm/context';
import { handleText } from './text.handler';
import { handleFallback } from './fallback.handler';
import { handleVideoShare } from './video.handler';
import { detectVideoShare } from '../utils/url-detector';
import { DownloaderClient } from '../downloader/api';
import { logger } from '../utils/logger';

/**
 * Check if the bot is @mentioned in the message text.
 * Handles common WeChat @mention formats: "@BotName", "@BotName ", etc.
 */
function isBotMentioned(text: string, botName: string): boolean {
  // Escape special regex characters in bot name
  const escapedName = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionPattern = new RegExp(`@${escapedName}([\\s\u2005\u00a0]|$)`, 'i');
  return mentionPattern.test(text);
}

/**
 * Remove @botName mention(s) from the message text.
 */
function cleanMentionText(text: string, botName: string): string {
  const escapedName = botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionPattern = new RegExp(`@${escapedName}[\\s\u2005\u00a0]*`, 'gi');
  return text.replace(mentionPattern, '').trim();
}

export async function routeMessage(
  msg: WechatyMessage,
  llmAdapter: LLMAdapter,
  contextManager: ContextManager,
  botName: string,
  downloader: DownloaderClient,
  noteImageThreshold: number
): Promise<void> {
  // Ignore self messages to prevent loops
  if (msg.self()) {
    return;
  }

  const contact = msg.talker();
  const room = msg.room();
  const msgType = msg.type();
  let text = msg.text();

  // ── Group (room) messages ──────────────────────────────────────────
  if (room) {
    // --- Video shares: always process, even without @mention ---
    if (msgType === types.Message.Text) {
      const detected = detectVideoShare(text);
      if (detected.isVideoShare) {
        // Clean @mention if present so the parsing API receives clean text
        const cleanText = cleanMentionText(text, botName);
        logger.info(`[路由] 群="${room.topic()}" | 用户=${contact.name()} | 视频分享: 平台=${detected.platform}`);
        try {
          await handleVideoShare(msg, contact, cleanText, downloader, noteImageThreshold);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`[路由] 群聊视频处理失败: ${errMsg}`);
        }
        return;
      }
    }

    // --- Regular text: require @mention ---
    if (!isBotMentioned(text, botName)) {
      return;
    }
    text = cleanMentionText(text, botName);
    logger.info(`[路由] 群="${room.topic()}" | 用户=${contact.name()}: "${text.slice(0, 200)}${text.length > 200 ? '...' : ''}"`);
  } else {
    // ── Private (1-on-1) messages ────────────────────────────────────
    logger.info(`来自 ${contact.name()} 的消息 (${contact.id}): 类型=${types.Message[msgType]}`);
  }

  switch (msgType) {
    case types.Message.Text: {
      logger.info(`[路由] 文本内容 (长度=${text.length}): "${text.slice(0, 200)}${text.length > 200 ? '...' : ''}"`);

      // Check if the message contains a douyin/bilibili share link
      const detected = detectVideoShare(text);
      if (detected.isVideoShare) {
        logger.info(`[路由] 检测到视频分享: 平台=${detected.platform}, 规则="${detected.matchedPattern}", 匹配="${detected.matchedText}"`);
        try {
          await handleVideoShare(msg, contact, text, downloader, noteImageThreshold);
          return;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`[路由] 视频处理失败，降级到 LLM: ${errMsg}`);
          // Fall through to regular text/LLM handling
        }
      } else {
        logger.debug(`[路由] 未检测到视频分享链接`);
      }

      // For group messages, use room.id as conversation context key;
      // pass cleaned text to avoid @mention prefix going to LLM.
      await handleText(msg, contact, llmAdapter, contextManager, room?.id, text);
      break;
    }
    default:
      await handleFallback(msg, msgType);
      break;
  }
}
