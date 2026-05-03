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
      // Kea returns Unix epoch seconds as a string
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
  const [configForm, setConfigForm] = useState<Partial<DhcpConfig>>({})
  const [configSaving, setConfigSaving] = useState(false)

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

  const handleSaveConfig = () => {
    setConfigSaving(true)
    updateDhcpConfig(configForm)
      .then(() => {
        setConfigModalOpen(false)
        getDhcpConfig().then((r) => setConfig(r.data))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setConfigSaving(false))
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* DHCP Config summary */}
      {config && (
        <Card
          title="DHCP Server"
          actions={
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

