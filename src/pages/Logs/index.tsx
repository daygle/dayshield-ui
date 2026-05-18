import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LogViewer from '../../components/LogViewer'
import { useLiveLogs } from '../../hooks/useLiveLogs'
import type { LogLevel, LogSource } from '../../types/logs'

type LogsTab = 'logs' | 'live'

const DEFAULT_SOURCE: LogSource | 'all' = 'all'
const DEFAULT_LEVEL: LogLevel | 'all' = 'all'

const VALID_SOURCES = new Set<LogSource | 'all'>([
  'all',
  'suricata',
  'firewall',
  'system',
  'dhcp',
  'vpn',
  'cloudflared',
  'acme',
  'ai',
  'interfaces',
  'gateways',
  'dns',
  'ntp',
  'crowdsec',
  'pppoe',
  'backup_restore',
  'updates',
])

const VALID_LEVELS = new Set<LogLevel | 'all'>([
  'all',
  'debug',
  'info',
  'warning',
  'error',
  'critical',
])

function defaultFromDateTime(): string {
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  return hourAgo.toISOString().slice(0, 16)
}

function parseSource(value: string | null): LogSource | 'all' {
  if (value && VALID_SOURCES.has(value as LogSource | 'all')) {
    return value as LogSource | 'all'
  }
  return DEFAULT_SOURCE
}

function parseLevel(value: string | null): LogLevel | 'all' {
  if (value && VALID_LEVELS.has(value as LogLevel | 'all')) {
    return value as LogLevel | 'all'
  }
  return DEFAULT_LEVEL
}

function tabFromQuery(value: string | null): LogsTab {
  return value === 'live' ? 'live' : 'logs'
}

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = tabFromQuery(searchParams.get('tab'))
  const initialFrom = searchParams.get('from') ?? defaultFromDateTime()
  const initialTo = searchParams.get('to') ?? new Date().toISOString().slice(0, 16)
  const initialSource = parseSource(searchParams.get('source'))
  const initialLevel = parseLevel(searchParams.get('level'))
  const initialSearch = searchParams.get('search') ?? ''

  const historical = useLiveLogs({ autoConnect: false })
  const live = useLiveLogs()

  const [fromDateTime, setFromDateTime] = useState(initialFrom)
  const [toDateTime, setToDateTime] = useState(initialTo)
  const [searching, setSearching] = useState(false)
  const [searchInfo, setSearchInfo] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    historical.setFilter({
      source: initialSource,
      level: initialLevel,
      search: initialSearch,
    })
    // Initialize from URL only once on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)

    if (activeTab === 'live') {
      next.set('tab', 'live')
    } else {
      next.delete('tab')
    }

    if (fromDateTime) next.set('from', fromDateTime)
    else next.delete('from')

    if (toDateTime) next.set('to', toDateTime)
    else next.delete('to')

    if (historical.filter.source !== DEFAULT_SOURCE) next.set('source', historical.filter.source)
    else next.delete('source')

    if (historical.filter.level !== DEFAULT_LEVEL) next.set('level', historical.filter.level)
    else next.delete('level')

    if (historical.filter.search.trim()) next.set('search', historical.filter.search)
    else next.delete('search')

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [
    activeTab,
    fromDateTime,
    historical.filter.level,
    historical.filter.search,
    historical.filter.source,
    searchParams,
    setSearchParams,
    toDateTime,
  ])

  const titleCount = useMemo(() => {
    if (activeTab === 'live') return live.totalCount
    return historical.totalCount
  }, [activeTab, historical.totalCount, live.totalCount])

  const setTab = (next: LogsTab) => {
    const updated = new URLSearchParams(searchParams)
    if (next === 'live') updated.set('tab', 'live')
    else updated.delete('tab')
    setSearchParams(updated, { replace: true })
  }

  const handleSearchRange = async () => {
    setSearchError(null)
    setSearchInfo(null)

    if (!fromDateTime || !toDateTime) {
      setSearchError('Please choose both from and to date/time values.')
      return
    }

    const from = new Date(fromDateTime)
    const to = new Date(toDateTime)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setSearchError('Invalid date/time values.')
      return
    }
    if (to < from) {
      setSearchError('To date/time must be after From date/time.')
      return
    }

    setSearching(true)
    try {
      const count = await historical.loadHistoricalRange(from.toISOString(), to.toISOString())
      setSearchInfo(`Loaded ${count.toLocaleString()} historical log entries.`)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search logs.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">Logs</h1>
        <p className="text-xs text-gray-400">{titleCount.toLocaleString()} events buffered</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-1.5 shrink-0 inline-flex gap-1.5 w-fit shadow-sm">
        <button
          type="button"
          onClick={() => setTab('logs')}
          className={[
            'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
            activeTab === 'logs'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Logs
        </button>
        <button
          type="button"
          onClick={() => setTab('live')}
          className={[
            'rounded-lg px-4 py-2 text-sm font-semibold transition-all',
            activeTab === 'live'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Live Logs
        </button>
      </div>

      {activeTab === 'logs' ? (
        <>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shrink-0 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                From
                <input
                  type="datetime-local"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  value={fromDateTime}
                  onChange={(e) => setFromDateTime(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                To
                <input
                  type="datetime-local"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  value={toDateTime}
                  onChange={(e) => setToDateTime(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={handleSearchRange}
                disabled={searching}
                className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching ? 'Searching…' : 'Search Range'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Historical search mode. Live stream updates are disabled in this tab.
            </p>
            {searchInfo && <p className="text-xs text-green-700">{searchInfo}</p>}
            {searchError && <p className="text-xs text-red-700">{searchError}</p>}
          </div>

          <div className="flex-1 min-h-[360px]">
            <LogViewer
              logs={historical.logs}
              allLogs={historical.allLogs}
              status={historical.status}
              filter={historical.filter}
              onFilterChange={(next) => historical.setFilter((prev) => ({ ...prev, ...next }))}
              paused
              onPausedChange={() => {}}
              autoScroll={false}
              onAutoScrollChange={() => {}}
              onClear={historical.clearLogs}
              onReconnect={() => {}}
              showLiveControls={false}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-[360px]">
          <LogViewer
            logs={live.logs}
            allLogs={live.allLogs}
            status={live.status}
            filter={live.filter}
            onFilterChange={(next) => live.setFilter((prev) => ({ ...prev, ...next }))}
            paused={live.paused}
            onPausedChange={live.setPaused}
            autoScroll={live.autoScroll}
            onAutoScrollChange={live.setAutoScroll}
            onClear={live.clearLogs}
            onReconnect={live.reconnect}
          />
        </div>
      )}
    </div>
  )
}
