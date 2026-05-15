import { EventEmitter } from 'events';

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface BotStatus {
  state: 'starting' | 'waiting_scan' | 'logged_in' | 'logged_out' | 'error';
  puppet: string;
  llmProvider: string;
  loginUser?: string;
  qrcode?: string;
  qrcodeImageUrl?: string;
}

class LogBridge extends EventEmitter {
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  pushLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.emit('log', entry);
  }

  getRecentLogs(count = 200): LogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logBridge = new LogBridge();
