import React, { useEffect, useState } from 'react'
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
import ErrorBoundary from '../../components/ErrorBoundary'
import { useToast } from '../../context/ToastContext'
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext'

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

export default function CrowdSec() {
  return (
    <ErrorBoundary fallbackMessage="The CrowdSec page failed to render. Please refresh and try again.">
      <CrowdSecContent />
    </ErrorBoundary>
  )
}

const decisionColumns = (
  formatDateTime: (value?: Date | string | number | null) => string,
): Column<DecisionRow>[] => [
  { key: 'value', header: 'IP / Range', render: (row) => <span className="font-mono text-xs">{row.value as string}</span> },
  { key: 'type', header: 'Type', render: (row) => decisionTypeBadge(row.type as CrowdSecDecision['type']) },
  { key: 'origin', header: 'Origin' },
  { key: 'duration', header: 'Duration' },
  { key: 'createdAt', header: 'Created', render: (row) => formatDateTime(row.createdAt as string) },
]

function CrowdSecContent() {
  const { formatDateTime } = useDisplayPreferences()
  const [status, setStatus] = useState<CrowdSecStatus | null>(null)
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [enableConfirmOpen, setEnableConfirmOpen] = useState(false)
  const [configForm, setConfigForm] = useState<Partial<CrowdSecStatus>>({})
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  const loadAll = () => {
    setLoading(true)
    Promise.all([getCrowdSecConfig(), getCrowdSecDecisions()])
      .then(([st, dec]) => {
        setStatus(st.data)
        setConfigForm(st.data)
        setDecisions(dec.data as DecisionRow[])
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const validation = React.useMemo(() => {
    const lapiUrl = (configForm.lapi_url ?? '').trim()
    const updateInterval = Number(configForm.update_interval)
    const banAlias = (configForm.ban_alias_name ?? '').trim()
    let lapiUrlError = ''
    let updateIntervalError = ''
    let banAliasError = ''

    if (!lapiUrl) {
      lapiUrlError = 'LAPI URL is required.'
    } else {
      try {
        const parsed = new URL(lapiUrl)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          lapiUrlError = 'LAPI URL must use http:// or https://.'
        }
      } catch {
        lapiUrlError = 'LAPI URL must be a valid URL.'
      }
    }

    if (!Number.isFinite(updateInterval) || updateInterval < 1) {
      updateIntervalError = 'Update interval must be at least 1 second.'
    }

    if (!banAlias) {
      banAliasError = 'Ban alias name is required.'
    }

    const errors = [lapiUrlError, updateIntervalError, banAliasError].filter(Boolean)

    return {
      errors,
      lapiUrlError,
      updateIntervalError,
      banAliasError,
      isValid: errors.length === 0,
    }
  }, [configForm.ban_alias_name, configForm.lapi_url, configForm.update_interval])

  const saveConfig = () => {
    setSaving(true)
    updateCrowdSecConfig({
      enabled: !!configForm.enabled,
      lapi_url: (configForm.lapi_url ?? '').trim(),
      api_key: configForm.api_key ?? '',
      update_interval: Number(configForm.update_interval),
      ban_alias_name: (configForm.ban_alias_name ?? '').trim(),
    })
      .then((res) => {
        setStatus(res.data)
        setConfigForm(res.data)
        setConfigModalOpen(false)
        setError(null)
        setSuccess('CrowdSec configuration saved successfully.')
        addToast('CrowdSec configuration saved successfully.', 'success')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  const handleSaveConfig = () => {
    if (!validation.isValid) {
      setError(validation.errors[0] ?? 'Please fix the CrowdSec settings form errors.')
      return
    }

    const enableRequested = Boolean(configForm.enabled)
    if (enableRequested && !status?.enabled) {
      setEnableConfirmOpen(true)
      return
    }

    saveConfig()
  }

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <div className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
        <div className="h-56 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700" role="status" aria-live="polite">
          {success}
        </div>
      )}

      {/* Status */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Status', value: status.enabled ? 'Enabled' : 'Disabled', color: status.enabled ? 'text-green-600' : 'text-gray-500' },
            { label: 'LAPI URL', value: status.lapi_url || '-', color: 'text-gray-900' },
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
            <button
              onClick={() => setConfigModalOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              title="Edit settings"
              aria-label="Edit CrowdSec settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
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
              <dd className="font-medium text-gray-800 break-all">{status.lapi_url || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Update Interval</dt>
              <dd className="font-medium text-gray-800">{status.update_interval}s</dd>
            </div>
            <div>
              <dt className="text-gray-500">Ban Alias</dt>
              <dd className="font-medium text-gray-800 font-mono">{status.ban_alias_name || '-'}</dd>
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
          columns={decisionColumns(formatDateTime)}
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
              aria-label="Enable CrowdSec integration"
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
            aria-label="CrowdSec local API URL"
            error={validation.lapiUrlError || undefined}
            value={configForm.lapi_url ?? ''}
            onChange={(e) => setConfigForm((f) => ({ ...f, lapi_url: e.target.value }))}
          />

          <FormField
            id="crowdsec-api-key"
            label="API Key"
            placeholder="Paste CrowdSec API key"
            aria-label="CrowdSec API key"
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
                aria-label="CrowdSec decision update interval seconds"
                error={validation.updateIntervalError || undefined}
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
                aria-label="CrowdSec ban alias name"
                error={validation.banAliasError || undefined}
                value={configForm.ban_alias_name ?? ''}
                onChange={(e) => setConfigForm((f) => ({ ...f, ban_alias_name: e.target.value }))}
              />
          </div>
        </div>
      </Modal>

      <Modal
        open={enableConfirmOpen}
        title="Enable CrowdSec integration?"
        onClose={() => setEnableConfirmOpen(false)}
        onConfirm={() => {
          setEnableConfirmOpen(false)
          saveConfig()
        }}
        confirmLabel="Enable and Save"
        size="md"
      >
        <p className="text-sm text-gray-700">
          Enabling CrowdSec starts decision synchronization with the configured LAPI endpoint.
          Continue with the current configuration?
        </p>
      </Modal>
    </div>
  )
}
