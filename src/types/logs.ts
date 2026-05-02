export type LogSource = 'suricata' | 'firewall' | 'system'

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical'

export interface LogEntry {
  id: string
  timestamp: string   // ISO 8601
  source: LogSource
  level: LogLevel
  message: string
  raw?: string
  meta?: Record<string, unknown>
}

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface LiveLogsFilter {
  source: LogSource | 'all'
  level: LogLevel | 'all'
  search: string
}
