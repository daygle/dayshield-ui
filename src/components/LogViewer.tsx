import { useEffect, useRef } from 'react'
import type { LiveLogsFilter, LogEntry, LogSource } from '../types/logs'
import LogLine from './LogLine'
import LogFilters from './LogFilters'
import LogSearch from './LogSearch'
import LogTabs from './LogTabs'
import AutoScrollToggle from './AutoScrollToggle'

interface LogViewerProps {
  logs: LogEntry[]
  allLogs: LogEntry[]   // unfiltered, used for tab counts
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  filter: LiveLogsFilter
  onFilterChange: (next: Partial<LiveLogsFilter>) => void
  paused: boolean
  onPausedChange: (p: boolean) => void
  autoScroll: boolean
  onAutoScrollChange: (v: boolean) => void
  onClear: () => void
  onReconnect: () => void
}

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  connecting: { label: 'Connecting…', dot: 'bg-yellow-400 animate-pulse' },
  connected: { label: 'Connected', dot: 'bg-green-400' },
  disconnected: { label: 'Disconnected', dot: 'bg-slate-500' },
  error: { label: 'Error', dot: 'bg-red-500' },
}

function buildCounts(logs: LogEntry[]): Record<LogSource | 'all', number> {
  const counts: Record<LogSource | 'all', number> = {
    all: logs.length,
    suricata: 0,
    firewall: 0,
    system: 0,
    dhcp: 0,
    vpn: 0,
    cloudflared: 0,
    acme: 0,
  }
  for (const log of logs) {
    counts[log.source] = (counts[log.source] ?? 0) + 1
  }
  return counts
}

export default function LogViewer({
  logs,
  allLogs,
  status,
  filter,
  onFilterChange,
  paused,
  onPausedChange,
  autoScroll,
  onAutoScrollChange,
  onClear,
  onReconnect,
}: LogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const statusInfo = STATUS_LABEL[status]
  const counts = buildCounts(allLogs)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !paused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
    }
  }, [logs, autoScroll, paused])

  // Disable auto-scroll when the user scrolls up manually
  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (!atBottom && autoScroll) onAutoScrollChange(false)
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-900/80 shrink-0">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-[100px]">
          <span className={`h-2 w-2 rounded-full shrink-0 ${statusInfo.dot}`} />
          {statusInfo.label}
        </div>

        <LogFilters filter={filter} onChange={onFilterChange} />
        <LogSearch value={filter.search} onChange={(s) => onFilterChange({ search: s })} />

        <div className="flex items-center gap-2 ml-auto">
          <AutoScrollToggle enabled={autoScroll} onToggle={onAutoScrollChange} />

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={() => onPausedChange(!paused)}
            className={[
              'flex items-center gap-1.5 h-7 rounded px-2 text-xs border transition-colors',
              paused
                ? 'bg-yellow-900/50 border-yellow-600/50 text-yellow-300 hover:bg-yellow-900/70'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {paused ? (
              <>
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Resume
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                Pause
              </>
            )}
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 h-7 rounded px-2 text-xs border bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>

          {/* Reconnect (only when not connected) */}
          {status !== 'connected' && (
            <button
              type="button"
              onClick={onReconnect}
              className="flex items-center gap-1.5 h-7 rounded px-2 text-xs border bg-blue-900/50 border-blue-500/50 text-blue-300 hover:bg-blue-900/70 transition-colors"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <LogTabs
        active={filter.source}
        counts={counts}
        onChange={(tab) => onFilterChange({ source: tab })}
      />

      {/* ── Log lines ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-1"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 text-sm">
            <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {status === 'connecting' ? 'Connecting to log stream…' : 'No log entries'}
          </div>
        ) : (
          <>
            {logs.map((entry) => (
              <LogLine key={entry.id} entry={entry} highlight={filter.search} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Footer counter ── */}
      <div className="shrink-0 border-t border-slate-700 px-3 py-1 text-[10px] text-slate-500 flex items-center gap-2">
        <span>{logs.length.toLocaleString()} entries{filter.source !== 'all' || filter.level !== 'all' || filter.search ? ' (filtered)' : ''}</span>
        {paused && (
          <span className="text-yellow-400 font-medium">⏸ Stream paused</span>
        )}
      </div>
    </div>
  )
}
