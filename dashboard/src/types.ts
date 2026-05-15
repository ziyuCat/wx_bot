export interface LogEntry {
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
}

export interface BotStatus {
  state: 'starting' | 'waiting_scan' | 'logged_in' | 'logged_out' | 'error'
  puppet: string
  llmProvider: string
  loginUser?: string
  qrcode?: string
  qrcodeImageUrl?: string
  uptime?: number
  memory?: { rss: number; heapTotal: number; heapUsed: number }
}

export interface SSEMessage {
  type: 'init' | 'log' | 'status'
  logs?: LogEntry[]
  entry?: LogEntry
  status?: BotStatus
}
