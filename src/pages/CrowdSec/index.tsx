import { useEffect, useState } from 'react'
import {
  getCrowdSecConfig,
  updateCrowdSecConfig,
  getCrowdSecDecisions,
} from '../../api/crowdsec'
import type { CrowdSecStatus, CrowdSecDecision } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type DecisionRow = CrowdSecDecision & Record<string, unknown>

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

export default function CrowdSec() {
  const [status, setStatus] = useState<CrowdSecStatus | null>(null)
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configForm, setConfigForm] = useState<Partial<CrowdSecStatus>>({})
  const [saving, setSaving] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getCrowdSecConfig(), getCrowdSecDecisions()])
      .then(([st, dec]) => {
        setStatus(st.data)
        setConfigForm(st.data)
        setDecisions(dec.data as DecisionRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const handleSaveConfig = () => {
    if (!configForm.lapi_url || !configForm.update_interval || !configForm.ban_alias_name) {
      setError('LAPI URL, update interval, and alias name are required.')
      return
    }

    setSaving(true)
    updateCrowdSecConfig({
      enabled: !!configForm.enabled,
      lapi_url: configForm.lapi_url,
      api_key: configForm.api_key ?? '',
      update_interval: Number(configForm.update_interval) || 60,
      ban_alias_name: configForm.ban_alias_name,
    })
      .then((res) => {
        setStatus(res.data)
        setConfigForm(res.data)
        setConfigModalOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Status', value: status.enabled ? 'Enabled' : 'Disabled', color: status.enabled ? 'text-green-600' : 'text-gray-500' },
            { label: 'LAPI URL', value: status.lapi_url || '—', color: 'text-gray-900' },
            { label: 'Decision Poll Interval', value: `${status.update_interval || 0}s`, color: 'text-gray-900' },
            { label: 'Active Decisions', value: String(decisions.length), color: 'text-gray-900' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
              <p className="text-sm text-gray-500 mb-1">{label}</p>
              <p className={`text-base font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {status && (
        <Card
          title="CrowdSec Settings"
          subtitle="Configure CrowdSec Local API integration and decision synchronization"
          actions={
            <Button size="sm" onClick={() => setConfigModalOpen(true)}>
              Edit Settings
            </Button>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Enabled</dt>
              <dd className={`font-medium ${status.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {status.enabled ? 'Yes' : 'No'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">LAPI URL</dt>
              <dd className="font-medium text-gray-800 break-all">{status.lapi_url || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Update Interval</dt>
              <dd className="font-medium text-gray-800">{status.update_interval}s</dd>
            </div>
            <div>
              <dt className="text-gray-500">Ban Alias</dt>
              <dd className="font-medium text-gray-800 font-mono">{status.ban_alias_name || '—'}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Decisions */}
      <Card
        title="Active Decisions"
        subtitle="IP bans, captchas and throttles enforced by CrowdSec"
      >
        <Table
          columns={decisionColumns}
          data={decisions}
          keyField="id"
          loading={false}
          emptyMessage="No active decisions."
        />
      </Card>

      {/* Edit CrowdSec Config Modal */}
      <Modal
        open={configModalOpen}
        title="Edit CrowdSec Settings"
        onClose={() => setConfigModalOpen(false)}
        onConfirm={handleSaveConfig}
        confirmLabel="Save"
        loading={saving}
        size="lg"
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={!!configForm.enabled}
              onChange={(e) => setConfigForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">Enable CrowdSec integration</span>
          </label>

          <FormField
            id="crowdsec-lapi-url"
            label="LAPI URL"
            required
            placeholder="http://127.0.0.1:8080"
            value={configForm.lapi_url ?? ''}
            onChange={(e) => setConfigForm((f) => ({ ...f, lapi_url: e.target.value }))}
          />

          <FormField
            id="crowdsec-api-key"
            label="API Key"
            placeholder="Paste CrowdSec API key"
            value={configForm.api_key ?? ''}
            onChange={(e) => setConfigForm((f) => ({ ...f, api_key: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="crowdsec-update-interval"
              label="Update Interval (seconds)"
              type="number"
              min={1}
              required
              value={String(configForm.update_interval ?? 60)}
              onChange={(e) =>
                setConfigForm((f) => ({
                  ...f,
                  update_interval: Math.max(1, Number(e.target.value) || 60),
                }))
              }
            />

            <FormField
              id="crowdsec-ban-alias-name"
              label="Ban Alias Name"
              required
              placeholder="crowdsec_bans"
              value={configForm.ban_alias_name ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, ban_alias_name: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
