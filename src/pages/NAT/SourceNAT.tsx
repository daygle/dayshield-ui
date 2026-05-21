import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSourceNatRules,
  createSourceNatRule,
  updateSourceNatRule,
  deleteSourceNatRule,
} from '../../api/nat';
import { getInterfaces } from '../../api/interfaces';
import { getSystemConfig } from '../../api/system';
import { useToast } from '../../context/ToastContext';
import type { NatRule, NetworkInterface } from '../../types';
import Card from '../../components/Card';
import Table, { Column } from '../../components/Table';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import AddressPrefixField from '../../components/AddressPrefixField';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';

type RuleRow = NatRule & Record<string, unknown>;

const defaultRuleForm = (): Omit<NatRule, 'id'> => ({
  enabled: true,
  description: null,
  rule_type: 'snat',
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

function splitCidrValue(
  value: string | null | undefined,
  family: NatRule['address_family'] = 'ipv4'
): { address: string; prefix: string } {
  const maxPrefix = family === 'ipv6' ? 128 : 32;
  const defaultPrefix = String(maxPrefix);
  const trimmed = (value ?? '').trim();
  if (!trimmed) return { address: '', prefix: defaultPrefix };

  const [addressPart, prefixPart] = trimmed.split('/', 2);
  const parsedPrefix = Number(prefixPart);
  const validPrefix =
    Number.isInteger(parsedPrefix) && parsedPrefix >= 0 && parsedPrefix <= maxPrefix;

  return {
    address: (addressPart ?? '').trim(),
    prefix: validPrefix ? String(parsedPrefix) : defaultPrefix,
  };
}

function joinCidrValue(address: string, prefix: string): string | null {
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;
  return `${cleanAddress}/${prefix}`;
}

function isWanInterface(iface: NetworkInterface): boolean {
  const desc = iface.description?.trim().toLowerCase() ?? '';
  return (
    Boolean(iface.wanMode) ||
    Boolean(iface.gateway) ||
    desc.includes('wan') ||
    iface.name.toLowerCase() === 'wan'
  );
}

export default function SourceNAT() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['nat', 'snat-rules'],
    queryFn: getSourceNatRules,
  });

  const { data: interfacesData } = useQuery({
    queryKey: ['interfaces', 'nat-snat'],
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
  const [sourcePrefixInput, setSourcePrefixInput] = useState('24');
  const [translationAddressInput, setTranslationAddressInput] = useState('');
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NatRule, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingRule(null);
    const initial = defaultRuleForm();
    setRuleForm(initial);
    const sourceParts = splitCidrValue(initial.source, initial.address_family);
    setSourceAddressInput(sourceParts.address);
    setSourcePrefixInput(sourceParts.prefix);
    setTranslationAddressInput(initial.translation?.address ?? '');
    setFormErrors({});
    setRuleModalOpen(true);
  };

  const openEditModal = (rule: NatRule) => {
    setEditingRule(rule);
    const { id: _id, ...rest } = rule;
    const next = { ...rest, address_family: rest.address_family ?? 'ipv4' };
    setRuleForm(next);
    const sourceParts = splitCidrValue(next.source, next.address_family);
    setSourceAddressInput(sourceParts.address);
    setSourcePrefixInput(sourceParts.prefix);
    setTranslationAddressInput(next.translation?.address ?? '');
    setFormErrors({});
    setRuleModalOpen(true);
  };

  const sourcePrefixOptions =
    ruleForm.address_family === 'ipv6' ? [...Array(129).keys()] : [...Array(33).keys()];

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
    mutationFn: createSourceNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'snat-rules'] });
      setRuleModalOpen(false);
      addToast('Source NAT rule created', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<NatRule, 'id'>> }) =>
      updateSourceNatRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'snat-rules'] });
      setRuleModalOpen(false);
      addToast('Source NAT rule updated', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSourceNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'snat-rules'] });
      setDeleteId(null);
      addToast('Source NAT rule deleted', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const handleSave = () => {
    if (!validate()) return;

    const source = joinCidrValue(sourceAddressInput, sourcePrefixInput);
    const payload: Omit<NatRule, 'id'> = {
      ...ruleForm,
      source,
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
        return found ? formatInterfaceDisplayName(found) : iface;
      },
    },
    { key: 'source', header: 'Source', render: (row) => (row as NatRule).source ?? 'any' },
    {
      key: 'translation',
      header: 'Translation Address',
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Edit rule"
            aria-label="Edit Source NAT rule"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
            title="Delete rule"
            aria-label="Delete Source NAT rule"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Source NAT Rules</h3>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            disabled={rulesLoading}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Rule
          </button>
        </div>
      </Card>

      <Card>
        {rulesLoading ? (
          <div className="py-8 text-center text-gray-500">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No Source NAT rules configured. Create one to get started.
          </div>
        ) : (
          <Table data={rules} columns={columns} />
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={ruleModalOpen} onOpenChange={setRuleModalOpen} title="Source NAT Rule">
        <div className="space-y-4">
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
                  {formatInterfaceDisplayName(iface)}
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

          <FormField label="Source Address (CIDR)" error={formErrors.source}>
            <AddressPrefixField
              addressValue={sourceAddressInput}
              prefixValue={sourcePrefixInput}
              addressPlaceholder="e.g., 192.168.1.0"
              onAddressChange={setSourceAddressInput}
              onPrefixChange={setSourcePrefixInput}
              prefixOptions={sourcePrefixOptions}
            />
          </FormField>

          <FormField label="Translation Address" error={formErrors.translation}>
            <input
              type="text"
              value={translationAddressInput}
              onChange={(e) => setTranslationAddressInput(e.target.value)}
              placeholder="e.g., 203.0.113.5"
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

          <FormField label="Auto Firewall Rule">
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
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <p>Are you sure you want to delete this Source NAT rule?</p>
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
