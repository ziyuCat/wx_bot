import { LLMAdapter } from './interface';
import { LLMConfig } from '../config/types';
import { MockAdapter } from './adapters/mock';
import { logger } from '../utils/logger';

export function createLLMAdapter(config: LLMConfig): LLMAdapter {
  logger.info(`创建 LLM 适配器: ${config.provider}`);

  switch (config.provider) {
    case 'mock':
      return new MockAdapter(config.options as { mockEcho?: boolean });

    case 'openai':
      // Lazy load: only require openai when actually used
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { OpenAIAdapter } = require('../adapters/openai');
        return new OpenAIAdapter(config.options);
      } catch {
        throw new Error(
          'OpenAI 适配器尚未实现或 "openai" 包未安装。' +
          '请运行: npm install openai'
        );
      }

    case 'qwen':
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { QwenAdapter } = require('../adapters/qwen');
        return new QwenAdapter(config.options);
      } catch {
        throw new Error(
          'Qwen 适配器尚未实现。' +
          '如需使用，请实现 src/llm/adapters/qwen.ts'
        );
      }

    default:
      throw new Error(`未知的 LLM 提供商: ${config.provider}。支持的选项: mock, openai, qwen`);
  }
}
