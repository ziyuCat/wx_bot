import type { Message as WechatyMessage } from 'wechaty';
import { types } from 'wechaty';
import { logger } from '../utils/logger';

export async function handleFallback(
  msg: WechatyMessage,
  msgType: number
): Promise<void> {
  const typeName = types.Message[msgType] || 'Unknown';
  logger.info(`[Fallback] 非文本消息类型: ${typeName}`);

  await msg.say('抱歉，目前我只支持文字聊天。请发送文字消息给我。');
}
