import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNatConfig, updateNatConfig, getNatRules, createNatRule, updateNatRule, deleteNatRule } from '../../api/nat'
import { getInterfaces } from '../../api/interfaces'
import { useToast } from '../../context/ToastContext'
import type { NatRule, NatOutboundMode, NatProtocol, NatRuleType, NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

type RuleRow = NatRule & Record<string, unknown>

const defaultRuleForm = (): Omit<NatRule, 'id'> => ({
  enabled: true,
  description: null,
  rule_type: 'masquerade',
  interface: '',
  source: null,
  destination: null,
  protocol: 'any',
  source_port: null,
  destination_port: null,
  translation: null,
  nat_reflection: false,
  priority: 100,
  log: false,
  auto_firewall_rule: true,
})

function isWanInterface(iface: NetworkInterface): boolean {
  const desc = iface.description?.trim().toLowerCase() ?? ''
  return Boolean(iface.wanMode) || Boolean(iface.gateway) || desc.includes('wan') || iface.name.toLowerCase() === 'wan'
}

export default function OutboundNAT() {
  const qc = useQueryClient()
  const { addToast } = useToast()

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['nat', 'config'],
    queryFn: getNatConfig,
  })

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['nat', 'rules'],
    queryFn: getNatRules,
  })

  const { data: interfacesData } = useQuery({
    queryKey: ['interfaces', 'nat-outbound'],
    queryFn: getInterfaces,
  })

  const config = configData?.data
  // Outbound NAT page shows masquerade + SNAT rules only; DNAT lives in Port Forwards.
  const rules = (rulesData?.data ?? []).filter((r) => r.rule_type !== 'dnat') as RuleRow[]
  const wanInterfaces = (interfacesData?.data ?? []).filter((iface) => iface.enabled !== false && isWanInterface(iface))

  // â”€â”€ Mode mutation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const configMutation = useMutation({
    mutationFn: updateNatConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'config'] })
      addToast('NAT mode updated', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  // â”€â”€ Rule form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NatRule | null>(null)
  const [ruleForm, setRuleForm] = useState<Omit<NatRule, 'id'>>(defaultRuleForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NatRule, string>>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openAddModal = () => {
    setEditingRule(null)
    setRuleForm(defaultRuleForm())
    setFormErrors({})
    setRuleModalOpen(true)
  }

  const openEditModal = (rule: NatRule) => {
    setEditingRule(rule)
    const { id: _id, ...rest } = rule
    setRuleForm(rest)
    setFormErrors({})
    setRuleModalOpen(true)
  }

  const validate = (): boolean => {
    const errors: Partial<Record<keyof NatRule, string>> = {}
    if (!ruleForm.interface?.trim()) errors.interface = 'Interface is required'
    if (ruleForm.rule_type === 'snat' && !ruleForm.translation?.address?.trim()) {
      errors.translation = 'Translation address is required for SNAT'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const createMutation = useMutation({
    mutationFn: createNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] })
      setRuleModalOpen(false)
      addToast('NAT rule created', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<NatRule, 'id'>> }) =>
      updateNatRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] })
      setRuleModalOpen(false)
      addToast('NAT rule updated', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] })
      setDeleteId(null)
      addToast('NAT rule deleted', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  const handleSave = () => {
    if (!validate()) return
    // For masquerade, translation struct is not needed.
    const payload: Omit<NatRule, 'id'> =
      ruleForm.rule_type === 'masquerade'
        ? { ...ruleForm, translation: null }
        : ruleForm
    if (editingRule) {
      editMutation.mutate({ id: editingRule.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || editMutation.isPending

  const columns: Column<RuleRow>[] = [
    {
      key: 'enabled',
      header: 'Enabled',
      render: (row) => (
        <span className={row.enabled ? 'text-green-600' : 'text-gray-400'}>
          {row.enabled ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'rule_type',
      header: 'Type',
      render: (row) => (
        <span className="capitalize">{(row as NatRule).rule_type}</span>
      ),
    },
    { key: 'interface', header: 'Interface' },
    { key: 'source', header: 'Source', render: (row) => (row as NatRule).source ?? 'any' },
    { key: 'destination', header: 'Destination', render: (row) => (row as NatRule).destination ?? 'any' },
    {
      key: 'translation',
      header: 'Translation',
      render: (row) => {
        const rule = row as NatRule
        if (rule.rule_type === 'masquerade') return 'Masquerade'
        const t = rule.translation
        if (!t?.address) return '-'
        return t.port ? `${t.address}:${t.port}` : t.address
      },
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
            onClick={() => openEditModal(row as NatRule)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Edit rule"
            aria-label="Edit NAT rule"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setDeleteId(row.id as string)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
            title="Delete rule"
            aria-label="Delete NAT rule"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </button>
        </div>
      ),
    },
  ]

  const modes: { value: NatOutboundMode; label: string; desc: string }[] = [
    {
      value: 'automatic',
      label: 'Automatic',
      desc: 'Outbound NAT rules are automatically generated.',
    },
    {
      value: 'hybrid',
      label: 'Hybrid',
      desc: 'Automatic rules plus any manually added rules.',
    },
    {
      value: 'manual',
      label: 'Manual',
      desc: 'Only manually defined rules are used.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <Card title="Outbound NAT Mode" subtitle="Controls how outbound address translation is applied">
        {configLoading ? (
          <p className="text-sm text-gray-400">Loadingâ€¦</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            {modes.map((m) => {
              const active = config?.outbound_mode === m.value
              return (
                <button
                  key={m.value}
                  onClick={() =>
                    config && configMutation.mutate({ ...config, outbound_mode: m.value })
                  }
                  disabled={configMutation.isPending}
                  className={[
                    'flex-1 text-left rounded-lg border-2 px-4 py-3 transition-colors',
                    active
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300',
                  ].join(' ')}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* Rules table */}
      <Card
        title="Outbound NAT Rules"
        subtitle="Rules are evaluated top-to-bottom. Manual rules are only active in Hybrid or Manual mode."
        actions={
          <button
            onClick={openAddModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Add rule"
            aria-label="Add NAT rule"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        <Table
          columns={columns}
          data={rules}
          keyField="id"
          loading={rulesLoading}
          emptyMessage="No outbound NAT rules defined."
        />
      </Card>

      {/* Add / Edit Rule Modal */}
      <Modal
        open={ruleModalOpen}
        title={editingRule ? 'Edit NAT Rule' : 'Add NAT Rule'}
        onClose={() => setRuleModalOpen(false)}
        onConfirm={handleSave}
        confirmLabel={editingRule ? 'Save Changes' : 'Create Rule'}
        loading={isSaving}
        size="xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="nat-type"
            label="Rule Type"
            as="select"
            value={ruleForm.rule_type}
            onChange={(e) =>
              setRuleForm({ ...ruleForm, rule_type: e.target.value as NatRuleType, translation: null })
            }
          >
            <option value="masquerade">Masquerade</option>
            <option value="snat">SNAT (Static NAT)</option>
          </FormField>
          <FormField
            id="nat-iface"
            label="Interface"
            as="select"
            required
            value={ruleForm.interface ?? ''}
            error={formErrors.interface}
            onChange={(e) => setRuleForm({ ...ruleForm, interface: e.target.value || null })}
          >
            <option value="">Select WAN interface</option>
            {wanInterfaces.map((iface) => (
              <option key={iface.name} value={iface.name}>
                {formatInterfaceDisplayName(iface.description, iface.name)}
              </option>
            ))}
          </FormField>
          <FormField
            id="nat-proto"
            label="Protocol"
            as="select"
            value={ruleForm.protocol}
            onChange={(e) => setRuleForm({ ...ruleForm, protocol: e.target.value as NatProtocol })}
          >
            <option value="any">Any</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="tcp_udp">TCP/UDP</option>
          </FormField>
          <FormField
            id="nat-priority"
            label="Priority"
            type="number"
            value={ruleForm.priority}
            onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })}
          />
          <FormField
            id="nat-src"
            label="Source"
            placeholder="leave blank for any (CIDR, e.g. 192.168.1.0/24)"
            value={ruleForm.source ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value || null })}
          />
          <FormField
            id="nat-dst"
            label="Destination"
            placeholder="leave blank for any (CIDR)"
            value={ruleForm.destination ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, destination: e.target.value || null })}
          />
          {ruleForm.rule_type === 'snat' && (
            <FormField
              id="nat-translation"
              label="Translation Address"
              required
              placeholder="e.g. 203.0.113.5"
              className="col-span-2"
              value={ruleForm.translation?.address ?? ''}
              error={formErrors.translation}
              onChange={(e) =>
                setRuleForm({
                  ...ruleForm,
                  translation: {
                    address: e.target.value || null,
                    port: ruleForm.translation?.port ?? null,
                    port_end: ruleForm.translation?.port_end ?? null,
                  },
                })
              }
            />
          )}
          <FormField
            id="nat-desc"
            label="Description"
            className="col-span-2"
            placeholder="Optional description"
            value={ruleForm.description ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value || null })}
          />
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="nat-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={ruleForm.enabled}
              onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
            />
            <label htmlFor="nat-enabled" className="text-sm font-medium text-gray-700">
              Enable this rule
            </label>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="nat-log"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={ruleForm.log}
              onChange={(e) => setRuleForm({ ...ruleForm, log: e.target.checked })}
            />
            <label htmlFor="nat-log" className="text-sm font-medium text-gray-700">
              Log matched packets
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete NAT Rule"
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this NAT rule? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
