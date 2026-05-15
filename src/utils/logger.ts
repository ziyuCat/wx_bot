import { logBridge } from '../web/log-bridge';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL, 10) : LogLevel.INFO;

function formatTime(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, levelName: string, ...args: unknown[]): void {
  if (level < LOG_LEVEL) return;
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');

  if (level >= LogLevel.ERROR) {
    console.error(`[${formatTime()}] [${levelName}] ${msg}`);
  } else if (level >= LogLevel.WARN) {
    console.warn(`[${formatTime()}] [${levelName}] ${msg}`);
  } else {
    console.log(`[${formatTime()}] [${levelName}] ${msg}`);
  }

  // Emit to web dashboard
  try {
    logBridge.pushLog({ timestamp: formatTime(), level: levelName as LogEntry['level'], message: msg });
  } catch {
    // web bridge not critical
  }
}

import type { LogEntry } from '../web/log-bridge';

export const logger = {
  debug: (...args: unknown[]) => log(LogLevel.DEBUG, 'DEBUG', ...args),
  info: (...args: unknown[]) => log(LogLevel.INFO, 'INFO', ...args),
  warn: (...args: unknown[]) => log(LogLevel.WARN, 'WARN', ...args),
  error: (...args: unknown[]) => log(LogLevel.ERROR, 'ERROR', ...args),
};
