import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAiThreats,
  getAiThreatById,
  getAiBlockedEntries,
  unblockAiIp,
} from '../../api/ai'
import type { ThreatEvent, BlockedEntry } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { type Column } from '../../components/Table'
import Modal from '../../components/Modal'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useToast } from '../../context/ToastContext'

type ThreatRow = ThreatEvent & Record<string, unknown>
type BlockedRow = BlockedEntry & Record<string, unknown>

function formatLocalDateTime(unixSeconds: number | null): string {
  if (unixSeconds === null || !Number.isFinite(unixSeconds)) return '—'
  const date = new Date(unixSeconds * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

function formatRelativeFromUnix(unixSeconds: number | null): string {
  if (unixSeconds === null || !Number.isFinite(unixSeconds)) return 'Permanent'
  const now = Date.now()
  const target = unixSeconds * 1000
  const diffMs = target - now
  const absMs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const value =
    absMs >= day
      ? Math.round(absMs / day)
      : absMs >= hour
        ? Math.round(absMs / hour)
        : absMs >= minute
          ? Math.round(absMs / minute)
          : Math.max(1, Math.round(absMs / 1000))
  const unit =
    absMs >= day
      ? 'day'
      : absMs >= hour
        ? 'hour'
        : absMs >= minute
          ? 'minute'
          : 'second'
  const suffix = value === 1 ? unit : `${unit}s`
  return diffMs >= 0 ? `in ${value} ${suffix}` : `${value} ${suffix} ago`
}

function formatRelativeFromMs(timestampMs: number | null): string {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return '—'
  return formatRelativeFromUnix(Math.floor(timestampMs / 1000))
}

function riskBadge(score: number) {
  const pct = Math.round(score * 100)
  const color =
    score >= 0.9
      ? 'bg-red-100 text-red-700'
      : score >= 0.7
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700'
  const barColor =
    score >= 0.9
      ? 'bg-red-500'
      : score >= 0.7
        ? 'bg-amber-500'
        : 'bg-green-500'

  return (
    <div className="min-w-24">
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${color}`}>{pct}%</span>
      <div className="mt-1 h-1.5 w-20 rounded bg-gray-200">
        <div className={`h-1.5 rounded ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  )
}

function yesNoBadge(flag: boolean, yesText = 'Yes', noText = 'No', yesClass = 'bg-green-100 text-green-700') {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
        flag ? yesClass : 'bg-gray-100 text-gray-600'
      }`}
    >
      {flag ? yesText : noText}
    </span>
  )
}

function AIThreatsContent() {
  const { addToast } = useToast()
  const [threats, setThreats] = useState<ThreatRow[]>([])
  const [blockedEntries, setBlockedEntries] = useState<BlockedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [selectedThreat, setSelectedThreat] = useState<ThreatEvent | null>(null)
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null)

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([getAiThreats(100), getAiBlockedEntries()])
      .then(([threatRes, blockedRes]) => {
        setThreats(threatRes.data as ThreatRow[])
        setBlockedEntries(blockedRes.data as BlockedRow[])
        setError(null)
        setLastUpdatedAt(Date.now())
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
    const timer = window.setInterval(loadAll, 30_000)
    return () => window.clearInterval(timer)
  }, [loadAll])

  const handleOpenThreat = (row: ThreatRow) => {
    const id = String(row.id)
    setSelectedThreat(row as ThreatEvent)
    getAiThreatById(id)
      .then((res) => setSelectedThreat(res.data))
      .catch(() => undefined)
  }

  const handleUnblock = async (ip: string) => {
    setUnblockingIp(ip)
    try {
      const res = await unblockAiIp(ip)
      if (res.data.unblocked) {
        addToast(`Unblocked ${res.data.ip}`, 'success')
      } else {
        addToast(`${res.data.ip} was not blocked`, 'warning')
      }
      loadAll()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to unblock IP', 'error')
    } finally {
      setUnblockingIp(null)
    }
  }

  const threatColumns: Column<ThreatRow>[] = useMemo(
    () => [
      {
        key: 'timestamp',
        header: 'Timestamp',
        render: (row) => (
          <span title={new Date((row.timestamp as number) * 1000).toLocaleString()}>
            {formatLocalDateTime(row.timestamp as number)}
          </span>
        ),
      },
      { key: 'src_ip', header: 'Src IP', render: (row) => <span className="font-mono">{String(row.src_ip)}</span> },
      { key: 'dst_ip', header: 'Dst IP', render: (row) => <span className="font-mono">{String(row.dst_ip)}</span> },
      { key: 'protocol', header: 'Protocol', render: (row) => <span className="uppercase">{String(row.protocol)}</span> },
      { key: 'risk_score', header: 'Risk Score', render: (row) => riskBadge(Number(row.risk_score)) },
      {
        key: 'blocked',
        header: 'Blocked',
        render: (row) => yesNoBadge(Boolean(row.blocked), 'Blocked', 'No', 'bg-red-100 text-red-700'),
      },
      {
        key: 'escalated',
        header: 'Escalated',
        render: (row) => yesNoBadge(Boolean(row.escalated), 'Escalated', 'No', 'bg-amber-100 text-amber-700'),
      },
      {
        key: 'quarantine',
        header: 'Quarantine',
        render: (row) => yesNoBadge(Boolean(row.quarantine), 'Quarantine', 'No', 'bg-purple-100 text-purple-700'),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) =>
          row.blocked && !row.manually_unblocked ? (
            <Button
              size="sm"
              variant="secondary"
              loading={unblockingIp === String(row.src_ip)}
              onClick={(e) => {
                e.stopPropagation()
                void handleUnblock(String(row.src_ip))
              }}
            >
              Unblock
            </Button>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
    ],
    [unblockingIp],
  )

  const blockedColumns: Column<BlockedRow>[] = useMemo(
    () => [
      { key: 'ip', header: 'IP', render: (row) => <span className="font-mono">{String(row.ip)}</span> },
      {
        key: 'added_at',
        header: 'Added',
        render: (row) => (
          <span title={formatLocalDateTime(Number(row.added_at))}>
            {formatRelativeFromUnix(Number(row.added_at))}
          </span>
        ),
      },
      {
        key: 'expires_at',
        header: 'Expires',
        render: (row) =>
          row.expires_at === null ? (
            <span className="text-gray-600">Permanent</span>
          ) : (
            <span title={formatLocalDateTime(Number(row.expires_at))}>
              {formatRelativeFromUnix(Number(row.expires_at))}
            </span>
          ),
      },
      {
        key: 'quarantine',
        header: 'Quarantine',
        render: (row) => yesNoBadge(Boolean(row.quarantine), 'Quarantine', 'No', 'bg-purple-100 text-purple-700'),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <Button
            size="sm"
            variant="secondary"
            loading={unblockingIp === String(row.ip)}
            onClick={(e) => {
              e.stopPropagation()
              void handleUnblock(String(row.ip))
            }}
          >
            Unblock
          </Button>
        ),
      },
    ],
    [unblockingIp],
  )

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AI Threat Engine</h1>
          <p className="mt-1 text-sm text-slate-500">
            Recent AI-detected threats and currently active firewall blocks.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Auto-refresh: 30s</p>
          <p className="text-xs text-gray-500">
            Last updated:{' '}
            <span className="font-medium text-gray-700">{formatRelativeFromMs(lastUpdatedAt)}</span>
          </p>
        </div>
      </div>

      <Card
        title="AI Threats"
        subtitle="Latest 100 threat events (newest first)"
        actions={
          <Button size="sm" variant="secondary" onClick={loadAll}>
            Refresh
          </Button>
        }
      >
        {!loading && threats.length === 0 && (
          <div className="mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            <div className="text-2xl mb-1" aria-hidden="true">🛡️</div>
            No AI threat events detected yet.
          </div>
        )}
        <Table
          columns={threatColumns}
          data={threats}
          keyField="id"
          loading={loading}
          emptyMessage="No AI threat events."
          onRowClick={handleOpenThreat}
        />
      </Card>

      <Card title="Active Blocks" subtitle="IPs currently blocked by the AI threat engine">
        {!loading && blockedEntries.length === 0 && (
          <div className="mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            <div className="text-2xl mb-1" aria-hidden="true">✅</div>
            No active AI blocks right now.
          </div>
        )}
        <Table
          columns={blockedColumns}
          data={blockedEntries}
          keyField="ip"
          loading={loading}
          emptyMessage="No active blocks."
        />
      </Card>

      <Modal
        open={Boolean(selectedThreat)}
        title="Threat Event Details"
        onClose={() => setSelectedThreat(null)}
        size="lg"
      >
        {selectedThreat && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Detail label="ID" value={<span className="font-mono break-all">{selectedThreat.id}</span>} />
              <Detail label="Timestamp" value={formatLocalDateTime(selectedThreat.timestamp)} />
              <Detail label="Source IP" value={<span className="font-mono">{selectedThreat.src_ip}</span>} />
              <Detail label="Destination IP" value={<span className="font-mono">{selectedThreat.dst_ip}</span>} />
              <Detail label="Source Port" value={selectedThreat.src_port === null ? '—' : String(selectedThreat.src_port)} />
              <Detail label="Destination Port" value={selectedThreat.dst_port === null ? '—' : String(selectedThreat.dst_port)} />
              <Detail label="Protocol" value={selectedThreat.protocol} />
              <Detail label="Risk Score" value={`${Math.round(selectedThreat.risk_score * 100)}%`} />
              <Detail label="Blocked" value={selectedThreat.blocked ? 'Yes' : 'No'} />
              <Detail label="Block Expires" value={selectedThreat.block_expires_at === null ? 'Permanent' : formatLocalDateTime(selectedThreat.block_expires_at)} />
              <Detail label="Escalated" value={selectedThreat.escalated ? 'Yes' : 'No'} />
              <Detail label="Quarantine" value={selectedThreat.quarantine ? 'Yes' : 'No'} />
              <Detail label="Manually Unblocked" value={selectedThreat.manually_unblocked ? 'Yes' : 'No'} />
            </dl>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Reasons</p>
              {selectedThreat.reasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-gray-700">
                  {selectedThreat.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No reasons provided.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  )
}

export default function AIThreats() {
  return (
    <ErrorBoundary fallbackMessage="The AI Threats page failed to render. Please refresh and try again.">
      <AIThreatsContent />
    </ErrorBoundary>
  )
}
