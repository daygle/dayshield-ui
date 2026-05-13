import type { LiveLogsFilter, LogLevel, LogSource } from '../types/logs'

const SOURCES: { value: LogSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'suricata', label: 'Suricata' },
  { value: 'ai', label: 'AI Threat Engine' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'system', label: 'System' },
  { value: 'dhcp', label: 'DHCP' },
  { value: 'vpn', label: 'VPN' },
  { value: 'cloudflared', label: 'Cloudflared' },
  { value: 'acme', label: 'ACME' },
]

const LEVELS: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'critical', label: 'Critical' },
]

interface LogFiltersProps {
  filter: LiveLogsFilter
  onChange: (next: Partial<LiveLogsFilter>) => void
}

export default function LogFilters({ filter, onChange }: LogFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Source filter */}
      <select
        className="h-7 rounded border border-slate-600 bg-slate-800 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={filter.source}
        onChange={(e) => onChange({ source: e.target.value as LogSource | 'all' })}
      >
        {SOURCES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Level filter */}
      <select
        className="h-7 rounded border border-slate-600 bg-slate-800 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={filter.level}
        onChange={(e) => onChange({ level: e.target.value as LogLevel | 'all' })}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  )
}
