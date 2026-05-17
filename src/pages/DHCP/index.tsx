import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getDhcpConfig,
  getDhcp6Config,
  updateDhcpConfig,
  updateDhcp6Config,
  getDhcpStaticLeases,
  createDhcpStaticLease,
  deleteDhcpStaticLease,
  getDhcpLeases,
  getDhcp6StaticLeases,
  createDhcp6StaticLease,
  deleteDhcp6StaticLease,
  getDhcp6Leases,
  getInterfaceDhcpConfig,
  getInterfaceDhcp6Config,
  updateInterfaceDhcpConfig,
  updateInterfaceDhcp6Config,
  getInterfaceStaticLeases,
  createInterfaceStaticLease,
  deleteInterfaceStaticLease,
  getInterfaceDhcp6StaticLeases,
  createInterfaceDhcp6StaticLease,
  deleteInterfaceDhcp6StaticLease,
} from '../../api/dhcp'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import type {
  Dhcp6Config,
  Dhcp6ConfigPerInterface,
  Dhcp6StaticLease,
  Dhcp6Lease,
  DhcpConfig,
  DhcpConfigPerInterface,
  DhcpStaticLease,
  DhcpLease,
  NetworkInterface,
} from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext'

type StaticLeaseRow = DhcpStaticLease & Record<string, unknown>
type ActiveLeaseRow = DhcpLease & Record<string, unknown>
type Static6LeaseRow = Dhcp6StaticLease & Record<string, unknown>
type Active6LeaseRow = Dhcp6Lease & Record<string, unknown>

const staticColumns: Column<StaticLeaseRow>[] = [
  { key: 'mac', header: 'MAC Address' },
  { key: 'ipAddress', header: 'IP Address' },
  { key: 'hostname', header: 'Hostname' },
  { key: 'description', header: 'Description' },
]

const static6Columns: Column<Static6LeaseRow>[] = [
  { key: 'duid', header: 'DUID' },
  { key: 'ipAddress', header: 'IPv6 Address' },
  { key: 'hostname', header: 'Hostname' },
  { key: 'description', header: 'Description' },
]

const defaultLease6Form: Omit<Dhcp6StaticLease, 'id'> = {
  duid: '',
  ipAddress: '',
  hostname: '',
  description: '',
}

const defaultLeaseForm: Omit<DhcpStaticLease, 'id'> = {
  mac: '',
  ipAddress: '',
  hostname: '',
  description: '',
}

const defaultConfigForm = (): Partial<DhcpConfig> => ({
  enabled: true,
  interface: '',
  subnet: '',
  rangeStart: '',
  rangeEnd: '',
  gateway: '',
  dnsServers: [],
  leaseTime: 86400,
  domainName: '',
})

const defaultConfig6Form = (): Partial<Dhcp6Config> => ({
  enabled: true,
  interface: '',
  subnet: '',
  rangeStart: '',
  rangeEnd: '',
  dnsServers: [],
  leaseTime: 86400,
  domainName: '',
})

function isWanInterface(iface: NetworkInterface): boolean {
  const desc = iface.description?.trim().toLowerCase() ?? ''
  return Boolean(iface.wanMode) || desc.includes('wan') || iface.name.toLowerCase() === 'wan'
}

function ipv6ToBigInt(value: string): bigint | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.includes('/') || trimmed.includes('.')) return null

  const halves = trimmed.split('::')
  if (halves.length > 2) return null

  const parseParts = (part: string): number[] | null => {
    if (!part) return []
    const pieces = part.split(':')
    if (pieces.some((piece) => piece === '')) return null
    const parsed = pieces.map((piece) => {
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null
      return Number.parseInt(piece, 16)
    })
    return parsed.some((piece) => piece == null) ? null : parsed as number[]
  }

  const head = parseParts(halves[0])
  const tail = parseParts(halves[1] ?? '')
  if (head == null || tail == null) return null

  const hasCompression = halves.length === 2
  const missing = 8 - head.length - tail.length
  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 0)) return null

  const segments = hasCompression
    ? [...head, ...Array(missing).fill(0), ...tail]
    : head
  if (segments.length !== 8) return null

  return segments.reduce((acc, segment) => (acc << 16n) + BigInt(segment), 0n)
}

