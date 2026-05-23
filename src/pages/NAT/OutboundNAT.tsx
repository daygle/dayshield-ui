import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNatConfig,
  updateNatConfig,
  getNatRules,
  createNatRule,
  updateNatRule,
  deleteNatRule,
} from '../../api/nat';
import { getInterfaces } from '../../api/interfaces';
import { getSystemConfig } from '../../api/system';
import { useToast } from '../../context/ToastContext';
import type {
  NatRule,
  NatOutboundMode,
  NatProtocol,
  NetworkInterface,
} from '../../types';
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
  rule_type: 'masquerade',
  interface: '',
  source: null,
  destination: null,
  protocol: 'any',
  source_port: null,
  destination_port: null,
  translation: null,
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

export default function OutboundNAT() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['nat', 'config'],
    queryFn: getNatConfig,
  });

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['nat', 'rules'],
    queryFn: getNatRules,
  });

  const { data: interfacesData } = useQuery({
    queryKey: ['interfaces', 'nat-outbound'],
    queryFn: getInterfaces,
  });

  const { data: systemData } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: getSystemConfig,
  });

  const config = configData?.data;
  // Outbound NAT page shows masquerade rules only; SNAT, DNAT, and OneToOne live in their own tabs.
  const rules = (rulesData?.data ?? []).filter((r) => r.rule_type === 'masquerade') as RuleRow[];
  const wanInterfaces = (interfacesData?.data ?? []).filter(
    (iface) => iface.enabled !== false && isWanInterface(iface)
  );
  const ipv6Enabled = Boolean(systemData?.data.ipv6Enabled);

  const formatRuleInterface = (interfaceName: string | null | undefined): string => {
    if (!interfaceName) return '';
    const iface = interfacesData?.data?.find((item) => item.name === interfaceName);
    return iface ? formatInterfaceDisplayName(iface.description, iface.name) : interfaceName;
  };

  // â”€â”€ Mode mutation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const configMutation = useMutation({
    mutationFn: updateNatConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'config'] });
      addToast('NAT mode updated', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  // â”€â”€ Rule form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NatRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Omit<NatRule, 'id'>>(defaultRuleForm());
  const [sourceAddressInput, setSourceAddressInput] = useState('');
  const [sourcePrefixInput, setSourcePrefixInput] = useState('32');
  const [destinationAddressInput, setDestinationAddressInput] = useState('');
  const [destinationPrefixInput, setDestinationPrefixInput] = useState('32');
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NatRule, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingRule(null);
    const initial = defaultRuleForm();
    setRuleForm(initial);
    const sourceParts = splitCidrValue(initial.source, initial.address_family);
    const destinationParts = splitCidrValue(initial.destination, initial.address_family);
    setSourceAddressInput(sourceParts.address);
    setSourcePrefixInput(sourceParts.prefix);
    setDestinationAddressInput(destinationParts.address);
    setDestinationPrefixInput(destinationParts.prefix);
    setFormErrors({});
    setRuleModalOpen(true);
  };

  const openEditModal = (rule: NatRule) => {
    setEditingRule(rule);
    const { id: _id, ...rest } = rule;
    const next = { ...rest, address_family: rest.address_family ?? 'ipv4' };
    setRuleForm(next);
    const sourceParts = splitCidrValue(next.source, next.address_family);
    const destinationParts = splitCidrValue(next.destination, next.address_family);
    setSourceAddressInput(sourceParts.address);
    setSourcePrefixInput(sourceParts.prefix);
    setDestinationAddressInput(destinationParts.address);
    setDestinationPrefixInput(destinationParts.prefix);
    setFormErrors({});
    setRuleModalOpen(true);
  };

  const sourcePrefixOptions =
    ruleForm.address_family === 'ipv6' ? [...Array(129).keys()] : [...Array(33).keys()];
  const destinationPrefixOptions = sourcePrefixOptions;

  const validate = (): boolean => {
    const errors: Partial<Record<keyof NatRule, string>> = {};
    if (!ruleForm.interface?.trim()) errors.interface = 'Interface is required';
    if (ruleForm.address_family === 'ipv6' && !ipv6Enabled) {
      errors.address_family = 'IPv6 NAT requires IPv6 to be enabled in System settings';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const createMutation = useMutation({
    mutationFn: createNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] });
      setRuleModalOpen(false);
      addToast('NAT rule created', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<NatRule, 'id'>> }) =>
      updateNatRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] });
      setRuleModalOpen(false);
      addToast('NAT rule updated', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNatRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'rules'] });
      setDeleteId(null);
      addToast('NAT rule deleted', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const handleSave = () => {
    if (!validate()) return;
    // For masquerade, translation struct is not needed.
    const payload: Omit<NatRule, 'id'> =
      ruleForm.rule_type === 'masquerade' ? { ...ruleForm, translation: null } : ruleForm;
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
      key: 'rule_type',
      header: 'Type',
      render: (row) => <span className="capitalize">{(row as NatRule).rule_type}</span>,
    },
    {
      key: 'interface',
      header: 'Interface',
      render: (row) => formatRuleInterface((row as NatRule).interface),
    },
    {
      key: 'address_family',
      header: 'Family',
      render: (row) => ((row as NatRule).address_family ?? 'ipv4').toUpperCase(),
    },
    { key: 'source', header: 'Source', render: (row) => (row as NatRule).source ?? 'any' },
    {
      key: 'destination',
      header: 'Destination',
      render: (row) => (row as NatRule).destination ?? 'any',
    },
    {
      key: 'translation',
      header: 'Translation',
      render: (row) => {
        const rule = row as NatRule;
        if (rule.rule_type === 'masquerade') return 'Masquerade';
        const t = rule.translation;
        if (!t?.address) return '-';
        return t.port ? `${t.address}:${t.port}` : t.address;
      },
    },
    { key: 'protocol', header: 'Protocol' },
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
            aria-label="Edit NAT rule"
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
            aria-label="Delete NAT rule"
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
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          </button>
        </div>
      ),
    },
  ];

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
  ];

  return (
    <div className="space-y-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
          {ipv6Enabled ? (
            <FormField
              id="nat-family"
              label="Address Family"
              as="select"
              value={ruleForm.address_family ?? 'ipv4'}
              error={formErrors.address_family}
              onChange={(e) => {
                const family = e.target.value as NatRule['address_family'];
                const nextSource = splitCidrValue(ruleForm.source, family);
                const nextDestination = splitCidrValue(ruleForm.destination, family);
                setSourceAddressInput(nextSource.address);
                setSourcePrefixInput(nextSource.prefix);
                setDestinationAddressInput(nextDestination.address);
                setDestinationPrefixInput(nextDestination.prefix);
                setRuleForm({
                  ...ruleForm,
                  address_family: family,
                  source: joinCidrValue(nextSource.address, nextSource.prefix),
                  destination: joinCidrValue(nextDestination.address, nextDestination.prefix),
                });
              }}
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
          <AddressPrefixField
            id="nat-src"
            label="Source"
            addressPlaceholder="leave blank for any"
            addressValue={sourceAddressInput}
            prefixValue={sourcePrefixInput}
            prefixOptions={sourcePrefixOptions}
            onAddressChange={(value) => {
              setSourceAddressInput(value);
              setRuleForm({
                ...ruleForm,
                source: joinCidrValue(value, sourcePrefixInput),
              });
            }}
            onPrefixChange={(value) => {
              setSourcePrefixInput(value);
              setRuleForm({
                ...ruleForm,
                source: joinCidrValue(sourceAddressInput, value),
              });
            }}
          />
          <AddressPrefixField
            id="nat-dst"
            label="Destination"
            addressPlaceholder="leave blank for any"
            addressValue={destinationAddressInput}
            prefixValue={destinationPrefixInput}
            prefixOptions={destinationPrefixOptions}
            onAddressChange={(value) => {
              setDestinationAddressInput(value);
              setRuleForm({
                ...ruleForm,
                destination: joinCidrValue(value, destinationPrefixInput),
              });
            }}
            onPrefixChange={(value) => {
              setDestinationPrefixInput(value);
              setRuleForm({
                ...ruleForm,
                destination: joinCidrValue(destinationAddressInput, value),
              });
            }}
          />
          <FormField
            id="nat-desc"
            label="Description"
            className="lg:col-span-3"
            placeholder="Optional description"
            value={ruleForm.description ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value || null })}
          />
          <div className="lg:col-span-3 flex items-center gap-2">
            <input
              id="nat-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={ruleForm.enabled}
              onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
            />
            <label htmlFor="nat-enabled" className="text-sm font-medium text-gray-700">
              Enable Rule
            </label>
          </div>
          <div className="lg:col-span-3 flex items-center gap-2">
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

      {/* Mode selector */}
      <Card
        title="Outbound NAT Mode"
        subtitle="Controls how outbound address translation is applied"
      >
        {configLoading ? (
          <p className="text-sm text-gray-400">Loadingâ€¦</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            {modes.map((m) => {
              const active = config?.outbound_mode === m.value;
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
                  <p
                    className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}
                  >
                    {m.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                </button>
              );
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
            className="btn-icon btn-icon-secondary"
            title="Add rule"
            aria-label="Add NAT rule"
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
          columns={columns}
          data={rules}
          keyField="id"
          loading={rulesLoading}
          emptyMessage="No outbound NAT rules defined."
        />
      </Card>
    </div>
  );
}
