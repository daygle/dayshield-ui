import { useEffect, useState } from 'react'
import {
  getDhcpConfig,
  updateDhcpConfig,
  getDhcpStaticLeases,
  createDhcpStaticLease,
  deleteDhcpStaticLease,
  getDhcpLeases,
} from '../../api/dhcp'
import type { DhcpConfig, DhcpStaticLease, DhcpLease } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type StaticLeaseRow = DhcpStaticLease & Record<string, unknown>
type ActiveLeaseRow = DhcpLease & Record<string, unknown>

const staticColumns: Column<StaticLeaseRow>[] = [
  { key: 'mac', header: 'MAC Address' },
  { key: 'ipAddress', header: 'IP Address' },
  { key: 'hostname', header: 'Hostname' },
  { key: 'description', header: 'Description' },
]

const activeColumns: Column<ActiveLeaseRow>[] = [
  { key: 'mac', header: 'MAC Address' },
  { key: 'ipAddress', header: 'IP Address' },
  { key: 'hostname', header: 'Hostname', render: (row) => (row.hostname as string) || '—' },
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
      if (!raw) return '—'
      const asNum = Number(raw)
      const d = Number.isFinite(asNum) && asNum > 1e9
        ? new Date(asNum * 1000)
        : new Date(raw)
      return isNaN(d.getTime()) ? raw : d.toLocaleString()
    },
  },
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

