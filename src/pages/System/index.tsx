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
} from '../../api/system'
import { getFirewallSettings, updateFirewallSettings } from '../../api/firewall'
import { getAcmeConfig } from '../../api/acme'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import type { SystemStatus, SystemConfig, UpdatesStatus, UpdateSettings, UpdateLogEntry, FirewallSettings, NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'
import SchedulesPanel from './SchedulesPanel'
import { useDisplayPreferences, type DateFormatPreference, type TimeFormatPreference } from '../../context/DisplayPreferencesContext'
import type { UpdateScheduleFrequency, UpdateScheduleWeekday } from '../../types'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

const DEFAULT_GITHUB_REGISTRY_URL = 'https://api.github.com/repos/daygle/dayshield-core'
const STATUS_REFRESH_INTERVAL_MS = 15000
const UPDATES_REFRESH_INTERVAL_MS = 5000
const UPDATE_SCHEDULE_FREQUENCY_OPTIONS: Array<{ value: UpdateScheduleFrequency; label: string }> = [
  { value: 'daily', label: 'Every Day' },
  { value: 'weekly', label: 'Every Week' },
  { value: 'monthly', label: 'Every Month' },
]

const UPDATE_WEEKDAY_OPTIONS: Array<{ value: UpdateScheduleWeekday; label: string }> = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

type UpdateMonthlyDay = 'first' | 'last'

const UPDATE_MONTHLY_DAY_OPTIONS: Array<{ value: UpdateMonthlyDay; label: string }> = [
  { value: 'first', label: 'First Day of Month' },
  { value: 'last', label: 'Last Day of Month' },
]

const DATE_FORMAT_OPTIONS: Array<{ value: DateFormatPreference; label: string }> = [
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
  { value: 'dd-mm-yyyy', label: 'DD-MM-YYYY' },
  { value: 'mm-dd-yyyy', label: 'MM-DD-YYYY' },
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY' },
]

const TIME_FORMAT_OPTIONS: Array<{ value: TimeFormatPreference; label: string }> = [
  { value: '24h', label: '24-hour (HH:MM:SS)' },
  { value: '12h', label: '12-hour (HH:MM:SS AM/PM)' },
]

const DEFAULT_FIREWALL_SETTINGS: FirewallSettings = {
  input_policy: 'drop',
  forward_policy: 'drop',
  output_policy: 'accept',
  drop_invalid_state: true,
  syn_flood_protection: true,
  syn_flood_rate: 120,
  syn_flood_burst: 240,
  management_anti_lockout: true,
  management_interface: null,
  management_allowed_sources: [],
  management_ports: [22, 443, 8443],
  log_position: 'after',
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0d 0h 0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function parseCommaSeparatedNumbers(value: string): number[] {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 65535)
}

function shortCommit(value?: string): string {
  return value ? value.slice(0, 8) : '-'
}

function componentCurrentDisplay(
  comp: {
  currentVersion?: string
  currentCommit?: string
  },
): string {
  return comp.currentVersion ?? 'Unknown'
}

function componentRemoteDisplay(
  comp: {
  remoteVersion?: string
  remoteCommit?: string
  },
): string {
  return comp.remoteVersion ?? 'Unknown'
}

function formatUpdateComponentName(component: string): string {
  switch (component.toLowerCase()) {
    case 'core':
      return 'Core'
    case 'ui':
      return 'Web UI'
    case 'rootfs':
      return 'Root Filesystem'
    default:
      return component.charAt(0).toUpperCase() + component.slice(1)
  }
}

function formatUpdateOperationName(operation: string): string {
  switch (operation) {
    case 'apply':
      return 'Apply'
    case 'check':
      return 'Check'
    case 'rollback':
      return 'Rollback'
    case 'validate':
      return 'Validate'
    default:
      return operation
  }
}

function formatUpdateLevelName(level: string): string {
  if (!level) return 'Info'
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()
}

function normalizeUpdateText(text: string, entry?: Pick<UpdateLogEntry, 'component' | 'fromVersion' | 'toVersion'>): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed

  const ensureVersionPrefix = (version: string): string => {
    const v = version.trim()
    return v.toLowerCase().startsWith('v') ? v : `v${v}`
  }

  // Show only file name for created/restored config backup archive
  const backupArchiveMatch = trimmed.match(/^(Restored|Created) config backup archive: (.+[\\\/])?([^\\\/]+)$/)
  if (backupArchiveMatch) {
    return `${backupArchiveMatch[1]} config backup archive: ${backupArchiveMatch[3]}.`
  }

  const lower = trimmed.toLowerCase()

  if (lower === 'manual update check started') {
    return 'Manual update check started.'
  }
  if (lower === 'scheduled update check started') {
    return 'Scheduled update check started.'
  }
  if (lower === 'manual update check completed: no updates found') {
    return 'Manual update check completed: no updates found.'
  }
  if (lower === 'scheduled update check completed: no updates found') {
    return 'Scheduled update check completed: no updates found.'
  }
  if (lower === 'artifact update apply started') {
    return 'Update started.'
  }
  if (lower === 'artifact update apply completed') {
    return 'Update completed successfully.'
  }
  if (lower === 'created backup snapshots') {
    return 'Created backup snapshots.'
  }
  if (lower === 'post-apply service health check passed') {
    return 'Post-update service health check passed.'
  }

  const downloadedMatch = trimmed.match(/^downloaded and verified\s+([a-z0-9_-]+)-(.+)$/i)
  if (downloadedMatch) {
    const component = formatUpdateComponentName(downloadedMatch[1])
    const version = downloadedMatch[2].trim()
    return `Downloaded and verified ${component} ${version}.`
  }

  const deployedMatch = trimmed.match(/^deployed\s+([a-z0-9_-]+)-(.+)$/i)
  if (deployedMatch) {
    const component = formatUpdateComponentName(deployedMatch[1])
    const version = deployedMatch[2].trim()
    const fromVersion = entry?.fromVersion?.trim()
    if (fromVersion) {
      return `Deployed ${component} from ${ensureVersionPrefix(fromVersion)} to ${ensureVersionPrefix(version)}.`
    }
    return `Deployed ${component} ${ensureVersionPrefix(version)}.`
  }

  const rollbackMatch = trimmed.match(/^rolled back\s+([a-z0-9_-]+)\s+to\s+v?(.+)$/i)
  if (rollbackMatch) {
    const component = formatUpdateComponentName(rollbackMatch[1])
    const toVersion = entry?.toVersion?.trim() || rollbackMatch[2].trim()
    const fromVersion = entry?.fromVersion?.trim()
    if (fromVersion) {
      return `Rolled back ${component} from ${ensureVersionPrefix(fromVersion)} to ${ensureVersionPrefix(toVersion)}.`
    }
    return `Rolled back ${component} to ${ensureVersionPrefix(toVersion)}.`
  }

  const updatesFoundMatch = trimmed.match(/^manual update check completed:\s*updates found for\s+(.+)$/i)
  if (updatesFoundMatch) {
    const components = updatesFoundMatch[1]
      .split(',')
      .map((name) => formatUpdateComponentName(name.trim()))
      .filter(Boolean)
      .join(', ')
    return `Manual update check completed: updates found for ${components}.`
  }

  const firstUpper = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  const normalized = firstUpper
    .replace(/\bok\b/g, 'OK')
    .replace(/\bui\b/g, 'UI')
    .replace(/\bids\b/g, 'IDS')
    .replace(/\bips\b/g, 'IPS')

  if (/[.!?]$/.test(normalized)) return normalized
  return `${normalized}.`
}

