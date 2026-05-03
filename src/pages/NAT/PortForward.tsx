import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPortForwards, createPortForward, updatePortForward, deletePortForward } from '../../api/nat'
import { useToast } from '../../context/ToastContext'
import type { PortForward, NatProtocol } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

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
