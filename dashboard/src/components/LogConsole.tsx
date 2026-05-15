import { useState, useRef, useEffect } from 'react'
import { LogEntry } from '@/types'
import { cn } from '@/lib/utils'
import { Search, X, ChevronDown } from 'lucide-react'

const levelColors: Record<string, string> = {
  DEBUG: 'text-muted-foreground',
  INFO: 'text-cyan-300',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
}

const levelBorders: Record<string, string> = {
  ERROR: 'border-l-red-400/50',
  WARN: 'border-l-amber-400/30',
  INFO: 'border-l-transparent',
  DEBUG: 'border-l-transparent',
}

function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch { return iso }
}

export function LogConsole({ logs, connected }: { logs: LogEntry[]; connected: boolean }) {
  const [filter, setFilter] = useState('')
  const [showLevels, setShowLevels] = useState<Set<string>>(new Set(['INFO', 'WARN', 'ERROR', 'DEBUG']))
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleLevel = (level: string) => {
    setShowLevels(prev => {
      const next = new Set(prev)
      next.has(level) ? next.delete(level) : next.add(level)
      return next
    })
  }

  const clearFilter = () => setFilter('')

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [logs, autoScroll])

  const filteredLogs = logs.filter(log => {
    if (!showLevels.has(log.level)) return false
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/30">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            connected ? "bg-emerald-400 shadow-[0_0_6px_hsl(145,76%,42%)]" : "bg-red-400"
          )} />
          <span className="text-sm font-semibold">控制台日志</span>
          <span className="text-xs text-muted-foreground">({filteredLogs.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Level filters */}
          {['ERROR', 'WARN', 'INFO', 'DEBUG'].map(level => (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-all",
                showLevels.has(level)
                  ? cn("bg-background", levelColors[level])
                  : "text-muted-foreground/40 line-through"
              )}
            >
              {level}
            </button>
          ))}

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "px-2 py-0.5 rounded text-xs transition-colors",
              autoScroll ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground"
            )}
            title="自动滚动"
          >
            <ChevronDown className="w-3 h-3 inline" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-background/20">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="搜索日志..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        {filter && (
          <button onClick={clearFilter} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Log lines */}
      <div
        ref={containerRef}
        className="overflow-y-auto font-mono text-xs leading-relaxed"
        style={{ maxHeight: 'calc(100vh - 440px)', minHeight: '280px' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
            {logs.length === 0 ? '等待日志...' : '无匹配日志'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={`${log.timestamp}-${i}`}
              className={cn(
                "flex gap-3 px-4 py-1 border-l-2 hover:bg-background/40 transition-colors log-entry-new",
                levelBorders[log.level]
              )}
            >
              <span className="text-muted-foreground shrink-0 w-[72px] select-none">
                {formatLogTime(log.timestamp)}
              </span>
              <span className={cn("shrink-0 w-12 font-semibold select-none", levelColors[log.level])}>
                {log.level}
              </span>
              <span className="text-foreground/90 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
