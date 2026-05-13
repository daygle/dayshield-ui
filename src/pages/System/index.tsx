import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { getAcmeConfig } from '../../api/acme'
import type { SystemStatus, SystemConfig, UpdatesStatus, UpdateSettings } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'

const DEFAULT_GITHUB_REGISTRY_URL = 'https://api.github.com/repos/daygle/dayshield-core'
const STATUS_REFRESH_INTERVAL_MS = 15000

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0d 0h 0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function formatIsoDate(value?: string): string {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString()
}

function shortCommit(value?: string): string {
  return value ? value.slice(0, 8) : '-'
}

function componentCurrentDisplay(
  comp: {
  currentVersion?: string
  currentCommit?: string
  },
  isRegistryMode: boolean,
): string {
  if (comp.currentVersion) return comp.currentVersion
  return isRegistryMode ? 'Unknown' : shortCommit(comp.currentCommit)
}

function componentRemoteDisplay(
  comp: {
  remoteVersion?: string
  remoteCommit?: string
  },
  isRegistryMode: boolean,
): string {
  if (comp.remoteVersion) return comp.remoteVersion
  return isRegistryMode ? 'Unknown' : shortCommit(comp.remoteCommit)
}

/**
 * Get a list of IANA timezone identifiers for use in dropdowns
 */
function getTimezones(): Array<{ name: string; label: string }> {
  // Common IANA timezones organized by region
  const timezones = [
    // UTC
    { name: 'UTC', label: 'UTC' },
    { name: 'GMT', label: 'GMT (Greenwich Mean Time)' },
    
    // Africa
    { name: 'Africa/Cairo', label: 'Cairo' },
    { name: 'Africa/Johannesburg', label: 'Johannesburg' },
    { name: 'Africa/Lagos', label: 'Lagos' },
    { name: 'Africa/Nairobi', label: 'Nairobi' },
    
    // Americas - US & Canada
    { name: 'America/Anchorage', label: 'Anchorage' },
    { name: 'America/Chicago', label: 'Chicago' },
    { name: 'America/Denver', label: 'Denver' },
    { name: 'America/Los_Angeles', label: 'Los Angeles' },
    { name: 'America/New_York', label: 'New York' },
    { name: 'America/Phoenix', label: 'Phoenix' },
    { name: 'America/Toronto', label: 'Toronto' },
    { name: 'America/Vancouver', label: 'Vancouver' },
    
    // Americas - Other
    { name: 'America/Bogota', label: 'Bogota' },
    { name: 'America/Buenos_Aires', label: 'Buenos Aires' },
    { name: 'America/Caracas', label: 'Caracas' },
    { name: 'America/Mexico_City', label: 'Mexico City' },
    { name: 'America/Sao_Paulo', label: 'Sao Paulo' },
    
    // Asia
    { name: 'Asia/Bangkok', label: 'Bangkok' },
    { name: 'Asia/Dubai', label: 'Dubai' },
    { name: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City' },
    { name: 'Asia/Hong_Kong', label: 'Hong Kong' },
    { name: 'Asia/Jakarta', label: 'Jakarta' },
    { name: 'Asia/Kolkata', label: 'Kolkata' },
    { name: 'Asia/Manila', label: 'Manila' },
    { name: 'Asia/Singapore', label: 'Singapore' },
    { name: 'Asia/Seoul', label: 'Seoul' },
    { name: 'Asia/Shanghai', label: 'Shanghai' },
    { name: 'Asia/Tokyo', label: 'Tokyo' },
    
    // Europe
    { name: 'Europe/Amsterdam', label: 'Amsterdam' },
    { name: 'Europe/Athens', label: 'Athens' },
    { name: 'Europe/Berlin', label: 'Berlin' },
    { name: 'Europe/Brussels', label: 'Brussels' },
    { name: 'Europe/Budapest', label: 'Budapest' },
    { name: 'Europe/Dublin', label: 'Dublin' },
    { name: 'Europe/Helsinki', label: 'Helsinki' },
    { name: 'Europe/Istanbul', label: 'Istanbul' },
    { name: 'Europe/Lisbon', label: 'Lisbon' },
    { name: 'Europe/London', label: 'London' },
    { name: 'Europe/Madrid', label: 'Madrid' },
    { name: 'Europe/Moscow', label: 'Moscow' },
    { name: 'Europe/Paris', label: 'Paris' },
    { name: 'Europe/Rome', label: 'Rome' },
    { name: 'Europe/Stockholm', label: 'Stockholm' },
    { name: 'Europe/Vienna', label: 'Vienna' },
    { name: 'Europe/Warsaw', label: 'Warsaw' },
    { name: 'Europe/Zurich', label: 'Zurich' },
    
    // Oceania
    { name: 'Australia/Brisbane', label: 'Brisbane' },
    { name: 'Australia/Melbourne', label: 'Melbourne' },
    { name: 'Australia/Perth', label: 'Perth' },
    { name: 'Australia/Sydney', label: 'Sydney' },
    { name: 'Pacific/Auckland', label: 'Auckland' },
    { name: 'Pacific/Fiji', label: 'Fiji' },
    { name: 'Pacific/Honolulu', label: 'Honolulu' },
  ]
  
  return timezones.sort((a, b) => a.label.localeCompare(b.label))
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

  if (normalized.includes('note')) {
    return 'rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800'
  }

  if (normalized.includes('applied successfully') || normalized.includes('passed')) {
    return 'rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700'
  }

  return 'rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700'
}

function formatUpdateInterval(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Disabled'
  if (minutes % 1440 === 0) {
    const days = minutes / 1440
    return days === 1 ? 'Every 24 hours' : `Every ${days} days`
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? 'Every 1 hour' : `Every ${hours} hours`
  }
  return `Every ${minutes} minutes`
}

function normalizeRegistryUrl(input?: string): string {
  const raw = (input ?? '').trim()
  if (!raw) return raw

  const trimmed = raw.replace(/\/+$/, '')

  // Accept direct GitHub repo URLs and convert to GitHub API repo endpoint.
  const webRepo = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i)
  if (webRepo) {
    const [, owner, repo] = webRepo
    return `https://api.github.com/repos/${owner}/${repo}`
  }

  // Accept GitHub API "latest release" endpoints and normalize to repo base.
  const apiLatest = trimmed.match(/^https?:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/releases\/latest$/i)
  if (apiLatest) {
    const [, owner, repo] = apiLatest
    return `https://api.github.com/repos/${owner}/${repo}`
  }

  return trimmed
}

