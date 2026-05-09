import { useEffect, useState } from 'react'
import {
  getSystemStatus,
  getSystemConfig,
  updateSystemConfig,
  rebootSystem,
  getUpdatesStatus,
  getUpdateSettings,
  updateUpdateSettings,
  checkForUpdates,
  applyUpdates,
  rollbackUpdates,
  validateUpdates,
} from '../../api/system'
import type { SystemStatus, SystemConfig, UpdatesStatus, UpdateSettings } from '../../types'
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

function shortCommit(value?: string): string {
  return value ? value.slice(0, 8) : '—'
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

  const [updates, setUpdates] = useState<UpdatesStatus | null>(null)
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings | null>(null)
  const [updateSettingsOpen, setUpdateSettingsOpen] = useState(false)
  const [updateActionLoading, setUpdateActionLoading] = useState(false)
  const [updateActionMessage, setUpdateActionMessage] = useState<string | null>(null)
  const [updateSaving, setUpdateSaving] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getSystemStatus(), getSystemConfig(), getUpdatesStatus(), getUpdateSettings()])
      .then(([st, cfg, upd, updSettings]) => {
        setStatus(st.data)
        setConfig(cfg.data)
        setEditConfig(cfg.data)
        setUpdates(upd.data)
        setUpdateSettings(updSettings.data)
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

  const handleCheckUpdates = () => {
    setUpdateActionLoading(true)
    setUpdateActionMessage(null)
    checkForUpdates()
      .then((res) => {
        setUpdates(res.data)
        setUpdateActionMessage('Update check completed.')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdateActionLoading(false))
  }

  const handleApplyUpdates = () => {
    setUpdateActionLoading(true)
    setUpdateActionMessage(null)
    applyUpdates('both')
      .then((res) => {
        setUpdates(res.data.status)
        setUpdateActionMessage(res.data.message)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdateActionLoading(false))
  }

  const handleRollbackUpdates = () => {
    setUpdateActionLoading(true)
    setUpdateActionMessage(null)
    rollbackUpdates('both')
      .then((res) => {
        setUpdates(res.data.status)
        setUpdateActionMessage(res.data.message)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdateActionLoading(false))
  }

  const handleValidateUpdates = () => {
    setUpdateActionLoading(true)
    setUpdateActionMessage(null)
    validateUpdates('both')
      .then((res) => {
        setUpdates(res.data.status)
        setUpdateActionMessage(`${res.data.message}: ${res.data.details.join(' | ')}`)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdateActionLoading(false))
  }

  const handleSaveUpdateSettings = () => {
    if (!updateSettings) return
    setUpdateSaving(true)
    updateUpdateSettings(updateSettings)
      .then((res) => {
        setUpdateSettings(res.data)
        setUpdateSettingsOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdateSaving(false))
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

      {/* Software updates */}
      {updates && (
        <Card
          title="Software Updates"
          subtitle="GitHub-based updates for DayShield core and UI"
          actions={
            <Button
              size="sm"
              onClick={() => {
                setUpdateSettings(updates.settings)
                setUpdateSettingsOpen(true)
              }}
            >
              Settings
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded border border-gray-200 p-3 bg-gray-50">
                <p className="text-gray-500">Auto Check</p>
                <p className="font-medium text-gray-900">
                  {updates.settings.autoCheckEnabled
                    ? `Every ${updates.settings.checkIntervalMinutes} minutes`
                    : 'Disabled'}
                </p>
              </div>
              <div className="rounded border border-gray-200 p-3 bg-gray-50">
                <p className="text-gray-500">Last Checked</p>
                <p className="font-medium text-gray-900">
                  {updates.lastCheckedAt ? new Date(updates.lastCheckedAt).toLocaleString() : 'Never'}
                </p>
              </div>
              <div className="rounded border border-gray-200 p-3 bg-gray-50">
                <p className="text-gray-500">Reboot Policy</p>
                <p className="font-medium text-gray-900">
                  {updates.settings.rebootRequiredAfterApply ? 'Required After Apply' : 'Not Required'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {updates.components.map((comp) => (
                <div key={comp.component} className="rounded border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 uppercase">{comp.component}</h4>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        comp.validRepo
                          ? comp.updateAvailable
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {comp.validRepo
                        ? comp.updateAvailable
                          ? 'Update Available'
                          : 'Up to Date'
                        : 'Repo Invalid'}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1 text-xs text-gray-600">
                    <div>
                      <dt className="inline text-gray-500">Branch: </dt>
                      <dd className="inline font-medium text-gray-800">{comp.branch}</dd>
                    </div>
                    <div>
                      <dt className="inline text-gray-500">Current: </dt>
                      <dd className="inline font-mono text-gray-800">{shortCommit(comp.currentCommit)}</dd>
                    </div>
                    <div>
                      <dt className="inline text-gray-500">Remote: </dt>
                      <dd className="inline font-mono text-gray-800">{shortCommit(comp.remoteCommit)}</dd>
                    </div>
                    <div>
                      <dt className="inline text-gray-500">Rollback: </dt>
                      <dd className="inline font-mono text-gray-800">{shortCommit(comp.rollbackCommit)}</dd>
                    </div>
                    {comp.lastError && (
                      <div className="text-red-600">{comp.lastError}</div>
                    )}
                  </dl>
                </div>
              ))}
            </div>

            {updates.pendingReboot && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                A reboot is pending to finalize applied updates.
              </div>
            )}

            {updateActionMessage && (
              <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                {updateActionMessage}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleCheckUpdates} disabled={updateActionLoading}>
                Check Now
              </Button>
              <Button size="sm" onClick={handleApplyUpdates} disabled={updateActionLoading}>
                Apply Updates
              </Button>
              <Button size="sm" onClick={handleValidateUpdates} disabled={updateActionLoading}>
                Validate
              </Button>
              <Button variant="danger" size="sm" onClick={handleRollbackUpdates} disabled={updateActionLoading}>
                Rollback
              </Button>
            </div>
          </div>
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

      {/* Update Settings Modal */}
      <Modal
        open={updateSettingsOpen}
        title="Update Settings"
        onClose={() => setUpdateSettingsOpen(false)}
        onConfirm={handleSaveUpdateSettings}
        confirmLabel="Save"
        loading={updateSaving}
        size="lg"
      >
        {updateSettings && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="upd-auto"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={updateSettings.autoCheckEnabled}
                onChange={(e) => setUpdateSettings({ ...updateSettings, autoCheckEnabled: e.target.checked })}
              />
              <label htmlFor="upd-auto" className="text-sm font-medium text-gray-700">
                Enable periodic update checks
              </label>
            </div>
            <FormField
              id="upd-interval"
              label="Check Interval (minutes)"
              type="number"
              min={1}
              value={String(updateSettings.checkIntervalMinutes)}
              onChange={(e) =>
                setUpdateSettings({
                  ...updateSettings,
                  checkIntervalMinutes: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="upd-reboot"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={updateSettings.rebootRequiredAfterApply}
                onChange={(e) =>
                  setUpdateSettings({
                    ...updateSettings,
                    rebootRequiredAfterApply: e.target.checked,
                  })
                }
              />
              <label htmlFor="upd-reboot" className="text-sm font-medium text-gray-700">
                Mark reboot as required after successful apply
              </label>
            </div>

            <FormField
              id="upd-core-path"
              label="Core Repo Path"
              className="col-span-2"
              value={updateSettings.coreRepoPath}
              onChange={(e) => setUpdateSettings({ ...updateSettings, coreRepoPath: e.target.value })}
            />
            <FormField
              id="upd-core-url"
              label="Core Repo URL"
              className="col-span-2"
              value={updateSettings.coreRepoUrl}
              onChange={(e) => setUpdateSettings({ ...updateSettings, coreRepoUrl: e.target.value })}
            />
            <FormField
              id="upd-core-branch"
              label="Core Branch"
              value={updateSettings.coreBranch}
              onChange={(e) => setUpdateSettings({ ...updateSettings, coreBranch: e.target.value })}
            />

            <FormField
              id="upd-ui-path"
              label="UI Repo Path"
              className="col-span-2"
              value={updateSettings.uiRepoPath}
              onChange={(e) => setUpdateSettings({ ...updateSettings, uiRepoPath: e.target.value })}
            />
            <FormField
              id="upd-ui-url"
              label="UI Repo URL"
              className="col-span-2"
              value={updateSettings.uiRepoUrl}
              onChange={(e) => setUpdateSettings({ ...updateSettings, uiRepoUrl: e.target.value })}
            />
            <FormField
              id="upd-ui-branch"
              label="UI Branch"
              value={updateSettings.uiBranch}
              onChange={(e) => setUpdateSettings({ ...updateSettings, uiBranch: e.target.value })}
            />
          </div>
        )}
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

