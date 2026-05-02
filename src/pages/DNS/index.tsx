import { useEffect, useState } from 'react'
import {
  getDnsConfig,
  getDnsForwarders,
  createDnsForwarder,
  deleteDnsForwarder,
  getDnsHostOverrides,
  createDnsHostOverride,
  deleteDnsHostOverride,
} from '../../api/dns'
import type { DnsConfig, DnsForwarder, DnsHostOverride } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type ForwarderRow = DnsForwarder & Record<string, unknown>
type HostRow = DnsHostOverride & Record<string, unknown>

const forwarderColumns: Column<ForwarderRow>[] = [
  { key: 'address', header: 'Address' },
  { key: 'port', header: 'Port' },
  { key: 'domain', header: 'Domain', render: (row) => (row.domain as string) || 'All domains' },
  { key: 'description', header: 'Description' },
]

const hostColumns: Column<HostRow>[] = [
  { key: 'hostname', header: 'Hostname' },
  { key: 'domain', header: 'Domain' },
  { key: 'ipv4', header: 'IPv4', render: (row) => (row.ipv4 as string) || '—' },
  { key: 'ipv6', header: 'IPv6', render: (row) => (row.ipv6 as string) || '—' },
  { key: 'description', header: 'Description' },
]

const defaultForwarderForm: Omit<DnsForwarder, 'id'> = {
  address: '',
  port: 53,
  domain: '',
  description: '',
}

const defaultHostForm: Omit<DnsHostOverride, 'id'> = {
  hostname: '',
  domain: '',
  ipv4: '',
  ipv6: '',
  description: '',
}