export default function DHCP() {
  const [config, setConfig] = useState<DhcpConfig | null>(null)
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
  const [configForm, setConfigForm] = useState<Partial<DhcpConfig>>(defaultConfigForm())
  const [configSaving, setConfigSaving] = useState(false)
  // DNS servers are edited as a comma-separated string in the input
  const [dnsInput, setDnsInput] = useState('')

  const loadAll = () => {
    setLoading(true)
    Promise.all([getDhcpConfig(), getDhcpStaticLeases(), getDhcpLeases()])
      .then(([cfg, statics, actives]) => {
        setConfig(cfg.data)
        setStaticLeases(statics.data as StaticLeaseRow[])
        setActiveLeases(actives.data as ActiveLeaseRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const openConfigModal = () => {
    if (config) {
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
    updateDhcpConfig(payload)
      .then((r) => {
        setConfig(r.data)
        setConfigModalOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setConfigSaving(false))
  }

  const handleAddLease = () => {
    setLeaseSaving(true)
    createDhcpStaticLease(leaseForm)
      .then(() => {
        setLeaseModalOpen(false)
        setLeaseForm(defaultLeaseForm)
        getDhcpStaticLeases().then((r) => setStaticLeases(r.data as StaticLeaseRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLeaseSaving(false))
  }

  const handleDeleteLease = () => {
    if (deleteId === null) return
    setDeleting(true)
    deleteDhcpStaticLease(deleteId)
      .then(() => {
        setDeleteId(null)
        getDhcpStaticLeases().then((r) => setStaticLeases(r.data as StaticLeaseRow[]))
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

      {/* DHCP Config summary */}
      <Card
        title="DHCP Server"
        subtitle="Kea DHCPv4 configuration"
        actions={
          <Button size="sm" variant="secondary" onClick={openConfigModal}>
            Edit Settings
          </Button>
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
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Interface</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{config.interface || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Subnet</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{config.subnet || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Pool Range</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">
                {config.rangeStart && config.rangeEnd
                  ? `${config.rangeStart} – ${config.rangeEnd}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Default Gateway</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{config.gateway || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">DNS Servers</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">
                {config.dnsServers?.length ? config.dnsServers.join(', ') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Lease Time</dt>
              <dd className="mt-1 font-medium text-gray-800">{leaseTimeFmt(config.leaseTime)}</dd>
            </div>
            {config.domainName && (
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Domain Name</dt>
                <dd className="mt-1 font-medium text-gray-800 font-mono">{config.domainName}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Subnet Mask</dt>
              <dd className="mt-1 font-medium text-gray-800 font-mono">{config.subnetMask || '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">No DHCP configuration found.</p>
        )}
      </Card>

      {/* Static Leases */}
      <Card
        title="Static Leases"
        subtitle="MAC → IP address reservations (always assigned the same IP)"
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

      {/* Active Leases */}
      <Card title="Active Leases" subtitle="Currently assigned DHCP leases">
        <Table
          columns={activeColumns}
          data={activeLeases}
          keyField="mac"
          loading={loading}
          emptyMessage="No active leases."
        />
      </Card>

      {/* Edit DHCP Config Modal */}
      <Modal
        open={configModalOpen}
        title="Edit DHCP Server"
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

          <div className="grid grid-cols-2 gap-4">
            {/* Interface */}
            <FormField
              id="cfg-iface"
              label="LAN Interface"
              required
              placeholder="e.g. eth1"
              value={configForm.interface ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, interface: e.target.value }))}
            />

            {/* Subnet CIDR */}
            <FormField
              id="cfg-subnet"
              label="Subnet (CIDR)"
              required
              placeholder="e.g. 192.168.1.0/24"
              value={configForm.subnet ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, subnet: e.target.value }))}
            />

            {/* Gateway */}
            <FormField
              id="cfg-gw"
              label="Default Gateway"
              placeholder="e.g. 192.168.1.1"
              value={configForm.gateway ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, gateway: e.target.value }))}
            />

            {/* Lease time */}
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

            {/* Pool start */}
            <FormField
              id="cfg-start"
              label="Pool Start"
              required
              placeholder="e.g. 192.168.1.100"
              value={configForm.rangeStart ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, rangeStart: e.target.value }))}
            />

            {/* Pool end */}
            <FormField
              id="cfg-end"
              label="Pool End"
              required
              placeholder="e.g. 192.168.1.199"
              value={configForm.rangeEnd ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, rangeEnd: e.target.value }))}
            />

            {/* DNS servers — comma-separated */}
            <FormField
              id="cfg-dns"
              label="DNS Servers"
              className="col-span-2"
              placeholder="e.g. 192.168.1.1, 1.1.1.1"
              value={dnsInput}
              onChange={(e) => setDnsInput(e.target.value)}
            />

            {/* Domain name */}
            <FormField
              id="cfg-domain"
              label="Domain Name (optional)"
              className="col-span-2"
              placeholder="e.g. home.lan"
              value={configForm.domainName ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, domainName: e.target.value }))}
            />
          </div>

          <p className="text-xs text-gray-500">
            <strong>Subnet</strong> must match the LAN interface network (e.g. if your LAN IP is
            192.168.1.1/24, enter 192.168.1.0/24). Kea uses this to decide which interface to
            listen on and will silently not respond if it doesn't match.
          </p>
        </div>
      </Modal>

      {/* Add Static Lease Modal */}
      <Modal
        open={leaseModalOpen}
        title="Add Static Lease"
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
            <Button size="sm" variant="secondary" onClick={() => { setConfigForm(config); setConfigModalOpen(true) }}>
              Edit
            </Button>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className={`font-medium ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config.enabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Interface</dt>
              <dd className="font-medium text-gray-800">{config.interface}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Range</dt>
              <dd className="font-medium text-gray-800">{config.rangeStart} – {config.rangeEnd}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Lease Time</dt>
              <dd className="font-medium text-gray-800">{config.leaseTime}s</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Static Leases */}
      <Card
        title="Static Leases"
        subtitle="MAC → IP address reservations"
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

      {/* Active Leases */}
      <Card title="Active Leases" subtitle="Currently assigned DHCP leases">
        <Table
          columns={activeColumns}
          data={activeLeases}
          keyField="mac"
          loading={loading}
          emptyMessage="No active leases."
        />
      </Card>

      {/* Add Static Lease Modal */}
      <Modal
        open={leaseModalOpen}
        title="Add Static Lease"
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
            placeholder="192.168.1.100"
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

      {/* Edit DHCP Config Modal */}
      <Modal
        open={configModalOpen}
        title="Edit DHCP Server"
        onClose={() => setConfigModalOpen(false)}
        onConfirm={handleSaveConfig}
        confirmLabel="Save"
        loading={configSaving}
        size="md"
      >
        <div className="space-y-4">
          <FormField label="Enabled">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={!!configForm.enabled}
                onChange={(e) => setConfigForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="cfg-iface" label="Interface" required
              placeholder="e.g. eth1"
              value={configForm.interface ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, interface: e.target.value }))}
            />
            <FormField id="cfg-gw" label="Gateway IP"
              placeholder="e.g. 192.168.1.1"
              value={configForm.gateway ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, gateway: e.target.value }))}
            />
            <FormField id="cfg-start" label="Range Start" required
              placeholder="e.g. 192.168.1.100"
              value={configForm.rangeStart ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, rangeStart: e.target.value }))}
            />
            <FormField id="cfg-end" label="Range End" required
              placeholder="e.g. 192.168.1.199"
              value={configForm.rangeEnd ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, rangeEnd: e.target.value }))}
            />
            <FormField id="cfg-dns" label="DNS Servers"
              placeholder="8.8.8.8,8.8.4.4"
              value={(configForm.dnsServers ?? []).join(',')}
              onChange={(e) => setConfigForm((f) => ({ ...f, dnsServers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
            />
            <FormField id="cfg-lease" label="Lease Time (seconds)"
              placeholder="86400"
              value={String(configForm.leaseTime ?? '')}
              onChange={(e) => setConfigForm((f) => ({ ...f, leaseTime: parseInt(e.target.value, 10) || 86400 }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