function updateLogLevelClasses(level: string): string {
  switch (level) {
    case 'success':
      return 'bg-green-100 text-green-700'
    case 'error':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

/**
 * Get a list of IANA timezone identifiers for use in dropdowns
 */
function getTimezones(): Array<{ name: string; label: string }> {
  const fallback = ['UTC', 'Etc/UTC']
  const zoneIds = (() => {
    const maybeIntl = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[]
    }
    if (typeof maybeIntl.supportedValuesOf === 'function') {
      const zones = maybeIntl.supportedValuesOf('timeZone')
      if (Array.isArray(zones) && zones.length > 0) return zones
    }
    return fallback
  })()

  const unique = Array.from(new Set([...zoneIds, 'UTC']))
  return unique
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, label: name }))
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

function formatUpdateScheduleWeekday(weekday: UpdateScheduleWeekday): string {
  return UPDATE_WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label ?? weekday
}

function formatUpdateSchedule(settings: {
  autoCheckFrequency?: UpdateScheduleFrequency
  autoCheckTime?: string
  autoCheckWeekday?: UpdateScheduleWeekday
  autoCheckMonthDays?: number[]
}): string {
  const time = normalizeUpdateTime(settings.autoCheckTime ?? '03:00')
  switch (settings.autoCheckFrequency ?? 'daily') {
    case 'weekly':
      return `Every week on ${formatUpdateScheduleWeekday(settings.autoCheckWeekday ?? 'monday')} at ${time}`
    case 'monthly': {
      const monthlyDay = getMonthlyDaySelection(settings.autoCheckMonthDays)
      return monthlyDay === 'last'
        ? `Every month on the last day at ${time}`
        : `Every month on the first day at ${time}`
    }
    case 'daily':
    default:
      return `Every day at ${time}`
  }
}

