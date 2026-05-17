import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPortForwards, createPortForward, updatePortForward, deletePortForward } from '../../api/nat'
import { getInterfaces } from '../../api/interfaces'
import { getSystemConfig } from '../../api/system'
import { useToast } from '../../context/ToastContext'
import type { NatRule, NatProtocol, NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

// Port forwards are DNAT NAT rules. All fields map directly to NatRule.
type PfRow = NatRule & Record<string, unknown>

const defaultForm = (): Omit<NatRule, 'id'> => ({
  enabled: true,
  description: null,
  rule_type: 'dnat',
  interface: '',          // WAN interface inbound traffic arrives on
  source: null,
  destination: null,
  protocol: 'tcp',
  source_port: null,
  destination_port: null, // external port being forwarded
  translation: {
    address: '',          // internal host IP
    port: null,           // internal port
    port_end: null,
  },
  nat_reflection: false,
  address_family: 'ipv4',
  priority: 100,
  log: false,
  auto_firewall_rule: true,
})

function isWanInterface(iface: NetworkInterface): boolean {
  const desc = iface.description?.trim().toLowerCase() ?? ''
  return Boolean(iface.wanMode) || Boolean(iface.gateway) || desc.includes('wan') || iface.name.toLowerCase() === 'wan'
}

export default function PortForwardPage() {
  const qc = useQueryClient()
  const { addToast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['nat', 'portforwards'],
    queryFn: getPortForwards,
  })

  const { data: interfacesData } = useQuery({
    queryKey: ['interfaces', 'nat-portforward'],
    queryFn: getInterfaces,
  })

  const { data: systemData } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: getSystemConfig,
  })

  const portForwards = (data?.data ?? []) as PfRow[]
  const wanInterfaces = (interfacesData?.data ?? []).filter((iface) => iface.enabled !== false && isWanInterface(iface))
  const ipv6Enabled = Boolean(systemData?.data.ipv6Enabled)

  // â”€â”€ Form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<NatRule | null>(null)
  const [form, setForm] = useState<Omit<NatRule, 'id'>>(defaultForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<string, string>>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null)
    setForm(defaultForm())
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = (rule: NatRule) => {
    setEditing(rule)
    const { id: _id, ...rest } = rule
    setForm({
      ...rest,
      address_family: rest.address_family ?? 'ipv4',
      translation: rest.translation ?? { address: '', port: null, port_end: null },
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!form.interface?.trim()) errors.interface = 'WAN interface is required'
    if (form.address_family === 'ipv6' && !ipv6Enabled) errors.address_family = 'IPv6 NAT requires IPv6 to be enabled in System settings'
    if (!form.destination_port) errors.destination_port = 'External port is required'
    if (!form.translation?.address?.trim()) errors.translation_address = 'Internal host IP is required'
    if (!form.translation?.port) errors.translation_port = 'Internal port is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const createMutation = useMutation({
    mutationFn: createPortForward,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'portforwards'] })
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] })
      setModalOpen(false)
      addToast('Port forward created', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<NatRule, 'id'>> }) =>
      updatePortForward(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'portforwards'] })
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] })
      setModalOpen(false)
      addToast('Port forward updated', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePortForward,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'portforwards'] })
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] })
      setDeleteId(null)
      addToast('Port forward deleted', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const handleSave = () => {
    if (!validate()) return
    if (editing) {
      editMutation.mutate({ id: editing.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const isSaving = createMutation.isPending || editMutation.isPending

  const columns: Column<PfRow>[] = [
    {
      key: 'enabled',
      header: 'Enabled',
      render: (row) => (
        <span className={row.enabled ? 'text-green-600' : 'text-gray-400'}>
          {row.enabled ? 'âœ“' : 'âœ-'}
        </span>
      ),
    },
    { key: 'interface', header: 'WAN Interface' },
    { key: 'address_family', header: 'Family', render: (row) => ((row as NatRule).address_family ?? 'ipv4').toUpperCase() },
    { key: 'destination_port', header: 'Ext. Port', render: (row) => (row as NatRule).destination_port ?? 'â€”' },
    {
      key: 'translation_address',
      header: 'Internal Host',
      render: (row) => (row as NatRule).translation?.address ?? 'â€”',
    },
    {
      key: 'translation_port',
      header: 'Int. Port',
      render: (row) => (row as NatRule).translation?.port ?? 'â€”',
    },
    { key: 'protocol', header: 'Protocol' },
    { key: 'description', header: 'Description', render: (row) => (row as NatRule).description ?? '' },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEdit(row as NatRule)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Edit port forward"
            aria-label="Edit port forward"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setDeleteId(row.id as string)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
            title="Delete port forward"
            aria-label="Delete port forward"
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
    <div className="space-y-6">
      <Card
        title="Port Forwards"
        subtitle="Redirect inbound traffic from WAN to internal hosts (Destination NAT / DNAT)"
        actions={
          <button
            onClick={openAdd}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Add port forward"
            aria-label="Add port forward"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        <Table
          columns={columns}
          data={portForwards}
          keyField="id"
          loading={isLoading}
          emptyMessage="No port forwards defined."
        />
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Port Forward' : 'Add Port Forward'}
        onClose={() => setModalOpen(false)}
        onConfirm={handleSave}
        confirmLabel={editing ? 'Save Changes' : 'Create Port Forward'}
        loading={isSaving}
        size="xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="pf-wan"
            label="WAN Interface"
            as="select"
            required
            value={form.interface ?? ''}
            error={formErrors.interface}
            onChange={(e) => setForm({ ...form, interface: e.target.value || null })}
          >
            <option value="">Select WAN interface</option>
            {wanInterfaces.map((iface) => (
              <option key={iface.name} value={iface.name}>
                {formatInterfaceDisplayName(iface.description, iface.name)}
              </option>
            ))}
          </FormField>
          <FormField
            id="pf-proto"
            label="Protocol"
            as="select"
            value={form.protocol}
            onChange={(e) => setForm({ ...form, protocol: e.target.value as NatProtocol })}
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="tcp_udp">TCP/UDP</option>
            <option value="any">Any</option>
          </FormField>
          {ipv6Enabled ? (
            <FormField
              id="pf-family"
              label="Address Family"
              as="select"
              value={form.address_family ?? 'ipv4'}
              error={formErrors.address_family}
              onChange={(e) => setForm({ ...form, address_family: e.target.value as NatRule['address_family'] })}
            >
              <option value="ipv4">IPv4</option>
              <option value="ipv6">IPv6</option>
            </FormField>
          ) : (
            <div className="col-span-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Address Family</p>
              <p className="mt-1 text-sm text-gray-700">IPv4 only</p>
            </div>
          )}
          <FormField
            id="pf-ext-port"
            label="External Port"
            required
            type="number"
            placeholder="e.g. 80"
            value={form.destination_port ?? ''}
            error={formErrors.destination_port}
            onChange={(e) =>
              setForm({ ...form, destination_port: e.target.value ? Number(e.target.value) : null })
            }
          />
          <FormField
            id="pf-int-host"
            label="Internal Host"
            required
            placeholder="e.g. 192.168.1.10"
            value={form.translation?.address ?? ''}
            error={formErrors.translation_address}
            onChange={(e) =>
              setForm({
                ...form,
                translation: {
                  address: e.target.value || null,
                  port: form.translation?.port ?? null,
                  port_end: form.translation?.port_end ?? null,
                },
              })
            }
          />
          <FormField
            id="pf-int-port"
            label="Internal Port"
            required
            type="number"
            placeholder="e.g. 8080"
            value={form.translation?.port ?? ''}
            error={formErrors.translation_port}
            onChange={(e) =>
              setForm({
                ...form,
                translation: {
                  address: form.translation?.address ?? null,
                  port: e.target.value ? Number(e.target.value) : null,
                  port_end: form.translation?.port_end ?? null,
                },
              })
            }
          />
          <FormField
            id="pf-priority"
            label="Priority"
            type="number"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
          />
          <FormField
            id="pf-desc"
            label="Description"
            className="col-span-2"
            placeholder="Optional description"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          />
          <div className="col-span-2 space-y-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={form.auto_firewall_rule}
                onChange={(e) => setForm({ ...form, auto_firewall_rule: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">
                Auto-create companion forward accept rule (recommended)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={form.nat_reflection}
                onChange={(e) => setForm({ ...form, nat_reflection: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">
                Enable NAT Reflection
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">Enable this rule</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete Port Forward"
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this port forward? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
