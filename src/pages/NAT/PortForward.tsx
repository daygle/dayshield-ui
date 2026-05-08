import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPortForwards, createPortForward, updatePortForward, deletePortForward } from '../../api/nat'
import { useToast } from '../../context/ToastContext'
import type { NatRule, NatProtocol } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

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
  priority: 100,
  log: false,
  auto_firewall_rule: true,
})

export default function PortForwardPage() {
  const qc = useQueryClient()
  const { addToast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['nat', 'portforwards'],
    queryFn: getPortForwards,
  })

  const portForwards = (data?.data ?? []) as PfRow[]

  // ── Form state ───────────────────────────────────────────────────────────────
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
    setForm({ ...rest, translation: rest.translation ?? { address: '', port: null, port_end: null } })
    setFormErrors({})
    setModalOpen(true)
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!form.interface?.trim()) errors.interface = 'WAN interface is required'
    if (!form.destination_port) errors.destination_port = 'External port is required'
    if (!form.translation?.address?.trim()) errors.translation_address = 'Internal host IP is required'
    if (!form.translation?.port) errors.translation_port = 'Internal port is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
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
          {row.enabled ? '✓' : '✗'}
        </span>
      ),
    },
    { key: 'interface', header: 'WAN Interface' },
    { key: 'destination_port', header: 'Ext. Port', render: (row) => (row as NatRule).destination_port ?? '—' },
    {
      key: 'translation_address',
      header: 'Internal Host',
      render: (row) => (row as NatRule).translation?.address ?? '—',
    },
    {
      key: 'translation_port',
      header: 'Int. Port',
      render: (row) => (row as NatRule).translation?.port ?? '—',
    },
    { key: 'protocol', header: 'Protocol' },
    { key: 'description', header: 'Description', render: (row) => (row as NatRule).description ?? '' },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row as NatRule)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteId(row.id as string)}>
            Delete
          </Button>
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
          <Button size="sm" onClick={openAdd}>
            + Add Port Forward
          </Button>
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
            required
            placeholder="e.g. eth0"
            value={form.interface ?? ''}
            error={formErrors.interface}
            onChange={(e) => setForm({ ...form, interface: e.target.value || null })}
          />
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
                Enable NAT reflection for this rule
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


type PfRow = PortForward & Record<string, unknown>

const defaultForm = (): Omit<PortForward, 'id'> => ({
  enabled: true,
  wanInterface: '',
  externalPort: '',
  internalHost: '',
  internalPort: '',
  protocol: 'tcp',
  description: '',
  autoFirewallRule: true,
  natReflection: false,
})

export default function PortForwardPage() {
  const qc = useQueryClient()
  const { addToast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['nat', 'portforwards'],
    queryFn: getPortForwards,
  })

  const portForwards = (data?.data ?? []) as PfRow[]

  // ── Form state ───────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PortForward | null>(null)
  const [form, setForm] = useState<Omit<PortForward, 'id'>>(defaultForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PortForward, string>>>({})
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const openAdd = () => {
    setEditing(null)
    setForm(defaultForm())
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = (pf: PortForward) => {
    setEditing(pf)
    const { id: _id, ...rest } = pf
    setForm(rest)
    setFormErrors({})
    setModalOpen(true)
  }

  const validate = (): boolean => {
    const errors: Partial<Record<keyof PortForward, string>> = {}
    if (!form.wanInterface.trim()) errors.wanInterface = 'WAN interface is required'
    if (!form.externalPort.trim()) errors.externalPort = 'External port is required'
    if (!form.internalHost.trim()) errors.internalHost = 'Internal host is required'
    if (!form.internalPort.trim()) errors.internalPort = 'Internal port is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createPortForward,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'portforwards'] })
      setModalOpen(false)
      addToast('Port forward created', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<PortForward, 'id'>> }) =>
      updatePortForward(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'portforwards'] })
      setModalOpen(false)
      addToast('Port forward updated', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePortForward,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'portforwards'] })
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
          {row.enabled ? '✓' : '✗'}
        </span>
      ),
    },
    { key: 'wanInterface', header: 'WAN Interface' },
    { key: 'externalPort', header: 'External Port' },
    { key: 'internalHost', header: 'Internal Host' },
    { key: 'internalPort', header: 'Internal Port' },
    { key: 'protocol', header: 'Protocol' },
    { key: 'description', header: 'Description' },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row as PortForward)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteId(row.id as number)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card
        title="Port Forwards"
        subtitle="Redirect inbound traffic from WAN to internal hosts (Destination NAT)"
        actions={
          <Button size="sm" onClick={openAdd}>
            + Add Port Forward
          </Button>
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
            required
            placeholder="e.g. eth0, WAN"
            value={form.wanInterface}
            error={formErrors.wanInterface}
            onChange={(e) => setForm({ ...form, wanInterface: e.target.value })}
          />
          <FormField
            id="pf-proto"
            label="Protocol"
            as="select"
            value={form.protocol}
            onChange={(e) => setForm({ ...form, protocol: e.target.value as NatProtocol })}
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="tcp/udp">TCP/UDP</option>
            <option value="icmp">ICMP</option>
            <option value="any">Any</option>
          </FormField>
          <FormField
            id="pf-ext-port"
            label="External Port"
            required
            placeholder="e.g. 80 or 8080:8090"
            value={form.externalPort}
            error={formErrors.externalPort}
            onChange={(e) => setForm({ ...form, externalPort: e.target.value })}
          />
          <FormField
            id="pf-int-host"
            label="Internal Host"
            required
            placeholder="e.g. 192.168.1.10"
            value={form.internalHost}
            error={formErrors.internalHost}
            onChange={(e) => setForm({ ...form, internalHost: e.target.value })}
          />
          <FormField
            id="pf-int-port"
            label="Internal Port"
            required
            placeholder="e.g. 80"
            value={form.internalPort}
            error={formErrors.internalPort}
            onChange={(e) => setForm({ ...form, internalPort: e.target.value })}
          />
          <FormField
            id="pf-desc"
            label="Description"
            placeholder="Optional description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="col-span-2 space-y-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={form.autoFirewallRule}
                onChange={(e) => setForm({ ...form, autoFirewallRule: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">
                Auto-create associated firewall rule
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={form.natReflection}
                onChange={(e) => setForm({ ...form, natReflection: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">
                Enable NAT reflection for this rule
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
