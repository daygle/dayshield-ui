import type { LogEntry, LogLevel, LogSource } from '../types/logs'

const SOURCE_LABEL: Record<LogSource, string> = {
  suricata: 'Suricata',
  ai: 'AI Threat Engine',
  firewall: 'Firewall',
  system: 'System',
  dhcp: 'DHCP',
  vpn: 'VPN',
  cloudflared: 'Cloudflared',
  acme: 'ACME',
}

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'text-slate-400',
  info: 'text-slate-200',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  critical: 'text-red-300 font-bold',
}

const SOURCE_BADGE: Record<LogSource, string> = {
  suricata: 'bg-purple-900/60 text-purple-300',
  ai: 'bg-cyan-900/60 text-cyan-300',
  firewall: 'bg-blue-900/60 text-blue-300',
  system: 'bg-slate-700/70 text-slate-300',
  dhcp: 'bg-green-900/60 text-green-300',
  vpn: 'bg-indigo-900/60 text-indigo-300',
  cloudflared: 'bg-pink-900/60 text-pink-300',
  acme: 'bg-amber-900/60 text-amber-300',
}

const LEVEL_BADGE: Record<LogLevel, string> = {
  debug: 'bg-slate-700 text-slate-400',
  info: 'bg-slate-700 text-slate-300',
  warning: 'bg-yellow-900/60 text-yellow-300',
  error: 'bg-red-900/60 text-red-300',
  critical: 'bg-red-700 text-red-100',
}

interface LogLineProps {
  entry: LogEntry
  highlight?: string
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300/30 text-yellow-200 rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function LogLine({ entry, highlight = '' }: LogLineProps) {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const ms = new Date(entry.timestamp).getMilliseconds().toString().padStart(3, '0')

  return (
    <div className={`flex items-start gap-2 px-3 py-0.5 text-xs font-mono hover:bg-white/5 leading-5 ${LEVEL_STYLES[entry.level]}`}>
      {/* Timestamp */}
      <span className="shrink-0 text-slate-500 w-28">
        {time}.{ms}
      </span>

      {/* Source badge */}
      <span className={`shrink-0 inline-block px-1.5 rounded text-[10px] font-semibold uppercase leading-4 mt-0.5 ${SOURCE_BADGE[entry.source]}`}>
        {SOURCE_LABEL[entry.source]}
      </span>

      {/* Level badge */}
      <span className={`shrink-0 inline-block px-1.5 rounded text-[10px] font-semibold uppercase leading-4 mt-0.5 w-14 text-center ${LEVEL_BADGE[entry.level]}`}>
        {entry.level}
      </span>

      {/* Message */}
      <span className="break-all">{highlightText(entry.message, highlight)}</span>
    </div>
  )
}