function ipv6InSubnet(address: string, cidr: string): boolean {
  const [network, prefixText] = cidr.split('/')
  const prefix = Number(prefixText)
  if (!network || !Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false

  const ip = ipv6ToBigInt(address)
  const networkIp = ipv6ToBigInt(network)
  if (ip == null || networkIp == null) return false

  const allBits = (1n << 128n) - 1n
  const mask = prefix === 0 ? 0n : (allBits << BigInt(128 - prefix)) & allBits
  return (ip & mask) === (networkIp & mask)
}

export default function DHCP() {
  const { formatDateTime } = useDisplayPreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedInterface = searchParams.get('iface')
  const [config, setConfig] = useState<DhcpConfig | null>(null)
  const [config6, setConfig6] = useState<Dhcp6Config | null>(null)
  const [interfaceConfig, setInterfaceConfig] = useState<DhcpConfigPerInterface | null>(null)
  const [interfaceConfig6, setInterfaceConfig6] = useState<Dhcp6ConfigPerInterface | null>(null)
  const [staticLeases, setStaticLeases] = useState<StaticLeaseRow[]>([])
  const [activeLeases, setActiveLeases] = useState<ActiveLeaseRow[]>([])
  const [static6Leases, setStatic6Leases] = useState<Static6LeaseRow[]>([])
  const [active6Leases, setActive6Leases] = useState<Active6LeaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leaseModalOpen, setLeaseModalOpen] = useState(false)
  const [leaseForm, setLeaseForm] = useState<Omit<DhcpStaticLease, 'id'>>(defaultLeaseForm)
  const [leaseSaving, setLeaseSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [lease6ModalOpen, setLease6ModalOpen] = useState(false)
  const [lease6Form, setLease6Form] = useState<Omit<Dhcp6StaticLease, 'id'> & { mac?: string }>(defaultLease6Form)
  const [lease6Saving, setLease6Saving] = useState(false)
  const [delete6Id, setDelete6Id] = useState<string | null>(null)
  const [deleting6, setDeleting6] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configForm, setConfigForm] = useState<Partial<DhcpConfig | DhcpConfigPerInterface>>(defaultConfigForm())
  const [configSaving, setConfigSaving] = useState(false)
  const [config6ModalOpen, setConfig6ModalOpen] = useState(false)
  const [config6Form, setConfig6Form] = useState<Partial<Dhcp6Config | Dhcp6ConfigPerInterface>>(defaultConfig6Form())
  const [config6Saving, setConfig6Saving] = useState(false)
  // DNS servers are edited as a comma-separated string in the input
  const [dnsInput, setDnsInput] = useState('')
  const [dns6Input, setDns6Input] = useState('')
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])

  const interfaceLabel = (iface: NetworkInterface): string =>
    formatInterfaceDisplayName(iface.description, iface.name)

  const selectableInterfaces = useMemo(
    () => interfaces.filter((iface) => !isWanInterface(iface)),
    [interfaces],
  )

  const selectedInterfaceMeta = useMemo(
    () => interfaces.find((iface) => iface.name === selectedInterface) ?? null,
    [interfaces, selectedInterface],
  )

  const selectedInterfaceLabel = selectedInterfaceMeta
    ? interfaceLabel(selectedInterfaceMeta)
    : selectedInterface || ''

  const globalConfigInterfaceLabel = useMemo(() => {
    const name = config?.interface
    if (!name) return '-'
    const iface = interfaces.find((item) => item.name === name)
    return iface ? interfaceLabel(iface) : name
  }, [config?.interface, interfaces])

  const openStaticReservationFromLease = (lease: ActiveLeaseRow) => {
    setLeaseForm({
      mac: lease.mac ?? '',
      ipAddress: lease.ipAddress ?? '',
      hostname: lease.hostname ?? '',
      description: '',
    })
    setLeaseModalOpen(true)
  }

  const openStatic6ReservationFromLease = (lease: Active6LeaseRow) => {
    setLease6Form({
      duid: lease.duid ?? '',
      mac: '',
      ipAddress: lease.ipAddress ?? '',
      hostname: lease.hostname ?? '',
      description: '',
    })
    setLease6ModalOpen(true)
  }

  const activeColumns: Column<ActiveLeaseRow>[] = [
    { key: 'mac', header: 'MAC Address' },
    { key: 'ipAddress', header: 'IP Address' },
    { key: 'hostname', header: 'Hostname', render: (row) => (row.hostname as string) || '-' },
    {
      key: 'state',
      header: 'State',
      render: (row) => {
        const state = row.state as DhcpLease['state']
        const map: Record<string, string> = {
          active:    'bg-green-100 text-green-700',
          expired:   'bg-red-100 text-red-700',
          reserved:  'bg-blue-100 text-blue-700',
          declined:  'bg-orange-100 text-orange-700',
          reclaimed: 'bg-gray-100 text-gray-500',
        }
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[state] ?? 'bg-gray-100 text-gray-500'}`}>
            {state}
          </span>
        )
      },
    },
    {
      key: 'ends',
      header: 'Expires',
      render: (row) => {
        const raw = row.ends as string
        if (!raw) return '-'
        const asNum = Number(raw)
        const d = Number.isFinite(asNum) && asNum > 1e9
          ? new Date(asNum * 1000)
          : new Date(raw)
        return isNaN(d.getTime()) ? raw : formatDateTime(d)
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28 text-right',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openStaticReservationFromLease(row)}
          disabled={!row.mac || !row.ipAddress}
        >
          Reserve
        </Button>
      ),
    },
  ]

  const loadAll = () => {
    setLoading(true)
    if (selectedInterface) {
      Promise.all([
        getInterfaceDhcpConfig(selectedInterface),
        getInterfaceDhcp6Config(selectedInterface),
        getInterfaceStaticLeases(selectedInterface),
        getDhcpLeases(),
        getInterfaceDhcp6StaticLeases(selectedInterface),
        getDhcp6Leases(),
      ])
        .then(([cfg, cfg6, statics, active, statics6, active6]) => {
          setInterfaceConfig(cfg.data)
          setInterfaceConfig6(cfg6.data)
          setConfig(null)
          setConfig6(null)
          setStaticLeases(statics.data as StaticLeaseRow[])
          setActiveLeases(active.data as ActiveLeaseRow[])
          setStatic6Leases(statics6.data as Static6LeaseRow[])
          setActive6Leases(active6.data as Active6LeaseRow[])
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false))
      return
    }

    Promise.all([getDhcpConfig(), getDhcp6Config(), getDhcpStaticLeases(), getDhcpLeases(), getDhcp6StaticLeases(), getDhcp6Leases()])
      .then(([cfg, cfg6, statics, actives, statics6, actives6]) => {
        setConfig(cfg.data)
        setConfig6(cfg6.data)
        setInterfaceConfig(null)
        setInterfaceConfig6(null)
        setStaticLeases(statics.data as StaticLeaseRow[])
        setActiveLeases(actives.data as ActiveLeaseRow[])
        setStatic6Leases(statics6.data as Static6LeaseRow[])
        setActive6Leases(actives6.data as Active6LeaseRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [selectedInterface])

  useEffect(() => {
    if (!selectedInterface || selectableInterfaces.length === 0) return
    const isSelectable = selectableInterfaces.some((iface) => iface.name === selectedInterface)
    if (isSelectable) return

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('iface', selectableInterfaces[0].name)
      return next
    }, { replace: true })
  }, [selectedInterface, selectableInterfaces, setSearchParams])

  useEffect(() => {
    if (selectedInterface || selectableInterfaces.length === 0) return

    const preferred = selectableInterfaces.find((iface) => iface.name === config?.interface) ?? selectableInterfaces[0]
    if (!preferred) return

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('iface', preferred.name)
      return next
    }, { replace: true })
  }, [selectedInterface, selectableInterfaces, config?.interface, setSearchParams])

  const activeLeasesForSelectedInterface = useMemo(() => {
    if (!selectedInterface) return activeLeases
    const subnet = interfaceConfig?.subnet
    if (!subnet) return activeLeases

    const [network, prefixText] = subnet.split('/')
    const prefix = Number(prefixText)
    if (!network || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return activeLeases

    const toIPv4Int = (value: string): number | null => {
      const parts = value.split('.').map((part) => Number(part))
      if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return null
      }
      return (((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0)) >>> 0
    }

    const networkInt = toIPv4Int(network)
    if (networkInt == null) return activeLeases
    const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0)

    return activeLeases.filter((lease) => {
      const ip = toIPv4Int(String(lease.ipAddress ?? ''))
      return ip != null && (ip & mask) === (networkInt & mask)
    })
  }, [activeLeases, selectedInterface, interfaceConfig?.subnet])

  const active6LeasesForSelectedInterface = useMemo(() => {
    if (!selectedInterface) return active6Leases
    const subnet = interfaceConfig6?.subnet
    if (!subnet) return active6Leases

    return active6Leases.filter((lease) => ipv6InSubnet(String(lease.ipAddress ?? ''), subnet))
  }, [active6Leases, selectedInterface, interfaceConfig6?.subnet])

  const handleSelectInterface = (interfaceName: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (interfaceName) next.set('iface', interfaceName)
      else next.delete('iface')
      return next
    })
  }

  useEffect(() => {
    Promise.all([getInterfaces(), getInterfacesInventory()])
      .then(([ifacesRes, inventoryRes]) => {
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
      .catch(() => setInterfaces([]))
  }, [])

  const openConfigModal = () => {
    if (selectedInterface && interfaceConfig) {
      setConfigForm({ ...interfaceConfig })
      setDnsInput((interfaceConfig.dnsServers ?? []).join(', '))
    } else if (config) {
      setConfigForm({ ...config })
      setDnsInput((config.dnsServers ?? []).join(', '))
    } else {
      setConfigForm(defaultConfigForm())
      setDnsInput('')
    }
    setConfigModalOpen(true)
  }

  const handleSaveConfig = () => {
    // Parse the DNS servers input back to an array
    const dnsServers = dnsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const payload = { ...configForm, dnsServers }
    setConfigSaving(true)
    const savePromise = selectedInterface
      ? updateInterfaceDhcpConfig(selectedInterface, payload as Partial<DhcpConfigPerInterface>)
      : updateDhcpConfig(payload as Partial<DhcpConfig>)

    savePromise
      .then((r) => {
        if (selectedInterface) {
          setInterfaceConfig(r.data as DhcpConfigPerInterface)
        } else {
          setConfig(r.data as DhcpConfig)
        }
        setConfigModalOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setConfigSaving(false))
  }

  const openConfig6Modal = () => {
    if (selectedInterface && interfaceConfig6) {
      setConfig6Form({ ...interfaceConfig6 })
      setDns6Input((interfaceConfig6.dnsServers ?? []).join(', '))
    } else if (config6) {
      setConfig6Form({ ...config6 })
      setDns6Input((config6.dnsServers ?? []).join(', '))
    } else {
      setConfig6Form(defaultConfig6Form())
      setDns6Input('')
    }
    setConfig6ModalOpen(true)
  }

  const handleSaveConfig6 = () => {
    const dnsServers = dns6Input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const payload = { ...config6Form, dnsServers }
    setConfig6Saving(true)
    const savePromise = selectedInterface
      ? updateInterfaceDhcp6Config(selectedInterface, payload as Partial<Dhcp6ConfigPerInterface>)
      : updateDhcp6Config(payload as Partial<Dhcp6Config>)

    savePromise
      .then((r) => {
        if (selectedInterface) {
          setInterfaceConfig6(r.data as Dhcp6ConfigPerInterface)
        } else {
          setConfig6(r.data as Dhcp6Config)
        }
        setConfig6ModalOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setConfig6Saving(false))
  }

  const handleAddLease = () => {
    setLeaseSaving(true)
    const addPromise = selectedInterface
      ? createInterfaceStaticLease(selectedInterface, leaseForm)
      : createDhcpStaticLease(leaseForm)

    addPromise
      .then(() => {
        setLeaseModalOpen(false)
        setLeaseForm(defaultLeaseForm)
        const reloadLeases = selectedInterface
          ? getInterfaceStaticLeases(selectedInterface)
          : getDhcpStaticLeases()
        reloadLeases
          .then((r) => setStaticLeases(r.data as StaticLeaseRow[]))
          .catch((err: Error) => setError(err.message))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLeaseSaving(false))
  }

  const handleDeleteLease = () => {
    if (deleteId === null) return
    setDeleting(true)
    const deletePromise = selectedInterface
      ? deleteInterfaceStaticLease(selectedInterface, deleteId)
      : deleteDhcpStaticLease(deleteId)

    deletePromise
      .then(() => {
        setDeleteId(null)
        const reloadLeases = selectedInterface
          ? getInterfaceStaticLeases(selectedInterface)
          : getDhcpStaticLeases()
        reloadLeases
          .then((r) => setStaticLeases(r.data as StaticLeaseRow[]))
          .catch((err: Error) => setError(err.message))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false))
  }

  const handleAddLease6 = () => {
    setLease6Saving(true)
    const addPromise = selectedInterface
      ? createInterfaceDhcp6StaticLease(selectedInterface, lease6Form)
      : createDhcp6StaticLease(lease6Form)

    addPromise
      .then(() => {
        setLease6ModalOpen(false)
        setLease6Form(defaultLease6Form)
        const reloadLeases = selectedInterface
          ? getInterfaceDhcp6StaticLeases(selectedInterface)
          : getDhcp6StaticLeases()
        reloadLeases
          .then((r) => setStatic6Leases(r.data as Static6LeaseRow[]))
          .catch((err: Error) => setError(err.message))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLease6Saving(false))
  }

  const handleDeleteLease6 = () => {
    if (delete6Id === null) return
    setDeleting6(true)
    const deletePromise = selectedInterface
      ? deleteInterfaceDhcp6StaticLease(selectedInterface, delete6Id)
      : deleteDhcp6StaticLease(delete6Id)

    deletePromise
      .then(() => {
        setDelete6Id(null)
        const reloadLeases = selectedInterface
          ? getInterfaceDhcp6StaticLeases(selectedInterface)
          : getDhcp6StaticLeases()
        reloadLeases
          .then((r) => setStatic6Leases(r.data as Static6LeaseRow[]))
          .catch((err: Error) => setError(err.message))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting6(false))
  }

  const static6ColumnsWithActions: Column<Static6LeaseRow>[] = [
    ...static6Columns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <button
          onClick={() => setDelete6Id(row.id as string)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
          title="Delete DHCPv6 static lease"
          aria-label="Delete DHCPv6 static lease"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      ),
    },
  ]

  const active6Columns: Column<Active6LeaseRow>[] = [
    { key: 'ipAddress', header: 'IPv6 Address' },
    { key: 'duid', header: 'DUID', render: (row) => <span className="font-mono text-xs">{row.duid as string || '-'}</span> },
    { key: 'hostname', header: 'Hostname', render: (row) => (row.hostname as string) || '-' },
    {
      key: 'state',
      header: 'State',
      render: (row) => {
        const state = row.state as string
        const map: Record<string, string> = {
          active:    'bg-green-100 text-green-700',
          expired:   'bg-red-100 text-red-700',
          declined:  'bg-orange-100 text-orange-700',
          reclaimed: 'bg-gray-100 text-gray-500',
        }
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[state] ?? 'bg-gray-100 text-gray-500'}`}>
            {state}
          </span>
        )
      },
    },
    {
      key: 'ends',
      header: 'Expires',
      render: (row) => {
        const raw = row.ends as string
        if (!raw) return '-'
        const asNum = Number(raw)
        const d = Number.isFinite(asNum) && asNum > 1e9
          ? new Date(asNum * 1000)
          : new Date(raw)
        return isNaN(d.getTime()) ? raw : formatDateTime(d)
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28 text-right',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openStatic6ReservationFromLease(row)}
          disabled={!row.duid || !row.ipAddress}
        >
          Reserve
        </Button>
      ),
    },
  ]

  const staticColumnsWithActions: Column<StaticLeaseRow>[] = [
    ...staticColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <button
          onClick={() => setDeleteId(row.id as string)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
          title="Delete static lease"
          aria-label="Delete static lease"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      ),
    },
  ]

  const leaseTimeFmt = (secs: number) => {
    if (secs >= 86400 && secs % 86400 === 0) return `${secs / 86400} day${secs / 86400 !== 1 ? 's' : ''}`
    if (secs >= 3600 && secs % 3600 === 0) return `${secs / 3600} hour${secs / 3600 !== 1 ? 's' : ''}`
    return `${secs}s`
  }

  return (
    <div className="space-y-6">
      {/* Edit DHCP Config Modal */}
      <Modal
        open={configModalOpen}
        title={selectedInterface ? `Edit DHCP: ${selectedInterfaceLabel}` : 'Edit DHCP Server'}
        onClose={() => setConfigModalOpen(false)}
        onConfirm={handleSaveConfig}
        confirmLabel="Save"
        loading={configSaving}
        size="lg"
      >
        <div className="space-y-5">
          {/* Enable toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={!!configForm.enabled}
              onChange={(e) => setConfigForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">Enable DHCP server</span>
          </label>

          <details open className="overflow-hidden rounded border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
              Scope & Network
            </summary>
            <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
              {!selectedInterface && (
                <FormField
                  id="cfg-iface"
                  label="LAN Interface"
                  as="select"
                  required
                  value={(configForm as Partial<DhcpConfig>).interface ?? ''}
                  onChange={(e) => setConfigForm((f) => ({ ...f, interface: e.target.value }))}
                >
                  <option value="">Select interface</option>
                  {selectableInterfaces.map((iface) => (
                    <option key={iface.name} value={iface.name}>{interfaceLabel(iface)}</option>
                  ))}
                </FormField>
              )}

              <FormField
                id="cfg-subnet"
                label="Subnet (CIDR)"
                required
                placeholder="e.g. 192.168.1.0/24"
                value={configForm.subnet ?? ''}
                onChange={(e) => setConfigForm((f) => ({ ...f, subnet: e.target.value }))}
              >
                <select
                  className="input"
                  value={configForm.subnet?.split('/')[1] || ''}
                  onChange={(e) => {
                    const prefix = e.target.value;
                    const base = configForm.subnet?.split('/')[0] || '192.168.1.0';
                    setConfigForm((f) => ({ ...f, subnet: `${base}/${prefix}` }));
                  }}
                >
                  {[...Array(33).keys()].map((prefix) => (
                    <option key={prefix} value={prefix}>{`/${prefix}`}</option>
                  ))}
                </select>
              </FormField>

              <FormField
                id="cfg-gw"
                label="Default Gateway"
                placeholder="e.g. 192.168.1.1"
                value={configForm.gateway ?? ''}
                onChange={(e) => setConfigForm((f) => ({ ...f, gateway: e.target.value }))}
              />

              <FormField
                id="cfg-lease"
                label="Lease Time (seconds)"
                type="number"
                placeholder="86400"
                value={String(configForm.leaseTime ?? 86400)}
                onChange={(e) =>
                  setConfigForm((f) => ({ ...f, leaseTime: parseInt(e.target.value, 10) || 86400 }))
                }
              />

              <FormField
                id="cfg-start"
                label="Pool Start"
                required
                placeholder="e.g. 192.168.1.100"
                value={configForm.rangeStart ?? ''}
                onChange={(e) => setConfigForm((f) => ({ ...f, rangeStart: e.target.value }))}
              />

              <FormField
                id="cfg-end"
                label="Pool End"
                required
                placeholder="e.g. 192.168.1.199"
                value={configForm.rangeEnd ?? ''}
                onChange={(e) => setConfigForm((f) => ({ ...f, rangeEnd: e.target.value }))}
              />
            </div>
          </details>

          <details className="overflow-hidden rounded border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
              DNS & Domain
            </summary>
            <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
              <FormField
                id="cfg-dns"
                label="DNS Servers"
                className="col-span-2"
                placeholder="e.g. 192.168.1.1, 1.1.1.1"
                value={dnsInput}
                onChange={(e) => setDnsInput(e.target.value)}
              />
              <FormField
                id="cfg-domain"
                label="Domain Name (optional)"
                className="col-span-2"
                placeholder="e.g. home.lan"
                value={configForm.domainName ?? ''}
                onChange={(e) => setConfigForm((f) => ({ ...f, domainName: e.target.value }))}
              />
            </div>
          </details>

          <p className="text-xs text-gray-500">
            <strong>Subnet</strong> must match the interface network. Configure per-interface scopes from the DHCP submenu for each interface.
          </p>
        </div>
      </Modal>

      {/* Edit DHCPv6 Config Modal */}
      <Modal
        open={config6ModalOpen}
        title={selectedInterface ? `Edit DHCPv6: ${selectedInterfaceLabel}` : 'Edit DHCPv6 Server'}
        onClose={() => setConfig6ModalOpen(false)}
        onConfirm={handleSaveConfig6}
        confirmLabel="Save"
        loading={config6Saving}
        size="lg"
      >
        <div className="space-y-5">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={!!config6Form.enabled}
              onChange={(e) => setConfig6Form((f) => ({ ...f, enabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">Enable DHCPv6 server</span>
          </label>

          <details open className="overflow-hidden rounded border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
              Scope & Network
            </summary>
            <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
              {!selectedInterface && (
                <FormField
                  id="cfg6-iface"
                  label="LAN Interface"
                  as="select"
                  required
                  value={(config6Form as Partial<Dhcp6Config>).interface ?? ''}
                  onChange={(e) => setConfig6Form((f) => ({ ...f, interface: e.target.value }))}
                >
                  <option value="">Select interface</option>
                  {selectableInterfaces.map((iface) => (
                    <option key={iface.name} value={iface.name}>{interfaceLabel(iface)}</option>
                  ))}
                </FormField>
              )}

              <FormField
                id="cfg6-subnet"
                label="Subnet (CIDR)"
                required
                className="col-span-2"
                placeholder="e.g. fd00::/64"
                value={config6Form.subnet ?? ''}
                onChange={(e) => setConfig6Form((f) => ({ ...f, subnet: e.target.value }))}
              />

              <FormField
                id="cfg6-lease"
                label="Lease Time (seconds)"
                type="number"
                placeholder="86400"
                value={String(config6Form.leaseTime ?? 86400)}
                onChange={(e) =>
                  setConfig6Form((f) => ({ ...f, leaseTime: parseInt(e.target.value, 10) || 86400 }))
                }
              />

              <div />

              <FormField
                id="cfg6-start"
                label="Pool Start"
                required
                placeholder="e.g. fd00::100"
                value={config6Form.rangeStart ?? ''}
                onChange={(e) => setConfig6Form((f) => ({ ...f, rangeStart: e.target.value }))}
              />

              <FormField
                id="cfg6-end"
                label="Pool End"
                required
                placeholder="e.g. fd00::1ff"
                value={config6Form.rangeEnd ?? ''}
                onChange={(e) => setConfig6Form((f) => ({ ...f, rangeEnd: e.target.value }))}
              />
            </div>
          </details>

          <details className="overflow-hidden rounded border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
              DNS & Domain
            </summary>
            <div className="border-t border-gray-200 px-4 py-4 grid grid-cols-2 gap-4">
              <FormField
                id="cfg6-dns"
                label="DNS Servers"
                className="col-span-2"
                placeholder="e.g. fd00::1, 2001:4860:4860::8888"
                value={dns6Input}
                onChange={(e) => setDns6Input(e.target.value)}
              />
              <FormField
                id="cfg6-domain"
                label="Domain Name (optional)"
                className="col-span-2"
                placeholder="e.g. home.arpa"
                value={config6Form.domainName ?? ''}
                onChange={(e) => setConfig6Form((f) => ({ ...f, domainName: e.target.value }))}
              />
            </div>
          </details>
        </div>
      </Modal>

      {/* Add Static Lease Modal */}
      <Modal
        open={leaseModalOpen}
        title={selectedInterface ? `Add Static IP Reservation: ${selectedInterfaceLabel}` : 'Add Static Lease'}
        onClose={() => setLeaseModalOpen(false)}
        onConfirm={handleAddLease}
        confirmLabel="Add"
        loading={leaseSaving}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="lease-mac"
            label="MAC Address"
            required
            placeholder="aa:bb:cc:dd:ee:ff"
            value={leaseForm.mac}
            onChange={(e) => setLeaseForm({ ...leaseForm, mac: e.target.value })}
          />
          <FormField
            id="lease-ip"
            label="IP Address"
            required
            placeholder="192.168.1.50"
            value={leaseForm.ipAddress}
            onChange={(e) => setLeaseForm({ ...leaseForm, ipAddress: e.target.value })}
          />
          <FormField
            id="lease-host"
            label="Hostname"
            placeholder="my-device"
            value={leaseForm.hostname}
            onChange={(e) => setLeaseForm({ ...leaseForm, hostname: e.target.value })}
          />
          <FormField
            id="lease-desc"
            label="Description"
            placeholder="Optional"
            value={leaseForm.description}
            onChange={(e) => setLeaseForm({ ...leaseForm, description: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete Static Lease"
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteLease}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">Remove this static DHCP lease?</p>
      </Modal>

      {/* Add DHCPv6 Static Reservation Modal */}
      <Modal
        open={lease6ModalOpen}
        title="Add DHCPv6 Static Reservation"
        onClose={() => setLease6ModalOpen(false)}
        onConfirm={handleAddLease6}
        confirmLabel="Add"
        loading={lease6Saving}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Provide a <strong>DUID</strong> (colon-separated hex, e.g. <span className="font-mono">00:03:00:01:aa:bb:cc:dd:ee:ff</span>)
            or a <strong>MAC address</strong> — it will be auto-converted to a DUID-LL.
          </p>
          <FormField
            id="l6-duid"
            label="DUID (optional if MAC provided)"
            placeholder="00:03:00:01:aa:bb:cc:dd:ee:ff"
            value={lease6Form.duid ?? ''}
            onChange={(e) => setLease6Form((f) => ({ ...f, duid: e.target.value }))}
          />
          <FormField
            id="l6-mac"
            label="MAC Address (optional, auto-converted to DUID-LL)"
            placeholder="aa:bb:cc:dd:ee:ff"
            value={lease6Form.mac ?? ''}
            onChange={(e) => setLease6Form((f) => ({ ...f, mac: e.target.value }))}
          />
          <FormField
            id="l6-ip"
            label="IPv6 Address"
            required
            placeholder="fd00::50"
            value={lease6Form.ipAddress}
            onChange={(e) => setLease6Form((f) => ({ ...f, ipAddress: e.target.value }))}
          />
          <FormField
            id="l6-hostname"
            label="Hostname (optional)"
            placeholder="mydevice"
            value={lease6Form.hostname}
            onChange={(e) => setLease6Form((f) => ({ ...f, hostname: e.target.value }))}
          />
          <FormField
            id="l6-desc"
            label="Description (optional)"
            placeholder="e.g. Living room TV"
            value={lease6Form.description}
            onChange={(e) => setLease6Form((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
      </Modal>

      {/* DHCPv6 Delete Confirmation Modal */}
      <Modal
        open={delete6Id !== null}
        title="Delete DHCPv6 Reservation"
        onClose={() => setDelete6Id(null)}
        onConfirm={handleDeleteLease6}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting6}
        size="sm"
      >
        <p className="text-sm text-gray-600">Remove this DHCPv6 static reservation?</p>
      </Modal>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-3 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <Card
        title="DHCP"
        subtitle="Select the interface whose DHCP settings, reservations, and active leases you want to manage"
      >
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          This page manages DHCPv4 (Kea). IPv6 uplink modes (DHCPv6/SLAAC/track prefix) are configured per interface in Interfaces when IPv6 is enabled in System settings.
        </div>
        <div className="max-w-md">
          <FormField
            id="dhcp-interface-selector"
            label="Interface"
            as="select"
            value={selectedInterface ?? ''}
            onChange={(e) => handleSelectInterface(e.target.value)}
          >
            <option value="">Select interface</option>
            {selectableInterfaces.map((iface) => (
              <option key={iface.name} value={iface.name}>
                {interfaceLabel(iface)}
              </option>
            ))}
          </FormField>
        </div>
      </Card>

      {/* DHCP Config summary */}
      <Card
        title={selectedInterface ? `DHCP: ${selectedInterfaceLabel}` : 'DHCP Server'}
        subtitle={selectedInterface ? 'Per-interface DHCPv4 scope and reservation settings' : 'Kea DHCPv4 configuration'}
        actions={
          <button
            onClick={openConfigModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title={selectedInterface ? 'Edit interface DHCP settings' : 'Edit DHCP settings'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (selectedInterface ? interfaceConfig : config) ? (
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {!selectedInterface && (
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Interface</dt>
                <dd className="mt-1 font-medium text-gray-800">{globalConfigInterfaceLabel}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
              <dd className={`mt-1 font-semibold ${(selectedInterface ? interfaceConfig?.enabled : config?.enabled) ? 'text-green-600' : 'text-gray-400'}`}>
                {(selectedInterface ? interfaceConfig?.enabled : config?.enabled) ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Subnet</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{(selectedInterface ? interfaceConfig?.subnet : config?.subnet) || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Pool Range</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">
                {(selectedInterface ? interfaceConfig?.rangeStart : config?.rangeStart) && (selectedInterface ? interfaceConfig?.rangeEnd : config?.rangeEnd)
                  ? `${selectedInterface ? interfaceConfig?.rangeStart : config?.rangeStart} - ${selectedInterface ? interfaceConfig?.rangeEnd : config?.rangeEnd}`
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Default Gateway</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{(selectedInterface ? interfaceConfig?.gateway : config?.gateway) || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">DNS Servers</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">
                {(selectedInterface ? interfaceConfig?.dnsServers : config?.dnsServers)?.length
                  ? (selectedInterface ? interfaceConfig?.dnsServers : config?.dnsServers)?.join(', ')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Lease Time</dt>
              <dd className="mt-1 font-medium text-gray-800">{leaseTimeFmt((selectedInterface ? interfaceConfig?.leaseTime : config?.leaseTime) ?? 86400)}</dd>
            </div>
            {(selectedInterface ? interfaceConfig?.domainName : config?.domainName) && (
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Domain Name</dt>
                <dd className="mt-1 font-medium text-gray-800 font-mono">{selectedInterface ? interfaceConfig?.domainName : config?.domainName}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Subnet Mask</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{(selectedInterface ? interfaceConfig?.subnetMask : config?.subnetMask) || '-'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">No DHCP configuration found.</p>
        )}
      </Card>

      <Card
        title={selectedInterface ? 'Static IP Reservations' : 'Static Leases'}
        subtitle={selectedInterface ? `Reservations for ${selectedInterfaceLabel}` : 'MAC to IP address reservations (always assigned the same IP)'}
        actions={
          <button
            onClick={() => setLeaseModalOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Add new lease"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        <Table
          columns={staticColumnsWithActions}
          data={staticLeases}
          keyField="id"
          loading={loading}
          emptyMessage="No static leases configured."
        />
      </Card>

      <Card
        title="Active Leases"
        subtitle={selectedInterface ? `Active leases within ${selectedInterfaceLabel}` : 'Currently assigned DHCP leases'}
      >
        <Table
          columns={activeColumns}
          data={activeLeasesForSelectedInterface}
          keyField="mac"
          loading={loading}
          emptyMessage="No active leases."
        />
      </Card>

      {/* DHCPv6 Static Reservations */}
      <Card
        title="DHCPv6 Static Reservations"
        subtitle="DUID → IPv6 address static bindings managed by the Kea DHCPv6 server"
        actions={
          <button
            onClick={() => { setLease6Form(defaultLease6Form); setLease6ModalOpen(true) }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Add DHCPv6 static reservation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        <Table
          columns={static6ColumnsWithActions}
          data={static6Leases}
          keyField="id"
          loading={loading}
          emptyMessage="No DHCPv6 static reservations configured."
        />
      </Card>

      {/* DHCPv6 Active Leases */}
      <Card
        title="DHCPv6 Active Leases"
        subtitle="Currently active DHCPv6 address assignments from the Kea lease database"
      >
        <Table
          columns={active6Columns}
          data={active6LeasesForSelectedInterface}
          keyField="ipAddress"
          loading={loading}
          emptyMessage="No active DHCPv6 leases."
        />
      </Card>

      <Card
        title={selectedInterface ? `DHCPv6: ${selectedInterfaceLabel}` : 'DHCPv6 Server'}
        subtitle={selectedInterface ? 'Per-interface DHCPv6 scope settings' : 'Kea DHCPv6 configuration'}
        actions={
          <button
            onClick={openConfig6Modal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title={selectedInterface ? 'Edit interface DHCPv6 settings' : 'Edit DHCPv6 settings'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (selectedInterface ? interfaceConfig6 : config6) ? (
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {!selectedInterface && (
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Interface</dt>
                <dd className="mt-1 font-medium text-gray-800">{config6?.interface || '-'}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
              <dd className={`mt-1 font-semibold ${(selectedInterface ? interfaceConfig6?.enabled : config6?.enabled) ? 'text-green-600' : 'text-gray-400'}`}>
                {(selectedInterface ? interfaceConfig6?.enabled : config6?.enabled) ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Subnet</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{(selectedInterface ? interfaceConfig6?.subnet : config6?.subnet) || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Pool Range</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">
                {(selectedInterface ? interfaceConfig6?.rangeStart : config6?.rangeStart) && (selectedInterface ? interfaceConfig6?.rangeEnd : config6?.rangeEnd)
                  ? `${selectedInterface ? interfaceConfig6?.rangeStart : config6?.rangeStart} - ${selectedInterface ? interfaceConfig6?.rangeEnd : config6?.rangeEnd}`
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">DNS Servers</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">
                {(selectedInterface ? interfaceConfig6?.dnsServers : config6?.dnsServers)?.length
                  ? (selectedInterface ? interfaceConfig6?.dnsServers : config6?.dnsServers)?.join(', ')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Lease Time</dt>
              <dd className="mt-1 font-medium text-gray-800">{leaseTimeFmt((selectedInterface ? interfaceConfig6?.leaseTime : config6?.leaseTime) ?? 86400)}</dd>
            </div>
            {(selectedInterface ? interfaceConfig6?.domainName : config6?.domainName) && (
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Domain Name</dt>
                <dd className="mt-1 font-medium text-gray-800 font-mono">{selectedInterface ? interfaceConfig6?.domainName : config6?.domainName}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-400">No DHCPv6 configuration found.</p>
        )}
      </Card>
    </div>
  )
}
