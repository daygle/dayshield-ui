import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { getInterfacesInventory } from '../../api/interfaces'
import {
  getDynamicDnsConfig,
  getDynamicDnsStatus,
  triggerDynamicDnsUpdate,
  updateDynamicDnsConfig,
} from '../../api/dynamicDns'
import type {
  DynamicDnsConfig,
  DynamicDnsEntry,
  DynamicDnsProvider,
  DynamicDnsStatus,
  NetworkInterface,
} from '../../types'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

const PROVIDERS: Array<{ value: DynamicDnsProvider; label: string }> = [
  { value: 'duck_dns', label: 'DuckDNS' },
  { value: 'no_ip', label: 'No-IP' },
  { value: 'dynu', label: 'Dynu' },
  { value: 'free_dns', label: 'FreeDNS (Afraid.org)' },
  { value: 'custom', label: 'Custom URL' },
]

const DEFAULT_ENTRY = (iface: string): DynamicDnsEntry => ({
  id: crypto.randomUUID(),
  enabled: true,
  provider: 'duck_dns',
  interface: iface,
  hostname: '',
  username: '',
  password: '',
  passwordConfigured: false,
  updateUrl: '',
})

const DEFAULT_CONFIG: DynamicDnsConfig = {
  enabled: false,
  checkIntervalSeconds: 300,
  entries: [],
}

function providerNeedsUsername(provider: DynamicDnsProvider): boolean {
  return provider === 'no_ip' || provider === 'dynu'
}

function providerNeedsCustomUrl(provider: DynamicDnsProvider): boolean {
  return provider === 'custom'
}

function providerSecretLabel(provider: DynamicDnsProvider): string {
  if (provider === 'duck_dns') return 'Token'
  if (provider === 'free_dns') return 'Update Token'
  return 'Password / API Key'
}

function providerHelpText(provider: DynamicDnsProvider): string {
  if (provider === 'custom') {
    return 'Use placeholders: {hostname}, {username}, {password}, {ip}'
  }
  if (provider === 'duck_dns') {
    return 'Hostname should be your DuckDNS subdomain (without .duckdns.org).'
  }
  return ''
}

function validateEntry(entry: DynamicDnsEntry): string | null {
  if (!entry.enabled) return null
  if (!entry.interface.trim()) return 'Interface is required.'
  if (!entry.hostname.trim()) return 'Hostname is required.'
  if (providerNeedsUsername(entry.provider) && !entry.username?.trim()) return 'Username is required.'
  if (!entry.passwordConfigured && !entry.password.trim()) return `${providerSecretLabel(entry.provider)} is required.`
  if (providerNeedsCustomUrl(entry.provider)) {
    if (!entry.updateUrl?.trim()) return 'Custom update URL is required.'
    if (!entry.updateUrl.includes('{ip}')) return 'Custom update URL must include {ip}.'
  }
  return null
}

