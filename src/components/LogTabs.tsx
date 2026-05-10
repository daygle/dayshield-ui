import type { LogSource } from '../types/logs'

const TABS: { value: LogSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'suricata', label: 'Suricata' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'system', label: 'System' },
  { value: 'dhcp', label: 'DHCP' },
  { value: 'vpn', label: 'VPN' },
  { value: 'cloudflared', label: 'Cloudflared' },
  { value: 'acme', label: 'ACME' },
]

interface LogTabsProps {
  active: LogSource | 'all'
  counts: Record<LogSource | 'all', number>
  onChange: (tab: LogSource | 'all') => void
}

export default function LogTabs({ active, counts, onChange }: LogTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-700 px-3">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={[
            'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            active === tab.value
              ? 'border-blue-400 text-blue-300'
              : 'border-transparent text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          {tab.label}
          {counts[tab.value] > 0 && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                active === tab.value ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {counts[tab.value] > 9999 ? '9999+' : counts[tab.value]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
