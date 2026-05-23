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
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">One-to-One NAT Rules</h3>
          <button
            onClick={openAddModal}
            className="btn-icon btn-icon-secondary"
            title="Add NAT rule"
            aria-label="Add NAT rule"
            disabled={rulesLoading}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </Card>

      <Card>
        {rulesLoading ? (
          <div className="py-8 text-center text-gray-500">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No One-to-One NAT rules configured. Create one to get started.
          </div>
        ) : (
          <Table data={rules} columns={columns} keyField="id" />
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} title="One-to-One NAT Rule">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            <p>
              One-to-One NAT maps entire IP addresses between networks. Traffic from the internal address
              is translated to the external address and vice versa.
            </p>
          </div>

          <FormField
            label="Enabled"
            error={formErrors.enabled}
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ruleForm.enabled}
                onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                className="rounded"
              />
              <span>Enable this rule</span>
            </label>
          </FormField>

          <FormField label="Interface" error={formErrors.interface}>
            <select
              value={ruleForm.interface ?? ''}
              onChange={(e) => setRuleForm({ ...ruleForm, interface: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select interface...</option>
              {wanInterfaces.map((iface) => (
                <option key={iface.name} value={iface.name}>
                  {formatInterfaceDisplayName(iface.description, iface.name)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Address Family" error={formErrors.address_family}>
            <select
              value={ruleForm.address_family}
              onChange={(e) =>
                setRuleForm({
                  ...ruleForm,
                  address_family: e.target.value as 'ipv4' | 'ipv6',
                })
              }
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ipv4">IPv4</option>
              <option value="ipv6">IPv6</option>
            </select>
          </FormField>

          <FormField label="Internal Address" error={formErrors.source}>
            <input
              type="text"
              value={sourceAddressInput}
              onChange={(e) => setSourceAddressInput(e.target.value)}
              placeholder="e.g., 192.168.1.100"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          <FormField label="External Address" error={formErrors.translation}>
            <input
              type="text"
              value={translationAddressInput}
              onChange={(e) => setTranslationAddressInput(e.target.value)}
              placeholder="e.g., 203.0.113.100"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          <FormField label="Description">
            <input
              type="text"
              value={ruleForm.description ?? ''}
              onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value || null })}
              placeholder="Optional description"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </FormField>

          <FormField label="Logging">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ruleForm.log}
                onChange={(e) => setRuleForm({ ...ruleForm, log: e.target.checked })}
                className="rounded"
              />
              <span>Log matching packets</span>
            </label>
          </FormField>

          <FormField label="Auto Firewall Rule" className="lg:col-span-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ruleForm.auto_firewall_rule}
                onChange={(e) => setRuleForm({ ...ruleForm, auto_firewall_rule: e.target.checked })}
                className="rounded"
              />
              <span>Automatically create firewall rule</span>
            </label>
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setRuleModalOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Confirm Deletion"
        size="xl"
      >
        <div className="space-y-4">
          <p>Are you sure you want to delete this One-to-One NAT rule?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteId(null)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              disabled={deleteMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
