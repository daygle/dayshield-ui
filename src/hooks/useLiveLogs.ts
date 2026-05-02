import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveLogsFilter, LogEntry, WsStatus } from '../types/logs'

const MAX_BUFFER = 2000

function buildWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/logs/ws`
}

export function useLiveLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<WsStatus>('disconnected')
  const [filter, setFilter] = useState<LiveLogsFilter>({
    source: 'all',
    level: 'all',
    search: '',
  })
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  const wsRef = useRef<WebSocket | null>(null)
  const pausedRef = useRef(paused)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  // keep paused ref in sync so the WS message handler always sees latest value
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const connect = useCallback(() => {
    if (unmountedRef.current) return
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) return

    setStatus('connecting')
    const ws = new WebSocket(buildWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return }
      setStatus('connected')
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current || pausedRef.current) return
      try {
        const entry = JSON.parse(event.data as string) as LogEntry
        setLogs((prev) => {
          const next = [...prev, entry]
          return next.length > MAX_BUFFER ? next.slice(next.length - MAX_BUFFER) : next
        })
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = () => {
      if (unmountedRef.current) return
      setStatus('error')
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      setStatus('disconnected')
      // fixed 3-second delay before reconnect
      reconnectTimerRef.current = setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const clearLogs = useCallback(() => setLogs([]), [])

  const filteredLogs = logs.filter((entry) => {    if (filter.source !== 'all' && entry.source !== filter.source) return false
    if (filter.level !== 'all' && entry.level !== filter.level) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (!entry.message.toLowerCase().includes(q) && !entry.raw?.toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })

  return {
    logs: filteredLogs,
    allLogs: logs,
    totalCount: logs.length,
    status,
    filter,
    setFilter,
    paused,
    setPaused,
    autoScroll,
    setAutoScroll,
    clearLogs,
    reconnect: connect,
  }
}
