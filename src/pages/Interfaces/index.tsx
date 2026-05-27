import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { getInterfacesInventory, createInterface, deleteInterface } from '../../api/interfaces';
import { getSystemConfig } from '../../api/system';
import type { Ipv6Mode, Ipv6RaMode, NetworkInterface } from '../../types';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import TrashIcon from '../../components/TrashIcon';
import AddressPrefixField from '../../components/AddressPrefixField';
import InterfaceDetails from './InterfaceDetails';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';

type InterfaceRow = NetworkInterface & Record<string, unknown>;

const defaultForm: Partial<NetworkInterface> = {
  name: '',
  description: '',
  type: 'ethernet',
  parentInterface: '',
  vlanId: undefined,
  enabled: true,
  dhcp4: false,
  dhcp6: false,
  acceptRa: false,
  ipv6Mode: 'static',
  trackSourceInterface: '',
  trackPrefixId: undefined,
  delegatedPrefixLen: undefined,
  raMode: 'unmanaged',
  iaPdHintLen: undefined,
  wanMode: undefined,
  pppoeUsername: '',
  pppoePassword: '',
  blockPrivateNetworks: false,
  blockBogonNetworks: false,
  ipv4Address: '',
  ipv4Prefix: 24,
  ipv6Address: '',
  ipv6Prefix: 64,
  mss: undefined,
};

