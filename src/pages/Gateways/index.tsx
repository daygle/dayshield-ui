import { useEffect, useState } from 'react'
import { getGateways, upsertGateway, deleteGateway } from '../../api/gateways'
import { useInterfaceInventory } from './useInterfaceInventory'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'
import { formatGatewayDisplayName } from '../../utils/gatewayLabel'
import type { Gateway, GatewayStatus } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type GatewayRow = GatewayStatus & Record<string, unknown>

const defaultForm: Gateway = {
  name: '',
  description: '',
  interface: '',
  gateway_ip: '',
  monitor_ip: '',
  weight: 1,
  enabled: true,
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    online: 'bg-green-100 text-green-700',
    offline: 'bg-red-100 text-red-700',
    unknown: 'bg-gray-100 text-gray-500',
  }
  const dotMap: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    unknown: 'bg-gray-400',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[state] ?? map.unknown}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotMap[state] ?? dotMap.unknown}`} />
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </span>
  )
}

export default function Gateways() {
  const [rows, setRows] = useState<GatewayRow[]>([])
  const [defaultIface, setDefaultIface] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<Gateway>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [deleteName, setDeleteName] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Removed unused interfaces state
  const interfaceInventory = useInterfaceInventory();
  const [editingActiveIp, setEditingActiveIp] = useState<string | undefined>()

  const interfaceLabel = (name: string) => {
    const iface = interfaceInventory.find((i) => i.name === name)
    if (defaultIface && name === defaultIface) {
      return formatInterfaceDisplayName('WAN', name)
    }
    return formatInterfaceDisplayName(iface?.description, name)
  }

  const formatGatewayName = (name: string) => {
    return name.replace(/_AUTO$/, '');
  }

  const load = () => {
    setLoading(true)
    getGateways()
      .then((res) => {
        setRows((res.data as unknown as { gateways: GatewayRow[]; default_interface?: string }).gateways ?? [])
        setDefaultIface((res.data as unknown as { default_interface?: string }).default_interface)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])



  const openAdd = () => {
    setForm(defaultForm)
    setIsEditing(false)
    setEditingActiveIp(undefined)
    setModalOpen(true)
  }

  const openEdit = (row: GatewayRow) => {
    setForm({
      name: formatGatewayName(row.name),
      description: row.description,
      interface: row.interface,
      gateway_ip: row.gateway_ip,
      monitor_ip: row.monitor_ip,
      weight: row.weight,
      enabled: row.enabled,
    })
    setIsEditing(true)
    setModalOpen(true)
  }

  const handleSave = () => {
    setSaving(true)
    const payload: Gateway = {
      ...form,
      gateway_ip: form.gateway_ip || undefined,
      monitor_ip: form.monitor_ip || undefined,
      description: form.description || undefined,
    }
    upsertGateway(payload)
      .then(() => {
        setModalOpen(false)
        load()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  const handleDelete = () => {
    if (!deleteName) return
    setDeleting(true)
    deleteGateway(deleteName)
      .then(() => {
        setDeleteName(null)
        load()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false))
  }

  const columns: Column<GatewayRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="flex items-center gap-1.5">
          {formatGatewayName(row.name as string)}
          {String(row.name).endsWith('_AUTO') && (
            <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
              Auto
            </span>
          )}
        </span>
      ),
    },
    { key: 'description', header: 'Description', render: (row) => (row.description as string) || '-' },
    { key: 'interface', header: 'Interface', render: (row) => interfaceLabel(row.interface as string) },
    {
      key: 'active_ip',
      header: 'Gateway IP',
      render: (row) => {
        const ip = (row.active_ip as string) ?? (row.gateway_ip as string)
        return ip || <span className="text-gray-400 text-xs">auto</span>
      },
    },
    {
      key: 'monitor_ip',
      header: 'Monitor IP',
      render: (row) => (row.monitor_ip as string) || <span className="text-gray-400 text-xs">-</span>,
    },
    {
      key: 'state',
      header: 'Health',
      render: (row) => <StateBadge state={row.state as string} />,
    },
    { key: 'weight', header: 'Weight' },
    {
      key: 'enabled',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            row.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${row.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
          {row.enabled ? 'Enabled' : 'Disabled'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => openEdit(row)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title={String(row.name).endsWith('_AUTO') ? 'Configure gateway' : 'Edit gateway'}
            aria-label={String(row.name).endsWith('_AUTO') ? 'Configure gateway' : 'Edit gateway'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setDeleteName(row.name)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
            title="Delete gateway"
            aria-label="Delete gateway"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gateways</h1>
          {defaultIface && (
            <p className="text-sm text-gray-500 mt-0.5">
              Default route via: <span className="font-medium text-gray-700">{interfaceLabel(defaultIface)}</span>
            </p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
          title="Add gateway"
          aria-label="Add gateway"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <Table
          columns={columns}
          data={rows}
          keyField="name"
          loading={loading}
          emptyMessage="No gateways configured. Add one to define your upstream routing."
        />
      </Card>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        title={
          isEditing
            ? formatGatewayDisplayName(
                interfaceInventory.find((i) => i.name === form.interface) || { name: form.interface },
                String(form.name).endsWith('_AUTO')
              )
            : 'Add Gateway'
        }
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" required>
            <input
              className="input"
              placeholder="e.g. WAN_GW"
              value={formatGatewayDisplayName(
                interfaceInventory.find((i) => i.name === form.interface) || { name: form.interface },
                String(form.name).endsWith('_AUTO')
              )}
              disabled
            />
          </FormField>
          <FormField label="Description">
            <input
              className="input"
              placeholder="Optional description"
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </FormField>
          <FormField label="Interface" required>
            <select
              className="input"
              value={form.interface}
              onChange={(e) => setForm((f) => ({ ...f, interface: e.target.value }))}
            >
              <option value="">Select interface</option>
              {interfaceInventory.map((iface) => (
                <option key={iface.name} value={iface.name}>
                  {formatInterfaceDisplayName(iface.description, iface.name)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Gateway IP"
            hint="Leave blank for DHCP / PPPoE interfaces where the gateway is assigned automatically."
          >
            <input
              className="input"
              placeholder="e.g. 203.0.113.1"
              value={form.gateway_ip ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, gateway_ip: e.target.value }))}
              disabled={isEditing && String(form.name).endsWith('_AUTO')}
            />
          </FormField>
          {isEditing && String(form.name).endsWith('_AUTO') && (
            <FormField
              label="Active Gateway IP"
              hint="Current default-route gateway learned from the running kernel."
            >
              <input
                className="input"
                value={editingActiveIp ?? '-'}
                readOnly
              />
            </FormField>
          )}
          <FormField
            label="Monitor IP"
            hint="IP to ping for health checks. Defaults to gateway IP when blank."
          >
            <input
              className="input"
              placeholder="e.g. 8.8.8.8"
              value={form.monitor_ip ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, monitor_ip: e.target.value }))}
            />
          </FormField>
          <FormField label="Weight" hint="1–100, lower = higher priority. Used for multi-WAN groups.">
            <input
              type="number"
              min={1}
              max={100}
              className="input w-24"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: parseInt(e.target.value, 10) || 1 }))}
            />
          </FormField>
          <FormField label="Enabled">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </FormField>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteName}
        title="Delete Gateway"
        onClose={() => setDeleteName(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteName(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Delete gateway <span className="font-semibold">{deleteName}</span>? This will remove it
          from the routing table.
        </p>
      </Modal>
    </div>
  )
}
