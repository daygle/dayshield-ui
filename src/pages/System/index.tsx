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
  markApplianceRebuildComplete,
  rollbackRootfsLiveUpdate,
} from '../../api/system'
import type { SystemStatus, SystemConfig, UpdatesStatus, UpdateSettings } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0d 0h 0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function formatIsoDate(value?: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

function shortCommit(value?: string): string {
  return value ? value.slice(0, 8) : '—'
}

/**
 * Parse component error message. Format: "component: error message"
 * Example: "core: preflight failed (path is not writable: /usr/local/sbin)"
 */
function parseComponentError(error: string): { component?: string; message: string } {
  const match = error.match(/^([^:]+):\s*(.+)$/)
  if (match) {
    return {
      component: match[1].trim().toUpperCase(),
      message: match[2].trim(),
    }
  }
  return { message: error }
}

function updateActionMessageClasses(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('failed') || normalized.includes('error')) {
    return 'rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700'
  }

  if (normalized.includes('warning')) {
    return 'rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800'
  }

  if (normalized.includes('applied successfully') || normalized.includes('passed')) {
    return 'rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700'
  }

  return 'rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700'
}

/**
 * Parse validation message to extract structured warning/error information.
 * Format: "validation passed with N warning(s): component: message | component: message"
 * Or: "validation failed: error message"
 * Or: "update preflight failed" / "update action failed"
 */