export default function Interfaces() {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [ifaces, setIfaces] = useState<InterfaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<NetworkInterface>>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedInterface, setExpandedInterface] = useState<string | null>(
    searchParams.get('iface')
  );
  const [unusedKernelNames, setUnusedKernelNames] = useState<string[]>([]);
  const [allInterfaceNames, setAllInterfaceNames] = useState<string[]>([]);
  const [configuredVlanNames, setConfiguredVlanNames] = useState<string[]>([]);
  const [ipv6Enabled, setIpv6Enabled] = useState(false);

  const requestedInterface = searchParams.get('iface');
  const isInterfaceRowArray = (value: unknown): value is InterfaceRow[] => Array.isArray(value);

  const interfaceNameLabel = (name: string) => {
    const iface = ifaces.find((item) => item.name === name);
    return formatInterfaceDisplayName(iface?.description, name);
  };

  const load = () => {
    setLoading(true);
    getSystemConfig()
      .then((res) => setIpv6Enabled(Boolean(res.data?.ipv6Enabled)))
      .catch(() => setIpv6Enabled(false));
    getInterfacesInventory()
      .then((res) => {
        const rows = isInterfaceRowArray(res.data?.configured) ? res.data.configured : [];
        setUnusedKernelNames(
          Array.isArray(res.data?.unusedKernelNames) ? res.data.unusedKernelNames : []
        );
        setAllInterfaceNames(Array.isArray(res.data?.names) ? res.data.names : []);
        setConfiguredVlanNames(
          rows.filter((iface) => iface.type === 'vlan').map((iface) => iface.name)
        );
        setIfaces(rows);
        setExpandedInterface((current) => {
          if (requestedInterface && rows.some((i) => i.name === requestedInterface)) {
            return requestedInterface;
          }
          if (!current && rows.length > 0) {
            return rows[0].name;
          }
          return current;
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [requestedInterface]);

  const isVlanForm = form.type === 'vlan';
  const isWanForm = Boolean(form.wanMode || form.gateway);
  const ipv6Mode: Ipv6Mode =
    form.ipv6Mode ?? (form.dhcp6 ? 'dhcp6' : form.acceptRa ? 'slaac' : 'static');
  const parentInterfaceOptions = allInterfaceNames.filter(
    (name) => name !== 'lo' && name !== form.name && !configuredVlanNames.includes(name)
  );

  const selectedInterfaceDetails = ifaces.find((iface) => iface.name === expandedInterface) ?? null;

  const resolveIpv6Mode = (iface: NetworkInterface): Ipv6Mode =>
    iface.ipv6Mode ?? (iface.dhcp6 ? 'dhcp6' : iface.acceptRa ? 'slaac' : 'static');

  const formatIpv6Mode = (mode: Ipv6Mode): string => {
    switch (mode) {
      case 'dhcp6':
        return 'DHCPv6';
      case 'slaac':
        return 'SLAAC (RA Receive)';
      case 'track_interface':
        return 'Track Interface (PD)';
      default:
        return 'Static';
    }
  };

  const formatRaMode = (mode: Ipv6RaMode = 'unmanaged'): string => {
    switch (mode) {
      case 'router_only':
        return 'Router Only';
      case 'managed':
        return 'Managed';
      case 'assisted':
        return 'Assisted';
      case 'stateless':
        return 'Stateless';
      default:
        return 'Unmanaged';
    }
  };

  const handleSave = () => {
    if (!form.name?.trim()) {
      setError('Interface name is required.');
      return;
    }
    if (!isVlanForm && !unusedKernelNames.includes(form.name.trim())) {
      setError('Select an unused detected interface. Physical interface names cannot be renamed.');
      return;
    }
    if (isVlanForm) {
      const vlanId = Number(form.vlanId);
      if (!form.parentInterface?.trim()) {
        setError('Parent interface is required for VLAN interfaces.');
        return;
      }
      if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
        setError('VLAN ID must be a whole number between 1 and 4094.');
        return;
      }
    }
    if (ipv6Enabled && ipv6Mode === 'track_interface' && !form.trackSourceInterface?.trim()) {
      setError('Track Interface mode requires a source interface.');
      return;
    }

    setSaving(true);
    createInterface({
      ...form,
      blockPrivateNetworks: isWanForm ? Boolean(form.blockPrivateNetworks) : false,
      blockBogonNetworks: isWanForm ? Boolean(form.blockBogonNetworks) : false,
    } as NetworkInterface)
      .then(() => {
        setModalOpen(false);
        setForm(defaultForm);
        addToast('Interface created.', 'success');
        load();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    if (!deleteName) return;
    setDeleting(true);
    deleteInterface(deleteName)
      .then(() => {
        setDeleteName(null);
        addToast('Interface deleted.', 'success');
        load();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false));
  };

  return (
    <div className="space-y-4">
      {/* Add Interface Modal */}
      <Modal
        open={modalOpen}
        title="Add Interface"
        onClose={() => {
          setModalOpen(false);
          setForm(defaultForm);
          setError(null);
        }}
        onConfirm={handleSave}
        confirmLabel="Create"
        loading={saving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="iface-type"
            label="Interface Type"
            as="select"
            value={form.type ?? 'ethernet'}
            onChange={(e) => {
              const type = e.target.value as NetworkInterface['type'];
              setForm({
                ...defaultForm,
                type,
                name: '',
                enabled: form.enabled ?? true,
                description: form.description ?? '',
              });
            }}
          >
            <option value="ethernet">Ethernet</option>
            <option value="vlan">VLAN</option>
          </FormField>
          <FormField
            id="iface-name"
            label={isVlanForm ? 'Interface Name' : 'Detected Interface'}
            required
            as={!isVlanForm ? 'select' : undefined}
            placeholder={isVlanForm ? 'e.g. eth0.100' : undefined}
            value={form.name ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
              setForm({ ...form, name: e.target.value });
            }}
            hint={
              !isVlanForm
                ? 'Physical interface names come from Debian. Use Friendly Name for labels such as WAN, LAN, or IoT.'
                : undefined
            }
          >
            {!isVlanForm && (
              <>
                <option value="">Select unused NIC</option>
                {unusedKernelNames.map((name) => (
                  <option key={name} value={name}>
                    {interfaceNameLabel(name)}
                  </option>
                ))}
              </>
            )}
          </FormField>
          {isVlanForm && (
            <>
              <FormField
                id="iface-parent"
                label="Parent Interface"
                required
                as="select"
                value={form.parentInterface ?? ''}
                onChange={(e) => setForm({ ...form, parentInterface: e.target.value })}
              >
                <option value="">Select parent interface</option>
                {parentInterfaceOptions.map((name) => (
                  <option key={name} value={name}>
                    {interfaceNameLabel(name)}
                  </option>
                ))}
              </FormField>
              <FormField
                id="iface-vlan-id"
                label="VLAN ID"
                required
                type="number"
                min={1}
                max={4094}
                placeholder="1-4094"
                value={form.vlanId != null ? String(form.vlanId) : ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vlanId: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </>
          )}
          <FormField
            id="iface-desc"
            label="Friendly Name"
            placeholder="WAN, LAN, DMZ…"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="col-span-2 flex items-center gap-3">
            <input
              id="iface-dhcp4"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={form.dhcp4 ?? false}
              onChange={(e) =>
                setForm({
                  ...form,
                  dhcp4: e.target.checked,
                  wanMode: undefined,
                  blockPrivateNetworks: false,
                  blockBogonNetworks: false,
                  ipv4Address: '',
                  ipv4Prefix: 24,
                })
              }
            />
            <label htmlFor="iface-dhcp4" className="text-sm font-medium text-gray-700">
              Obtain IPv4 address via DHCP
            </label>
          </div>

          {/* WAN mode - only shown when DHCP is not ticked */}
          {!isVlanForm && !form.dhcp4 && (
            <FormField
              id="iface-wan-mode"
              label="WAN Connection Type"
              as="select"
              value={form.wanMode ?? ''}
              onChange={(e) => {
                const v = e.target.value as NetworkInterface['wanMode'] | '';
                setForm({
                  ...form,
                  wanMode: v || undefined,
                  pppoeUsername: '',
                  pppoePassword: '',
                  mtu: v === 'pppoe' ? (form.mtu ?? 1492) : form.mtu,
                  blockPrivateNetworks: v ? form.blockPrivateNetworks : false,
                  blockBogonNetworks: v ? form.blockBogonNetworks : false,
                });
              }}
            >
              <option value="">- Not a WAN interface -</option>
              <option value="dhcp">DHCP (automatic from ISP)</option>
              <option value="pppoe">PPPoE (DSL / fibre - username &amp; password)</option>
            </FormField>
          )}

          {/* PPPoE credentials - only when wan_mode == pppoe */}
          {!isVlanForm && form.wanMode === 'pppoe' && (
            <>
              <FormField
                id="iface-pppoe-user"
                label="PPPoE Username"
                placeholder="user@isp.example.com"
                value={form.pppoeUsername ?? ''}
                onChange={(e) => setForm({ ...form, pppoeUsername: e.target.value })}
              />
              <FormField
                id="iface-pppoe-pass"
                label="PPPoE Password"
                type="password"
                placeholder="••••••••"
                value={form.pppoePassword ?? ''}
                onChange={(e) => setForm({ ...form, pppoePassword: e.target.value })}
              />
            </>
          )}
          <AddressPrefixField
            id="iface-ipv4"
            label="IPv4 Address"
            className="col-span-2"
            addressPlaceholder="192.168.1.1"
            addressValue={form.ipv4Address ?? ''}
            prefixValue={String(form.ipv4Prefix ?? 24)}
            prefixOptions={[...Array(33).keys()]}
            disabled={form.dhcp4 ?? false}
            onAddressChange={(value) => setForm({ ...form, ipv4Address: value })}
            onPrefixChange={(value) => setForm({ ...form, ipv4Prefix: Number(value) })}
          />
          {isWanForm && (
            <div className="col-span-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="mb-3 text-sm font-semibold text-gray-900">WAN Source Protection</p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={Boolean(form.blockPrivateNetworks)}
                    onChange={(e) => setForm({ ...form, blockPrivateNetworks: e.target.checked })}
                  />
                  <span>
                    <span className="block font-medium text-gray-900">Block private networks</span>
                    <span className="text-xs text-gray-500">
                      Drop inbound WAN traffic sourced from RFC1918 or IPv6 unique-local ranges.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={Boolean(form.blockBogonNetworks)}
                    onChange={(e) => setForm({ ...form, blockBogonNetworks: e.target.checked })}
                  />
                  <span>
                    <span className="block font-medium text-gray-900">Block bogon networks</span>
                    <span className="text-xs text-gray-500">
                      Drop inbound WAN traffic sourced from invalid, reserved, or documentation
                      ranges.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}
          {ipv6Enabled && (
            <>
              <FormField
                id="iface-ipv6-mode"
                label="IPv6 Configuration Type"
                className="col-span-2"
                as="select"
                value={ipv6Mode}
                onChange={(e) => {
                  const mode = e.target.value as Ipv6Mode;
                  setForm({
                    ...form,
                    ipv6Mode: mode,
                    dhcp6: mode === 'dhcp6',
                    acceptRa: mode === 'slaac',
                    trackSourceInterface:
                      mode === 'track_interface' ? (form.trackSourceInterface ?? '') : '',
                    trackPrefixId: mode === 'track_interface' ? form.trackPrefixId : undefined,
                    delegatedPrefixLen:
                      mode === 'track_interface' ? form.delegatedPrefixLen : undefined,
                    raMode: mode === 'track_interface' ? (form.raMode ?? 'unmanaged') : undefined,
                    iaPdHintLen: mode === 'dhcp6' ? form.iaPdHintLen : undefined,
                    ipv6Address: mode === 'static' ? form.ipv6Address : '',
                    ipv6Prefix: mode === 'static' ? (form.ipv6Prefix ?? 64) : 64,
                  });
                }}
              >
                <option value="static">Static</option>
                <option value="dhcp6">DHCPv6</option>
                <option value="slaac">SLAAC (Router Advertisements)</option>
                <option value="track_interface">Track Interface (Prefix Delegation)</option>
              </FormField>
              {ipv6Mode === 'dhcp6' && (
                <FormField
                  id="iface-ia-pd-hint-len"
                  label="Prefix Delegation Size (iaPdHintLen)"
                  type="number"
                  min={1}
                  max={128}
                  placeholder="e.g. 56 for /56"
                  value={form.iaPdHintLen != null ? String(form.iaPdHintLen) : ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      iaPdHintLen: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              )}
              {(ipv6Mode === 'track_interface' || ipv6Mode === 'slaac') && (
                <>
                  {ipv6Mode === 'track_interface' && (
                    <>
                      <FormField
                        id="iface-track-source"
                        label="Track Source Interface"
                        required
                        as="select"
                        value={form.trackSourceInterface ?? ''}
                        onChange={(e) => setForm({ ...form, trackSourceInterface: e.target.value })}
                      >
                        <option value="">Select source interface</option>
                        {allInterfaceNames
                          .filter((name) => name !== form.name)
                          .map((name) => (
                            <option key={name} value={name}>
                              {interfaceNameLabel(name)}
                            </option>
                          ))}
                      </FormField>
                      <FormField
                        id="iface-track-prefix-id"
                        label="Track Prefix ID"
                        type="number"
                        min={0}
                        max={255}
                        value={form.trackPrefixId != null ? String(form.trackPrefixId) : ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            trackPrefixId: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                      <FormField
                        id="iface-delegated-prefix-len"
                        label="Delegated Prefix Length"
                        type="number"
                        min={0}
                        max={128}
                        value={form.delegatedPrefixLen != null ? String(form.delegatedPrefixLen) : ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            delegatedPrefixLen: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    </>
                  )}

                  <FormField
                    id="iface-ra-mode"
                    label="Router Advertisement Mode"
                    className="col-span-2"
                    as="select"
                    value={form.raMode ?? 'unmanaged'}
                    hint={
                      ipv6Mode === 'track_interface'
                        ? 'Select which flags to set in Router Advertisements sent from this interface.'
                        : 'Select which flags to set in Router Advertisements (when applicable).'
                    }
                    onChange={(e) => setForm({ ...form, raMode: e.target.value as Ipv6RaMode })}
                  >
                    <option value="router_only">Router Only (no SLAAC or DHCPv6)</option>
                    <option value="unmanaged">Unmanaged (SLAAC A flag)</option>
                    <option value="managed">Managed (DHCPv6 M+O flags)</option>
                    <option value="assisted">Assisted (DHCPv6 + SLAAC M+O+A flags)</option>
                    <option value="stateless">Stateless (DHCPv6 info + SLAAC O+A flags)</option>
                  </FormField>
                </>
              )}
              <AddressPrefixField
                id="iface-ipv6"
                label="IPv6 Address"
                className="col-span-2"
                addressPlaceholder="2001:db8::1"
                addressValue={form.ipv6Address ?? ''}
                prefixValue={String(form.ipv6Prefix ?? 64)}
                prefixOptions={[...Array(129).keys()]}
                disabled={ipv6Mode !== 'static'}
                onAddressChange={(value) => setForm({ ...form, ipv6Address: value })}
                onPrefixChange={(value) => setForm({ ...form, ipv6Prefix: Number(value) })}
              />
            </>
          )}
          <FormField
            id="iface-mss"
            label="MSS"
            type="number"
            min={536}
            max={65535}
            placeholder="Optional (e.g. 1452)"
            value={form.mss != null ? String(form.mss) : ''}
            onChange={(e) =>
              setForm({
                ...form,
                mss: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteName !== null}
        title="Delete Interface"
        onClose={() => setDeleteName(null)}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete interface <strong>{deleteName}</strong>? This action
          cannot be undone.
        </p>
      </Modal>

      {ipv6Enabled && (
        <Card
          title="IPv6 Services"
          subtitle="Per-interface IPv6 mode, DHCPv6 client status, and Router Advertisement behavior"
        >
          {ifaces.length === 0 ? (
            <p className="text-sm text-gray-500">No interfaces available yet.</p>
          ) : (
            <div className="space-y-3">
              {ifaces.map((iface) => {
                const mode = resolveIpv6Mode(iface);
                const isTrack = mode === 'track_interface';
                const isDhcp6 = mode === 'dhcp6';
                const isSlaac = mode === 'slaac';
                const raMode = iface.raMode ?? 'unmanaged';
                const receiveRaText = isSlaac ? 'Enabled' : 'Disabled';
                const advertiseRaText = isTrack
                  ? iface.resolvedIpv6Prefix
                    ? `Active (${formatRaMode(raMode)})`
                    : `Waiting (${formatRaMode(raMode)})`
                  : 'Disabled';

                return (
                  <div
                    key={`ipv6-${iface.name}`}
                    className="rounded-md border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatInterfaceDisplayName(iface.description, iface.name)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {iface.name} • {iface.type}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {formatIpv6Mode(mode)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${iface.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {iface.enabled ? 'Interface Up' : 'Interface Down'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-700 md:grid-cols-3">
                      <div className="rounded border border-gray-200 bg-white px-2 py-1.5">
                        <span className="font-medium text-gray-500">DHCPv6 Client:</span>{' '}
                        <span className={isDhcp6 ? 'text-green-700' : 'text-gray-600'}>
                          {isDhcp6 ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="rounded border border-gray-200 bg-white px-2 py-1.5">
                        <span className="font-medium text-gray-500">RA Receive:</span>{' '}
                        <span className={isSlaac ? 'text-green-700' : 'text-gray-600'}>
                          {receiveRaText}
                        </span>
                      </div>
                      <div className="rounded border border-gray-200 bg-white px-2 py-1.5">
                        <span className="font-medium text-gray-500">RA Advertise:</span>{' '}
                        <span
                          className={
                            advertiseRaText.startsWith('Active')
                              ? 'text-green-700'
                              : 'text-gray-600'
                          }
                        >
                          {advertiseRaText}
                        </span>
                      </div>
                    </div>

                    {isDhcp6 && iface.iaPdHintLen != null && (
                      <p className="mt-2 text-xs text-gray-500">
                        Requested delegated prefix size: /{iface.iaPdHintLen}
                      </p>
                    )}
                    {isTrack && iface.trackSourceInterface && (
                      <p className="mt-1 text-xs text-gray-500">
                        Tracking source: {interfaceNameLabel(iface.trackSourceInterface)}
                        {iface.resolvedIpv6Prefix ? `, assigned ${iface.resolvedIpv6Prefix}` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Card
        title="Network Interfaces"
        subtitle="Manage physical and virtual network interfaces"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="btn-icon btn-icon-secondary"
            title="Add interface"
            aria-label="Add interface"
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
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {loading ? (
          <p className="text-gray-500">Loading interfaces...</p>
        ) : ifaces.length === 0 ? (
          <p className="text-gray-500">No interfaces found. Add one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Interfaces
              </div>
              <div className="space-y-2">
                {ifaces.map((iface) => {
                  const isSelected = expandedInterface === iface.name;
                  return (
                    <div
                      key={iface.name}
                      className={`flex items-start justify-between gap-2 rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => setExpandedInterface(iface.name)}
                      >
                        <h3 className="font-semibold text-gray-900">
                          {formatInterfaceDisplayName(iface.description, iface.name)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {iface.name} • {iface.type}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              iface.enabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${iface.enabled ? 'bg-green-500' : 'bg-gray-400'}`}
                            />
                            {iface.enabled ? 'Up' : 'Down'}
                          </span>
                          {iface.type === 'vlan' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              VLAN {iface.vlanId ?? '?'}
                            </span>
                          )}
                          {iface.wanMode === 'pppoe' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              PPPoE
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => setDeleteName(iface.name)}
                        title="Delete interface"
                        aria-label="Delete interface"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              {selectedInterfaceDetails ? (
                <InterfaceDetails
                  key={selectedInterfaceDetails.name}
                  iface={selectedInterfaceDetails}
                  ipv6Enabled={ipv6Enabled}
                  parentInterfaceOptions={parentInterfaceOptions}
                  parentInterfaceLabel={interfaceNameLabel}
                  onUpdate={load}
                />
              ) : (
                <div className="rounded border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
                  Select an interface to view its overview and edit options.
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
