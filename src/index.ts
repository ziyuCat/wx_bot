import 'dotenv/config';
import { loadConfig } from './config';
import { createLLMAdapter } from './llm/factory';
import { WeChatBot } from './bot';
import { logger } from './utils/logger';
import { startWebServer } from './web/server';
import { updateBotStatus, setBotInstance } from './web/api';

async function main(): Promise<void> {
  logger.info('========================================');
  logger.info('  WxBot - 微信聊天机器人');
  logger.info('========================================');

  // 加载配置
  const config = loadConfig();
  logger.info(`Puppet 类型: ${config.puppet.type}`);
  logger.info(`LLM 提供商: ${config.llm.provider}`);
  logger.info(`机器人名称: ${config.bot.name}`);

  // Create LLM adapter
  const llmAdapter = createLLMAdapter(config.llm);

  // Start web dashboard server
  const webPort = parseInt(process.env.WEB_PORT || '3000', 10);
  await startWebServer(webPort);

  // Create and start bot
  const bot = new WeChatBot(config, llmAdapter);
  setBotInstance(bot);

  // Graceful shutdown
  const shutdown = async () => {
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', async () => {
    logger.info('\n收到 SIGINT 信号，正在关闭...');
    await shutdown();
  });

  process.on('SIGTERM', async () => {
    logger.info('收到 SIGTERM 信号，正在关闭...');
    await shutdown();
  });

  try {
    await bot.start();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    logger.error('启动机器人失败:', msg);
    updateBotStatus({ state: 'error' });
    if (stack) console.error(stack);
    // Don't exit — web dashboard should show the error
  }
}

main();
