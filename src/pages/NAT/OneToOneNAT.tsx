import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOneToOneNatRules,
  createOneToOneNatRule,
  updateOneToOneNatRule,
  deleteOneToOneNatRule,
} from '../../api/nat';
import { getInterfaces } from '../../api/interfaces';
import { getSystemConfig } from '../../api/system';
import { useToast } from '../../context/ToastContext';
import type { NatRule, NetworkInterface } from '../../types';
import Card from '../../components/Card';
import TrashIcon from '../../components/TrashIcon';
import Table, { Column } from '../../components/Table';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';

type RuleRow = NatRule & Record<string, unknown>;

const defaultRuleForm = (): Omit<NatRule, 'id'> => ({
  enabled: true,
  description: null,
  rule_type: 'one_to_one',
  interface: '',
  source: null,
  destination: null,
  protocol: 'any',
  source_port: null,
  destination_port: null,
  translation: { address: '', port: null, port_end: null },
  nat_reflection: false,
  address_family: 'ipv4',
  log: false,
  auto_firewall_rule: true,
});

function isWanInterface(iface: NetworkInterface): boolean {
  const desc = iface.description?.trim().toLowerCase() ?? '';
  return (
    Boolean(iface.wanMode) ||
    Boolean(iface.gateway) ||
    desc.includes('wan') ||
    iface.name.toLowerCase() === 'wan'
  );
}

