import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createInterfaceDnsBlocklist,
  getDnsConfig,
  updateDnsConfig,
  getDnsOverrides,
  getInterfaceDnsBlocklists,
  createDnsHostOverride,
  deleteInterfaceDnsBlocklist,
  deleteDnsHostOverride,
  createDnsDomainOverride,
  deleteDnsDomainOverride,
} from '../../api/dns'
import { getAcmeConfig } from '../../api/acme'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import type {
  DnsBlocklistEntry,
  DnsConfig,
  DnsHostOverride,
  DnsDomainOverride,
  KernelInterface,
  NetworkInterface,
} from '../../types'
import Card from '../../components/Card'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type HostRow = DnsHostOverride & Record<string, unknown>
type DomainRow = DnsDomainOverride & Record<string, unknown>
type BlocklistRow = DnsBlocklistEntry & Record<string, unknown>
type DnsListenCandidate = {
  key: string
  ip: string
  interfaceName: string
  interfaceLabel: string
}

const hostColumns: Column<HostRow>[] = [
  { key: 'hostname', header: 'Hostname (FQDN)' },
  { key: 'address', header: 'IP Address' },
]

const domainColumns: Column<DomainRow>[] = [
  { key: 'domain', header: 'Domain' },
  { key: 'forward_to', header: 'Forward To (DNS IP)' },
]

