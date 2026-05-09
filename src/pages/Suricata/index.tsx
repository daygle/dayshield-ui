import { useEffect, useState } from 'react'
import {
  getSuricataConfig,
  updateSuricataConfig,
  getSuricataRulesets,
  updateSuricataRuleset,
  getSuricataAlerts,
} from '../../api/suricata'
import type { SuricataConfig, SuricataRuleset, SuricataAlert, SuricataSeverity } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'

type RulesetRow = SuricataRuleset & Record<string, unknown>
type AlertRow = SuricataAlert & Record<string, unknown>

const severityBadge = (severity: SuricataSeverity) => {
  const map: Record<SuricataSeverity, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-orange-100 text-orange-700',
    low: 'bg-yellow-100 text-yellow-700',
    informational: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[severity]}`}>
      {severity}
    </span>
  )
}

const actionBadge = (action: 'alert' | 'drop') => (
  <span
    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
      action === 'drop' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
    }`}
  >
    {action}
  </span>
)

export default function Suricata() {
  const [config, setConfig] = useState<SuricataConfig | null>(null)
  const [rulesets, setRulesets] = useState<RulesetRow[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getSuricataConfig(), getSuricataRulesets(), getSuricataAlerts()])
      .then(([cfg, rs, al]) => {
        setConfig(cfg.data)
        setRulesets(rs.data as RulesetRow[])
        setAlerts(al.data as AlertRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const handleToggleEnabled = () => {
    if (!config) return
    updateSuricataConfig({ enabled: !config.enabled })
      .then((res) => setConfig(res.data))
      .catch((err: Error) => setError(err.message))
  }

  const handleToggleMode = () => {
    if (!config) return
    updateSuricataConfig({ mode: config.mode === 'ids' ? 'ips' : 'ids' })
      .then((res) => setConfig(res.data))
      .catch((err: Error) => setError(err.message))
  }

  const handleToggleRuleset = (id: number, enabled: boolean) => {
    setTogglingId(id)
    updateSuricataRuleset(id, { enabled: !enabled })
      .then((res) => {
        setRulesets((prev) =>
          prev.map((r) => (r.id === id ? ({ ...r, ...res.data } as RulesetRow) : r)),
        )
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setTogglingId(null))
  }

  const rulesetColumns: Column<RulesetRow>[] = [
    { key: 'name', header: 'Ruleset' },
    { key: 'source', header: 'Source' },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      render: (row) =>
        row.lastUpdated ? new Date(row.lastUpdated as string).toLocaleDateString() : '—',
    },
    {
      key: 'enabled',
      header: 'Enabled',
      render: (row) => (
        <Button
          variant={row.enabled ? 'primary' : 'secondary'}
          size="sm"
          loading={togglingId === (row.id as number)}
          onClick={() => handleToggleRuleset(row.id as number, row.enabled as boolean)}
        >
          {row.enabled ? 'Enabled' : 'Disabled'}
        </Button>
      ),
    },
  ]

  const alertColumns: Column<AlertRow>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (row) => new Date(row.timestamp as string).toLocaleString(),
    },
    { key: 'srcIp', header: 'Src IP' },
    { key: 'dstIp', header: 'Dst IP' },
    { key: 'protocol', header: 'Proto' },
    { key: 'signature', header: 'Signature' },
    { key: 'category', header: 'Category' },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => severityBadge(row.severity as SuricataSeverity),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => actionBadge(row.action as 'alert' | 'drop'),
    },
  ]

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Status card */}
      {config && (
        <Card
          title="Suricata IDS/IPS"
          subtitle="Network threat detection and prevention"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant={config.mode === 'ips' ? 'danger' : 'secondary'}
                size="sm"
                onClick={handleToggleMode}
              >
                Mode: {config.mode.toUpperCase()}
              </Button>
              <Button
                variant={config.enabled ? 'danger' : 'primary'}
                size="sm"
                onClick={handleToggleEnabled}
              >
                {config.enabled ? 'Stop' : 'Start'}
              </Button>
            </div>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className={`font-medium ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config.enabled ? 'Running' : 'Stopped'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Mode</dt>
              <dd className="font-medium text-gray-800 uppercase">{config.mode}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Interfaces</dt>
              <dd className="font-medium text-gray-800">{config.interfaces.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Home Networks</dt>
              <dd className="font-medium text-gray-800 text-xs">
                {config.homeNet.join(', ') || '—'}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Rulesets */}
      <Card title="Rulesets" subtitle="Enable or disable individual rule sources">
        <Table
          columns={rulesetColumns}
          data={rulesets}
          keyField="id"
          loading={loading}
          emptyMessage="No rulesets configured."
        />
      </Card>

      {/* Alerts */}
      <Card
        title="Recent Alerts"
        subtitle="Latest 100 IDS/IPS events"
        actions={
          <Button variant="secondary" size="sm" onClick={loadAll}>
            Refresh
          </Button>
        }
      >
        <Table
          columns={alertColumns}
          data={alerts}
          keyField="id"
          loading={loading}
          emptyMessage="No alerts recorded."
        />
      </Card>
    </div>
  )
}
