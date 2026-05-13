import { useCallback, useEffect, useState } from 'react'
import { getNtpConfig, updateNtpConfig, getNtpStatus, postNtpResync } from '../../api/ntp'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import type { NtpConfig, NtpStatus, NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

// ── IPv4 validation ───────────────────────────────────────────────────────────

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/

function isValidIPv4(val: string): boolean {
  if (!IPV4_RE.test(val)) return false
  return val.split('.').every((octet) => {
    const n = Number(octet)
    return n >= 0 && n <= 255
  })
}

// ── Toast ─────────────────────────────────────────────────────────────────────

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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
      {messages.map((m) => (
        <div
          key={m.id}
          role="alert"
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg text-white ${
            m.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {m.kind === 'success' ? (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          )}
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: NtpConfig = {
  enabled: true,
  servers: [],
  serveLan: false,
  listenInterfaces: [],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NtpPage() {
  const [config, setConfig] = useState<NtpConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<NtpStatus | null>(null)
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])

  const interfaceLabel = (iface: NetworkInterface): string =>
    formatInterfaceDisplayName(iface.description, iface.name)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Server input state
  const [serverInput, setServerInput] = useState('')
  const [serverError, setServerError] = useState('')

  const addToast = useCallback((kind: ToastKind, text: string) => {
    const id = toastSeq++
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([getNtpConfig(), getNtpStatus(), getInterfaces(), getInterfacesInventory()])
      .then(([cfg, stat, ifaces, inventory]) => {
        setConfig(cfg.data)
        setStatus(stat.data)
        const configured = Array.isArray(ifaces.data)
          ? ifaces.data.filter((i) => i.type !== 'loopback')
          : []
        const known = new Set(configured.map((i) => i.name))
        const extras = (inventory.data?.names ?? [])
          .filter((name) => name !== 'lo' && !known.has(name))
          .map((name) => ({
            name,
            description: '',
            type: 'ethernet' as const,
            enabled: true,
          }))

        setInterfaces([...configured, ...extras])
      })
      .catch((err: Error) => addToast('error', `Failed to load NTP data: ${err.message}`))
      .finally(() => setLoading(false))
  }, [addToast])

  useEffect(() => {
    if (
      !loading &&
      interfaces.length > 0 &&
      config.enabled &&
      config.listenInterfaces.length === 0 &&
      config.servers.length === 0
    ) {
      setConfig((prev) => ({ ...prev, listenInterfaces: interfaces.map((iface) => iface.name) }))
    }
  }, [loading, interfaces, config])

  const handleSave = () => {
    setSaving(true)
    const payload = { ...config, serveLan: config.listenInterfaces.length > 0 }
    updateNtpConfig(payload)
      .then((res) => {
        setConfig(res.data)
        addToast('success', 'NTP configuration saved.')
      })
      .catch((err: Error) => addToast('error', `Save failed: ${err.message}`))
      .finally(() => setSaving(false))
  }

  const handleResync = () => {
    setResyncing(true)
    postNtpResync()
      .then(() => {
        addToast('success', 'NTP resync triggered.')
        return getNtpStatus()
      })
      .then((res) => setStatus(res.data))
      .catch((err: Error) => addToast('error', `Resync failed: ${err.message}`))
      .finally(() => setResyncing(false))
  }

  const handleAddServer = () => {
    const trimmed = serverInput.trim()
    if (!trimmed) {
      setServerError('Enter an IPv4 address.')
      return
    }
    if (!isValidIPv4(trimmed)) {
      setServerError('Only valid IPv4 addresses are accepted.')
      return
    }
    if (config.servers.includes(trimmed)) {
      setServerError('This server is already in the list.')
      return
    }
    setConfig((c) => ({ ...c, servers: [...c.servers, trimmed] }))
    setServerInput('')
    setServerError('')
  }

  const handleRemoveServer = (server: string) => {
    setConfig((c) => ({ ...c, servers: c.servers.filter((s) => s !== server) }))
  }

  const handleToggleInterface = (name: string) => {
    setConfig((c) => {
      const selected = c.listenInterfaces.includes(name)
        ? c.listenInterfaces.filter((i) => i !== name)
        : [...c.listenInterfaces, name]
      return { ...c, listenInterfaces: selected, serveLan: selected.length > 0 }
    })
  }

  const busy = loading || saving

  return (
    <div className="space-y-6">

      {/* NTP Status */}
      <Card title="NTP Status" subtitle="Current synchronization state">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : status ? (
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Sync</dt>
              <dd>
                <span
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    status.synced ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      status.synced ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  {status.synced ? 'Synchronized' : 'Not synchronized'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Upstream</dt>
              <dd className="font-medium text-gray-800">{status.upstream || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Stratum</dt>
              <dd className="font-medium text-gray-800">{status.stratum}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Offset</dt>
              <dd className="font-medium text-gray-800">
                {typeof status.offset === 'number' && Number.isFinite(status.offset)
                  ? `${status.offset.toFixed(3)} ms`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Jitter</dt>
              <dd className="font-medium text-gray-800">
                {typeof status.jitter === 'number' && Number.isFinite(status.jitter)
                  ? `${status.jitter.toFixed(3)} ms`
                  : '—'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">NTP status unavailable.</p>
        )}
      </Card>

      {/* Global enable/disable */}
      <Card
        title="NTP Service"
        subtitle="Enable or disable the Network Time Protocol daemon."
        actions={
          <Button
            variant={config.enabled ? 'danger' : 'primary'}
            disabled={busy}
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
          >
            {config.enabled ? 'Disable NTP' : 'Enable NTP'}
          </Button>
        }
      >
        <p className="text-sm text-gray-500">
          {config.enabled
            ? 'NTP is enabled. The system clock is synchronised with upstream servers.'
            : 'NTP is disabled. The system clock will not be synchronised automatically.'}
        </p>
      </Card>

      {/* Upstream Servers */}
      <Card
        title="Upstream Servers"
        subtitle="IPv4 addresses of NTP servers used for clock synchronisation."
      >
        <div className="space-y-4">
          {/* Server list */}
          {config.servers.length === 0 ? (
            <p className="text-sm text-gray-400">No upstream servers configured.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
              {config.servers.map((server) => (
                <li key={server} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-mono text-gray-800">{server}</span>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleRemoveServer(server)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Add server input */}
          <div className="flex items-end gap-3">
            <FormField
              id="ntp-server-input"
              label="Add Server (IPv4)"
              placeholder="203.0.113.1"
              className="flex-1"
              value={serverInput}
              error={serverError}
              disabled={busy}
              onChange={(e) => {
                setServerInput(e.target.value)
                if (serverError) setServerError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddServer()
                }
              }}
            />
            <Button
              size="md"
              disabled={busy}
              onClick={handleAddServer}
              className="mb-[1px]"
            >
              Add
            </Button>
          </div>
        </div>
      </Card>

      {/* NTP Server Interfaces */}
      <Card
        title="NTP Server Interfaces"
        subtitle="Select which network interfaces should serve NTP to clients. If none are selected, the device will not serve NTP."
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading interfaces…</p>
        ) : interfaces.length === 0 ? (
          <p className="text-sm text-gray-400">No network interfaces available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {interfaces.map((iface) => {
              const checked = config.listenInterfaces.includes(iface.name)
              return (
                <label
                  key={iface.name}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm transition-colors ${
                    checked
                      ? 'border-blue-400 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={checked}
                    disabled={busy}
                    onChange={() => handleToggleInterface(iface.name)}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{interfaceLabel(iface)}</p>
                    {iface.ipv4Address && (
                      <p className="text-xs text-gray-500 font-mono truncate">
                        {iface.ipv4Address}/{iface.ipv4Prefix}
                      </p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {/* Manual Resync */}
        <Button
          variant="secondary"
          loading={resyncing}
          disabled={busy || resyncing}
          onClick={handleResync}
        >
          {resyncing ? 'Resyncing…' : 'Manual Resync'}
        </Button>

        {/* Save */}
        <Button loading={saving} disabled={busy} onClick={handleSave}>
          Save configuration
        </Button>
      </div>

      <Toast messages={toasts} />
    </div>
  )
}
