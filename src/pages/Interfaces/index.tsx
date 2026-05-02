import { useEffect, useState } from 'react'
import { getInterfaces, createInterface } from '../../api/client'
import type { NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

// TODO: Implement edit interface functionality (PUT /interfaces/:name)
// TODO: Implement delete interface functionality (DELETE /interfaces/:name)
// TODO: Add VLAN sub-interface creation support
// TODO: Add interface statistics (bytes in/out, errors) via GET /interfaces/:name/stats
// TODO: Add real-time status updates via polling

type InterfaceRow = NetworkInterface & Record<string, unknown>

const columns: Column<InterfaceRow>[] = [
  { key: 'name', header: 'Name' },
  { key: 'description', header: 'Description' },
  { key: 'type', header: 'Type' },
  {
    key: 'ipv4Address',
    header: 'IPv4 Address',
    render: (row) =>
      row.ipv4Address
        ? `${row.ipv4Address}/${row.ipv4Prefix ?? ''}`
        : '—',
  },
  {
    key: 'enabled',
    header: 'Status',
    render: (row) => (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          row.enabled
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${row.enabled ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        {row.enabled ? 'Up' : 'Down'}
      </span>
    ),
  },
  { key: 'mac', header: 'MAC Address', render: (row) => row.mac ?? '—' },
]

const defaultForm: Partial<NetworkInterface> = {
  name: '',
  description: '',
  type: 'ethernet',
  enabled: true,
  ipv4Address: '',
  ipv4Prefix: 24,
}

export default function Interfaces() {
  const [ifaces, setIfaces] = useState<InterfaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<NetworkInterface>>(defaultForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    getInterfaces()
      .then((res) => setIfaces(res.data as InterfaceRow[]))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = () => {
    setSaving(true)
    createInterface(form as NetworkInterface)
      .then(() => {
        setModalOpen(false)
        setForm(defaultForm)
        load()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-4">
      <Card
        title="Network Interfaces"
        subtitle="Manage physical and virtual network interfaces"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            + Add Interface
          </Button>
        }
      >
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}
        <Table
          columns={columns}
          data={ifaces}
          keyField="name"
          loading={loading}
          emptyMessage="No interfaces found. Add one to get started."
        />
      </Card>

      {/* Add Interface Modal */}
      <Modal
        open={modalOpen}
        title="Add Interface"
        onClose={() => setModalOpen(false)}
        onConfirm={handleSave}
        confirmLabel="Create"
        loading={saving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="iface-name"
            label="Interface Name"
            required
            placeholder="e.g. eth0"
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <FormField
            id="iface-desc"
            label="Description"
            placeholder="WAN, LAN, DMZ…"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <FormField
            id="iface-type"
            label="Type"
            as="select"
            value={form.type ?? 'ethernet'}
            onChange={(e) => setForm({ ...form, type: e.target.value as NetworkInterface['type'] })}
          >
            <option value="ethernet">Ethernet</option>
            <option value="vlan">VLAN</option>
            <option value="bridge">Bridge</option>
            <option value="wireless">Wireless</option>
            <option value="loopback">Loopback</option>
          </FormField>
          <FormField
            id="iface-ip"
            label="IPv4 Address"
            placeholder="192.168.1.1"
            value={form.ipv4Address ?? ''}
            onChange={(e) => setForm({ ...form, ipv4Address: e.target.value })}
          />
          <FormField
            id="iface-prefix"
            label="Prefix Length"
            type="number"
            min={0}
            max={32}
            value={String(form.ipv4Prefix ?? 24)}
            onChange={(e) => setForm({ ...form, ipv4Prefix: Number(e.target.value) })}
          />
        </div>
      </Modal>
    </div>
  )
}