function parseValidationMessage(message: string): {
  status: 'passed' | 'failed' | 'error'
  warningCount?: number
  warnings?: Array<{ component: string; message: string }>
  error?: string
} {
  // Handle preflight/general update failures
  if (message.includes('preflight failed') || message.includes('update action failed')) {
    return {
      status: 'error',
      error: message,
    }
  }

  if (message.includes('validation failed')) {
    const errorMatch = message.match(/validation failed:\s*(.+)/)
    return {
      status: 'failed',
      error: errorMatch ? errorMatch[1] : 'Validation failed',
    }
  }

  if (message.includes('validation passed')) {
    const countMatch = message.match(/validation passed with (\d+) warning\(s\)/)
    const warningCount = countMatch ? parseInt(countMatch[1], 10) : 0

    const warningPart = message.split(': ', 2)[1] || ''
    const warnings: Array<{ component: string; message: string }> = []

    // Split by pipe and parse each warning
    const items = warningPart.split(' | ').filter(Boolean)
    for (const item of items) {
      const match = item.match(/^([^:]+):\s*(.+)$/)
      if (match) {
        warnings.push({
          component: match[1].trim().toUpperCase(),
          message: match[2].trim(),
        })
      }
    }

    return {
      status: 'passed',
      warningCount,
      warnings,
    }
  }

  return { status: 'passed' }
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
  const [markingApplianceRebuildComplete, setMarkingApplianceRebuildComplete] = useState(false)
  const [rollingBackRootfsLive, setRollingBackRootfsLive] = useState(false)

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

  const handleMarkApplianceRebuildComplete = () => {
    setMarkingApplianceRebuildComplete(true)
    setUpdateActionMessage(null)
    markApplianceRebuildComplete()
      .then((res) => {
        setUpdates(res.data)
        setUpdateActionMessage('Appliance rebuild status cleared.')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setMarkingApplianceRebuildComplete(false))
  }

  const handleRollbackRootfsLiveUpdate = () => {
    setRollingBackRootfsLive(true)
    setUpdateActionMessage(null)
    rollbackRootfsLiveUpdate()
      .then((res) => {
        setUpdates(res.data.status)
        setUpdateActionMessage(`${res.data.message}: ${res.data.details.join(' | ')}`)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setRollingBackRootfsLive(false))
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
                {formatIsoDate(status.lastUpdated)}
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
          subtitle="Git-based updates for DayShield core, UI, and rootfs repositories"
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
                  {updates.lastCheckedAt ? formatIsoDate(updates.lastCheckedAt) : 'Never'}
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
                    {comp.lastError && (() => {
                      const parsed = parseComponentError(comp.lastError)
                      return (
                        <div className="mt-2 rounded bg-red-50 border border-red-200 p-2">
                          <div className="text-xs font-medium text-red-700">{parsed.component ? `${parsed.component} Error` : 'Error'}</div>
                          <div className="text-xs text-red-600 mt-1">{parsed.message}</div>
                        </div>
                      )
                    })()}
                  </dl>
                </div>
              ))}
            </div>

            {updates.pendingReboot && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                A reboot is pending to finalize applied updates.
              </div>
            )}

            {updates.pendingApplianceRebuild && (
              <div className="rounded-md bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 space-y-3">
                <div>
                  <p className="font-medium">Appliance rebuild required.</p>
                  <p>
                    {updates.applianceRebuildReason ?? 'RootFS changes require rebuilding the appliance rootfs and installer ISO artifacts.'}
                  </p>
                  <p className="mt-1 text-xs text-orange-700">
                    Rebuild and publish a new rootfs.tar.zst and installer ISO from the build environment, then clear this status.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleMarkApplianceRebuildComplete}
                    disabled={markingApplianceRebuildComplete || updateActionLoading}
                  >
                    Mark Rebuild Complete
                  </Button>
                  {updates.applianceRebuildMarkedAt && (
                    <span className="text-xs text-orange-700">
                      Last changed: {formatIsoDate(updates.applianceRebuildMarkedAt)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {updates.rootfsLiveUpdate && (
              <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">RootFS Live Update Report</p>
                  {updates.rootfsLiveUpdate.reportCommit && (
                    <span className="text-xs font-mono text-slate-600">
                      {shortCommit(updates.rootfsLiveUpdate.reportCommit)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>Last run: {formatIsoDate(updates.rootfsLiveUpdate.reportTimestamp)}</p>
                  {updates.rootfsLiveUpdate.backupDir && (
                    <p>Backup: {updates.rootfsLiveUpdate.backupDir}</p>
                  )}
                  {typeof updates.rootfsLiveUpdate.migrationFromVersion === 'number' && typeof updates.rootfsLiveUpdate.migrationToVersion === 'number' && (
                    <p>
                      Migration schema: {updates.rootfsLiveUpdate.migrationFromVersion} → {updates.rootfsLiveUpdate.migrationToVersion}
                    </p>
                  )}
                </div>

                {updates.rootfsLiveUpdate.stagedFiles.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1">
                      Staged config deltas (merge required)
                    </p>
                    <ul className="max-h-36 overflow-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs font-mono text-amber-800 space-y-1">
                      {updates.rootfsLiveUpdate.stagedFiles.map((file) => (
                        <li key={file}>{file}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRollbackRootfsLiveUpdate}
                    disabled={rollingBackRootfsLive || updateActionLoading || !updates.rootfsLiveUpdate.rollbackAvailable}
                  >
                    Roll Back RootFS Live Update
                  </Button>
                  {!updates.rootfsLiveUpdate.rollbackAvailable && (
                    <span className="text-xs text-slate-500">No rollback snapshot available.</span>
                  )}
                </div>
              </div>
            )}

            {updateActionMessage && (() => {
              const parsed = parseValidationMessage(updateActionMessage)
              const containerClasses = updateActionMessageClasses(updateActionMessage)

              if (parsed.status === 'error') {
                return (
                  <div className={containerClasses}>
                    <div className="space-y-2">
                      <div className="font-medium">Update Failed</div>
                      <div className="text-sm">{parsed.error}</div>
                    </div>
                  </div>
                )
              }

              if (parsed.status === 'failed') {
                return (
                  <div className={containerClasses}>
                    <div className="font-medium mb-2">Validation Failed</div>
                    <div className="text-sm">{parsed.error}</div>
                  </div>
                )
              }

              if (parsed.status === 'passed' && parsed.warningCount && parsed.warnings && parsed.warnings.length > 0) {
                return (
                  <div className={containerClasses}>
                    <div className="space-y-3">
                      <div className="font-medium">
                        Validation Passed with {parsed.warningCount} Warning{parsed.warningCount !== 1 ? 's' : ''}
                      </div>
                      <div className="space-y-2">
                        {/* Group warnings by component */}
                        {Array.from(new Map(
                          parsed.warnings.map(w => [w.component, w])
                        ).entries()).map(([component, warning]) => (
                          <div key={component} className="border-l-2 border-current pl-3">
                            <div className="font-medium text-sm">{component}</div>
                            <div className="text-xs mt-1">{warning.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div className={containerClasses}>
                  {updateActionMessage}
                </div>
              )
            })()}

            {updates && updates.availableUpdateCount && updates.availableUpdateCount > 1 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 space-y-3">
                <div>
                  <p className="font-medium">Multiple Component Updates Available</p>
                  <p className="text-xs mt-1">
                    {updates.availableUpdateCount} components have available updates. For consistency, all available components should be updated together.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">Components to update:</p>
                  <ul className="text-xs space-y-1 ml-2">
                    {updates.components
                      .filter((c) => c.updateAvailable)
                      .map((c) => (
                        <li key={c.component} className="flex items-center gap-2">
                          <span className="text-amber-600">•</span>
                          <span className="font-medium uppercase">{c.component}</span>
                          <span className="text-amber-600 font-mono text-xs">
                            {c.currentCommit ? c.currentCommit.slice(0, 8) : '—'} → {c.remoteCommit ? c.remoteCommit.slice(0, 8) : '—'}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleCheckUpdates} disabled={updateActionLoading}>
                Check Now
              </Button>
              <Button 
                size="sm" 
                onClick={handleApplyUpdates} 
                disabled={updateActionLoading}
                title={updates && updates.availableUpdateCount && updates.availableUpdateCount > 1 
                  ? `Apply ${updates.availableUpdateCount} available component updates`
                  : 'Apply available updates'}
              >
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
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="upd-deploy-runtime"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={updateSettings.deployRuntimeAfterApply}
                onChange={(e) =>
                  setUpdateSettings({
                    ...updateSettings,
                    deployRuntimeAfterApply: e.target.checked,
                  })
                }
              />
              <label htmlFor="upd-deploy-runtime" className="text-sm font-medium text-gray-700">
                Build and deploy runtime updates after apply (core binary, UI assets, and managed rootfs files)
              </label>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="upd-signed-commits"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={updateSettings.requireSignedCommits}
                onChange={(e) =>
                  setUpdateSettings({
                    ...updateSettings,
                    requireSignedCommits: e.target.checked,
                  })
                }
              />
              <label htmlFor="upd-signed-commits" className="text-sm font-medium text-gray-700">
                Require signed commits for updates
              </label>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="upd-verify-rootfs-manifest"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={updateSettings.verifyRootfsManifest}
                onChange={(e) =>
                  setUpdateSettings({
                    ...updateSettings,
                    verifyRootfsManifest: e.target.checked,
                  })
                }
              />
              <label htmlFor="upd-verify-rootfs-manifest" className="text-sm font-medium text-gray-700">
                Verify rootfs live-update manifest before deploy
              </label>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="upd-bootstrap-rootfs"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={updateSettings.bootstrapMissingRootfsRepo}
                onChange={(e) =>
                  setUpdateSettings({
                    ...updateSettings,
                    bootstrapMissingRootfsRepo: e.target.checked,
                  })
                }
              />
              <label htmlFor="upd-bootstrap-rootfs" className="text-sm font-medium text-gray-700">
                Auto-bootstrap missing rootfs repo on older installations
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

            <FormField
              id="upd-rootfs-path"
              label="RootFS Repo Path"
              className="col-span-2"
              value={updateSettings.rootfsRepoPath}
              onChange={(e) => setUpdateSettings({ ...updateSettings, rootfsRepoPath: e.target.value })}
            />
            <FormField
              id="upd-rootfs-url"
              label="RootFS Repo URL"
              className="col-span-2"
              value={updateSettings.rootfsRepoUrl}
              onChange={(e) => setUpdateSettings({ ...updateSettings, rootfsRepoUrl: e.target.value })}
            />
            <FormField
              id="upd-rootfs-branch"
              label="RootFS Branch"
              value={updateSettings.rootfsBranch}
              onChange={(e) => setUpdateSettings({ ...updateSettings, rootfsBranch: e.target.value })}
            />
            <FormField
              id="upd-signers-file"
              label="Trusted Signers File"
              className="col-span-2"
              value={updateSettings.trustedSignersFile}
              onChange={(e) => setUpdateSettings({ ...updateSettings, trustedSignersFile: e.target.value })}
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