function inferRegistryStatusLabel(validRepo: boolean, lastError?: string): string {
  if (validRepo) return 'Up to Date'
  const err = (lastError ?? '').toLowerCase()
  if (err.includes('http 404')) return 'Registry 404'
  if (err.includes('http 401') || err.includes('http 403')) return 'Registry Access Denied'
  if (err.includes('timed out') || err.includes('dns') || err.includes('connection')) return 'Registry Unreachable'
  return 'Registry Error'
}

function detectRegistry404Hint(components: UpdatesStatus['components']): string | null {
  const with404 = components.find((comp) => (comp.lastError ?? '').toLowerCase().includes('http 404'))
  if (!with404) return null
  return with404.lastError ?? null
}

/**
 * Parse validation message to extract structured note/error information.
 * Format: "validation passed with N note(s): component: message | component: message"
 * Or: "validation failed: error message"
 * Or: "update preflight failed" / "update action failed"
 */
function parseValidationMessage(message: string): {
  status: 'passed' | 'failed' | 'error'
  noteCount?: number
  notes?: Array<{ component: string; message: string }>
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
    const countMatch = message.match(/validation passed with (\d+) note\(s\)/)
    const noteCount = countMatch ? parseInt(countMatch[1], 10) : 0

    const notePart = message.split(': ', 2)[1] || ''
    const notes: Array<{ component: string; message: string }> = []

    // Split by pipe and parse each note
    const items = notePart.split(' | ').filter(Boolean)
    for (const item of items) {
      const match = item.match(/^([^:]+):\s*(.+)$/)
      if (match) {
        notes.push({
          component: match[1].trim().toUpperCase(),
          message: match[2].trim(),
        })
      }
    }

    return {
      status: 'passed',
      noteCount,
      notes,
    }
  }

  return { status: 'passed' }
}

