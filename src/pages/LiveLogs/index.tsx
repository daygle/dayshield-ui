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
  } = useLiveLogs()

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
