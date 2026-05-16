export type LogSource =
  | 'suricata'
  | 'firewall'
  | 'system'
  | 'dhcp'
  | 'vpn'
  | 'cloudflared'
  | 'acme'
  | 'ai'
  | 'interfaces'
  | 'gateways'
  | 'dns'
  | 'ntp'
  | 'crowdsec'
  | 'backup_restore'
  | 'updates'

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
