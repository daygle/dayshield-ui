import React, { useCallback, useEffect, useState } from 'react'
import {
  getCloudflaredConfig,
  getCloudflaredStatus,
  restartCloudflared,
  updateCloudflaredConfig,
} from '../../api/cloudflared'
import type {
  CloudflaredConfig,
  CloudflaredIngressRule,
  CloudflaredStatus,
} from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'

const DEFAULT_INGRESS: CloudflaredIngressRule = {
  hostname: '',
  service: 'http://127.0.0.1:8080',
}

const DEFAULT_CONFIG: CloudflaredConfig = {
  enabled: false,
  tunnelName: '',
  tunnelToken: '',
  tunnelTokenConfigured: false,
  metricsAddress: '127.0.0.1:60123',
  logLevel: 'info',
  ingress: [],
}

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/

function statusBadge(status: CloudflaredStatus | null) {
  if (!status) return null

  const tone = status.running
    ? 'bg-green-100 text-green-700'
    : status.enabled
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-600'

  const label = status.running ? 'Running' : status.enabled ? 'Configured / stopped' : 'Disabled'

  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
}

function CloudflaredPageContent() {
  const [config, setConfig] = useState<CloudflaredConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<CloudflaredStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false)
  const { addToast } = useToast()

  const notifySuccess = useCallback((text: string) => addToast(text, 'success'), [addToast])
  const notifyError = useCallback((text: string) => addToast(text, 'error'), [addToast])

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([getCloudflaredConfig(), getCloudflaredStatus()])
      .then(([cfg, stat]) => {
        setConfig(cfg.data)
        setStatus(stat.data)
      })
      .catch((err: Error) => notifyError(`Failed to load Cloudflared data: ${err.message}`))
      .finally(() => setLoading(false))
  }, [notifyError])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const ingressValidation = React.useMemo(
    () =>
      config.ingress.map((rule) => {
        const hostname = rule.hostname.trim()
        const service = rule.service.trim()
        let hostnameError = ''
        let serviceError = ''

        if (!hostname) {
          hostnameError = 'Hostname is required.'
        } else if (!HOSTNAME_PATTERN.test(hostname)) {
          hostnameError = 'Hostname must be a valid domain name (example: app.example.com).'
        }

        if (!service) {
          serviceError = 'Service URL is required.'
        } else {
          try {
            const parsed = new URL(service)
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              serviceError = 'Service URL must start with http:// or https://.'
            }
          } catch {
            serviceError = 'Service URL must be a valid URL.'
          }
        }

        return { hostnameError, serviceError }
      }),
    [config.ingress],
  )

  const hasIngressErrors = ingressValidation.some((entry) => entry.hostnameError || entry.serviceError)
  const tunnelTokenHint = `${config.tunnelTokenConfigured ? 'A tunnel token is already stored. Leave blank to keep the existing token. ' : ''}Treat tunnel tokens as sensitive credentials.`

  const moveIngress = (index: number, direction: -1 | 1) => {
    setConfig((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.ingress.length) return current
      const nextIngress = [...current.ingress]
      const [rule] = nextIngress.splice(index, 1)
      nextIngress.splice(nextIndex, 0, rule)
      return { ...current, ingress: nextIngress }
    })
  }

  const handleSave = () => {
    if (hasIngressErrors) {
      notifyError('Fix invalid ingress hostname/service values before saving.')
      return
    }

    setSaving(true)
    updateCloudflaredConfig(config)
      .then((res) => {
        setConfig((current) => ({
          ...res.data,
          tunnelToken: current.tunnelToken,
        }))
        notifySuccess('Cloudflared configuration saved.')
        return getCloudflaredStatus()
      })
      .then((stat) => {
        setStatus(stat.data)
      })
      .catch((err: Error) => notifyError(`Save failed: ${err.message}`))
      .finally(() => setSaving(false))
  }

  const handleRestart = () => {
    setRestarting(true)
    restartCloudflared()
      .then(() => {
        notifySuccess('Cloudflared service restarted.')
        return getCloudflaredStatus()
      })
      .then((stat) => {
        setStatus(stat.data)
      })
      .catch((err: Error) => notifyError(`Restart failed: ${err.message}`))
      .finally(() => setRestarting(false))
  }

  const updateIngress = (index: number, next: CloudflaredIngressRule) => {
    setConfig((current) => ({
      ...current,
      ingress: current.ingress.map((rule, ruleIndex) => (ruleIndex === index ? next : rule)),
    }))
  }

  const addIngress = () => {
    setConfig((current) => ({ ...current, ingress: [...current.ingress, { ...DEFAULT_INGRESS }] }))
  }

  const removeIngress = (index: number) => {
    setConfig((current) => ({
      ...current,
      ingress: current.ingress.filter((_, ruleIndex) => ruleIndex !== index),
    }))
  }

  const toggleEnabled = () => {
    if (config.enabled && status?.running) {
      setDisableConfirmOpen(true)
      return
    }

    setConfig((current) => ({ ...current, enabled: !current.enabled }))
  }

  const busy = loading || saving

  return (
    <div className="space-y-6">
      <Card
        title="Cloudflared Tunnel"
        subtitle="Publish selected internal services through Cloudflare Tunnel without inbound port forwards."
        actions={statusBadge(status)}
      >
        {loading ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Service state</p>
              <p className="mt-1 text-sm text-gray-800">
                Active state: <span className="font-medium">{status?.activeState ?? 'unknown'}</span>
              </p>
              <p className="text-sm text-gray-800">
                Sub-state: <span className="font-medium">{status?.subState ?? 'unknown'}</span>
              </p>
              <p className="text-sm text-gray-800">
                Unit enabled: <span className="font-medium">{status?.unitEnabled ? 'Yes' : 'No'}</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Environment</p>
              <p className="mt-1 text-sm text-gray-800">
                Binary present: <span className="font-medium">{status?.binaryPresent ? 'Yes' : 'No'}</span>
              </p>
              <p className="text-sm text-gray-800">
                Version: <span className="font-medium">{status?.version ?? 'Unavailable'}</span>
              </p>
              <p className="text-sm text-gray-800">
                Tunnel routes: <span className="font-medium">{status?.ingressCount ?? 0}</span>
              </p>
            </div>
            {status?.lastError && (
              <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {status.lastError}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Configuration"
        subtitle="Store the tunnel token and define which hostnames should map to which internal services."
        actions={
          <Button
            variant={config.enabled ? 'danger' : 'primary'}
            aria-label={config.enabled ? 'Disable Cloudflared tunnel' : 'Enable Cloudflared tunnel'}
            disabled={busy}
            onClick={toggleEnabled}
          >
            {config.enabled ? 'Disable tunnel' : 'Enable tunnel'}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            id="cloudflared-name"
            label="Tunnel Name"
            aria-label="Cloudflared tunnel name"
            value={config.tunnelName}
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, tunnelName: e.target.value }))}
          />
          <FormField
            id="cloudflared-log-level"
            label="Log Level"
            as="select"
            aria-label="Cloudflared log level"
            value={config.logLevel}
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, logLevel: e.target.value }))}
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </FormField>
          <FormField
            id="cloudflared-token"
            label="Tunnel Token"
            className="md:col-span-2"
            type="password"
            placeholder={config.tunnelTokenConfigured ? 'Stored token present. Enter a new token to replace it.' : 'Paste the Cloudflare tunnel token'}
            value={config.tunnelToken}
            aria-label="Cloudflared tunnel token"
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, tunnelToken: e.target.value }))}
            hint={tunnelTokenHint}
          />
          <FormField
            id="cloudflared-metrics"
            label="Metrics Address"
            aria-label="Cloudflared metrics address"
            value={config.metricsAddress}
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, metricsAddress: e.target.value }))}
            hint="Example: 127.0.0.1:60123"
          />
        </div>
      </Card>

      <Card
        title="Ingress Rules"
        subtitle="Each rule maps a public hostname to an internal HTTP or HTTPS service."
        actions={
          <Button size="sm" disabled={busy} onClick={addIngress}>
            + Add Route
          </Button>
        }
      >
        <div className="space-y-4">
          {hasIngressErrors && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              One or more ingress rules are invalid. Fix the highlighted fields before saving.
            </p>
          )}
          <p id="cloudflared-ingress-keyboard-hint" className="text-xs text-gray-500">
            Reorder routes with the ↑/↓ buttons, or focus a rule and use Alt+↑ / Alt+↓.
          </p>
          {config.ingress.length === 0 ? (
            <p className="text-sm text-gray-400">No public hostnames defined yet.</p>
          ) : (
            config.ingress.map((rule, index) => (
              <div
                key={`${rule.hostname}-${index}`}
                className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_1fr_auto]"
                tabIndex={0}
                aria-describedby="cloudflared-ingress-keyboard-hint"
                onKeyDown={(e) => {
                  if (e.altKey && e.key === 'ArrowUp') {
                    e.preventDefault()
                    moveIngress(index, -1)
                  }
                  if (e.altKey && e.key === 'ArrowDown') {
                    e.preventDefault()
                    moveIngress(index, 1)
                  }
                }}
                aria-label={`Ingress rule ${index + 1}`}
              >
                <FormField
                  id={`cloudflared-host-${index}`}
                  label="Hostname"
                  placeholder="app.example.com"
                  aria-label={`Ingress rule ${index + 1} hostname`}
                  error={ingressValidation[index]?.hostnameError || undefined}
                  value={rule.hostname}
                  disabled={busy}
                  onChange={(e) => updateIngress(index, { ...rule, hostname: e.target.value })}
                />
                <FormField
                  id={`cloudflared-service-${index}`}
                  label="Service URL"
                  placeholder="http://127.0.0.1:8443"
                  aria-label={`Ingress rule ${index + 1} service URL`}
                  error={ingressValidation[index]?.serviceError || undefined}
                  value={rule.service}
                  disabled={busy}
                  onChange={(e) => updateIngress(index, { ...rule, service: e.target.value })}
                />
                <div className="flex items-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Move ingress rule ${index + 1} up`}
                    disabled={busy || index === 0}
                    onClick={() => moveIngress(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Move ingress rule ${index + 1} down`}
                    disabled={busy || index === config.ingress.length - 1}
                    onClick={() => moveIngress(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button variant="danger" size="sm" aria-label={`Remove ingress rule ${index + 1}`} disabled={busy} onClick={() => removeIngress(index)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="secondary" loading={restarting} onClick={handleRestart}>
          Restart Service
        </Button>
        <Button aria-label="Save Cloudflared configuration" loading={saving} disabled={busy} onClick={handleSave}>
          Save Configuration
        </Button>
      </div>

      <p className="text-xs text-gray-400">
        Cloudflared log output is streamed in real-time on the{' '}
        <a href="/live-logs" className="underline hover:text-gray-600">Live Logs</a> page
        - filter by source <span className="font-mono">cloudflared</span>.
      </p>

      <Modal
        open={disableConfirmOpen}
        title="Disable running tunnel?"
        onClose={() => setDisableConfirmOpen(false)}
        onConfirm={() => {
          setDisableConfirmOpen(false)
          setConfig((current) => ({ ...current, enabled: false }))
        }}
        confirmLabel="Disable Tunnel"
        confirmVariant="danger"
      >
        <p className="text-sm text-gray-700">
          The Cloudflared tunnel is currently running. Disabling it will stop publishing your
          ingress routes after saving this configuration.
        </p>
      </Modal>
    </div>
  )
}

export default function CloudflaredPage() {
  return (
    <ErrorBoundary fallbackMessage="The Cloudflared page failed to render. Please refresh and try again.">
      <CloudflaredPageContent />
    </ErrorBoundary>
  )
}
