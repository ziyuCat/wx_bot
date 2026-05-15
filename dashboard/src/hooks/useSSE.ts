import { useState, useEffect, useRef, useCallback } from 'react'
import { LogEntry, BotStatus } from '../types'

export function useSSE(url: string) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'init' && data.logs) {
          setLogs(data.logs.reverse())
        } else if (data.type === 'log' && data.entry) {
          setLogs(prev => [data.entry, ...prev].slice(0, 500))
        } else if (data.type === 'status' && data.status) {
          setStatus(data.status)
        }
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Reconnect after 3 seconds
      setTimeout(connect, 3000)
    }
  }, [url])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])

  return { logs, status, connected }
}
