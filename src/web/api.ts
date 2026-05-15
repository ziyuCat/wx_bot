import { Router, Request, Response } from 'express';
import { logBridge, BotStatus } from './log-bridge';
import { getRuntimeConfig, updateRuntimeConfig } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// 机器人实例引用（由 index.ts 设置）
interface BotInstance {
  updateDownloaderUrl(url: string): void;
  logout(): Promise<void>;
}
let botInstance: BotInstance | null = null;

/**
 * 设置机器人实例引用，供 API 调用
 */
export function setBotInstance(bot: BotInstance): void {
  botInstance = bot;
}

// Shared bot status (updated by bot.ts)
const botStatus: BotStatus = {
  state: 'starting',
  puppet: '',
  llmProvider: '',
};

export function updateBotStatus(update: Partial<BotStatus>): void {
  Object.assign(botStatus, update);
  logBridge.emit('status', botStatus);
}

export function getBotStatus(): BotStatus {
  return { ...botStatus };
}

// GET /api/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    ...botStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// GET /api/logs — recent logs snapshot
router.get('/logs', (_req: Request, res: Response) => {
  const count = parseInt(_req.query.count as string, 10) || 200;
  res.json(logBridge.getRecentLogs(count));
});

// GET /api/logs/stream — SSE real-time log stream
router.get('/logs/stream', (_req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send recent logs as initial batch
  const recentLogs = logBridge.getRecentLogs(50);
  res.write(`data: ${JSON.stringify({ type: 'init', logs: recentLogs })}\n\n`);

  // Send current status
  res.write(`data: ${JSON.stringify({ type: 'status', status: botStatus })}\n\n`);

  // Forward new logs
  const onLog = (entry: unknown) => {
    res.write(`data: ${JSON.stringify({ type: 'log', entry })}\n\n`);
  };

  const onStatus = (status: BotStatus) => {
    res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
  };

  logBridge.on('log', onLog);
  logBridge.on('status', onStatus);

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Cleanup on disconnect
  _req.on('close', () => {
    logBridge.off('log', onLog);
    logBridge.off('status', onStatus);
    clearInterval(heartbeat);
  });
});

// GET /api/config — 获取当前配置（不含敏感密钥）
router.get('/config', (_req: Request, res: Response) => {
  try {
    const config = getRuntimeConfig();
    // 返回配置副本，移除敏感密钥
    const safeConfig = {
      puppet: { ...config.puppet },
      llm: {
        provider: config.llm.provider,
        options: { ...config.llm.options },
      },
      bot: { ...config.bot },
      downloader: { ...config.downloader },
    };
    // 移除 API 密钥
    if (safeConfig.llm.options.apiKey) {
      safeConfig.llm.options.apiKey = '***';
    }
    res.json(safeConfig);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// POST /api/logout — 手动登出微信
router.post('/logout', async (_req: Request, res: Response) => {
  try {
    if (!botInstance) {
      res.status(400).json({ error: '机器人未初始化' });
      return;
    }
    await botInstance.logout();
    logger.info('[登出] 登出请求已处理');
    res.json({ success: true, message: '已登出' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[登出] 登出失败: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

// POST /api/config — 更新配置
router.post('/config', (req: Request, res: Response) => {
  try {
    const update = req.body as Record<string, unknown>;
    if (!update || typeof update !== 'object') {
      res.status(400).json({ error: '请求体必须为 JSON 对象' });
      return;
    }

    // 不允许通过 Web 面板修改 puppet 和 llm.provider（需要重启生效）
    const allowed: Record<string, unknown> = {};
    if (update.downloader && typeof update.downloader === 'object') {
      const d = update.downloader as Record<string, unknown>;
      if (typeof d.apiUrl === 'string') {
        allowed.downloader = { apiUrl: d.apiUrl };

        // 同步更新机器人实例中的下载器地址
        if (botInstance) {
          botInstance.updateDownloaderUrl(d.apiUrl);
        }
      }
    }
    if (update.bot && typeof update.bot === 'object') {
      const b = update.bot as Record<string, unknown>;
      if (typeof b.name === 'string' || typeof b.maxContextMessages === 'number') {
        allowed.bot = {};
        if (typeof b.name === 'string') (allowed.bot as Record<string, unknown>).name = b.name;
        if (typeof b.maxContextMessages === 'number') (allowed.bot as Record<string, unknown>).maxContextMessages = b.maxContextMessages;
      }
    }
    if (update.llm && typeof update.llm === 'object') {
      const l = update.llm as Record<string, unknown>;
      if (l.options && typeof l.options === 'object') {
        allowed.llm = { options: { ...l.options as Record<string, unknown> } };
        // 移除 API 密钥，不应通过 Web 面板保存
        const opts = allowed.llm as Record<string, unknown>;
        if (opts.options && typeof opts.options === 'object') {
          const o = opts.options as Record<string, unknown>;
          if (o.apiKey) delete o.apiKey;
        }
      }
    }

    if (Object.keys(allowed).length === 0) {
      res.status(400).json({ error: '没有可更新的配置字段' });
      return;
    }

    const newConfig = updateRuntimeConfig(allowed);
    logger.info(`[配置] 已更新配置: ${JSON.stringify(allowed)}`);

    // 返回更新后的安全配置
    const safeConfig = {
      puppet: { ...newConfig.puppet },
      llm: {
        provider: newConfig.llm.provider,
        options: { ...newConfig.llm.options },
      },
      bot: { ...newConfig.bot },
      downloader: { ...newConfig.downloader },
    };
    if (safeConfig.llm.options.apiKey) {
      safeConfig.llm.options.apiKey = '***';
    }
    res.json({ success: true, config: safeConfig });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[配置] 更新配置失败: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

export default router;
