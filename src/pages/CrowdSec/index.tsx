import { useEffect, useState } from 'react'
import {
  getCrowdSecStatus,
  getCrowdSecDecisions,
  getCrowdSecAlerts,
  deleteCrowdSecDecision,
} from '../../api/crowdsec'
import type { CrowdSecStatus, CrowdSecDecision, CrowdSecAlert } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'

type DecisionRow = CrowdSecDecision & Record<string, unknown>
type AlertRow = CrowdSecAlert & Record<string, unknown>

const decisionTypeBadge = (type: CrowdSecDecision['type']) => {
  const map: Record<CrowdSecDecision['type'], string> = {
    ban: 'bg-red-100 text-red-700',
    captcha: 'bg-yellow-100 text-yellow-700',
    throttle: 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${map[type]}`}>
      {type}
    </span>
  )
}

const decisionColumns: Column<DecisionRow>[] = [
  { key: 'value', header: 'IP / Range', render: (row) => <span className="font-mono text-xs">{row.value as string}</span> },
  { key: 'type', header: 'Type', render: (row) => decisionTypeBadge(row.type as CrowdSecDecision['type']) },
  { key: 'origin', header: 'Origin' },
  { key: 'duration', header: 'Duration' },
  { key: 'createdAt', header: 'Created', render: (row) => new Date(row.createdAt as string).toLocaleString() },
]

const alertColumns: Column<AlertRow>[] = [
  { key: 'createdAt', header: 'Time', render: (row) => new Date(row.createdAt as string).toLocaleString() },
  { key: 'scenario', header: 'Scenario' },
  { key: 'sourceIp', header: 'Source IP', render: (row) => <span className="font-mono text-xs">{row.sourceIp as string}</span> },
  { key: 'sourceCN', header: 'Country' },
  { key: 'decisions', header: 'Decisions' },
]

export default function CrowdSec() {
  const [status, setStatus] = useState<CrowdSecStatus | null>(null)
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getCrowdSecStatus(), getCrowdSecDecisions(), getCrowdSecAlerts()])
      .then(([st, dec, alt]) => {
        setStatus(st.data)
        setDecisions(dec.data as DecisionRow[])
        setAlerts(alt.data as AlertRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const handleDeleteDecision = () => {
    if (deleteId === null) return
    setDeleting(true)
    deleteCrowdSecDecision(deleteId)
      .then(() => {
        setDeleteId(null)
        getCrowdSecDecisions().then((r) => setDecisions(r.data as DecisionRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false))
  }

  const decisionColumnsWithActions: Column<DecisionRow>[] = [
    ...decisionColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-20 text-right',
      render: (row) => (
        <Button variant="danger" size="sm" onClick={() => setDeleteId(row.id as number)}>
          Delete
        </Button>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        Loading CrowdSec data…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Status */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Status', value: status.running ? 'Running' : 'Stopped', color: status.running ? 'text-green-600' : 'text-red-600' },
            { label: 'Version', value: status.version, color: 'text-gray-900' },
            { label: 'Active Decisions', value: String(status.decisions), color: 'text-gray-900' },
            { label: 'Alerts', value: String(status.alerts), color: 'text-gray-900' },
            { label: 'Bouncers', value: String(status.bouncers), color: 'text-gray-900' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
              <p className="text-sm text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Decisions */}
      <Card
        title="Active Decisions"
        subtitle="IP bans, captchas and throttles enforced by CrowdSec"
      >
        <Table
          columns={decisionColumnsWithActions}
          data={decisions}
          keyField="id"
          loading={false}
          emptyMessage="No active decisions."
        />
      </Card>

      {/* Alerts */}
      <Card
        title="Recent Alerts"
        subtitle="Attack scenarios detected by CrowdSec"
      >
        <Table
          columns={alertColumns}
          data={alerts}
          keyField="id"
          loading={false}
          emptyMessage="No alerts."
        />
      </Card>

      {/* Delete Decision Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete Decision"
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteDecision}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Remove this decision? The affected IP will no longer be blocked.
        </p>
      </Modal>
    </div>
  )
}
