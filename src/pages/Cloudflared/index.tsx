import { useCallback, useEffect, useState } from 'react'
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

type ToastKind = 'success' | 'error'

interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

let toastSeq = 0

function Toast({ messages }: { messages: ToastMessage[] }) {
  if (messages.length === 0) return null
  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
      {messages.map((message) => (
        <div
          key={message.id}
          role="alert"
          className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            message.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {message.text}
        </div>
      ))}
    </div>
  )
}

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

export default function CloudflaredPage() {
  const [config, setConfig] = useState<CloudflaredConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<CloudflaredStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((kind: ToastKind, text: string) => {
    const id = toastSeq++
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4000)
  }, [])

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([getCloudflaredConfig(), getCloudflaredStatus()])
      .then(([cfg, stat]) => {
        setConfig(cfg.data)
        setStatus(stat.data)
      })
      .catch((err: Error) => addToast('error', `Failed to load Cloudflared data: ${err.message}`))
      .finally(() => setLoading(false))
  }, [addToast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleSave = () => {
    setSaving(true)
    updateCloudflaredConfig(config)
      .then((res) => {
        setConfig((current) => ({
          ...res.data,
          tunnelToken: current.tunnelToken,
        }))
        addToast('success', 'Cloudflared configuration saved.')
        return getCloudflaredStatus()
      })
      .then((stat) => {
        setStatus(stat.data)
      })
      .catch((err: Error) => addToast('error', `Save failed: ${err.message}`))
      .finally(() => setSaving(false))
  }

  const handleRestart = () => {
    setRestarting(true)
    restartCloudflared()
      .then(() => {
        addToast('success', 'Cloudflared service restarted.')
        return getCloudflaredStatus()
      })
      .then((stat) => {
        setStatus(stat.data)
      })
      .catch((err: Error) => addToast('error', `Restart failed: ${err.message}`))
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

  const busy = loading || saving

  return (
    <div className="space-y-6">
      <Card
        title="Cloudflared Tunnel"
        subtitle="Publish selected internal services through Cloudflare Tunnel without inbound port forwards."
        actions={statusBadge(status)}
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
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
          <Button variant={config.enabled ? 'danger' : 'primary'} disabled={busy} onClick={() => setConfig((current) => ({ ...current, enabled: !current.enabled }))}>
            {config.enabled ? 'Disable tunnel' : 'Enable tunnel'}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            id="cloudflared-name"
            label="Tunnel Name"
            value={config.tunnelName}
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, tunnelName: e.target.value }))}
          />
          <FormField
            id="cloudflared-log-level"
            label="Log Level"
            as="select"
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
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, tunnelToken: e.target.value }))}
            hint={config.tunnelTokenConfigured ? 'A tunnel token is already stored. Leave blank to keep the existing token.' : undefined}
          />
          <FormField
            id="cloudflared-metrics"
            label="Metrics Address"
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
          {config.ingress.length === 0 ? (
            <p className="text-sm text-gray-400">No public hostnames defined yet.</p>
          ) : (
            config.ingress.map((rule, index) => (
              <div key={`${rule.hostname}-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_1fr_auto]">
                <FormField
                  id={`cloudflared-host-${index}`}
                  label="Hostname"
                  placeholder="app.example.com"
                  value={rule.hostname}
                  disabled={busy}
                  onChange={(e) => updateIngress(index, { ...rule, hostname: e.target.value })}
                />
                <FormField
                  id={`cloudflared-service-${index}`}
                  label="Service URL"
                  placeholder="http://127.0.0.1:8443"
                  value={rule.service}
                  disabled={busy}
                  onChange={(e) => updateIngress(index, { ...rule, service: e.target.value })}
                />
                <div className="flex items-end">
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => removeIngress(index)}>
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
        <Button loading={saving} disabled={busy} onClick={handleSave}>
          Save Configuration
        </Button>
      </div>

      <p className="text-xs text-gray-400">
        Cloudflared log output is streamed in real-time on the{' '}
        <a href="/live-logs" className="underline hover:text-gray-600">Live Logs</a> page
        — filter by source <span className="font-mono">cloudflared</span>.
      </p>

      <Toast messages={toasts} />
    </div>
  )
}