function normalizeUpdateTime(value: string): string {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  return match ? `${match[1]}:${match[2]}` : '03:00'
}

function normalizeUpdateMonthDays(days: number[]): number[] {
  return days.includes(31) ? [31] : [1]
}

function getMonthlyDaySelection(days?: number[]): UpdateMonthlyDay {
  const normalized = normalizeUpdateMonthDays(days ?? [1])
  return normalized.includes(31) ? 'last' : 'first'
}

function toMonthlyDays(selection: UpdateMonthlyDay): number[] {
  return selection === 'last' ? [31] : [1]
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

function inferUpdateStatusLabel(validRepo: boolean, lastError?: string): string {
  if (validRepo) return 'Up to Date'
  const err = (lastError ?? '').toLowerCase()
  if (err.includes('http 404')) return 'Update not available'
  if (err.includes('http 401') || err.includes('http 403')) return 'Cannot access update server'
  if (err.includes('timed out') || err.includes('dns') || err.includes('connection')) return 'Update server unreachable'
  return 'Update check failed'
}

function simplifyErrorMessage(error: string): string {
  // Remove the "FAILED TO QUERY REGISTRY" prefix and similar wrapper text
  let simplified = error
    .replace(/^FAILED TO QUERY REGISTRY:\s*/i, '')
    .replace(/^UPDATE ERROR:\s*/i, '')
    .replace(/^failed to query registry:\s*/i, '')
  
  // For HTTP errors, provide context
  if (simplified.includes('HTTP 401') || simplified.includes('HTTP 403')) {
    return 'Authentication failed. Check if the update source URL is correct.'
  }
  if (simplified.includes('HTTP 404')) {
    return 'Update version not found at the specified source.'
  }
  if (simplified.includes('HTTP')) {
    // Extract just the HTTP status without the full URL
    const match = simplified.match(/HTTP (\d+)/)
    if (match) {
      return `Update check failed (HTTP ${match[1]}). Please check your network connection.`
    }
  }
  if (simplified.includes('rate limit') || simplified.includes('429')) {
    return 'Update server rate limit exceeded. Please try again in a few minutes.'
  }
  if (simplified.includes('timeout') || simplified.includes('timed out')) {
    return 'Update server connection timed out. Check your network connection.'
  }
  if (simplified.includes('dns') || simplified.includes('no such host')) {
    return 'Cannot resolve update server address. Check your network and DNS settings.'
  }
  if (simplified.includes('connection refused')) {
    return 'Update server connection refused. The server may be down.'
  }
  
  // Return original if no matches, but trim if very long
  return simplified.length > 150 ? simplified.substring(0, 147) + '...' : simplified
}

function detectUpdateNotFoundHint(components: UpdatesStatus['components']): string | null {
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
  const normalized = message.toLowerCase()

  // Handle preflight/general update failures
  if (normalized.includes('preflight failed') || normalized.includes('update action failed')) {
    return {
      status: 'error',
      error: message,
    }
  }

  if (normalized.includes('validation failed')) {
    const errorMatch = message.match(/validation failed:\s*(.+)/i)
    return {
      status: 'failed',
      error: errorMatch ? errorMatch[1] : 'Validation failed',
    }
  }

  if (normalized.includes('validation passed')) {
    const countMatch = message.match(/validation passed with (\d+) note\(s\)/i)
    let noteCount = countMatch ? parseInt(countMatch[1], 10) : 0

    const notePart = message.split(': ', 2)[1] || ''
    const notes: Array<{ component: string; message: string }> = []

    // Split by pipe and parse each note
    const items = notePart.split(' | ').filter(Boolean)
    for (const item of items) {
      const match = item.match(/^([^:]+):\s*(.+)$/)
      if (match) {
        notes.push({
          component: match[1].trim(),
          message: normalizeUpdateText(match[2].trim()),
        })
      }
    }

    if (!countMatch && notes.length > 0) {
      noteCount = notes.length
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
  const { dateFormat, timeFormat, setDateFormat, setTimeFormat, formatDateTime } = useDisplayPreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [firewallSettings, setFirewallSettings] = useState<FirewallSettings>(DEFAULT_FIREWALL_SETTINGS)
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acmeDomains, setAcmeDomains] = useState<string[]>([])
  const [editConfig, setEditConfig] = useState<Partial<SystemConfig>>({})
  const [managementAllowedSourcesInput, setManagementAllowedSourcesInput] = useState('')
  const [managementPortsInput, setManagementPortsInput] = useState('22, 443, 8443')
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
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false)

  const activeSection = searchParams.get('section') === 'updates'
    ? 'updates'
    : searchParams.get('section') === 'reboot'
      ? 'reboot'
      : searchParams.get('section') === 'schedules'
        ? 'schedules'
      : 'overview'

  const sectionTabs: Array<{ id: 'overview' | 'updates' | 'schedules' | 'reboot'; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'updates', label: 'Updates' },
    { id: 'schedules', label: 'Schedules' },
    { id: 'reboot', label: 'Reboot' },
  ]

  const setActiveSection = (section: 'overview' | 'updates' | 'schedules' | 'reboot') => {
    const next = new URLSearchParams(searchParams)
    if (section === 'overview') next.delete('section')
    else next.set('section', section)
    setSearchParams(next)
  }
  const allTimezones = getTimezones()
  const selectedTimezone = editConfig.timezone ?? 'UTC'
  const timezoneOptions = (() => {
    if (allTimezones.some((tz) => tz.name === selectedTimezone)) {
      return allTimezones
    }
    const selected = allTimezones.find((tz) => tz.name === selectedTimezone)
    if (selected) {
      return [selected, ...allTimezones]
    }
    if (selectedTimezone) {
      return [{ name: selectedTimezone, label: selectedTimezone }, ...allTimezones]
    }
    return allTimezones
  })()

  const interfaceLabel = (iface: NetworkInterface): string =>
    formatInterfaceDisplayName(iface.description, iface.name)

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      getSystemStatus(),
      getSystemConfig(),
      getUpdatesStatus(),
      getUpdateSettings(),
      getAcmeConfig(),
      getFirewallSettings(),
      getInterfaces(),
      getInterfacesInventory(),
    ])
      .then(([st, cfg, upd, updSettings, acme, fw, ifacesRes, inventoryRes]) => {
        setStatus(st.data)
        setConfig(cfg.data)
        setEditConfig(cfg.data)
        setUpdates(upd.data)
        setUpdateSettings(updSettings.data)
        setAcmeDomains(acme.data.domains ?? [])

        const mergedFirewallSettings = { ...DEFAULT_FIREWALL_SETTINGS, ...fw.data }
        setFirewallSettings(mergedFirewallSettings)
        setManagementAllowedSourcesInput((mergedFirewallSettings.management_allowed_sources ?? []).join(', '))
        setManagementPortsInput((mergedFirewallSettings.management_ports ?? []).join(', '))

        const configured = (ifacesRes.data ?? []).filter((iface) => iface.enabled !== false)
        const known = new Set(configured.map((iface) => iface.name))
        const extras = (inventoryRes.data?.names ?? [])
          .filter((name) => name !== 'lo' && !known.has(name))
          .map((name) => ({
            name,
            description: '',
            type: 'ethernet' as const,
            enabled: true,
          }))
        setInterfaces([...configured, ...extras])
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

  useEffect(() => {
    if (activeSection !== 'updates') return

    const refreshUpdates = () => {
      getUpdatesStatus()
        .then((res) => setUpdates(res.data))
        .catch(() => {
          // Keep current UI state on transient poll failures.
        })
    }

    refreshUpdates()
    const timer = window.setInterval(refreshUpdates, UPDATES_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [activeSection])

  const handleSaveConfig = () => {
    const managementAllowedSources = managementAllowedSourcesInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const managementPorts = parseCommaSeparatedNumbers(managementPortsInput)

    if (managementPortsInput.trim() && managementPorts.length === 0) {
      setError('Enter valid management ports as comma-separated numbers.')
      return
    }

    const firewallPayload: FirewallSettings = {
      ...firewallSettings,
      management_interface: firewallSettings.management_interface || null,
      management_allowed_sources: managementAllowedSources,
      management_ports: managementPorts.length ? managementPorts : [22, 443, 8443],
      syn_flood_rate: Math.max(1, Number(firewallSettings.syn_flood_rate || 1)),
      syn_flood_burst: Math.max(1, Number(firewallSettings.syn_flood_burst || 1)),
    }

    setSaving(true)
    Promise.all([updateSystemConfig(editConfig), updateFirewallSettings(firewallPayload)])
      .then(([systemRes, firewallRes]) => {
        setConfig(systemRes.data)
        setEditConfig(systemRes.data)
        const mergedFirewallSettings = { ...DEFAULT_FIREWALL_SETTINGS, ...firewallRes.data }
        setFirewallSettings(mergedFirewallSettings)
        setManagementAllowedSourcesInput((mergedFirewallSettings.management_allowed_sources ?? []).join(', '))
        setManagementPortsInput((mergedFirewallSettings.management_ports ?? []).join(', '))
        setError(null)
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
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUpdateActionLoading(false))
  }

  const handleRollbackUpdates = () => {
    setRollbackConfirmOpen(true)
  }

  const handleRollbackConfirm = () => {
    setRollbackConfirmOpen(false)
    setUpdateActionLoading(true)
    setUpdateActionMessage(null)
    rollbackUpdates('both')
      .then((res) => {
        setUpdates(res.data.status)
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
    const normalizedUpdateSettings: UpdateSettings = {
      ...updateSettings,
      autoCheckTime: normalizeUpdateTime(updateSettings.autoCheckTime),
      autoCheckMonthDays: normalizeUpdateMonthDays(updateSettings.autoCheckMonthDays),
      autoCheckWeekday: updateSettings.autoCheckWeekday ?? 'monday',
    }
    updateUpdateSettings({
      ...normalizedUpdateSettings,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        Loading system information…
      </div>
    )
  }

  const updateNotFoundHint = updates ? detectUpdateNotFoundHint(updates.components) : null

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="System tabs">
          {sectionTabs.map((tab) => {
            const isActive = activeSection === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={[
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

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
                {formatDateTime(status.lastUpdated)}
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
            <button
              onClick={() => { setEditConfig(config); setEditOpen(true) }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
              title="Edit system configuration"
              aria-label="Edit system configuration"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
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
            <div>
              <dt className="text-gray-500">IPv6</dt>
              <dd className={`font-medium ${config.ipv6Enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config.ipv6Enabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Management Interface</dt>
              <dd className="font-medium text-gray-800">{firewallSettings.management_interface || 'Any interface'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Management Allowed Sources</dt>
              <dd className="font-medium text-gray-800">{(firewallSettings.management_allowed_sources ?? []).join(', ') || 'Any source'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Management Ports</dt>
              <dd className="font-medium text-gray-800">{(firewallSettings.management_ports ?? []).join(', ') || '-'}</dd>
            </div>
          </dl>
        </Card>
      )}

      {activeSection === 'overview' && (
        <Card title="Display Preferences" subtitle="Global date and time display format for the web UI">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="display-date-format"
              label="Date Format"
              as="select"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormatPreference)}
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FormField>

            <FormField
              id="display-time-format"
              label="Time Format"
              as="select"
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as TimeFormatPreference)}
            >
              {TIME_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FormField>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Preview: {formatDateTime(new Date())}
          </p>
        </Card>
      )}

      {activeSection === 'updates' && updates && (
        <Card
          title="Software Updates"
          subtitle="Manage prebuilt updates for DayShield core, UI, and rootfs"
          actions={
            <Button
              size="sm"
              onClick={() => {
                setUpdateSettings(updates.settings)
                setUpdateSettingsOpen(true)
              }}
            >
              Update Settings
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded border border-gray-200 p-3 bg-gray-50">
              <p className="text-gray-500 text-sm">Automatic Update Check</p>
              <p className="font-medium text-gray-900">
                {updates.settings.autoCheckEnabled
                  ? formatUpdateSchedule(updates.settings)
                  : 'Disabled'}
              </p>
            </div>

            {updateNotFoundHint && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 space-y-2">
                <p className="font-medium">Update not found on server.</p>
                <p className="text-xs text-amber-800">
                  This usually means the update server is unreachable, requires authentication, or has no published releases.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSetDefaultRegistry}
                    disabled={updateSaving || updateActionLoading}
                  >
                    Use default update source
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {updates.components
                .filter((comp) => comp.component !== 'rootfs')
                .map((comp) => (
                <div key={comp.component} className="rounded border border-gray-200 p-3">
                  {(() => {
                    const statusLabel = inferUpdateStatusLabel(comp.validRepo, comp.lastError)
                    const statusClass = comp.validRepo
                      ? comp.updateAvailable
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'

                    return (
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{formatUpdateComponentName(comp.component)}</h4>
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
                    <div>
                      <dt className="inline text-gray-500">Current version: </dt>
                      <dd className="inline font-mono text-gray-800">
                        {componentCurrentDisplay(comp)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-gray-500">Available version: </dt>
                      <dd className="inline font-mono text-gray-800">
                        {componentRemoteDisplay(comp)}
                      </dd>
                    </div>
                    {/* Show last applied version if available */}
                    {comp.lastAppliedVersion && (
                      <div>
                        <dt className="inline text-gray-500">Last installed: </dt>
                        <dd className="inline font-mono text-gray-800">{comp.lastAppliedVersion}</dd>
                      </div>
                    )}
                    {/* Show rollback commit if available */}
                    {comp.rollbackCommit && (
                      <div>
                        <dt className="inline text-gray-500">Rollback target: </dt>
                        <dd className="inline font-mono text-gray-800">{shortCommit(comp.rollbackCommit)}</dd>
                      </div>
                    )}
                    {comp.lastError && (() => {
                      const parsed = parseComponentError(comp.lastError)
                      const simplified = simplifyErrorMessage(parsed.message)
                      return (
                        <div className="mt-2 rounded bg-red-50 border border-red-200 p-2">
                          <div className="text-xs font-medium text-red-700">Update Check Failed</div>
                          <div className="text-xs text-red-600 mt-1">{simplified}</div>
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
                      Last changed: {formatDateTime(updates.applianceRebuildMarkedAt)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {updateActionMessage && (() => {
              const parsed = parseValidationMessage(updateActionMessage)
              const containerClasses = updateActionMessageClasses(updateActionMessage)
              const formattedMessage = normalizeUpdateText(updateActionMessage)

              if (parsed.status === 'error') {
                return (
                  <div className={containerClasses}>
                    <div className="space-y-2">
                      <div className="font-medium">Update Failed</div>
                      <div className="text-sm">{parsed.error ? normalizeUpdateText(parsed.error) : 'Update failed.'}</div>
                    </div>
                  </div>
                )
              }

              if (parsed.status === 'failed') {
                return (
                  <div className={containerClasses}>
                    <div className="font-medium mb-2">Validation Failed</div>
                    <div className="text-sm">{parsed.error ? normalizeUpdateText(parsed.error) : 'Validation failed.'}</div>
                  </div>
                )
              }


              // Remove green validation box: do not render anything for validation passed with notes
              if (parsed.status === 'passed' && parsed.notes && parsed.notes.length > 0) {
                return null
              }

              return (
                <div className={containerClasses}>
                  {formattedMessage}
                </div>
              )
            })()}

            <div className="rounded-md border border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
                <h4 className="text-sm font-semibold text-gray-900">Update Logs</h4>
                <span className="text-xs text-gray-500">Newest first</span>
              </div>
              {updates.operationLogs && updates.operationLogs.length > 0 ? (
                <ul className="max-h-72 overflow-auto divide-y divide-gray-200">
                  {[...updates.operationLogs]
                    .sort((a: UpdateLogEntry, b: UpdateLogEntry) =>
                      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
                    )
                    .map((entry: UpdateLogEntry, idx: number) => (
                      <li key={`${entry.timestamp}-${entry.operation}-${idx}`} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono text-gray-500">
                            {formatDateTime(entry.timestamp)}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                            {formatUpdateOperationName(entry.operation)}
                          </span>
                          {entry.component && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {formatUpdateComponentName(entry.component)}
                            </span>
                          )}
                          <span className={`rounded px-2 py-0.5 font-medium ${updateLogLevelClasses(entry.level)}`}>
                            {formatUpdateLevelName(entry.level)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-gray-800">{normalizeUpdateText(entry.message, entry)}</p>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="px-4 py-4 text-sm text-gray-500">No update logs recorded yet.</div>
              )}
            </div>

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

      {activeSection === 'schedules' && (
        <SchedulesPanel onError={setError} />
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
                  {formatDateTime(new Date(Date.now() - status.uptime * 1000))}
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
            className="col-span-2"
            as="select"
            value={editConfig.timezone ?? 'UTC'}
            onChange={(e) => setEditConfig({ ...editConfig, timezone: e.target.value })}
          >
            <option value="">-- Select Timezone --</option>
            {timezoneOptions.map((tz) => (
              <option key={tz.name} value={tz.name}>
                {tz.label}
              </option>
            ))}
            {timezoneOptions.length === 0 && <option value="" disabled>No matching timezones</option>}
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
          <div className="col-span-2 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              id="cfg-ipv6-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={editConfig.ipv6Enabled ?? false}
              onChange={(e) => setEditConfig({ ...editConfig, ipv6Enabled: e.target.checked })}
            />
            <label htmlFor="cfg-ipv6-enabled" className="text-sm font-medium text-gray-700">
              Enable IPv6
            </label>
          </div>
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
          <div className="col-span-2 border-t border-gray-200 pt-3">
            <p className="text-sm font-semibold text-gray-900">Management Access Controls</p>
            <p className="text-xs text-gray-500 mt-1">These controls were moved from Firewall Settings to System Settings.</p>
          </div>
          <FormField
            id="cfg-management-interface"
            className="col-span-2"
            label="Management Interface (optional)"
            as="select"
            value={firewallSettings.management_interface ?? ''}
            onChange={(e) => setFirewallSettings((prev) => ({ ...prev, management_interface: e.target.value || null }))}
          >
            <option value="">Any interface</option>
            {interfaces.map((iface) => (
              <option key={iface.name} value={iface.name}>
                {interfaceLabel(iface)}
              </option>
            ))}
          </FormField>
          <FormField
            id="cfg-management-sources"
            className="col-span-2"
            label="Management Allowed Sources (comma-separated CIDRs)"
            placeholder="e.g. 192.168.1.0/24, 10.0.0.0/8"
            value={managementAllowedSourcesInput}
            onChange={(e) => setManagementAllowedSourcesInput(e.target.value)}
          />
          <FormField
            id="cfg-management-ports"
            className="col-span-2"
            label="Management Ports (comma-separated)"
            placeholder="e.g. 22, 443, 8443"
            value={managementPortsInput}
            onChange={(e) => setManagementPortsInput(e.target.value)}
          />
        </div>
      </Modal>

      {/* Update Settings Modal */}
      <Modal
        open={updateSettingsOpen}
        title="Automatic Update Checks"
        onClose={() => setUpdateSettingsOpen(false)}
        onConfirm={handleSaveUpdateSettings}
        confirmLabel="Save"
        loading={updateSaving}
        size="sm"
      >
        {updateSettings && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose whether DayShield checks for updates automatically and when it runs.
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
                Check for updates automatically
              </label>
            </div>
            {updateSettings.autoCheckEnabled && (
              <div className="space-y-4">
                <FormField
                  id="upd-frequency"
                  as="select"
                  label="Schedule"
                  hint="Pick whether updates run daily, weekly, or monthly."
                  value={updateSettings.autoCheckFrequency ?? 'daily'}
                  onChange={(e) => {
                    const nextFrequency = e.target.value as UpdateScheduleFrequency
                    setUpdateSettings({
                      ...updateSettings,
                      autoCheckFrequency: nextFrequency,
                      autoCheckWeekday: nextFrequency === 'weekly' ? updateSettings.autoCheckWeekday ?? 'monday' : updateSettings.autoCheckWeekday,
                      autoCheckMonthDays: nextFrequency === 'monthly'
                        ? normalizeUpdateMonthDays(updateSettings.autoCheckMonthDays ?? [1])
                        : updateSettings.autoCheckMonthDays,
                    })
                  }}
                >
                  {UPDATE_SCHEDULE_FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FormField>

                <FormField
                  id="upd-time"
                  label="Time"
                  type="time"
                  hint="The update check runs at this local time."
                  value={normalizeUpdateTime(updateSettings.autoCheckTime ?? '03:00')}
                  onChange={(e) => setUpdateSettings({ ...updateSettings, autoCheckTime: e.target.value })}
                />

                {updateSettings.autoCheckFrequency === 'weekly' && (
                  <FormField
                    id="upd-weekday"
                    as="select"
                    label="Day of Week"
                    hint="Choose the day DayShield checks for updates each week."
                    value={updateSettings.autoCheckWeekday ?? 'monday'}
                    onChange={(e) =>
                      setUpdateSettings({
                        ...updateSettings,
                        autoCheckWeekday: e.target.value as UpdateScheduleWeekday,
                      })
                    }
                  >
                    {UPDATE_WEEKDAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FormField>
                )}

                {updateSettings.autoCheckFrequency === 'monthly' && (
                  <FormField
                    id="upd-monthly-day"
                    as="select"
                    label="Monthly Day"
                    hint="Choose whether the monthly check runs on the first or last day of each month."
                    value={getMonthlyDaySelection(updateSettings.autoCheckMonthDays)}
                    onChange={(e) =>
                      setUpdateSettings({
                        ...updateSettings,
                        autoCheckMonthDays: toMonthlyDays(e.target.value as UpdateMonthlyDay),
                      })
                    }
                  >
                    {UPDATE_MONTHLY_DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FormField>
                )}
              </div>
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

      {/* Rollback Confirmation Modal */}
      <Modal
        open={rollbackConfirmOpen}
        title="Confirm Rollback"
        onClose={() => setRollbackConfirmOpen(false)}
        onConfirm={handleRollbackConfirm}
        confirmLabel="Rollback"
        confirmVariant="danger"
        loading={updateActionLoading}
        size="sm"
      >
        <div className="space-y-2">
          <p className="text-sm text-red-700 font-medium">
            Rolling back will revert both the software and the configuration to their previous state.
          </p>
          <p className="text-sm text-gray-700">
            This action cannot be undone. All changes made since the last update will be lost.
          </p>
        </div>
      </Modal>
    </div>
  )
}