export default function System() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acmeDomains, setAcmeDomains] = useState<string[]>([])

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

  const activeSection = searchParams.get('section') === 'updates'
    ? 'updates'
    : searchParams.get('section') === 'reboot'
      ? 'reboot'
      : 'overview'
  const isRegistryMode = (updates?.settings.updateMode ?? 'registry') === 'registry'

  const loadAll = () => {
    setLoading(true)
    Promise.all([getSystemStatus(), getSystemConfig(), getUpdatesStatus(), getUpdateSettings(), getAcmeConfig()])
      .then(([st, cfg, upd, updSettings, acme]) => {
        setStatus(st.data)
        setConfig(cfg.data)
        setEditConfig(cfg.data)
        setUpdates(upd.data)
        setUpdateSettings(updSettings.data)
        setAcmeDomains(acme.data.domains ?? [])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  useEffect(() => {
    if (activeSection !== 'overview') return

    const refreshStatus = () => {
      getSystemStatus()
        .then((st) => setStatus(st.data))
        .catch((err: Error) => setError(err.message))
    }

    const timer = window.setInterval(refreshStatus, STATUS_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [activeSection])

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
    const normalizedRegistryUrl = normalizeRegistryUrl(updateSettings.registryUrl)
    updateUpdateSettings({
      ...updateSettings,
      updateMode: 'registry',
      registryUrl: normalizedRegistryUrl,
    })
      .then((res) => {
        setUpdateSettings(res.data)
        setUpdates((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            settings: {
              ...prev.settings,
              registryUrl: res.data.registryUrl,
            },
          }
        })
        setUpdateSettingsOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdateSaving(false))
  }

  const handleSetDefaultRegistry = () => {
    if (!updateSettings) return
    setUpdateSaving(true)
    updateUpdateSettings({
      ...updateSettings,
      updateMode: 'registry',
      registryUrl: DEFAULT_GITHUB_REGISTRY_URL,
    })
      .then((res) => {
        setUpdateSettings(res.data)
        setUpdates((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            settings: {
              ...prev.settings,
              registryUrl: res.data.registryUrl,
            },
          }
        })
        setUpdateActionMessage('Registry URL updated to the default GitHub releases repository. Run Check Now to retry.')
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

  const registry404Hint = updates ? detectRegistry404Hint(updates.components) : null

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeSection === 'overview' && status && (
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

      {activeSection === 'overview' && config && (
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
              <dd className="font-medium text-gray-800">{config.ntpServers.join(', ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">DNS Servers</dt>
              <dd className="font-medium text-gray-800">{config.dnsServers.join(', ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Web Port</dt>
              <dd className="font-medium text-gray-800">{config.webPort}</dd>
            </div>
          </dl>
        </Card>
      )}

      {activeSection === 'updates' && updates && (
        <Card
          title="Software Updates"
          subtitle="Prebuilt artifact registry updates for DayShield core, UI, and rootfs"
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
            <div className="rounded border border-gray-200 p-3 bg-gray-50">
              <p className="text-gray-500 text-sm">Auto Check</p>
              <p className="font-medium text-gray-900">
                {updates.settings.autoCheckEnabled
                  ? formatUpdateInterval(updates.settings.checkIntervalMinutes)
                  : 'Disabled'}
              </p>
            </div>

            {isRegistryMode && registry404Hint && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 space-y-2">
                <p className="font-medium">Registry returned HTTP 404.</p>
                <p className="text-xs text-amber-800">
                  This usually means the artifact repository is unreachable, private without auth, or has no published releases.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSetDefaultRegistry}
                    disabled={updateSaving || updateActionLoading}
                  >
                    Use Default Registry
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {updates.components.map((comp) => (
                <div key={comp.component} className="rounded border border-gray-200 p-3">
                  {(() => {
                    const statusLabel = inferRegistryStatusLabel(comp.validRepo, comp.lastError)
                    const statusClass = comp.validRepo
                      ? comp.updateAvailable
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'

                    return (
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 uppercase">{comp.component}</h4>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
                    >
                      {comp.validRepo
                        ? comp.updateAvailable
                          ? 'Update Available'
                          : 'Up to Date'
                        : statusLabel}
                    </span>
                  </div>
                    )
                  })()}
                  <dl className="mt-2 space-y-1 text-xs text-gray-600">
                    {!isRegistryMode && (
                      <div>
                        <dt className="inline text-gray-500">Branch: </dt>
                        <dd className="inline font-medium text-gray-800">{comp.branch}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline text-gray-500">Installed: </dt>
                      <dd className="inline font-mono text-gray-800">
                        {componentCurrentDisplay(comp, isRegistryMode)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-gray-500">Latest: </dt>
                      <dd className="inline font-mono text-gray-800">
                        {componentRemoteDisplay(comp, isRegistryMode)}
                      </dd>
                    </div>
                    {/* Show last applied version if available */}
                    {comp.lastAppliedVersion && (
                      <div>
                        <dt className="inline text-gray-500">Last Applied: </dt>
                        <dd className="inline font-mono text-gray-800">{comp.lastAppliedVersion}</dd>
                      </div>
                    )}
                    {/* Show rollback commit if available */}
                    {comp.rollbackCommit && (
                      <div>
                        <dt className="inline text-gray-500">Rollback: </dt>
                        <dd className="inline font-mono text-gray-800">{shortCommit(comp.rollbackCommit)}</dd>
                      </div>
                    )}
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

              if (parsed.status === 'passed' && parsed.noteCount && parsed.notes && parsed.notes.length > 0) {
                return (
                  <div className={containerClasses}>
                    <div className="space-y-3">
                      <div className="font-medium">
                        Validation OK with {parsed.noteCount} Note{parsed.noteCount !== 1 ? 's' : ''}
                      </div>
                      <div className="space-y-2">
                        {/* Group notes by component */}
                        {Array.from(new Map(
                          parsed.notes.map(n => [n.component, n])
                        ).entries()).map(([component, note]) => (
                          <div key={component} className="border-l-2 border-current pl-3">
                            <div className="font-medium text-sm">{component}</div>
                            <div className="text-xs mt-1">{note.message}</div>
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
                            {componentCurrentDisplay(c, isRegistryMode)} → {componentRemoteDisplay(c, isRegistryMode)}
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
                disabled={updateActionLoading || !updates?.availableUpdateCount}
                title={updates && updates.availableUpdateCount && updates.availableUpdateCount > 1 
                  ? `Apply ${updates.availableUpdateCount} available component updates`
                  : updates?.availableUpdateCount === 1
                  ? 'Apply 1 available component update'
                  : 'No updates available'}
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

      {activeSection === 'reboot' && (
        <div className="space-y-5">
          {status && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Uptime</p>
                <p className="mt-1 text-xl font-semibold text-gray-900 font-mono">
                  {formatUptime(status.uptime)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Last Reboot</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {new Date(Date.now() - status.uptime * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <Card title="Reboot System">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button variant="danger" onClick={() => setRebootOpen(true)}>
                Reboot System
              </Button>
              <p className="text-xs text-gray-500">
                Rebooting will briefly interrupt all network services.
              </p>
            </div>
          </Card>
        </div>
      )}

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
            as="select"
            value={editConfig.timezone ?? 'UTC'}
            onChange={(e) => setEditConfig({ ...editConfig, timezone: e.target.value })}
          >
            <option value="">-- Select Timezone --</option>
            {getTimezones().map((tz) => (
              <option key={tz.name} value={tz.name}>
                {tz.label}
              </option>
            ))}
          </FormField>
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
          <div className="col-span-2">
            <label htmlFor="cfg-management-tls-domain" className="block text-sm font-medium text-gray-700">
              Management TLS Certificate (ACME Domain)
            </label>
            <select
              id="cfg-management-tls-domain"
              className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              value={editConfig.managementTlsAcmeDomain ?? ''}
              onChange={(e) => setEditConfig({ ...editConfig, managementTlsAcmeDomain: e.target.value || null })}
            >
              <option value="">Use default management certificate</option>
              {acmeDomains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Select an issued ACME certificate to use for the DayShield management UI.
            </p>
          </div>
        </div>
      </Modal>

      {/* Update Settings Modal */}
      <Modal
        open={updateSettingsOpen}
        title="Update Check Settings"
        onClose={() => setUpdateSettingsOpen(false)}
        onConfirm={handleSaveUpdateSettings}
        confirmLabel="Save"
        loading={updateSaving}
        size="sm"
      >
        {updateSettings && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Configure how frequently the system checks for available updates.
            </p>
            <div className="flex items-center gap-2">
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
            {updateSettings.autoCheckEnabled && (
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
            )}
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

