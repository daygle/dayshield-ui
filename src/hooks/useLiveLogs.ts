import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthToken } from '../api/client'
import { searchLogs } from '../api/logs'
import type { LiveLogsFilter, LogEntry, LogLevel, LogSource, WsStatus } from '../types/logs'

const MAX_BUFFER = 2000

function levelFromSystemMessage(message: string): LogLevel {
  const upper = message.toUpperCase()
  if (upper.includes("CRITICAL") || upper.includes("PANIC")) return 'critical'
  if (upper.includes("ERROR") || upper.includes("FAILED")) return 'error'
  if (upper.includes("WARN")) return 'warning'
  if (upper.includes("DEBUG") || upper.includes("TRACE")) return 'debug'
  return 'info'
}

function sourceFromSystemEvent(unit: string, message: string): LogSource {
  const hay = `${unit} ${message}`.toLowerCase()
  if (hay.includes('suricata')) return 'suricata'
  if (hay.includes('nft') || hay.includes('firewall')) return 'firewall'
  if (hay.includes('kea') || hay.includes('dhcp') || hay.includes('dnsmasq')) return 'dhcp'
  if (hay.includes('wireguard') || hay.includes('wg-') || hay.includes('vpn')) return 'vpn'
  if (hay.includes('cloudflared')) return 'cloudflared'
  if (hay.includes('acme') || hay.includes('cert') || hay.includes('letsencrypt')) return 'acme'
  return 'system'
}

function normalizeWsEvent(raw: unknown, seq: number): LogEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const event = raw as Record<string, unknown>

  // Backward-compatible: already in LogEntry shape.
  if (typeof event.source === 'string' && typeof event.level === 'string' && typeof event.message === 'string') {
    const timestamp = typeof event.timestamp === 'string' && event.timestamp ? event.timestamp : new Date().toISOString()
    const id = typeof event.id === 'string' && event.id ? event.id : `${timestamp}-${seq}`
    return {
      id,
      timestamp,
      source: event.source as LogSource,
      level: event.level as LogLevel,
      message: event.message,
      raw: JSON.stringify(event),
      meta: event.meta as Record<string, unknown> | undefined,
    }
  }

  const kind = typeof event.type === 'string' ? event.type : ''

  if (kind === 'suricata_alert') {
    const timestamp = typeof event.timestamp === 'string' && event.timestamp ? event.timestamp : new Date().toISOString()
    const severity = Number(event.severity ?? 3)
    const level: LogLevel = severity <= 1 ? 'error' : severity === 2 ? 'warning' : 'info'
    const src = String(event.src_ip ?? '')
    const dst = String(event.dest_ip ?? '')
    const proto = String(event.proto ?? '').toUpperCase()
    const sig = String(event.signature ?? 'Suricata alert')
    const flow = [src, dst].every(Boolean) ? ` (${src} -> ${dst}${proto ? ` ${proto}` : ''})` : ''
    return {
      id: `${timestamp}-suricata-${seq}`,
      timestamp,
      source: 'suricata',
      level,
      message: `${sig}${flow}`,
      raw: JSON.stringify(event),
      meta: event,
    }
  }

  if (kind === 'firewall_event') {
    const timestamp = typeof event.timestamp === 'string' && event.timestamp ? event.timestamp : new Date().toISOString()
    const action = String(event.action ?? 'EVENT')
    const src = String(event.src_ip ?? '')
    const dst = String(event.dest_ip ?? '')
    const sport = String(event.sport ?? '')
    const dport = String(event.dport ?? '')
    const iface = String(event.iface ?? '')
    const endpoint = [src, sport].filter(Boolean).join(':')
    const target = [dst, dport].filter(Boolean).join(':')
    const where = iface ? ` on ${iface}` : ''
    return {
      id: `${timestamp}-firewall-${seq}`,
      timestamp,
      source: 'firewall',
      level: action.toUpperCase().includes('DROP') ? 'warning' : 'info',
      message: `${action}${where}${endpoint || target ? ` ${endpoint} -> ${target}` : ''}`,
      raw: JSON.stringify(event),
      meta: event,
    }
  }

  if (kind === 'system_event') {
    const timestamp = typeof event.timestamp === 'string' && event.timestamp ? event.timestamp : new Date().toISOString()
    const unit = String(event.unit ?? 'system')
    const message = String(event.message ?? '').trim()
    const safeMessage = message || '(empty system log message)'
    return {
      id: `${timestamp}-system-${seq}`,
      timestamp,
      source: sourceFromSystemEvent(unit, safeMessage),
      level: levelFromSystemMessage(safeMessage),
      message: safeMessage,
      raw: JSON.stringify(event),
      meta: event,
    }
  }

  return null
}

function buildWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = getAuthToken()
  const suffix = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${proto}//${window.location.host}/logs/ws${suffix}`
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
  const sequenceRef = useRef(0)

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
        const parsed = JSON.parse(event.data as string) as unknown
        sequenceRef.current += 1
        const entry = normalizeWsEvent(parsed, sequenceRef.current)
        if (!entry) return
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

  const loadHistoricalRange = useCallback(async (from: string, to: string) => {
    const res = await searchLogs({ from, to, limit: MAX_BUFFER })
    const raw = Array.isArray(res.data) ? res.data : []
    const normalized: LogEntry[] = []
    let localSeq = 0
    for (const item of raw) {
      localSeq += 1
      const entry = normalizeWsEvent(item, localSeq)
      if (entry) normalized.push(entry)
    }

    setLogs(normalized)
    setPaused(true)
    setAutoScroll(true)
    return normalized.length
  }, [])

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
    loadHistoricalRange,
  }
}
