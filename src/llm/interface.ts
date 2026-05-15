export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMAdapter {
  readonly name: string;
  chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse>;
  chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string>;
}
