import { useState } from 'react'
import { useLiveLogs } from '../../hooks/useLiveLogs'
import LogViewer from '../../components/LogViewer'

export default function LiveLogs() {
  const {
    logs,
    allLogs,
    totalCount,
    status,
    filter,
    setFilter,
    paused,
    setPaused,
    autoScroll,
    setAutoScroll,
    clearLogs,
    reconnect,
    loadHistoricalRange,
  } = useLiveLogs()

  const [fromDateTime, setFromDateTime] = useState(() => {
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    return hourAgo.toISOString().slice(0, 16)
  })
  const [toDateTime, setToDateTime] = useState(() => new Date().toISOString().slice(0, 16))
  const [searching, setSearching] = useState(false)
  const [searchInfo, setSearchInfo] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const effectiveFrom = fromDateTime
  const effectiveTo = toDateTime

  const handleSearchRange = async () => {
    setSearchError(null)
    setSearchInfo(null)

    if (!effectiveFrom || !effectiveTo) {
      setSearchError('Please choose both from and to date/time values.')
      return
    }

    const from = new Date(effectiveFrom)
    const to = new Date(effectiveTo)
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
      const count = await loadHistoricalRange(from.toISOString(), to.toISOString())
      setSearchInfo(`Loaded ${count.toLocaleString()} historical log entries.`)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search logs.')
    } finally {
      setSearching(false)
    }
  }

  // Build allLogs-equivalent counts from unfiltered buffer length
  // LogViewer accepts the already-filtered list and the unfiltered list separately
  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">Live Logs</h1>
        <p className="text-xs text-gray-400">
          {totalCount.toLocaleString()} total events buffered
        </p>
      </div>

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
          <button
            type="button"
            onClick={() => {
              setPaused(false)
              reconnect()
            }}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Resume Live Stream
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Choose date/time range and search historical logs.
        </p>
        {searchInfo && <p className="text-xs text-green-700">{searchInfo}</p>}
        {searchError && <p className="text-xs text-red-700">{searchError}</p>}
      </div>

      {/* LogViewer takes up remaining height */}
      <div className="flex-1 min-h-0" style={{ height: 'calc(100vh - 140px)' }}>
        <LogViewer
          logs={logs}
          allLogs={allLogs}
          status={status}
          filter={filter}
          onFilterChange={(next) => setFilter((prev) => ({ ...prev, ...next }))}
          paused={paused}
          onPausedChange={setPaused}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          onClear={clearLogs}
          onReconnect={reconnect}
        />
      </div>
    </div>
  )
}
