import { LLMAdapter, Message, ChatOptions, LLMResponse } from '../interface';
import { logger } from '../../utils/logger';

export class MockAdapter implements LLMAdapter {
  readonly name = 'mock';

  async chat(messages: Message[], _options?: ChatOptions): Promise<LLMResponse> {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const content = lastUser
      ? `[Mock echo]: ${lastUser.content}`
      : '[Mock] No user message found.';

    logger.debug('[MockAdapter] 调用 chat，消息数量:', messages.length);

    return {
      content,
      model: 'mock-echo',
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }

  async *chatStream(messages: Message[], _options?: ChatOptions): AsyncIterable<string> {
    const response = await this.chat(messages, _options);
    for (const char of response.content) {
      yield char;
    }
  }
}
