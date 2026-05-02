import { useEffect, useState } from 'react'
import { getSystemStatus, getSystemConfig, updateSystemConfig, rebootSystem } from '../../api/system'
import type { SystemStatus, SystemConfig } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

export default function System() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editConfig, setEditConfig] = useState<Partial<SystemConfig>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [rebootOpen, setRebootOpen] = useState(false)
  const [rebooting, setRebooting] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getSystemStatus(), getSystemConfig()])
      .then(([st, cfg]) => {
        setStatus(st.data)
        setConfig(cfg.data)
        setEditConfig(cfg.data)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const handleSaveConfig = () => {
    setSaving(true)
    updateSystemConfig(editConfig)
      .then((res) => {
        setConfig(res.data)
        setEditConfig(res.data)
        setEditOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  const handleReboot = () => {
    setRebooting(true)
    rebootSystem()
      .then(() => setRebootOpen(false))
      .catch((err: Error) => setError(err.message))
      .finally(() => setRebooting(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        Loading system information…
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
        <Card title="System Status">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Hostname</dt>
              <dd className="font-medium text-gray-800">{status.hostname}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Version</dt>
              <dd className="font-medium text-gray-800">{status.version}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Uptime</dt>
              <dd className="font-medium text-gray-800">{formatUptime(status.uptime)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">CPU Usage</dt>
              <dd className={`font-medium ${status.cpuUsage > 80 ? 'text-red-600' : 'text-gray-800'}`}>
                {status.cpuUsage}%
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Last Updated</dt>
              <dd className="font-medium text-gray-800">
                {new Date(status.lastUpdated).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Active Connections</dt>
              <dd className="font-medium text-gray-800">{status.activeConnections}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Interfaces</dt>
              <dd className="font-medium text-gray-800">{status.interfaces}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Firewall Rules</dt>
              <dd className="font-medium text-gray-800">{status.firewallRules}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Configuration */}
      {config && (
        <Card
          title="System Configuration"
          actions={
            <Button size="sm" onClick={() => { setEditConfig(config); setEditOpen(true) }}>
              Edit
            </Button>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Hostname</dt>
              <dd className="font-medium text-gray-800">{config.hostname}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Timezone</dt>
              <dd className="font-medium text-gray-800">{config.timezone}</dd>
            </div>
            <div>
              <dt className="text-gray-500">SSH</dt>
              <dd className={`font-medium ${config.sshEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config.sshEnabled ? `Enabled (port ${config.sshPort})` : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">NTP Servers</dt>
              <dd className="font-medium text-gray-800">{config.ntpServers.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">DNS Servers</dt>
              <dd className="font-medium text-gray-800">{config.dnsServers.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Web Port</dt>
              <dd className="font-medium text-gray-800">{config.webPort}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Danger zone */}
      <Card title="Administration">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="danger" onClick={() => setRebootOpen(true)}>
            Reboot System
          </Button>
          <p className="text-xs text-gray-500">
            Rebooting will briefly interrupt all network services.
          </p>
        </div>
      </Card>

      {/* Edit Config Modal */}
      <Modal
        open={editOpen}
        title="Edit System Configuration"
        onClose={() => setEditOpen(false)}
        onConfirm={handleSaveConfig}
        confirmLabel="Save"
        loading={saving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="cfg-hostname"
            label="Hostname"
            value={editConfig.hostname ?? ''}
            onChange={(e) => setEditConfig({ ...editConfig, hostname: e.target.value })}
          />
          <FormField
            id="cfg-timezone"
            label="Timezone"
            placeholder="UTC"
            value={editConfig.timezone ?? ''}
            onChange={(e) => setEditConfig({ ...editConfig, timezone: e.target.value })}
          />
          <FormField
            id="cfg-ntp"
            label="NTP Servers (comma-separated)"
            className="col-span-2"
            placeholder="0.pool.ntp.org, 1.pool.ntp.org"
            value={(editConfig.ntpServers ?? []).join(', ')}
            onChange={(e) =>
              setEditConfig({
                ...editConfig,
                ntpServers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <FormField
            id="cfg-dns"
            label="DNS Servers (comma-separated)"
            className="col-span-2"
            placeholder="8.8.8.8, 8.8.4.4"
            value={(editConfig.dnsServers ?? []).join(', ')}
            onChange={(e) =>
              setEditConfig({
                ...editConfig,
                dnsServers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <FormField
            id="cfg-ssh-port"
            label="SSH Port"
            type="number"
            min={1}
            max={65535}
            value={String(editConfig.sshPort ?? 22)}
            onChange={(e) => setEditConfig({ ...editConfig, sshPort: Number(e.target.value) })}
          />
          <FormField
            id="cfg-web-port"
            label="Web UI Port"
            type="number"
            min={1}
            max={65535}
            value={String(editConfig.webPort ?? 8080)}
            onChange={(e) => setEditConfig({ ...editConfig, webPort: Number(e.target.value) })}
          />
        </div>
      </Modal>

      {/* Reboot Confirmation Modal */}
      <Modal
        open={rebootOpen}
        title="Reboot System"
        onClose={() => setRebootOpen(false)}
        onConfirm={handleReboot}
        confirmLabel="Reboot"
        confirmVariant="danger"
        loading={rebooting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to reboot the system? All active connections will be interrupted.
        </p>
      </Modal>
    </div>
  )
}

