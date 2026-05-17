import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getFirewallRules,
  createFirewallRule,
  updateFirewallRule,
  deleteFirewallRule,
  getFirewallSettings,
  updateFirewallSettings,
  getFirewallStats,
} from '../../api/firewall'
import { getAliases, createAlias, deleteAlias } from '../../api/aliases'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import { getWgInterfaces } from '../../api/wireguard'
import type { Alias, AliasType, FirewallRule, FirewallRuleStats, FirewallSchedule, FirewallSettings, NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

type RuleRow = FirewallRule & Record<string, unknown>
type AliasRow = Alias & Record<string, unknown>

const defaultRuleForm: Partial<FirewallRule> = {
  description: '',
  action: 'accept',
  direction: 'forward',
  protocol: 'tcp',
  source: null,
  source_port: null,
  destination: null,
  destination_port: null,
  interface: null,
  log: false,
  priority: 100,
  enabled: true,
  schedule: null,
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const defaultAliasForm: Alias = {
  name: '',
  alias_type: 'host',
  description: null,
  values: [],
  ttl: null,
  enabled: true,
}

const defaultSettings: FirewallSettings = {
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

function actionBadge(action: FirewallRule['action']) {
  const map: Record<FirewallRule['action'], string> = {
    accept: 'bg-green-100 text-green-700',
    drop: 'bg-red-100 text-red-700',
    reject: 'bg-orange-100 text-orange-700',
    jump: 'bg-purple-100 text-purple-700',
    log: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${map[action]}`}>
      {action}
    </span>
  )
}

function directionLabel(direction: FirewallRule['direction']) {
  switch (direction) {
    case 'input':
      return 'Inbound'
    case 'both':
      return 'In/Out'
    case 'forward':
      return 'Routed'
    case 'output':
      return 'Outbound'
    default:
      return direction
  }
}

function protocolLabel(protocol: FirewallRule['protocol']) {
  switch (protocol) {
    case 'tcp':
      return 'TCP'
    case 'udp':
      return 'UDP'
    case 'icmp':
      return 'ICMP'
    case 'icmpv6':
      return 'ICMPv6'
    case 'any':
    case null:
    case undefined:
      return 'Any'
    default:
      return String(protocol)
  }
}

function interfaceFieldLabel(direction: FirewallRule['direction']) {
  if (direction === 'output') return 'Egress Interface'
  if (direction === 'both') return 'Interface'
  return 'Ingress Interface'
}

function interfaceFieldHint(direction: FirewallRule['direction']) {
  switch (direction) {
    case 'input':
      return 'Matches traffic entering the firewall on this interface.'
    case 'both':
      return 'Matches both inbound and outbound traffic on this interface.'
    case 'forward':
      return 'Matches routed traffic by its incoming interface.'
    case 'output':
      return 'Matches traffic leaving the firewall on this interface.'
    default:
      return undefined
  }
}

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res
  const maybe = (res as { data?: unknown })?.data
  if (Array.isArray(maybe)) return maybe as T[]
  return []
}

function toIpv4NetworkCidr(address?: string, prefix?: number): string | null {
  if (!address || typeof prefix !== 'number' || prefix < 0 || prefix > 32) return null
  const parts = address.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null

  const ip =
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0)
  const net = (ip & mask) >>> 0
  const octets = [
    (net >>> 24) & 0xff,
    (net >>> 16) & 0xff,
    (net >>> 8) & 0xff,
    net & 0xff,
  ]
  return `${octets.join('.')}/${prefix}`
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value === undefined || value === null) return null
  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function isPort(value: unknown): boolean {
  const port = toNumber(value)
  return port !== null && Number.isInteger(port) && port > 0 && port <= 65535
}

function validateFirewallRuleForm(rule: Partial<FirewallRule>): string | null {
  if (rule.priority == null || !Number.isInteger(rule.priority) || rule.priority < 1) {
    return 'Priority must be a positive integer.'
  }

  if (rule.source_port != null && !isPort(rule.source_port)) {
    return 'Source port must be a valid port number between 1 and 65535.'
  }

  if (rule.destination_port != null && !isPort(rule.destination_port)) {
    return 'Destination port must be a valid port number between 1 and 65535.'
  }

  if (rule.schedule) {
    const { time_start, time_end, date_start, date_end } = rule.schedule
    const timePattern = /^\d{2}:\d{2}$/
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if ((time_start && !timePattern.test(time_start)) || (time_end && !timePattern.test(time_end))) {
      return 'Schedule time must be in HH:MM format.'
    }
    if ((date_start && !datePattern.test(date_start)) || (date_end && !datePattern.test(date_end))) {
      return 'Schedule date must be in YYYY-MM-DD format.'
    }
  }

  return null
}

function validateAliasForm(alias: Alias): string | null {
  if (!alias.name?.trim()) {
    return 'Alias name is required.'
  }

  const entries = (alias.values ?? []).map((value) => String(value).trim()).filter(Boolean)
  if (entries.length === 0) {
    return 'At least one alias entry is required.'
  }

  if (alias.alias_type === 'port') {
    if (entries.some((value) => !isPort(value))) {
      return 'All port alias entries must be valid port numbers.'
    }
  }

  return null
}

export default function Firewall() {
  const { formatDate, timeFormat } = useDisplayPreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSection = searchParams.get('section')
  const selectedInterface = searchParams.get('iface')

  const [rules, setRules] = useState<RuleRow[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState<Partial<FirewallRule>>(defaultRuleForm)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)
  const [editRule, setEditRule] = useState<FirewallRule | null>(null)

  const [aliases, setAliases] = useState<AliasRow[]>([])
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [vpnInterfaceNames, setVpnInterfaceNames] = useState<string[]>([])
  const [aliasesLoading, setAliasesLoading] = useState(true)
  const [aliasesError, setAliasesError] = useState<string | null>(null)
  const [aliasModalOpen, setAliasModalOpen] = useState(false)
  const [aliasForm, setAliasForm] = useState<Alias>(defaultAliasForm)
  const [aliasSaving, setAliasSaving] = useState(false)
  const [deleteAliasName, setDeleteAliasName] = useState<string | null>(null)
  const [deletingAlias, setDeletingAlias] = useState(false)

  const [settings, setSettings] = useState<FirewallSettings>(defaultSettings)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsFormError, setSettingsFormError] = useState<string | null>(null)

  const [stats, setStats] = useState<FirewallRuleStats[]>([])
  const [ruleFormError, setRuleFormError] = useState<string | null>(null)
  const [aliasFormError, setAliasFormError] = useState<string | null>(null)

  const interfaceLabel = (iface: NetworkInterface): string => {
    const prefix = vpnInterfaceNames.includes(iface.name) ? 'VPN • ' : ''
    const base = formatInterfaceDisplayName(iface.description, iface.name)
    return `${prefix}${base}`
  }

  const formatScheduleDate = (value: string | null | undefined): string | null => {
    if (!value) return null
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return value
    const y = Number(match[1])
    const m = Number(match[2])
    const d = Number(match[3])
    const parsed = new Date(y, m - 1, d)
    if (Number.isNaN(parsed.getTime())) return value
    return formatDate(parsed)
  }

  const formatScheduleTime = (value: string | null | undefined, fallback: string): string => {
    const source = value ?? fallback
    const match = source.match(/^(\d{2}):(\d{2})$/)
    if (!match) return source
    const hours24 = Number(match[1])
    const minutes = match[2]
    if (timeFormat === '12h') {
      const meridiem = hours24 >= 12 ? 'PM' : 'AM'
      const hours12 = hours24 % 12 || 12
      return `${String(hours12).padStart(2, '0')}:${minutes} ${meridiem}`
    }
    return `${String(hours24).padStart(2, '0')}:${minutes}`
  }

  const selectedInterfaceDisplay = selectedInterface
    ? (() => {
        const iface = interfaces.find((item) => item.name === selectedInterface)
        return iface ? interfaceLabel(iface) : selectedInterface
      })()
    : ''

  const visibleRules = useMemo(
    () => {
      const filtered = selectedInterface
        ? rules.filter((rule) => (rule.interface as string | null) === selectedInterface)
        : rules
      return [...filtered].sort((a, b) => ((a.priority as number) ?? 100) - ((b.priority as number) ?? 100))
    },
    [rules, selectedInterface],
  )

  const rulesEmptyMessage = selectedInterface
    ? `No firewall rules defined for ${selectedInterfaceDisplay}.`
    : 'No firewall rules defined.'

  const activeSection =
    selectedSection === 'aliases' || selectedSection === 'settings' || selectedSection === 'rules'
      ? selectedSection
      : 'settings'
  const showRulesSection = activeSection === 'rules'
  const showAliasesSection = activeSection === 'aliases'
  const showSettingsSection = activeSection === 'settings'

  const sectionTabs: Array<{ id: 'settings' | 'rules' | 'aliases'; label: string }> = [
    { id: 'settings', label: 'Settings' },
    { id: 'rules', label: 'Rules' },
    { id: 'aliases', label: 'Aliases' },
  ]

  const setActiveSection = (section: 'settings' | 'rules' | 'aliases') => {
    const next = new URLSearchParams(searchParams)
    next.set('section', section)
    if (section !== 'rules') {
      next.delete('iface')
    }
    setSearchParams(next)
  }

  const updateRulesInterfaceFilter = (interfaceName: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('section', 'rules')
    if (interfaceName) next.set('iface', interfaceName)
    else next.delete('iface')
    setSearchParams(next)
  }

  const openAddRuleModal = () => {
    const nextPriority = rules.length > 0
      ? Math.max(...rules.map((rule) => (rule.priority as number) ?? 100)) + 10
      : 100

    setRuleForm({
      ...defaultRuleForm,
      interface: selectedInterface || null,
      priority: nextPriority,
    })
    setRuleFormError(null)
    setEditRule(null)
    setRuleModalOpen(true)
  }

  const openEditRulePanel = (rule: FirewallRule) => {
    const editableRule: Partial<FirewallRule> = { ...rule }
    delete editableRule.id
    setRuleForm(editableRule)
    setRuleFormError(null)
    setEditRule(rule)
    setRuleModalOpen(true)
  }

  const loadRules = () => {
    setRulesLoading(true)
    getFirewallRules()
      .then((res) => setRules((res.data as RuleRow[]) ?? []))
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setRulesLoading(false))
  }

  const loadStats = () => {
    getFirewallStats()
      .then((res) => setStats((res.data as FirewallRuleStats[]) ?? []))
      .catch(() => { /* stats are best-effort */ })
  }

  const loadAliases = () => {
    setAliasesLoading(true)
    getAliases()
      .then((res) => setAliases(unwrapArray<AliasRow>(res)))
      .catch((err: Error) => setAliasesError(err.message))
      .finally(() => setAliasesLoading(false))
  }

  const loadInterfaces = () => {
    Promise.all([getInterfaces(), getInterfacesInventory(), getWgInterfaces()])
      .then(([ifacesRes, inventoryRes, wgRes]) => {
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

        const enabledVpn = (wgRes.data ?? [])
          .filter((wg) => wg.enabled)
          .map((wg) => wg.interface)
          .filter(Boolean)

        const knownAfterKernel = new Set([...known, ...extras.map((e) => e.name)])
        const vpnExtras = enabledVpn
          .filter((name) => !knownAfterKernel.has(name))
          .map((name) => {
            const wg = (wgRes.data ?? []).find((item) => item.interface === name)
            return {
              name,
              description: wg?.description?.trim() || 'VPN',
              type: 'ethernet' as const,
              enabled: true,
            }
          })

        setVpnInterfaceNames(enabledVpn)
        setInterfaces([...configured, ...extras, ...vpnExtras])
      })
      .catch(() => {
        setVpnInterfaceNames([])
        setInterfaces([])
      })
  }

  const loadSettings = () => {
    getFirewallSettings()
      .then((res) => {
        setSettings({ ...defaultSettings, ...res.data })
      })
      .catch((err: Error) => setSettingsError(err.message))
  }

  useEffect(() => {
    loadRules()
    loadAliases()
    loadInterfaces()
    loadSettings()
    loadStats()
  }, [])

  const lanNetworkCidr = useMemo(() => {
    const preferredLan = interfaces.find((iface) => {
      const name = iface.name.toLowerCase()
      const desc = (iface.description ?? '').toLowerCase()
      return name.includes('lan') || desc.includes('lan')
    })
    const fallback = interfaces.find((iface) => Boolean(iface.ipv4Address) && typeof iface.ipv4Prefix === 'number')
    return toIpv4NetworkCidr(preferredLan?.ipv4Address, preferredLan?.ipv4Prefix) ?? toIpv4NetworkCidr(fallback?.ipv4Address, fallback?.ipv4Prefix)
  }, [interfaces])

  const thisFirewallAddress = useMemo(() => {
    const mgmtIface = settings.management_interface
      ? interfaces.find((iface) => iface.name === settings.management_interface)
      : undefined
    const fallback = interfaces.find((iface) => Boolean(iface.ipv4Address))
    const addr = mgmtIface?.ipv4Address ?? fallback?.ipv4Address
    return addr ? `${addr}/32` : null
  }, [interfaces, settings.management_interface])

  const addressPresetOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [{ label: 'Any', value: '' }]
    if (thisFirewallAddress) {
      options.push({ label: `This Firewall (${thisFirewallAddress})`, value: thisFirewallAddress })
    }
    if (lanNetworkCidr) {
      options.push({ label: `LAN Network (${lanNetworkCidr})`, value: lanNetworkCidr })
    }
    aliases
      .filter((alias) => alias.alias_type === 'host' || alias.alias_type === 'network')
      .forEach((alias) => {
        options.push({ label: `Alias: ${alias.name}`, value: alias.name })
      })
    return options
  }, [aliases, lanNetworkCidr, thisFirewallAddress])

  const openSettingsModal = () => {
    setSettingsModalOpen(true)
  }

  const handleSaveSettings = () => {
    setSettingsFormError(null)

    const payload: FirewallSettings = {
      ...settings,
      management_interface: settings.management_interface || null,
      management_allowed_sources: settings.management_allowed_sources ?? [],
      management_ports: (settings.management_ports ?? []).length ? settings.management_ports : [22, 443, 8443],
      syn_flood_rate: Math.max(1, Number(settings.syn_flood_rate || 1)),
      syn_flood_burst: Math.max(1, Number(settings.syn_flood_burst || 1)),
    }

    setSettingsSaving(true)
    updateFirewallSettings(payload)
      .then((res) => {
        setSettings({ ...defaultSettings, ...res.data })
        setSettingsModalOpen(false)
      })
      .catch((err: Error) => setSettingsError(err.message))
      .finally(() => setSettingsSaving(false))
  }

  const handleSaveRule = () => {
    const validationError = validateFirewallRuleForm(ruleForm)
    if (validationError) {
      setRuleFormError(validationError)
      return
    }

    setRuleFormError(null)
    setRuleSaving(true)
    const payload = ruleForm as Omit<FirewallRule, 'id'>
    const save = editRule
      ? updateFirewallRule(editRule.id, payload)
      : createFirewallRule(payload)

    save
      .then(() => {
        setRuleModalOpen(false)
        setEditRule(null)
        setRuleForm(defaultRuleForm)
        setRuleFormError(null)
        loadRules()
        loadStats()
      })
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setRuleSaving(false))
  }

  const handleToggleRule = (rule: FirewallRule) => {
    updateFirewallRule(rule.id, { ...rule, enabled: !rule.enabled })
      .then(() => loadRules())
      .catch((err: Error) => setRulesError(err.message))
  }

  const handleToggleRuleLog = (rule: FirewallRule) => {
    updateFirewallRule(rule.id, { ...rule, log: !rule.log })
      .then(() => loadRules())
      .catch((err: Error) => setRulesError(err.message))
  }

  const handleDeleteRule = () => {
    if (!deleteRuleId) return
    setDeletingRule(true)
    deleteFirewallRule(deleteRuleId)
      .then(() => {
        setDeleteRuleId(null)
        loadRules()
      })
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setDeletingRule(false))
  }

  const handleReorderRule = (rule: FirewallRule, direction: 'earlier' | 'later') => {
    const currentIndex = visibleRules.findIndex((item) => item.id === rule.id)
    const targetIndex = direction === 'earlier' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= visibleRules.length) return

    const targetRule = visibleRules[targetIndex] as unknown as FirewallRule
    const currentPriority = Number(rule.priority) || 100
    const targetPriority = Number(targetRule.priority) || 100
    const nextCurrentPriority = currentPriority === targetPriority
      ? direction === 'earlier'
        ? Math.max(1, currentPriority - 1)
        : currentPriority + 1
      : targetPriority
    const nextTargetPriority = currentPriority === targetPriority
      ? direction === 'earlier'
        ? currentPriority + 1
        : Math.max(1, currentPriority - 1)
      : currentPriority

    setRuleSaving(true)
    Promise.all([
      updateFirewallRule(rule.id, { ...rule, priority: nextCurrentPriority }),
      updateFirewallRule(targetRule.id, { ...targetRule, priority: nextTargetPriority }),
    ])
      .then(() => loadRules())
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setRuleSaving(false))
  }

  const handleSaveAlias = () => {
    const validationError = validateAliasForm(aliasForm)
    if (validationError) {
      setAliasFormError(validationError)
      return
    }

    setAliasFormError(null)
    setAliasSaving(true)
    createAlias(aliasForm)
      .then(() => {
        setAliasModalOpen(false)
        setAliasForm(defaultAliasForm)
        loadAliases()
      })
      .catch((err: Error) => setAliasesError(err.message))
      .finally(() => setAliasSaving(false))
  }

  const handleDeleteAlias = () => {
    if (!deleteAliasName) return
    setDeletingAlias(true)
    deleteAlias(deleteAliasName)
      .then(() => {
        setDeleteAliasName(null)
        loadAliases()
      })
      .catch((err: Error) => setAliasesError(err.message))
      .finally(() => setDeletingAlias(false))
  }

  const ruleColumns: Column<RuleRow>[] = [
    {
      key: 'enabled',
      header: '',
      className: 'w-12',
      render: (row) => {
        const enabled = Boolean(row.enabled)
        return (
          <button
            title={enabled ? 'Disable rule' : 'Enable rule'}
            aria-label={enabled ? 'Disable firewall rule' : 'Enable firewall rule'}
            onClick={() => handleToggleRule(row as unknown as FirewallRule)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border shadow-sm transition-colors ${
              enabled
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-900'
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            {enabled ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 105.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>
        )
      },
    },
    {
      key: 'order',
      header: 'Order',
      className: 'w-36',
      render: (row) => {
        const ruleData = row as unknown as FirewallRule
        const rowIndex = visibleRules.findIndex((item) => item.id === row.id)
        const isFirst = rowIndex <= 0
        const isLast = rowIndex === -1 || rowIndex >= visibleRules.length - 1
        const positionLabel = isFirst ? 'First' : isLast ? 'Last' : 'Middle'

        return (
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md shadow-sm">
              <button
                title="Run earlier"
                aria-label="Move rule earlier"
                onClick={() => handleReorderRule(ruleData, 'earlier')}
                disabled={ruleSaving || isFirst}
                className="inline-flex h-8 w-8 items-center justify-center rounded-l-md border border-gray-300 bg-white transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3m0 0l-6 6m6-6l6 6" />
                </svg>
              </button>
              <button
                title="Run later"
                aria-label="Move rule later"
                onClick={() => handleReorderRule(ruleData, 'later')}
                disabled={ruleSaving || isLast}
                className="-ml-px inline-flex h-8 w-8 items-center justify-center rounded-r-md border border-gray-300 bg-white transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v12m0 0l-6-6m6 6l6-6" />
                </svg>
              </button>
            </div>
            <span className="text-xs font-medium text-gray-500">{positionLabel}</span>
          </div>
        )
      },
    },
    { key: 'description', header: 'Description' },
    { key: 'action', header: 'Action', render: (row) => actionBadge(row.action as FirewallRule['action']) },
    {
      key: 'log',
      header: 'Log',
      className: 'w-12',
      render: (row) => {
        const logging = Boolean(row.log)
        return (
          <button
            title={logging ? 'Disable match logging' : 'Log matches to Live Logs'}
            aria-label={logging ? 'Disable firewall rule match logging' : 'Enable firewall rule match logging'}
            onClick={() => handleToggleRuleLog(row as unknown as FirewallRule)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border shadow-sm transition-colors ${
              logging
                ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900'
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3.75h6m-6 3.75h3M6.75 3.75h10.5A2.25 2.25 0 0119.5 6v12A2.25 2.25 0 0117.25 20.25H6.75A2.25 2.25 0 014.5 18V6a2.25 2.25 0 012.25-2.25z" />
            </svg>
          </button>
        )
      },
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (row) => <span className="text-xs font-medium text-gray-700">{directionLabel(row.direction as FirewallRule['direction'])}</span>,
    },
    { key: 'protocol', header: 'Protocol', render: (row) => protocolLabel((row.protocol as FirewallRule['protocol']) ?? null) },
    { key: 'source', header: 'Source', render: (row) => (row.source as string) ?? 'Any' },
    { key: 'source_port', header: 'Source Port', render: (row) => (row.source_port as number | null) ?? 'Any' },
    { key: 'destination', header: 'Destination', render: (row) => (row.destination as string) ?? 'Any' },
    { key: 'destination_port', header: 'Destination Port', render: (row) => (row.destination_port as number | null) ?? 'Any' },
    {
      key: 'interface',
      header: 'Interface',
      render: (row) => {
        const name = row.interface as string | null
        if (!name) return 'Any'
        const iface = interfaces.find((item) => item.name === name)
        return iface ? interfaceLabel(iface) : name
      },
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (row) => {
        const sched = row.schedule as FirewallSchedule | null
        if (!sched) return <span className="text-gray-400 text-xs">Always</span>
        const dayLabels = sched.days.length > 0
          ? sched.days.map((d) => DAY_NAMES[d]).join(',')
          : 'All'
        const timeLabel = sched.time_start || sched.time_end
          ? `${formatScheduleTime(sched.time_start, '00:00')}\u2013${formatScheduleTime(sched.time_end, '23:59')}`
          : null
        const startDate = formatScheduleDate(sched.date_start)
        const endDate = formatScheduleDate(sched.date_end)
        const dateLabel = startDate || endDate
          ? `${startDate ?? 'Any'}\u2013${endDate ?? 'Any'}`
          : null
        return (
          <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-yellow-50 text-yellow-800">
            {dayLabels}{timeLabel ? ` ${timeLabel}` : ''}{dateLabel ? ` • ${dateLabel}` : ''}
          </span>
        )
      },
    },
    {
      key: 'counters',
      header: 'Hits',
      render: (row) => {
        const s = stats.find((x) => x.id === row.id)
        if (!s) return <span className="text-gray-400 text-xs">-</span>
        return (
          <span className="text-xs text-gray-600">
            {s.packets.toLocaleString()} pkts<br />
            {formatBytes(s.bytes)}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (row) => {
        const ruleData = row as unknown as FirewallRule
        return (
          <div className="flex justify-end gap-1">
            <button
              title="Edit rule"
              onClick={() => openEditRulePanel(ruleData)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              title="Delete rule"
              onClick={() => setDeleteRuleId(row.id as string)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </button>
          </div>
        )
      },
    },
  ]

  const aliasColumns: Column<AliasRow>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'alias_type',
      header: 'Type',
      render: (row) => (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 capitalize">
          {row.alias_type as string}
        </span>
      ),
    },
    { key: 'description', header: 'Description' },
    {
      key: 'values',
      header: 'Entries',
      render: (row) => {
        const entries = (row.values as string[]) ?? []
        return (
          <span className="text-xs text-gray-600">
            {entries.slice(0, 3).join(', ')}
            {entries.length > 3 && ` +${entries.length - 3} more`}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <button
          onClick={() => setDeleteAliasName(row.name)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
          title="Delete alias"
          aria-label="Delete alias"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="Firewall tabs">
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

      {showSettingsSection && <div id="firewall-settings">
        {settingsModalOpen && (
          <div className="mb-4">
            <Card title="Edit Firewall Settings">
              <div className="space-y-4">
                {settingsFormError && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {settingsFormError}
                  </div>
                )}
                <details open className="overflow-hidden rounded border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Policies</summary>
                  <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
                    <FormField
                      id="fw-input-policy"
                      label="Input Policy"
                      as="select"
                      value={settings.input_policy}
                      onChange={(e) => setSettings({ ...settings, input_policy: e.target.value as FirewallSettings['input_policy'] })}
                    >
                      <option value="drop">Drop</option>
                      <option value="accept">Accept</option>
                    </FormField>
                    <FormField
                      id="fw-forward-policy"
                      label="Forward Policy"
                      as="select"
                      value={settings.forward_policy}
                      onChange={(e) => setSettings({ ...settings, forward_policy: e.target.value as FirewallSettings['forward_policy'] })}
                    >
                      <option value="drop">Drop</option>
                      <option value="accept">Accept</option>
                    </FormField>
                    <FormField
                      id="fw-output-policy"
                      label="Output Policy"
                      as="select"
                      value={settings.output_policy}
                      onChange={(e) => setSettings({ ...settings, output_policy: e.target.value as FirewallSettings['output_policy'] })}
                    >
                      <option value="accept">Accept</option>
                      <option value="drop">Drop</option>
                    </FormField>
                  </div>
                </details>

                <details className="overflow-hidden rounded border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Protection</summary>
                  <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 col-span-2">
                      <input
                        type="checkbox"
                        checked={settings.drop_invalid_state}
                        onChange={(e) => setSettings({ ...settings, drop_invalid_state: e.target.checked })}
                      />
                      <span className="text-sm text-gray-700">Drop invalid conntrack state</span>
                    </label>
                    <label className="flex items-center gap-3 col-span-2">
                      <input
                        type="checkbox"
                        checked={settings.syn_flood_protection}
                        onChange={(e) => setSettings({ ...settings, syn_flood_protection: e.target.checked })}
                      />
                      <span className="text-sm text-gray-700">Enable SYN flood protection</span>
                    </label>
                    <FormField
                      id="fw-syn-rate"
                      label="SYN Flood Rate (/sec)"
                      type="number"
                      min={1}
                      value={String(settings.syn_flood_rate)}
                      onChange={(e) => setSettings({ ...settings, syn_flood_rate: Number(e.target.value) || 1 })}
                    />
                    <FormField
                      id="fw-syn-burst"
                      label="SYN Burst"
                      type="number"
                      min={1}
                      value={String(settings.syn_flood_burst)}
                      onChange={(e) => setSettings({ ...settings, syn_flood_burst: Number(e.target.value) || 1 })}
                    />
                  </div>
                </details>

                <details className="overflow-hidden rounded border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Management</summary>
                  <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 col-span-2">
                      <input
                        type="checkbox"
                        checked={settings.management_anti_lockout}
                        onChange={(e) => setSettings({ ...settings, management_anti_lockout: e.target.checked })}
                      />
                      <span className="text-sm text-gray-700">Enable management anti-lockout rule</span>
                    </label>
                    <FormField
                      id="fw-log-position"
                      className="col-span-2"
                      label="Log packets before or after action"
                      as="select"
                      value={settings.log_position ?? 'after'}
                      onChange={e => setSettings({ ...settings, log_position: e.target.value as 'before' | 'after' })}
                      hint="Controls whether log entries are written before or after the rule’s action is applied."
                    >
                      <option value="before">Before action (default)</option>
                      <option value="after">After action</option>
                    </FormField>
                  </div>
                </details>

                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" variant="primary" onClick={handleSaveSettings} loading={settingsSaving}>Save</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSettingsModalOpen(false)
                      setSettingsFormError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
        <Card
          title="Firewall Settings"
          subtitle="Global chain policies, management-plane protection, and advanced stateful controls"
          actions={
            <button
              onClick={openSettingsModal}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
              title="Edit settings"
              aria-label="Edit firewall settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          }
        >
        {settingsError && <p className="text-sm text-red-600 mb-3">{settingsError}</p>}
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Input Policy</dt>
            <dd className="font-medium text-gray-800 uppercase">{settings.input_policy}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Forward Policy</dt>
            <dd className="font-medium text-gray-800 uppercase">{settings.forward_policy}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Output Policy</dt>
            <dd className="font-medium text-gray-800 uppercase">{settings.output_policy}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Drop Invalid State</dt>
            <dd className="font-medium text-gray-800">{settings.drop_invalid_state ? 'Enabled' : 'Disabled'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">SYN Flood Protection</dt>
            <dd className="font-medium text-gray-800">
              {settings.syn_flood_protection
                ? `Enabled (${settings.syn_flood_rate}/s, burst ${settings.syn_flood_burst})`
                : 'Disabled'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Management Anti-lockout</dt>
            <dd className="font-medium text-gray-800">{settings.management_anti_lockout ? 'Enabled' : 'Disabled'}</dd>
          </div>
        </dl>
        </Card>
      </div>}

      {showRulesSection && <div id="firewall-rules">
        {ruleModalOpen && (
          <div className="mb-4">
            <Card title={editRule ? 'Edit Firewall Rule' : 'Add Firewall Rule'}>
              <div className="space-y-3">
                {ruleFormError && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {ruleFormError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    id="rule-desc"
                    label="Description"
                    className="col-span-2"
                    placeholder="Brief rule description"
                    value={ruleForm.description ?? ''}
                    onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value || null })}
                  />
                  <FormField
                    id="rule-action"
                    label="Action"
                    as="select"
                    value={ruleForm.action ?? 'accept'}
                    onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value as FirewallRule['action'] })}
                  >
                    <option value="accept">Accept</option>
                    <option value="drop">Drop</option>
                    <option value="reject">Reject</option>
                  </FormField>
                  <FormField
                    id="rule-direction"
                    label="Direction"
                    as="select"
                    value={ruleForm.direction ?? 'forward'}
                    onChange={(e) => setRuleForm({ ...ruleForm, direction: e.target.value as FirewallRule['direction'] })}
                  >
                    <option value="input">In</option>
                    <option value="output">Out</option>
                    <option value="both">Both</option>
                    <option value="forward">Routed</option>
                  </FormField>
                  <FormField
                    id="rule-protocol"
                    label="Protocol"
                    as="select"
                    value={ruleForm.protocol ?? ''}
                    onChange={(e) => setRuleForm({ ...ruleForm, protocol: (e.target.value || null) as FirewallRule['protocol'] | null })}
                  >
                    <option value="">Any</option>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                    <option value="icmpv6">ICMPv6</option>
                  </FormField>
                  <FormField
                    id="rule-iface"
                    label={interfaceFieldLabel(ruleForm.direction ?? 'forward')}
                    hint={interfaceFieldHint(ruleForm.direction ?? 'forward')}
                    as="select"
                    value={ruleForm.interface ?? ''}
                    onChange={(e) => setRuleForm({ ...ruleForm, interface: e.target.value || null })}
                  >
                    <option value="">Any</option>
                    {interfaces.map((iface) => (
                      <option key={iface.name} value={iface.name}>
                        {interfaceLabel(iface)}
                      </option>
                    ))}
                  </FormField>
                  <details className="col-span-2 overflow-hidden rounded border border-gray-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                      Advanced Match
                    </summary>
                    <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
                      <FormField
                        id="rule-src-preset"
                        label="Source Preset"
                        as="select"
                        value={ruleForm.source ?? ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value || null })}
                      >
                        {addressPresetOptions.map((opt) => (
                          <option key={`src-${opt.value || 'any'}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </FormField>
                      <FormField
                        id="rule-src"
                        label="Source (custom CIDR/IP/Alias)"
                        value={ruleForm.source ?? ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value || null })}
                      />
                      <FormField
                        id="rule-src-port"
                        label="Source Port"
                        type="number"
                        value={ruleForm.source_port != null ? String(ruleForm.source_port) : ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, source_port: e.target.value ? parseInt(e.target.value, 10) : null })}
                      />
                      <FormField
                        id="rule-dst-preset"
                        label="Destination Preset"
                        as="select"
                        value={ruleForm.destination ?? ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, destination: e.target.value || null })}
                      >
                        {addressPresetOptions.map((opt) => (
                          <option key={`dst-${opt.value || 'any'}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </FormField>
                      <FormField
                        id="rule-dst"
                        label="Destination (custom CIDR/IP/Alias)"
                        value={ruleForm.destination ?? ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, destination: e.target.value || null })}
                      />
                      <FormField
                        id="rule-dst-port"
                        label="Destination Port"
                        type="number"
                        value={ruleForm.destination_port != null ? String(ruleForm.destination_port) : ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, destination_port: e.target.value ? parseInt(e.target.value, 10) : null })}
                      />
                    </div>
                  </details>

                  <div className="flex gap-6 col-span-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={ruleForm.enabled ?? true}
                        onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                      />
                      <span className="text-sm text-gray-700">Rule enabled</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={ruleForm.log ?? false}
                        onChange={(e) => setRuleForm({ ...ruleForm, log: e.target.checked })}
                      />
                      <span className="text-sm text-gray-700">Log this rule</span>
                    </label>
                  </div>

                  <details className="col-span-2 overflow-hidden rounded border border-gray-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
                      Schedule (optional)
                    </summary>
                    <div className="border-t border-gray-200 px-4 py-4 space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Days active (leave all unchecked = every day)</p>
                        <div className="flex gap-3 flex-wrap">
                          {DAY_NAMES.map((name, idx) => (
                            <label key={idx} className="flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                checked={(ruleForm.schedule?.days ?? []).includes(idx)}
                                onChange={(e) => {
                                  const days = [...(ruleForm.schedule?.days ?? [])]
                                  if (e.target.checked) {
                                    if (!days.includes(idx)) days.push(idx)
                                  } else {
                                    const index = days.indexOf(idx)
                                    if (index !== -1) days.splice(index, 1)
                                  }
                                  days.sort()
                                  setRuleForm({ ...ruleForm, schedule: { ...(ruleForm.schedule ?? { days: [], time_start: null, time_end: null, date_start: null, date_end: null }), days } })
                                }}
                              />
                              {name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField id="rule-sched-ts" label="Time start (HH:MM)" placeholder="e.g. 08:00"
                          value={ruleForm.schedule?.time_start ?? ''}
                          onChange={(e) => setRuleForm({ ...ruleForm, schedule: { ...(ruleForm.schedule ?? { days: [], time_start: null, time_end: null, date_start: null, date_end: null }), time_start: e.target.value || null } })} />
                        <FormField id="rule-sched-te" label="Time end (HH:MM)" placeholder="e.g. 17:00"
                          value={ruleForm.schedule?.time_end ?? ''}
                          onChange={(e) => setRuleForm({ ...ruleForm, schedule: { ...(ruleForm.schedule ?? { days: [], time_start: null, time_end: null, date_start: null, date_end: null }), time_end: e.target.value || null } })} />
                        <FormField id="rule-sched-ds" label="Date start (YYYY-MM-DD)" placeholder="e.g. 2026-01-01"
                          value={ruleForm.schedule?.date_start ?? ''}
                          onChange={(e) => setRuleForm({ ...ruleForm, schedule: { ...(ruleForm.schedule ?? { days: [], time_start: null, time_end: null, date_start: null, date_end: null }), date_start: e.target.value || null } })} />
                        <FormField id="rule-sched-de" label="Date end (YYYY-MM-DD)" placeholder="e.g. 2026-12-31"
                          value={ruleForm.schedule?.date_end ?? ''}
                          onChange={(e) => setRuleForm({ ...ruleForm, schedule: { ...(ruleForm.schedule ?? { days: [], time_start: null, time_end: null, date_start: null, date_end: null }), date_end: e.target.value || null } })} />
                      </div>
                    </div>
                  </details>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" variant="primary" onClick={handleSaveRule} loading={ruleSaving}>
                    {editRule ? 'Save Changes' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRuleModalOpen(false)
                      setEditRule(null)
                      setRuleFormError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
        <Card
          title="Firewall Rules"
          subtitle={selectedInterface ? `Rules for interface ${selectedInterfaceDisplay}` : 'Define allow/deny rules evaluated top-to-bottom'}
          actions={
            <div className="flex gap-2">
              <button
                onClick={loadStats}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                title="Refresh counters"
                aria-label="Refresh firewall rule counters"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M21.015 9.348A8.967 8.967 0 0012.048 3.75c-4.948 0-8.958 4.01-8.958 8.958m4.887 2.944H2.985v4.992m0-4.992a8.967 8.967 0 008.967 5.598c4.948 0 8.958-4.01 8.958-8.958" />
                </svg>
              </button>
              <button
                onClick={openAddRuleModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                title="Add rule"
                aria-label="Add firewall rule"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          }
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-sm">
              <FormField
                id="firewall-rules-interface-filter"
                label="Interface"
                as="select"
                value={selectedInterface ?? ''}
                onChange={(e) => updateRulesInterfaceFilter(e.target.value)}
              >
                <option value="">All interfaces</option>
                {interfaces.map((iface) => (
                  <option key={iface.name} value={iface.name}>
                    {interfaceLabel(iface)}
                  </option>
                ))}
              </FormField>
            </div>
            <p className="text-xs text-gray-500">
              Select an interface to show only that interface's firewall rules.
            </p>
          </div>
          {rulesError && <p className="text-sm text-red-600 mb-3">{rulesError}</p>}
          <Table columns={ruleColumns} data={visibleRules} keyField="id" loading={rulesLoading} emptyMessage={rulesEmptyMessage} />
        </Card>
      </div>}

      {showAliasesSection && <div id="firewall-aliases">
        {aliasModalOpen && (
          <div className="mb-4">
            <Card title="Add Alias">
              <div className="space-y-4">
                {aliasFormError && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {aliasFormError}
                  </div>
                )}
                <details open className="overflow-hidden rounded border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Alias Details</summary>
                  <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
                    <FormField
                      id="alias-name"
                      label="Name"
                      required
                      placeholder="e.g. RFC1918_NETWORKS"
                      value={aliasForm.name}
                      onChange={(e) => setAliasForm({ ...aliasForm, name: e.target.value })}
                    />
                    <FormField
                      id="alias-type"
                      label="Type"
                      as="select"
                      value={aliasForm.alias_type}
                      onChange={(e) => setAliasForm({ ...aliasForm, alias_type: e.target.value as AliasType })}
                    >
                      <option value="host">Host</option>
                      <option value="network">Network</option>
                      <option value="port">Port</option>
                      <option value="urltable">URL Table</option>
                    </FormField>
                    <FormField
                      id="alias-desc"
                      label="Description"
                      placeholder="Optional description"
                      value={aliasForm.description ?? ''}
                      onChange={(e) => setAliasForm({ ...aliasForm, description: e.target.value || null })}
                    />
                  </div>
                </details>

                <details open className="overflow-hidden rounded border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Entries</summary>
                  <div className="border-t border-gray-200 px-4 py-4">
                    <FormField
                      id="alias-values"
                      label="Entries"
                      as="textarea"
                      rows={6}
                      hint="One entry per line"
                      value={aliasForm.values.join('\n')}
                      onChange={(e) => setAliasForm({
                        ...aliasForm,
                        values: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                      })}
                    />
                  </div>
                </details>

                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" variant="primary" onClick={handleSaveAlias} loading={aliasSaving}>Save</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAliasModalOpen(false)
                      setAliasFormError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
        <Card
          title="Aliases"
          subtitle="Named sets of hosts, networks, or ports reusable in firewall rules"
          actions={
            <button onClick={() => {
              setAliasFormError(null)
              setAliasModalOpen(true)
            }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
              title="Add alias"
              aria-label="Add firewall alias"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          }
        >
          {aliasesError && <p className="text-sm text-red-600 mb-3">{aliasesError}</p>}
          <Table columns={aliasColumns} data={aliases} keyField="name" loading={aliasesLoading} emptyMessage="No aliases defined." />
        </Card>
      </div>}

      <Modal
        open={deleteRuleId !== null}
        title="Delete Firewall Rule"
        onClose={() => setDeleteRuleId(null)}
        onConfirm={handleDeleteRule}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingRule}
        size="sm"
      >
        <p className="text-sm text-gray-600">Delete this firewall rule?</p>
      </Modal>

      <Modal
        open={deleteAliasName !== null}
        title="Delete Alias"
        onClose={() => setDeleteAliasName(null)}
        onConfirm={handleDeleteAlias}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingAlias}
        size="sm"
      >
        <p className="text-sm text-gray-600">Delete this alias?</p>
      </Modal>
    </div>
  )
}