export default function DNS() {
  const [config, setConfig] = useState<DnsConfig | null>(null)
  const [forwarders, setForwarders] = useState<ForwarderRow[]>([])
  const [hosts, setHosts] = useState<HostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fwdModalOpen, setFwdModalOpen] = useState(false)
  const [fwdForm, setFwdForm] = useState<Omit<DnsForwarder, 'id'>>(defaultForwarderForm)
  const [fwdSaving, setFwdSaving] = useState(false)
  const [fwdDeleteId, setFwdDeleteId] = useState<number | null>(null)
  const [fwdDeleting, setFwdDeleting] = useState(false)

  const [hostModalOpen, setHostModalOpen] = useState(false)
  const [hostForm, setHostForm] = useState<Omit<DnsHostOverride, 'id'>>(defaultHostForm)
  const [hostSaving, setHostSaving] = useState(false)
  const [hostDeleteId, setHostDeleteId] = useState<number | null>(null)
  const [hostDeleting, setHostDeleting] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getDnsConfig(), getDnsForwarders(), getDnsHostOverrides()])
      .then(([cfg, fwd, hst]) => {
        setConfig(cfg.data)
        setForwarders(fwd.data as ForwarderRow[])
        setHosts(hst.data as HostRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const handleAddForwarder = () => {
    setFwdSaving(true)
    createDnsForwarder(fwdForm)
      .then(() => {
        setFwdModalOpen(false)
        setFwdForm(defaultForwarderForm)
        getDnsForwarders().then((r) => setForwarders(r.data as ForwarderRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setFwdSaving(false))
  }

  const handleDeleteForwarder = () => {
    if (fwdDeleteId === null) return
    setFwdDeleting(true)
    deleteDnsForwarder(fwdDeleteId)
      .then(() => {
        setFwdDeleteId(null)
        getDnsForwarders().then((r) => setForwarders(r.data as ForwarderRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setFwdDeleting(false))
  }

  const handleAddHost = () => {
    setHostSaving(true)
    createDnsHostOverride(hostForm)
      .then(() => {
        setHostModalOpen(false)
        setHostForm(defaultHostForm)
        getDnsHostOverrides().then((r) => setHosts(r.data as HostRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setHostSaving(false))
  }

  const handleDeleteHost = () => {
    if (hostDeleteId === null) return
    setHostDeleting(true)
    deleteDnsHostOverride(hostDeleteId)
      .then(() => {
        setHostDeleteId(null)
        getDnsHostOverrides().then((r) => setHosts(r.data as HostRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setHostDeleting(false))
  }

  const forwarderColumnsWithActions: Column<ForwarderRow>[] = [
    ...forwarderColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button variant="danger" size="sm" onClick={() => setFwdDeleteId(row.id as number)}>
          Delete
        </Button>
      ),
    },
  ]

  const hostColumnsWithActions: Column<HostRow>[] = [
    ...hostColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button variant="danger" size="sm" onClick={() => setHostDeleteId(row.id as number)}>
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

      {/* DNS Status summary */}
      {config && (
        <Card title="DNS Resolver">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className={`font-medium ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config.enabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Mode</dt>
              <dd className="font-medium text-gray-800 capitalize">{config.mode}</dd>
            </div>
            <div>
              <dt className="text-gray-500">DNSSEC</dt>
              <dd className={`font-medium ${config.dnssec ? 'text-green-600' : 'text-gray-400'}`}>
                {config.dnssec ? 'On' : 'Off'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Listen Port</dt>
              <dd className="font-medium text-gray-800">{config.listenPort}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Forwarders */}
      <Card
        title="DNS Forwarders"
        subtitle="Upstream DNS servers for resolving queries"
        actions={
          <Button size="sm" onClick={() => setFwdModalOpen(true)}>
            + Add Forwarder
          </Button>
        }
      >
        <Table
          columns={forwarderColumnsWithActions}
          data={forwarders}
          keyField="id"
          loading={loading}
          emptyMessage="No forwarders configured."
        />
      </Card>

      {/* Host Overrides */}
      <Card
        title="Host Overrides"
        subtitle="Map hostnames to specific IP addresses"
        actions={
          <Button size="sm" onClick={() => setHostModalOpen(true)}>
            + Add Host
          </Button>
        }
      >
        <Table
          columns={hostColumnsWithActions}
          data={hosts}
          keyField="id"
          loading={loading}
          emptyMessage="No host overrides configured."
        />
      </Card>

      {/* Add Forwarder Modal */}
      <Modal
        open={fwdModalOpen}
        title="Add DNS Forwarder"
        onClose={() => setFwdModalOpen(false)}
        onConfirm={handleAddForwarder}
        confirmLabel="Add"
        loading={fwdSaving}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="fwd-addr"
            label="IP Address"
            required
            placeholder="8.8.8.8"
            value={fwdForm.address}
            onChange={(e) => setFwdForm({ ...fwdForm, address: e.target.value })}
          />
          <FormField
            id="fwd-port"
            label="Port"
            type="number"
            min={1}
            max={65535}
            value={String(fwdForm.port)}
            onChange={(e) => setFwdForm({ ...fwdForm, port: Number(e.target.value) })}
          />
          <FormField
            id="fwd-domain"
            label="Domain"
            placeholder="Leave blank for all"
            className="col-span-2"
            value={fwdForm.domain}
            onChange={(e) => setFwdForm({ ...fwdForm, domain: e.target.value })}
          />
          <FormField
            id="fwd-desc"
            label="Description"
            className="col-span-2"
            value={fwdForm.description}
            onChange={(e) => setFwdForm({ ...fwdForm, description: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Forwarder Modal */}
      <Modal
        open={fwdDeleteId !== null}
        title="Remove Forwarder"
        onClose={() => setFwdDeleteId(null)}
        onConfirm={handleDeleteForwarder}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={fwdDeleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">Remove this DNS forwarder?</p>
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
            id="host-name"
            label="Hostname"
            required
            placeholder="myserver"
            value={hostForm.hostname}
            onChange={(e) => setHostForm({ ...hostForm, hostname: e.target.value })}
          />
          <FormField
            id="host-domain"
            label="Domain"
            required
            placeholder="local"
            value={hostForm.domain}
            onChange={(e) => setHostForm({ ...hostForm, domain: e.target.value })}
          />
          <FormField
            id="host-ipv4"
            label="IPv4 Address"
            placeholder="192.168.1.10"
            value={hostForm.ipv4 ?? ''}
            onChange={(e) => setHostForm({ ...hostForm, ipv4: e.target.value })}
          />
          <FormField
            id="host-ipv6"
            label="IPv6 Address"
            placeholder="fd00::1"
            value={hostForm.ipv6 ?? ''}
            onChange={(e) => setHostForm({ ...hostForm, ipv6: e.target.value })}
          />
          <FormField
            id="host-desc"
            label="Description"
            className="col-span-2"
            value={hostForm.description}
            onChange={(e) => setHostForm({ ...hostForm, description: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Host Override Modal */}
      <Modal
        open={hostDeleteId !== null}
        title="Remove Host Override"
        onClose={() => setHostDeleteId(null)}
        onConfirm={handleDeleteHost}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={hostDeleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">Remove this host override?</p>
      </Modal>
    </div>
  )
}

