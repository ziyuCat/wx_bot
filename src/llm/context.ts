import { Message } from './interface';
import { logger } from '../utils/logger';

export class ContextManager {
  private conversations: Map<string, Message[]> = new Map();
  private maxMessages: number;

  constructor(maxMessages: number = 10) {
    this.maxMessages = maxMessages;
  }

  addMessage(contactId: string, message: Message): void {
    if (!this.conversations.has(contactId)) {
      this.conversations.set(contactId, []);
    }
    const history = this.conversations.get(contactId)!;
    history.push(message);

    // Sliding window: keep only the last N messages
    if (history.length > this.maxMessages) {
      history.splice(0, history.length - this.maxMessages);
    }

    logger.debug(`[上下文] 联系人 ${contactId}: ${history.length} 条消息`);
  }

  getHistory(contactId: string): Message[] {
    return this.conversations.get(contactId) || [];
  }

  clear(contactId: string): void {
    this.conversations.delete(contactId);
    logger.debug(`[上下文] 已清除 ${contactId} 的历史记录`);
  }

  get size(): number {
    return this.conversations.size;
  }
}
