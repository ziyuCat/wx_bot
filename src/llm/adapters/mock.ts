import { LLMAdapter, Message, ChatOptions, LLMResponse } from '../interface';
import { logger } from '../../utils/logger';

export interface MockOptions {
  /** 是否开启复读模式（默认 true），关闭时返回固定占位回复 */
  mockEcho?: boolean;
}

export class MockAdapter implements LLMAdapter {
  readonly name = 'mock';
  private mockEcho: boolean;

  constructor(options: MockOptions = {}) {
    this.mockEcho = options.mockEcho !== false; // 默认 true
  }

  async chat(messages: Message[], _options?: ChatOptions): Promise<LLMResponse> {
    logger.debug('[MockAdapter] 调用 chat，消息数量:', messages.length, 'mockEcho:', this.mockEcho);

    let content: string;
    if (this.mockEcho) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      content = lastUser
        ? `[Mock echo]: ${lastUser.content}`
        : '[Mock] No user message found.';
    } else {
      content = ''; // 不复读，不回复任何内容
    }

    return {
      content,
      model: 'mock-echo',
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }

  /**
   * 运行时动态切换复读模式
   */
  setMockEcho(enabled: boolean): void {
    this.mockEcho = enabled;
    logger.info(`[MockAdapter] 复读模式已${enabled ? '开启' : '关闭'}`);
  }

  async *chatStream(messages: Message[], _options?: ChatOptions): AsyncIterable<string> {
    const response = await this.chat(messages, _options);
    for (const char of response.content) {
      yield char;
    }
  }
}