const BLOCKLIST_PRESETS: Array<{ name: string; url: string }> = [
  { name: 'StevenBlack Unified Hosts', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts' },
  { name: 'OISD Small', url: 'https://small.oisd.nl/' },
  { name: 'AdGuard DNS Filter', url: 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt' },
  { name: 'EasyList', url: 'https://easylist.to/easylist/easylist.txt' },
  { name: 'EasyPrivacy', url: 'https://easylist.to/easylist/easyprivacy.txt' },
]

const defaultConfigForm = (): Partial<DnsConfig> => ({
  enabled: true,
  listen_addresses: [],
  port: 53,
  forwarders: [],
  dnssec: false,
  dot_enabled: false,
  dot_port: 853,
  dot_lan_only: true,
  dot_certificate: '',
  dot_private_key: '',
  dot_acme_domain: '',
  local_records: [],
})

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export default function DNS() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [config, setConfig] = useState<DnsConfig | null>(null)
  const [hostOverrides, setHostOverrides] = useState<HostRow[]>([])
  const [domainOverrides, setDomainOverrides] = useState<DomainRow[]>([])
  const [blocklists, setBlocklists] = useState<BlocklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Config edit
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [dotModalOpen, setDotModalOpen] = useState(false)
  const [configForm, setConfigForm] = useState<Partial<DnsConfig>>(defaultConfigForm())
  const [listenInput, setListenInput] = useState('')
  const [forwardersInput, setForwardersInput] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [dnsInterfaces, setDnsInterfaces] = useState<KernelInterface[]>([])
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [acmeDomains, setAcmeDomains] = useState<string[]>([])

  // Host overrides
  const [hostModalOpen, setHostModalOpen] = useState(false)
  const [hostForm, setHostForm] = useState({ hostname: '', address: '' })
  const [hostSaving, setHostSaving] = useState(false)
  const [hostDeleteName, setHostDeleteName] = useState<string | null>(null)
  const [hostDeleting, setHostDeleting] = useState(false)

  // Domain overrides
  const [domainModalOpen, setDomainModalOpen] = useState(false)
  const [domainForm, setDomainForm] = useState({ domain: '', forward_to: '' })
  const [domainSaving, setDomainSaving] = useState(false)
  const [domainDeleteName, setDomainDeleteName] = useState<string | null>(null)
  const [domainDeleting, setDomainDeleting] = useState(false)

  // Blocklists
  const [blocklistModalOpen, setBlocklistModalOpen] = useState(false)
  const [blocklistForm, setBlocklistForm] = useState({ name: '', url: '', enabled: true })
  const [selectedPreset, setSelectedPreset] = useState('')
  const [blocklistSaving, setBlocklistSaving] = useState(false)
  const [blocklistDeleteId, setBlocklistDeleteId] = useState<string | null>(null)
  const [blocklistDeleting, setBlocklistDeleting] = useState(false)
  const [blocklistsLoading, setBlocklistsLoading] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getDnsConfig(), getAcmeConfig(), getDnsOverrides()])
      .then(([cfg, acmeCfg, overrides]) => {
        setConfig(cfg.data)
        setAcmeDomains(acmeCfg.data.domains ?? [])
        setHostOverrides(overrides.data.host_overrides as HostRow[])
        setDomainOverrides(overrides.data.domain_overrides as DomainRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const loadInterfaces = () => {
    Promise.all([getInterfaces(), getInterfacesInventory()])
      .then(([configuredRes, inventoryRes]) => {
        const configured = (configuredRes.data ?? []).filter((iface) => iface.enabled !== false)
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
      .catch(() => setInterfaces([]))
  }

  useEffect(() => {
    loadAll()
    loadInterfaces()
  }, [])

  const sectionParam = searchParams.get('section')
  const activeSection =
    sectionParam === 'overrides' || sectionParam === 'blocklists' || sectionParam === 'dot'
      ? sectionParam
      : 'settings'

  const interfaceLabel = (iface: NetworkInterface): string => {
    return formatInterfaceDisplayName(iface.description, iface.name)
  }

  const interfaceOptions = useMemo(() => interfaces.map((iface) => iface.name), [interfaces])
  const selectedInterface = searchParams.get('iface') ?? ''
  const effectiveInterface = selectedInterface || interfaceOptions[0] || ''
  const effectiveInterfaceObj = interfaces.find((iface) => iface.name === effectiveInterface)
  const effectiveInterfaceLabel = effectiveInterfaceObj
    ? interfaceLabel(effectiveInterfaceObj)
    : (effectiveInterface || '-')

  const interfaceLabelByName = useMemo(
    () => new Map(interfaces.map((iface) => [iface.name, interfaceLabel(iface)] as const)),
    [interfaces],
  )

  const listenEntries = useMemo(
    () => listenInput.split(',').map((v) => v.trim()).filter(Boolean),
    [listenInput],
  )

  const dnsListenCandidates = useMemo<DnsListenCandidate[]>(
    () =>
      dnsInterfaces.flatMap((iface) =>
        (iface.addresses ?? [])
          .map((cidr) => {
            const ip = cidr.split('/')[0]?.trim()
            if (!ip) return null
            return {
              key: `${iface.name}-${ip}`,
              ip,
              interfaceName: iface.name,
              interfaceLabel: interfaceLabelByName.get(iface.name) ?? iface.name,
            }
          })
          .filter((entry): entry is DnsListenCandidate => entry !== null),
      ),
    [dnsInterfaces, interfaceLabelByName],
  )

  useEffect(() => {
    if (activeSection !== 'blocklists') return
    if (selectedInterface || interfaceOptions.length === 0) return
    const next = new URLSearchParams(searchParams)
    next.set('section', 'blocklists')
    next.set('iface', interfaceOptions[0])
    setSearchParams(next)
  }, [activeSection, interfaceOptions, searchParams, selectedInterface, setSearchParams])

  const loadInterfaceBlocklists = (interfaceName: string) => {
    if (!interfaceName) {
      setBlocklists([])
      return
    }
    setBlocklistsLoading(true)
    getInterfaceDnsBlocklists(interfaceName)
      .then((res) => setBlocklists((res.data ?? []) as BlocklistRow[]))
      .catch((err: Error) => setError(err.message))
      .finally(() => setBlocklistsLoading(false))
  }

  useEffect(() => {
    if (activeSection !== 'blocklists') return
    loadInterfaceBlocklists(effectiveInterface)
  }, [activeSection, effectiveInterface])

  const openConfigModal = () => {
    if (config) {
      setConfigForm({
        ...config,
        dot_enabled: config.dot_enabled ?? false,
        dot_port: config.dot_port ?? 853,
        dot_lan_only: config.dot_lan_only ?? true,
        dot_certificate: config.dot_certificate ?? '',
        dot_private_key: config.dot_private_key ?? '',
        dot_acme_domain: config.dot_acme_domain ?? '',
      })
      setListenInput((config.listen_addresses ?? []).join(', '))
      setForwardersInput((config.forwarders ?? []).join(', '))
    } else {
      setConfigForm(defaultConfigForm())
      setListenInput('')
      setForwardersInput('')
    }
    getInterfacesInventory()
      .then((res) => {
        const kernel = Array.isArray(res.data?.kernel) ? res.data.kernel : []
        setDnsInterfaces(kernel.filter((i) => i.name !== 'lo'))
      })
      .catch(() => {
        setDnsInterfaces([])
      })
    setConfigModalOpen(true)
  }

  const openDotModal = () => {
    if (config) {
      setConfigForm({
        ...config,
        dot_enabled: config.dot_enabled ?? false,
        dot_port: config.dot_port ?? 853,
        dot_lan_only: config.dot_lan_only ?? true,
        dot_acme_domain: config.dot_acme_domain ?? '',
      })
    } else {
      setConfigForm(defaultConfigForm())
    }
    setDotModalOpen(true)
  }

  const handleSaveConfig = () => {
    const parseList = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean)
    const acmeDomain = configForm.dot_acme_domain?.trim() ?? ''

    if (configForm.dot_enabled && !acmeDomain) {
      setError('DNS-over-TLS requires a selected ACME domain.')
      return
    }

    const payload: Partial<DnsConfig> = {
      enabled: configForm.enabled ?? true,
      listen_addresses: parseList(listenInput),
      port: configForm.port ?? 53,
      forwarders: parseList(forwardersInput),
      dnssec: configForm.dnssec ?? false,
      dot_enabled: configForm.dot_enabled ?? false,
      dot_port: configForm.dot_port ?? 853,
      dot_lan_only: configForm.dot_lan_only ?? true,
      dot_acme_domain: configForm.dot_acme_domain?.trim() ? configForm.dot_acme_domain : undefined,
      // Preserve existing local_records - they're managed via the overrides API
      local_records: config?.local_records ?? [],
      interface_blocklists: config?.interface_blocklists ?? [],
    }
    setConfigSaving(true)
    updateDnsConfig(payload)
      .then((r) => {
        setConfig(r.data)
        setConfigModalOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setConfigSaving(false))
  }

  const useAcmeDoTCert = Boolean(configForm.dot_acme_domain?.trim())



  const handleAddHost = () => {
    setHostSaving(true)
    createDnsHostOverride(hostForm.hostname, hostForm.address)
      .then(() => getDnsOverrides())
      .then((r) => {
        setHostModalOpen(false)
        setHostForm({ hostname: '', address: '' })
        setHostOverrides(r.data.host_overrides as HostRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setHostSaving(false))
  }

  const handleDeleteHost = () => {
    if (!hostDeleteName) return
    setHostDeleting(true)
    deleteDnsHostOverride(hostDeleteName)
      .then(() => getDnsOverrides())
      .then((r) => {
        setHostDeleteName(null)
        setHostOverrides(r.data.host_overrides as HostRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setHostDeleting(false))
  }

  const handleAddDomain = () => {
    setDomainSaving(true)
    createDnsDomainOverride(domainForm.domain, domainForm.forward_to)
      .then(() => getDnsOverrides())
      .then((r) => {
        setDomainModalOpen(false)
        setDomainForm({ domain: '', forward_to: '' })
        setDomainOverrides(r.data.domain_overrides as DomainRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDomainSaving(false))
  }

  const handleDeleteDomain = () => {
    if (!domainDeleteName) return
    setDomainDeleting(true)
    deleteDnsDomainOverride(domainDeleteName)
      .then(() => getDnsOverrides())
      .then((r) => {
        setDomainDeleteName(null)
        setDomainOverrides(r.data.domain_overrides as DomainRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDomainDeleting(false))
  }

  const openAddBlocklistModal = () => {
    setSelectedPreset('')
    setBlocklistForm({ name: '', url: '', enabled: true })
    setBlocklistModalOpen(true)
  }

  const handleAddBlocklist = () => {
    if (!effectiveInterface || !blocklistForm.url.trim()) {
      setError('Please select an interface and enter a valid blocklist URL.')
      return
    }
    if (!isHttpUrl(blocklistForm.url.trim())) {
      setError('Blocklist URL must be a valid HTTP or HTTPS URL.')
      return
    }
    setBlocklistSaving(true)
    createInterfaceDnsBlocklist(effectiveInterface, {
      name: blocklistForm.name.trim() || undefined,
      url: blocklistForm.url.trim(),
      enabled: blocklistForm.enabled,
    })
      .then(() => {
        setBlocklistModalOpen(false)
        loadInterfaceBlocklists(effectiveInterface)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBlocklistSaving(false))
  }

  const handleDeleteBlocklist = () => {
    if (!effectiveInterface || !blocklistDeleteId) return
    setBlocklistDeleting(true)
    deleteInterfaceDnsBlocklist(effectiveInterface, blocklistDeleteId)
      .then(() => {
        setBlocklistDeleteId(null)
        loadInterfaceBlocklists(effectiveInterface)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBlocklistDeleting(false))
  }

  const hostColumnsWithActions: Column<HostRow>[] = [
    ...hostColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <button
          onClick={() => setHostDeleteName(row.hostname as string)}
          className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-red-600 hover:text-red-900"
          title="Delete host override"
          aria-label="Delete host override"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      ),
    },
  ]

  const domainColumnsWithActions: Column<DomainRow>[] = [
    ...domainColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <button
          onClick={() => setDomainDeleteName(row.domain as string)}
          className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-red-600 hover:text-red-900"
          title="Delete domain override"
          aria-label="Delete domain override"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      ),
    },
  ]

  const blocklistColumnsWithActions: Column<BlocklistRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (row.name as string) || 'Custom List',
    },
    { key: 'url', header: 'URL' },
    {
      key: 'enabled',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${(row.enabled as boolean)
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-600'}`}
        >
          {(row.enabled as boolean) ? 'Enabled' : 'Disabled'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <button
          onClick={() => setBlocklistDeleteId(String(row.id))}
          className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-red-600 hover:text-red-900"
          title="Delete blocklist"
          aria-label="Delete blocklist"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      ),
    },
  ]

  const handleChangeBlocklistInterface = (interfaceName: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('section', 'blocklists')
    if (interfaceName) next.set('iface', interfaceName)
    else next.delete('iface')
    setSearchParams(next)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-3 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {activeSection === 'settings' && (
        <>
          <Card
            title="DNS Resolver (Unbound)"
            subtitle="Recursive resolver / forwarder configuration"
            actions={
              <button
                onClick={openConfigModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                title="Edit resolver"
                aria-label="Edit resolver"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            }
          >
            {loading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : config ? (
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
                  <dd className={`mt-1 font-semibold ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {config.enabled ? 'Enabled' : 'Disabled'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Mode</dt>
                  <dd className="mt-1 font-medium text-gray-800">
                    {config.forwarders?.length ? 'Forwarder' : 'Full Recursion'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Port</dt>
                  <dd className="mt-1 font-medium text-gray-800 font-mono">{config.port ?? 53}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Listen Addresses</dt>
                  <dd className="mt-1 font-medium text-gray-800 font-mono">
                    {config.listen_addresses?.length ? config.listen_addresses.join(', ') : 'All Interfaces'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Upstream Forwarders</dt>
                  <dd className="mt-1 font-medium text-gray-800 font-mono">
                    {config.forwarders?.length ? config.forwarders.join(', ') : '- (Recursive)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">DNSSEC</dt>
                  <dd className={`mt-1 font-semibold ${config.dnssec ? 'text-green-600' : 'text-gray-400'}`}>
                    {config.dnssec ? 'Enabled' : 'Disabled'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-400">No DNS configuration found.</p>
            )}
          </Card>
        </>
      )}

      {activeSection === 'dot' && (
        <Card
          title="DoT"
          subtitle="Encrypted private DNS listener on the configured DoT port"
          actions={
            <Button size="sm" variant="secondary" onClick={openDotModal}>
              Edit DoT
            </Button>
          }
        >
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : config ? (
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
                <dd className={`mt-1 font-semibold ${config.dot_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {config.dot_enabled ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Listener</dt>
                <dd className="mt-1 font-medium text-gray-800 font-mono">TCP/{config.dot_port ?? 853}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Access</dt>
                <dd className="mt-1 font-medium text-gray-800">
                  {config.dot_lan_only === false ? 'LAN + external clients' : 'LAN clients only'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Certificate</dt>
                <dd className="mt-1 font-medium text-gray-800">
                  {config.dot_acme_domain ? 'ACME: ' + config.dot_acme_domain : 'Not configured'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No DoT configuration found.</p>
          )}
        </Card>
      )}

      {activeSection === 'overrides' && (
        <>
          <Card
            title="Host Overrides"
            subtitle="Map fully-qualified hostnames to specific IP addresses (local A/AAAA records)"
            actions={
              <button
                onClick={() => setHostModalOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                title="Add host override"
                aria-label="Add host override"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            }
          >
            <Table
              columns={hostColumnsWithActions}
              data={hostOverrides}
              keyField="hostname"
              loading={loading}
              emptyMessage="No host overrides configured."
            />
          </Card>

          <Card
            title="Domain Overrides"
            subtitle="Forward all DNS queries for a domain to a specific resolver"
            actions={
              <button
                onClick={() => setDomainModalOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                title="Add domain override"
                aria-label="Add domain override"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            }
          >
            <Table
              columns={domainColumnsWithActions}
              data={domainOverrides}
              keyField="domain"
              loading={loading}
              emptyMessage="No domain overrides configured."
            />
          </Card>
        </>
      )}

      {activeSection === 'blocklists' && (
        <Card
          title="DNS Blocklists"
          subtitle="Attach external DNS blocklist sources per interface"
          actions={
            <button
              onClick={openAddBlocklistModal}
              disabled={!effectiveInterface}
              className="inline-flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Add blocklist"
              aria-label="Add blocklist"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded border border-gray-200 p-3 bg-gray-50 md:col-span-2">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">
                  Interface
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={effectiveInterface}
                  onChange={(e) => handleChangeBlocklistInterface(e.target.value)}
                >
                  {interfaceOptions.length === 0 && <option value="">No interfaces available</option>}
                  {interfaces.map((iface) => (
                    <option key={iface.name} value={iface.name}>
                      {interfaceLabel(iface)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded border border-gray-200 p-3 bg-gray-50">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Active Interface</p>
                <p className="mt-1 font-medium text-gray-900">{effectiveInterfaceLabel}</p>
              </div>
            </div>

            <Table
              columns={blocklistColumnsWithActions}
              data={blocklists}
              keyField="id"
              loading={blocklistsLoading}
              emptyMessage={effectiveInterface ? `No blocklists configured for ${effectiveInterfaceLabel}.` : 'Select an interface to manage blocklists.'}
            />
          </div>
        </Card>
      )}

      {/* Edit DNS Settings Modal */}
      <Modal
        open={configModalOpen}
        title="Edit DNS Resolver Settings"
        onClose={() => setConfigModalOpen(false)}
        onConfirm={handleSaveConfig}
        confirmLabel="Save"
        loading={configSaving}
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={!!configForm.enabled}
                  onChange={(e) => setConfigForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                <span className="text-sm font-medium text-gray-700">Enable DNS resolver</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none md:justify-end">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={!!configForm.dnssec}
                  onChange={(e) => setConfigForm((f) => ({ ...f, dnssec: e.target.checked }))}
                />
                <span className="text-sm font-medium text-gray-700">Enable DNSSEC validation</span>
              </label>

              <div className="md:col-span-2">
                <FormField
                  id="dns-port"
                  label="Listen Port"
                  type="number"
                  min={1}
                  max={65535}
                  placeholder="53"
                  value={String(configForm.port ?? 53)}
                  onChange={(e) =>
                    setConfigForm((f) => ({ ...f, port: parseInt(e.target.value, 10) || 53 }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-gray-700">Listen Addresses</label>
              <span className="text-xs text-gray-500">
                {listenEntries.length > 0
                  ? `${listenEntries.length} selected`
                  : 'Blank = all interfaces'}
              </span>
            </div>

            {dnsListenCandidates.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                <div className="flex flex-wrap gap-2">
                  {dnsListenCandidates.map((candidate) => {
                    const selected = listenEntries.includes(candidate.ip)
                    return (
                      <button
                        key={candidate.key}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? listenEntries.filter((entry) => entry !== candidate.ip)
                            : [...listenEntries, candidate.ip]
                          setListenInput(next.join(', '))
                        }}
                        className={`rounded border px-2.5 py-1.5 text-left text-xs transition-colors ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600'
                        }`}
                        title={`${candidate.interfaceLabel} (${candidate.interfaceName})`}
                      >
                        <div className="font-mono leading-4">{candidate.ip}</div>
                        <div className={`leading-4 ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
                          {candidate.interfaceLabel}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <input
              id="dns-listen"
              type="text"
              className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 192.168.1.1, 127.0.0.1 (leave blank to listen on all interfaces)"
              value={listenInput}
              onChange={(e) => setListenInput(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <FormField
              id="dns-fwd"
              label="Upstream Forwarders"
              placeholder="e.g. 1.1.1.1, 8.8.8.8 (leave blank for full recursion)"
              value={forwardersInput}
              onChange={(e) => setForwardersInput(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Enter multiple addresses as comma-separated values. When <strong>upstream forwarders</strong> are set,
              Unbound operates in forwarder mode; otherwise it performs full recursive resolution.
              Use <strong>Host Overrides</strong> and <strong>Domain Overrides</strong> for local entries and
              per-domain forwarding.
            </p>
          </div>

        </div>
      </Modal>

      {/* Edit DNS-over-TLS Modal */}
      <Modal
        open={dotModalOpen}
        title="Edit DoT Settings"
        onClose={() => setDotModalOpen(false)}
        onConfirm={handleSaveConfig}
        confirmLabel="Save"
        loading={configSaving}
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            DNS-over-TLS encrypts DNS traffic between clients and DayShield on port {configForm.dot_port ?? 853}.
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Step 1: Turn on encrypted DNS</h3>
              <p className="text-xs text-gray-500">Enable DoT to accept encrypted DNS connections.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                id="dns-dot-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={!!configForm.dot_enabled}
                onChange={(e) => setConfigForm((f) => ({ ...f, dot_enabled: e.target.checked }))}
              />
              <span className="text-sm font-medium text-gray-700">Enable DNS-over-TLS</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded border border-gray-200 bg-white px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Listener</p>
              <p className="mt-1 font-mono text-gray-900">TCP/{configForm.dot_port ?? 853}</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Exposure</p>
              <p className="mt-1 text-gray-900">
                {configForm.dot_lan_only === false ? 'LAN + external clients' : 'LAN clients only'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Step 2: Choose who can connect</p>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                id="dns-dot-wan-access"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={configForm.dot_lan_only === false}
                onChange={(e) => setConfigForm((f) => ({ ...f, dot_lan_only: !e.target.checked }))}
              />
              <span className="text-sm font-medium text-gray-700">Allow external (WAN) clients</span>
            </label>
            <p className="text-xs text-gray-500">
              Keep this off unless you intentionally want remote clients to query your DNS server.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="dns-dot-acme-domain" className="block text-sm font-semibold text-gray-900">
              Step 3: Select ACME certificate
            </label>
            <p className="text-xs text-gray-500">
              DoT requires an issued ACME certificate.
            </p>
            <select
              id="dns-dot-acme-domain"
              value={configForm.dot_acme_domain ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, dot_acme_domain: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="">-- Select an ACME certificate --</option>
              {acmeDomains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>



          <p className="text-xs text-gray-500">
            Save applies DoT settings to DNS service. Clients can then connect on TCP/{configForm.dot_port ?? 853} based on your access policy.
          </p>
        </div>
      </Modal>

      {/* Add Host Override Modal */}
      <Modal
        open={hostModalOpen}
        title="Add Host Override"
        onClose={() => setHostModalOpen(false)}
        onConfirm={handleAddHost}
        confirmLabel="Add"
        loading={hostSaving}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="host-fqdn"
            label="Hostname (FQDN)"
            required
            className="col-span-2"
            placeholder="e.g. myserver.home.lan"
            value={hostForm.hostname}
            onChange={(e) => setHostForm({ ...hostForm, hostname: e.target.value })}
          />
          <FormField
            id="host-addr"
            label="IP Address"
            required
            className="col-span-2"
            placeholder="192.168.1.50"
            value={hostForm.address}
            onChange={(e) => setHostForm({ ...hostForm, address: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Host Confirmation */}
      <Modal
        open={hostDeleteName !== null}
        title="Remove Host Override"
        onClose={() => setHostDeleteName(null)}
        onConfirm={handleDeleteHost}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={hostDeleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Remove override for <strong className="font-mono">{hostDeleteName}</strong>?
        </p>
      </Modal>

      {/* Add Domain Override Modal */}
      <Modal
        open={domainModalOpen}
        title="Add Domain Override"
        onClose={() => setDomainModalOpen(false)}
        onConfirm={handleAddDomain}
        confirmLabel="Add"
        loading={domainSaving}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="dom-name"
            label="Domain"
            required
            className="col-span-2"
            placeholder="e.g. internal.corp"
            value={domainForm.domain}
            onChange={(e) => setDomainForm({ ...domainForm, domain: e.target.value })}
          />
          <FormField
            id="dom-fwd"
            label="Forward To (DNS Server IP)"
            required
            className="col-span-2"
            placeholder="e.g. 10.0.0.53"
            value={domainForm.forward_to}
            onChange={(e) => setDomainForm({ ...domainForm, forward_to: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Domain Confirmation */}
      <Modal
        open={domainDeleteName !== null}
        title="Remove Domain Override"
        onClose={() => setDomainDeleteName(null)}
        onConfirm={handleDeleteDomain}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={domainDeleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Remove override for domain <strong className="font-mono">{domainDeleteName}</strong>?
        </p>
      </Modal>

      {/* Add Blocklist Modal */}
      <Modal
        open={blocklistModalOpen}
        title="Add DNS Blocklist"
        onClose={() => setBlocklistModalOpen(false)}
        onConfirm={handleAddBlocklist}
        confirmLabel="Add"
        loading={blocklistSaving}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <p className="text-gray-500">Interface</p>
            <p className="font-medium text-gray-800">{effectiveInterfaceLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="dns-blocklist-preset" className="block text-xs font-medium text-gray-700 mb-1">
                Preset Blocklist (optional)
              </label>
              <select
                id="dns-blocklist-preset"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={selectedPreset}
                onChange={(e) => {
                  const presetUrl = e.target.value
                  setSelectedPreset(presetUrl)
                  if (!presetUrl) return
                  const preset = BLOCKLIST_PRESETS.find((p) => p.url === presetUrl)
                  if (!preset) return
                  setBlocklistForm((prev) => ({
                    ...prev,
                    name: prev.name || preset.name,
                    url: preset.url,
                  }))
                }}
              >
                <option value="">Select preset or enter custom URL</option>
                {BLOCKLIST_PRESETS.map((preset) => (
                  <option key={preset.url} value={preset.url}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <FormField
              id="dns-blocklist-name"
              label="Name (optional)"
              className="col-span-2"
              placeholder="e.g. Ads + Tracker Block"
              value={blocklistForm.name}
              onChange={(e) => setBlocklistForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <FormField
              id="dns-blocklist-url"
              label="Blocklist URL"
              required
              className="col-span-2"
              placeholder="https://example.com/blocklist.txt"
              value={blocklistForm.url}
              onChange={(e) => setBlocklistForm((prev) => ({ ...prev, url: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={blocklistForm.enabled}
              onChange={(e) => setBlocklistForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">Enable this blocklist now</span>
          </label>
        </div>
      </Modal>

      {/* Delete Blocklist Confirmation */}
      <Modal
        open={blocklistDeleteId !== null}
        title="Remove DNS Blocklist"
        onClose={() => setBlocklistDeleteId(null)}
        onConfirm={handleDeleteBlocklist}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={blocklistDeleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Remove this blocklist from <strong>{effectiveInterfaceLabel}</strong>?
        </p>
      </Modal>
    </div>
  )
}