export default function DynamicDnsPage() {
  const [config, setConfig] = useState<DynamicDnsConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<DynamicDnsStatus | null>(null)
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runningUpdate, setRunningUpdate] = useState(false)
  const { addToast } = useToast()

  const interfaceOptions = useMemo(
    () =>
      interfaces
        .filter((iface) => iface.type !== 'loopback')
        .map((iface) => ({
          value: iface.name,
          label: formatInterfaceDisplayName(iface.description, iface.name),
        })),
    [interfaces],
  )

  const firstInterface = interfaceOptions[0]?.value ?? ''

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([getDynamicDnsConfig(), getDynamicDnsStatus(), getInterfacesInventory()])
      .then(([cfg, stat, inventory]) => {
        setConfig(cfg.data)
        setStatus(stat.data)
        setInterfaces(inventory.data.configured)
      })
      .catch((err: Error) => addToast(`Failed to load Dynamic DNS data: ${err.message}`, 'error'))
      .finally(() => setLoading(false))
  }, [addToast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const entryErrors = useMemo(() => {
    const out = new Map<string, string>()
    for (const entry of config.entries) {
      const error = validateEntry(entry)
      if (error) out.set(entry.id, error)
    }
    return out
  }, [config.entries])

  const hasErrors = entryErrors.size > 0

  const upsertEntry = (id: string, patch: Partial<DynamicDnsEntry>) => {
    setConfig((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }))
  }

  const addEntry = () => {
    setConfig((prev) => ({
      ...prev,
      entries: [...prev.entries, DEFAULT_ENTRY(firstInterface)],
    }))
  }

  const removeEntry = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      entries: prev.entries.filter((entry) => entry.id !== id),
    }))
  }

  const handleSave = () => {
    if (hasErrors) {
      addToast('Fix entry errors before saving.', 'error')
      return
    }

    setSaving(true)
    updateDynamicDnsConfig(config)
      .then((res) => {
        setConfig(res.data)
        addToast('Dynamic DNS configuration saved.', 'success')
      })
      .catch((err: Error) => addToast(`Save failed: ${err.message}`, 'error'))
      .finally(() => setSaving(false))
  }

  const handleUpdateNow = () => {
    setRunningUpdate(true)
    triggerDynamicDnsUpdate()
      .then((res) => {
        setStatus(res.data)
        const failedCount = res.data.entries.filter((entry) => !entry.success).length
        if (failedCount > 0) {
          addToast(`Dynamic DNS update completed with ${failedCount} failure(s).`, 'warning')
        } else {
          addToast('Dynamic DNS update completed successfully.', 'success')
        }
      })
      .catch((err: Error) => addToast(`Update failed: ${err.message}`, 'error'))
      .finally(() => setRunningUpdate(false))
  }

  const busy = loading || saving

  return (
    <div className="space-y-6">
      <Card
        title="Dynamic DNS"
        subtitle="Update DNS records automatically when your interface IP changes."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={busy || runningUpdate || !config.enabled} loading={runningUpdate} onClick={handleUpdateNow}>
              Update Now
            </Button>
            <Button variant={config.enabled ? 'danger' : 'primary'} disabled={busy} onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}>
              {config.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Check Interval (seconds)"
            id="ddns-interval"
            type="number"
            min={30}
            step={30}
            value={config.checkIntervalSeconds}
            disabled={busy}
            onChange={(e) => setConfig((prev) => ({ ...prev, checkIntervalSeconds: Number(e.target.value) || 300 }))}
            hint="Minimum 30 seconds."
          />
        </div>
      </Card>

      <Card
        title="Entries"
        subtitle="Each entry binds one hostname to one interface IP."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={addEntry}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Add Dynamic DNS entry"
            aria-label="Add Dynamic DNS entry"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : config.entries.length === 0 ? (
          <p className="text-sm text-gray-500">No Dynamic DNS entries yet.</p>
        ) : (
          <div className="space-y-4">
            {config.entries.map((entry, idx) => {
              const error = entryErrors.get(entry.id)
              return (
                <div key={entry.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Entry {idx + 1}</h4>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          disabled={busy}
                          onChange={(e) => upsertEntry(entry.id, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeEntry(entry.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Delete entry"
                        aria-label="Delete entry"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.5 2a1 1 0 00-.894.553L7 4H4a1 1 0 000 2h.293l.853 10.243A2 2 0 007.14 18h5.72a2 2 0 001.994-1.757L15.707 6H16a1 1 0 100-2h-3l-.606-1.447A1 1 0 0011.5 2h-3zm1 4a1 1 0 012 0v8a1 1 0 11-2 0V6z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      id={`ddns-provider-${entry.id}`}
                      label="Provider"
                      as="select"
                      value={entry.provider}
                      disabled={busy}
                      onChange={(e) => upsertEntry(entry.id, { provider: e.target.value as DynamicDnsProvider, username: '', password: '', passwordConfigured: false, updateUrl: '' })}
                    >
                      {PROVIDERS.map((provider) => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </FormField>

                    <FormField
                      id={`ddns-iface-${entry.id}`}
                      label="Interface"
                      as="select"
                      value={entry.interface}
                      disabled={busy}
                      onChange={(e) => upsertEntry(entry.id, { interface: e.target.value })}
                    >
                      <option value="">Select interface</option>
                      {interfaceOptions.map((iface) => (
                        <option key={iface.value} value={iface.value}>
                          {iface.label}
                        </option>
                      ))}
                    </FormField>

                    <FormField
                      id={`ddns-host-${entry.id}`}
                      label="Hostname"
                      value={entry.hostname}
                      disabled={busy}
                      onChange={(e) => upsertEntry(entry.id, { hostname: e.target.value })}
                      hint={providerHelpText(entry.provider)}
                    />

                    {providerNeedsUsername(entry.provider) && (
                      <FormField
                        id={`ddns-user-${entry.id}`}
                        label="Username"
                        value={entry.username ?? ''}
                        disabled={busy}
                        onChange={(e) => upsertEntry(entry.id, { username: e.target.value })}
                      />
                    )}

                    <FormField
                      id={`ddns-pass-${entry.id}`}
                      label={providerSecretLabel(entry.provider)}
                      type="password"
                      value={entry.password}
                      disabled={busy}
                      placeholder={entry.passwordConfigured ? 'Stored value set. Enter a new value to replace it.' : ''}
                      onChange={(e) => upsertEntry(entry.id, { password: e.target.value })}
                    />

                    {providerNeedsCustomUrl(entry.provider) && (
                      <FormField
                        id={`ddns-url-${entry.id}`}
                        label="Custom Update URL"
                        className="md:col-span-2"
                        value={entry.updateUrl ?? ''}
                        disabled={busy}
                        onChange={(e) => upsertEntry(entry.id, { updateUrl: e.target.value })}
                        hint="Include placeholders like {ip}, {hostname}, {username}, {password}."
                      />
                    )}
                  </div>

                  {error && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card
        title="Update Status"
        subtitle="Most recent Dynamic DNS update results."
        actions={
          <Button variant="secondary" disabled={busy} onClick={loadAll}>
            Refresh
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            Last run: {status?.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : 'Never'}
          </div>
          {!status || status.entries.length === 0 ? (
            <p className="text-sm text-gray-500">No update results yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Hostname</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Interface</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">IP</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Result</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {status.entries.map((entry) => (
                    <tr key={`${entry.id}-${entry.updatedAt}`}>
                      <td className="px-3 py-2 text-gray-900">{entry.hostname}</td>
                      <td className="px-3 py-2 text-gray-700">{entry.interface}</td>
                      <td className="px-3 py-2 text-gray-700">{entry.ip ?? '-'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${entry.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {entry.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{entry.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button disabled={busy} loading={saving} onClick={handleSave}>
          Save Dynamic DNS Configuration
        </Button>
      </div>
    </div>
  )
}