export default function OneToOneNAT() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['nat', 'one-to-one-rules'],
    queryFn: getOneToOneNatRules,
  });

  const { data: interfacesData } = useQuery({
    queryKey: ['interfaces', 'nat-one-to-one'],
    queryFn: getInterfaces,
  });

  const { data: systemData } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: getSystemConfig,
  });

  const rules = (rulesData?.data ?? []) as RuleRow[];
  const wanInterfaces = (interfacesData?.data ?? []).filter(
    (iface) => iface.enabled !== false && isWanInterface(iface)
  );
  const ipv6Enabled = Boolean(systemData?.data.ipv6Enabled);

  // Rule form state
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NatRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Omit<NatRule, 'id'>>(defaultRuleForm());
  const [sourceAddressInput, setSourceAddressInput] = useState('');
  const [translationAddressInput, setTranslationAddressInput] = useState('');
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NatRule, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingRule(null);
    const initial = defaultRuleForm();
    setRuleForm(initial);
    setSourceAddressInput('');
    setTranslationAddressInput('');
    setFormErrors({});
    setRuleModalOpen(true);
  };

  const openEditModal = (rule: NatRule) => {
    setEditingRule(rule);
    const { id: _id, ...rest } = rule;
    const next = { ...rest, address_family: rest.address_family ?? 'ipv4' };
    setRuleForm(next);
    setSourceAddressInput(next.source ?? '');
    setTranslationAddressInput(next.translation?.address ?? '');
    setFormErrors({});
    setRuleModalOpen(true);
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof NatRule, string>> = {};
    if (!ruleForm.interface?.trim()) errors.interface = 'Interface is required';
    if (!sourceAddressInput.trim()) errors.source = 'Source address is required';
    if (!translationAddressInput.trim()) errors.translation = 'Translation address is required';
    if (ruleForm.address_family === 'ipv6' && !ipv6Enabled) {
      errors.address_family = 'IPv6 NAT requires IPv6 to be enabled in System settings';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: createOneToOneNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'one-to-one-rules'] });
      setRuleModalOpen(false);
      addToast('One-to-One NAT rule created', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<NatRule, 'id'>> }) =>
      updateOneToOneNatRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'one-to-one-rules'] });
      setRuleModalOpen(false);
      addToast('One-to-One NAT rule updated', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOneToOneNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'one-to-one-rules'] });
      setDeleteId(null);
      addToast('One-to-One NAT rule deleted', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const handleSave = () => {
    if (!validate()) return;

    const payload: Omit<NatRule, 'id'> = {
      ...ruleForm,
      source: sourceAddressInput.trim() || null,
      translation: {
        address: translationAddressInput.trim() || null,
        port: null,
        port_end: null,
      },
    };

    if (editingRule) {
      editMutation.mutate({ id: editingRule.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || editMutation.isPending;

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
      key: 'address_family',
      header: 'Family',
      render: (row) => ((row as NatRule).address_family ?? 'ipv4').toUpperCase(),
    },
    {
      key: 'interface',
      header: 'Interface',
      render: (row) => {
        const iface = (row as NatRule).interface;
        if (!iface) return '-';
        const found = (interfacesData?.data ?? []).find((i) => i.name === iface);
        return found ? formatInterfaceDisplayName(found.description, found.name) : iface;
      },
    },
    { key: 'source', header: 'Internal Address', render: (row) => (row as NatRule).source ?? '-' },
    {
      key: 'translation',
      header: 'External Address',
      render: (row) => {
        const t = (row as NatRule).translation;
        return t?.address ?? '-';
      },
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (row as NatRule).description ?? '',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEditModal(row as NatRule)}
            className="btn-icon btn-icon-secondary"
            title="Edit rule"
            aria-label="Edit One-to-One NAT rule"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={() => setDeleteId(row.id as string)}
            className="btn-icon btn-icon-danger"
            title="Delete rule"
            aria-label="Delete One-to-One NAT rule"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Add/Edit Modal */}
      <Modal
        open={ruleModalOpen}
        title={editingRule ? 'Edit One-to-One NAT' : 'Add One-to-One NAT'}
        onClose={() => setRuleModalOpen(false)}
        onConfirm={handleSave}
        confirmLabel={editingRule ? 'Save Changes' : 'Create One-to-One NAT'}
        loading={isSaving}
        size="xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FormField
            id="one-to-one-iface"
            label="WAN Interface"
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

          {ipv6Enabled ? (
            <FormField
              id="one-to-one-family"
              label="Address Family"
              as="select"
              value={ruleForm.address_family ?? 'ipv4'}
              error={formErrors.address_family}
              onChange={(e) =>
                setRuleForm({
                  ...ruleForm,
                  address_family: e.target.value as NatRule['address_family'],
                })
              }
            >
              <option value="ipv4">IPv4</option>
              <option value="ipv6">IPv6</option>
            </FormField>
          ) : (
            <div className="lg:col-span-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Address Family
              </p>
              <p className="mt-1 text-sm text-gray-700">IPv4 only</p>
            </div>
          )}

          <FormField
            id="one-to-one-internal"
            label="Internal Address"
            required
            value={sourceAddressInput}
            error={formErrors.source}
            placeholder="e.g. 192.168.1.100"
            onChange={(e) => setSourceAddressInput(e.target.value)}
          />

          <FormField
            id="one-to-one-external"
            label="External Address"
            required
            value={translationAddressInput}
            error={formErrors.translation}
            placeholder="e.g. 203.0.113.100"
            onChange={(e) => setTranslationAddressInput(e.target.value)}
          />

          <FormField
            id="one-to-one-desc"
            label="Description"
            className="lg:col-span-3"
            placeholder="Optional description"
            value={ruleForm.description ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value || null })}
          />

          <div className="lg:col-span-3 space-y-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={ruleForm.auto_firewall_rule}
                onChange={(e) => setRuleForm({ ...ruleForm, auto_firewall_rule: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">
                Automatically create firewall rule
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={ruleForm.log}
                onChange={(e) => setRuleForm({ ...ruleForm, log: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">Log matching packets</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={ruleForm.enabled}
                onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">Enable Rule</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete One-to-One NAT"
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        size="xl"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this One-to-One NAT rule? This action cannot be undone.
        </p>
      </Modal>

      <Card
        title="One-to-One NAT Rules"
        subtitle="Map internal hosts to dedicated external addresses"
        actions={
          <button
            onClick={openAddModal}
            className="btn-icon btn-icon-secondary"
            title="Add One-to-One NAT rule"
            aria-label="Add One-to-One NAT rule"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        <Table
          data={rules}
          columns={columns}
          keyField="id"
          loading={rulesLoading}
          emptyMessage="No One-to-One NAT rules defined."
        />
      </Card>
    </div>
  );
}
