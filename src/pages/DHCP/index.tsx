import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getDhcpConfig,
  updateDhcpConfig,
  getDhcpStaticLeases,
  createDhcpStaticLease,
  deleteDhcpStaticLease,
  getDhcpLeases,
  getInterfaceDhcpConfig,
  updateInterfaceDhcpConfig,
  getInterfaceStaticLeases,
  createInterfaceStaticLease,
  deleteInterfaceStaticLease,
} from '../../api/dhcp'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import type { DhcpConfig, DhcpConfigPerInterface, DhcpStaticLease, DhcpLease, NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext'

type StaticLeaseRow = DhcpStaticLease & Record<string, unknown>
type ActiveLeaseRow = DhcpLease & Record<string, unknown>

const staticColumns: Column<StaticLeaseRow>[] = [
  { key: 'mac', header: 'MAC Address' },
  { key: 'ipAddress', header: 'IP Address' },
  { key: 'hostname', header: 'Hostname' },
  { key: 'description', header: 'Description' },
]

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

function isWanInterface(iface: NetworkInterface): boolean {
  const desc = iface.description?.trim().toLowerCase() ?? ''
  return Boolean(iface.wanMode) || desc.includes('wan') || iface.name.toLowerCase() === 'wan'
}

export default function DHCP() {
  const { formatDateTime } = useDisplayPreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedInterface = searchParams.get('iface')
  const [config, setConfig] = useState<DhcpConfig | null>(null)
  const [interfaceConfig, setInterfaceConfig] = useState<DhcpConfigPerInterface | null>(null)
  const [staticLeases, setStaticLeases] = useState<StaticLeaseRow[]>([])
  const [activeLeases, setActiveLeases] = useState<ActiveLeaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leaseModalOpen, setLeaseModalOpen] = useState(false)
  const [leaseForm, setLeaseForm] = useState<Omit<DhcpStaticLease, 'id'>>(defaultLeaseForm)
  const [leaseSaving, setLeaseSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configForm, setConfigForm] = useState<Partial<DhcpConfig | DhcpConfigPerInterface>>(defaultConfigForm())
  const [configSaving, setConfigSaving] = useState(false)
  // DNS servers are edited as a comma-separated string in the input
  const [dnsInput, setDnsInput] = useState('')
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
        getInterfaceStaticLeases(selectedInterface),
        getDhcpLeases(),
      ])
        .then(([cfg, statics, active]) => {
          setInterfaceConfig(cfg.data)
          setConfig(null)
          setStaticLeases(statics.data as StaticLeaseRow[])
          setActiveLeases(active.data as ActiveLeaseRow[])
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false))
      return
    }

    Promise.all([getDhcpConfig(), getDhcpStaticLeases(), getDhcpLeases()])
      .then(([cfg, statics, actives]) => {
        setConfig(cfg.data)
        setInterfaceConfig(null)
        setStaticLeases(statics.data as StaticLeaseRow[])
        setActiveLeases(actives.data as ActiveLeaseRow[])
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

  const staticColumnsWithActions: Column<StaticLeaseRow>[] = [
    ...staticColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button variant="danger" size="sm" onClick={() => setDeleteId(row.id as string)}>
          Delete
        </Button>
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
          <Button size="sm" variant="secondary" onClick={openConfigModal}>
            {selectedInterface ? 'Edit Interface DHCP' : 'Edit Settings'}
          </Button>
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

      {/* Static Leases */}
      <Card
        title={selectedInterface ? 'Static IP Reservations' : 'Static Leases'}
        subtitle={selectedInterface ? `Reservations for ${selectedInterfaceLabel}` : 'MAC to IP address reservations (always assigned the same IP)'}
        actions={
          <Button size="sm" onClick={() => setLeaseModalOpen(true)}>
            + Add Lease
          </Button>
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
                onChange={(e) => setConfigForm((f) => ({ ...f, subnet: e.target.value }))
                }
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
    </div>
  )
}
