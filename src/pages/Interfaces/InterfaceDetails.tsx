import { useState } from 'react'
import type { Ipv6Mode, Ipv6RaMode, NetworkInterface } from '../../types'
import { updateInterface } from '../../api/interfaces'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

interface InterfaceDetailsProps {
  iface: NetworkInterface
  ipv6Enabled?: boolean
  parentInterfaceOptions?: string[]
  parentInterfaceLabel?: (name: string) => string
  onUpdate?: () => void
}

export default function InterfaceDetails({ iface, ipv6Enabled = false, parentInterfaceOptions = [], parentInterfaceLabel, onUpdate }: InterfaceDetailsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<NetworkInterface>>({
    name: iface.name,
    description: iface.description,
    type: iface.type,
    enabled: iface.enabled,
    dhcp4: iface.dhcp4,
    dhcp6: iface.dhcp6,
    acceptRa: iface.acceptRa,
    ipv6Mode: iface.ipv6Mode ?? (iface.dhcp6 ? 'dhcp6' : iface.acceptRa ? 'slaac' : 'static'),
    trackSourceInterface: iface.trackSourceInterface,
    trackPrefixId: iface.trackPrefixId,
    delegatedPrefixLen: iface.delegatedPrefixLen,
    raMode: iface.raMode,
    iaPdHintLen: iface.iaPdHintLen,
    wanMode: iface.wanMode,
    pppoeUsername: iface.pppoeUsername,
    pppoePassword: iface.pppoePassword,
    ipv4Address: iface.ipv4Address,
    ipv4Prefix: iface.ipv4Prefix,
    ipv6Address: iface.ipv6Address,
    ipv6Prefix: iface.ipv6Prefix,
    parentInterface: iface.parentInterface,
    vlanId: iface.vlanId,
    gateway: iface.gateway,
    mtu: iface.mtu,
    mss: iface.mss,
  })

  const ipv4ConfigurationType = iface.dhcp4
    ? 'DHCP'
    : iface.wanMode === 'pppoe'
      ? 'PPPoE'
      : iface.wanMode === 'dhcp'
        ? 'DHCP WAN'
        : 'Static'

  const kernelAddresses = iface.kernelAddresses ?? []
  const availableParentInterfaces = parentInterfaceOptions.filter((name) => name !== iface.name)
  const availableTrackSourceInterfaces = availableParentInterfaces
  const resolvedParentInterfaceOptions = form.parentInterface
    && !availableParentInterfaces.includes(form.parentInterface)
    ? [...availableParentInterfaces, form.parentInterface]
    : availableParentInterfaces
  const resolvedTrackSourceOptions = form.trackSourceInterface
    && !availableTrackSourceInterfaces.includes(form.trackSourceInterface)
    ? [...availableTrackSourceInterfaces, form.trackSourceInterface]
    : availableTrackSourceInterfaces
  const formIpv6Mode: Ipv6Mode = form.ipv6Mode ?? (form.dhcp6 ? 'dhcp6' : form.acceptRa ? 'slaac' : 'static')
  const kernelIpv4 = kernelAddresses.filter((addr) => addr.includes('.'))
  const kernelIpv6 = kernelAddresses.filter((addr) => addr.includes(':'))
  const statusText = iface.enabled ? (iface.kernelState ?? 'UP') : 'DOWN'
  const statusClass = statusText.toUpperCase() === 'UP'
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-600'
  const interfaceDisplayName = formatInterfaceDisplayName(iface.description, iface.name)

  const formatCount = (value?: number) => (typeof value === 'number' ? value.toLocaleString() : '-')
  const formatBytes = (value?: number) => {
    if (typeof value !== 'number') return '-'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = value
    let idx = 0
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024
      idx += 1
    }
    return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
  }

  const labelParentInterface = (name?: string) => {
    if (!name) return '-'
    return parentInterfaceLabel ? parentInterfaceLabel(name) : name
  }

  const labelIpv6Mode = (mode: Ipv6Mode | undefined) => {
    switch (mode) {
      case 'dhcp6':
        return 'DHCPv6'
      case 'slaac':
        return 'SLAAC (RA)'
      case 'track_interface':
        return 'Track Interface'
      default:
        return 'Static'
    }
  }

  const labelRaMode = (mode: Ipv6RaMode | undefined) => {
    switch (mode) {
      case 'router_only':
        return 'Router Only'
      case 'managed':
        return 'Managed'
      case 'assisted':
        return 'Assisted'
      case 'stateless':
        return 'Stateless'
      default:
        return 'Unmanaged'
    }
  }

  const handleSave = () => {
    if (form.type === 'vlan') {
      const vlanId = Number(form.vlanId)
      if (!form.parentInterface?.trim()) {
        setError('Parent interface is required for VLAN interfaces.')
        return
      }
      if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) {
        setError('VLAN ID must be a whole number between 1 and 4094.')
        return
      }
    }
    if (ipv6Enabled && formIpv6Mode === 'track_interface' && !form.trackSourceInterface?.trim()) {
      setError('Track Interface mode requires a source interface.')
      return
    }

    setSaving(true)
    setError(null)
    updateInterface({
      ...iface,
      ...form,
      name: form.name ?? iface.name,
      description: form.description ?? iface.description,
    } as NetworkInterface)
      .then(() => {
        setEditOpen(false)
        onUpdate?.()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between rounded border border-gray-200 bg-white p-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{interfaceDisplayName}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {iface.name} • {iface.type.toUpperCase()} • {ipv4ConfigurationType}
          </p>
          {iface.type === 'vlan' && (
            <p className="mt-0.5 text-xs text-gray-500">
              Parent: {labelParentInterface(iface.parentInterface)} • VLAN {iface.vlanId ?? '-'}
            </p>
          )}
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
          title="Edit interface settings"
          aria-label="Edit interface settings"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">Overview</h4>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
            {statusText}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Identity</p>
            <p className="mt-1 text-sm text-gray-900">{interfaceDisplayName}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{iface.name}</p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Mode</p>
            <p className="mt-1 text-sm text-gray-900">{ipv4ConfigurationType}</p>
            <p className="mt-1 text-xs text-gray-500">Type: {iface.type}</p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Link</p>
            <p className="mt-1 font-mono text-sm text-gray-900">{iface.mac ?? '-'}</p>
            <p className="mt-1 text-xs text-gray-500">MTU: {iface.mtu ?? 'Default'}</p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">IPv4</p>
            <p className="mt-1 font-mono text-sm text-gray-900">
              {iface.ipv4Address ? `${iface.ipv4Address}/${iface.ipv4Prefix ?? '-'}` : '-'}
            </p>
            {kernelIpv4.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">Runtime: {kernelIpv4.join(', ')}</p>
            )}
          </div>
          {ipv6Enabled && (
            <div className="rounded border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">IPv6</p>
              <p className="mt-1 font-mono text-sm text-gray-900">
                {iface.ipv6Address ? `${iface.ipv6Address}/${iface.ipv6Prefix ?? '-'}` : kernelIpv6.length > 0 ? kernelIpv6.join(', ') : '-'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Mode: {labelIpv6Mode(iface.ipv6Mode ?? (iface.dhcp6 ? 'dhcp6' : iface.acceptRa ? 'slaac' : 'static'))}
              </p>
              {iface.ipv6Mode === 'track_interface' && (
                <p className="mt-1 text-xs text-gray-500">
                  Source: {labelParentInterface(iface.trackSourceInterface)}
                </p>
              )}
              {iface.ipv6Mode === 'track_interface' && (
                <p className="mt-1 text-xs text-gray-500">
                  RA Mode: {labelRaMode(iface.raMode)}
                </p>
              )}
              {iface.resolvedIpv6Prefix && (
                <p className="mt-1 text-xs text-gray-500">
                  {iface.ipv6Mode === 'dhcp6' ? 'Delegated' : 'Assigned'}: <span className="font-mono">{iface.resolvedIpv6Prefix}</span>
                </p>
              )}
              {kernelIpv6.length > 0 && iface.ipv6Address && (
                <p className="mt-1 text-xs text-gray-500">Runtime: {kernelIpv6.join(', ')}</p>
              )}
            </div>
          )}
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Routing</p>
            <p className="mt-1 font-mono text-sm text-gray-900">{iface.gateway ?? '-'}</p>
            <p className="mt-1 text-xs text-gray-500">MSS: {iface.mss ?? '-'}</p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Counters</p>
            <p className="mt-1 text-xs text-gray-700">
              RX Packets: <span className="font-mono">{formatCount(iface.kernelRxPackets)}</span>
            </p>
            <p className="mt-1 text-xs text-gray-700">
              TX Packets: <span className="font-mono">{formatCount(iface.kernelTxPackets)}</span>
            </p>
            <p className="mt-1 text-xs text-gray-700">
              RX Bytes: <span className="font-mono">{formatBytes(iface.kernelRxBytes)}</span>
            </p>
            <p className="mt-1 text-xs text-gray-700">
              TX Bytes: <span className="font-mono">{formatBytes(iface.kernelTxBytes)}</span>
            </p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3 md:col-span-2 lg:col-span-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Kernel Flags</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(iface.kernelFlags && iface.kernelFlags.length > 0) ? iface.kernelFlags.map((flag) => (
                <span
                  key={flag}
                  className="inline-flex items-center rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700"
                >
                  {flag}
                </span>
              )) : (
                <span className="text-xs text-gray-500">No runtime flags available.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={editOpen}
        title={`Edit Interface: ${iface.description || iface.name}`}
        onClose={() => setEditOpen(false)}
        onConfirm={handleSave}
        confirmLabel="Save"
        loading={saving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="iface-name"
            label="Interface Name"
            required
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <FormField
            id="iface-description"
            label="Description"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {form.type === 'vlan' && (
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
                {resolvedParentInterfaceOptions.map((name) => (
                  <option key={name} value={name}>{labelParentInterface(name)}</option>
                ))}
              </FormField>
              <FormField
                id="iface-vlan-id"
                label="VLAN ID"
                required
                type="number"
                min={1}
                max={4094}
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
          <div className="col-span-2 flex items-center gap-3">
            <input
              id="iface-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={form.enabled ?? false}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <label htmlFor="iface-enabled" className="text-sm font-medium text-gray-700">
              Interface enabled
            </label>
          </div>
          <FormField
            id="iface-ipv4-mode"
            label="IPv4 Configuration Type"
            as="select"
            value={form.dhcp4 ? 'dhcp' : form.wanMode === 'pppoe' ? 'pppoe' : 'static'}
            onChange={(e) => {
              const mode = e.target.value
              if (mode === 'dhcp') {
                setForm({
                  ...form,
                  dhcp4: true,
                  wanMode: undefined,
                  ipv4Address: '',
                  ipv4Prefix: 24,
                  gateway: '',
                })
                return
              }
              if (mode === 'pppoe') {
                setForm({
                  ...form,
                  dhcp4: false,
                  wanMode: 'pppoe',
                  ipv4Address: '',
                  gateway: '',
                })
                return
              }
              setForm({
                ...form,
                dhcp4: false,
                wanMode: undefined,
              })
            }}
          >
            <option value="static">Static</option>
            <option value="dhcp">DHCP</option>
            <option value="pppoe">PPPoE</option>
          </FormField>
          <FormField
            id="iface-mtu"
            label="MTU"
            type="number"
            min={68}
            value={String(form.mtu ?? '')}
            onChange={(e) => setForm({ ...form, mtu: e.target.value ? Number(e.target.value) : undefined })}
          />
          <FormField
            id="iface-mss"
            label="MSS"
            type="number"
            min={536}
            max={65535}
            value={String(form.mss ?? '')}
            onChange={(e) => setForm({ ...form, mss: e.target.value ? Number(e.target.value) : undefined })}
          />
          {form.wanMode === 'pppoe' && (
            <>
              <FormField
                id="iface-pppoe-user"
                label="PPPoE Username"
                value={form.pppoeUsername ?? ''}
                onChange={(e) => setForm({ ...form, pppoeUsername: e.target.value })}
              />
              <FormField
                id="iface-pppoe-pass"
                label="PPPoE Password"
                type="password"
                value={form.pppoePassword ?? ''}
                onChange={(e) => setForm({ ...form, pppoePassword: e.target.value })}
              />
            </>
          )}
          {!form.dhcp4 && form.wanMode !== 'pppoe' && (
            <>
              <FormField
                id="iface-ipv4-address"
                label="IPv4 Address"
                value={form.ipv4Address ?? ''}
                onChange={(e) => setForm({ ...form, ipv4Address: e.target.value })}
              />
              <FormField
                id="iface-ipv4-prefix"
                label="Prefix Length"
                type="number"
                min={0}
                max={32}
                value={String(form.ipv4Prefix ?? 24)}
                onChange={(e) => setForm({ ...form, ipv4Prefix: Number(e.target.value) })}
              />
              <FormField
                id="iface-gateway"
                label="Gateway"
                className="col-span-2"
                value={form.gateway ?? ''}
                onChange={(e) => setForm({ ...form, gateway: e.target.value })}
              />
            </>
          )}
          {ipv6Enabled && (
            <>
              <FormField
                id="iface-ipv6-mode"
                label="IPv6 Configuration Type"
                className="col-span-2"
                as="select"
                value={formIpv6Mode}
                onChange={(e) => {
                  const mode = e.target.value as Ipv6Mode
                  setForm({
                    ...form,
                    ipv6Mode: mode,
                    dhcp6: mode === 'dhcp6',
                    acceptRa: mode === 'slaac',
                    trackSourceInterface: mode === 'track_interface' ? (form.trackSourceInterface ?? '') : '',
                    trackPrefixId: mode === 'track_interface' ? form.trackPrefixId : undefined,
                    delegatedPrefixLen: mode === 'track_interface' ? form.delegatedPrefixLen : undefined,
                    raMode: mode === 'track_interface' ? (form.raMode ?? 'unmanaged') : undefined,
                    iaPdHintLen: mode === 'dhcp6' ? form.iaPdHintLen : undefined,
                    ipv6Address: mode === 'static' ? form.ipv6Address : '',
                    ipv6Prefix: mode === 'static' ? (form.ipv6Prefix ?? 64) : 64,
                  })
                }}
              >
                <option value="static">Static</option>
                <option value="dhcp6">DHCPv6</option>
                <option value="slaac">SLAAC (Router Advertisements)</option>
                <option value="track_interface">Track Interface (Prefix Delegation)</option>
              </FormField>
              {formIpv6Mode === 'dhcp6' && (
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
              {formIpv6Mode === 'track_interface' && (
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
                    {resolvedTrackSourceOptions.map((name) => (
                      <option key={name} value={name}>{labelParentInterface(name)}</option>
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
                  <FormField
                    id="iface-ra-mode"
                    label="Router Advertisement Mode"
                    className="col-span-2"
                    as="select"
                    value={form.raMode ?? 'unmanaged'}
                    hint="Select which flags to set in Router Advertisements sent from this interface."
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
              <FormField
                id="iface-ipv6-address"
                label="IPv6 Address"
                value={form.ipv6Address ?? ''}
                disabled={formIpv6Mode !== 'static'}
                onChange={(e) => setForm({ ...form, ipv6Address: e.target.value })}
              />
              <FormField
                id="iface-ipv6-prefix"
                label="IPv6 Prefix Length"
                type="number"
                min={0}
                max={128}
                value={String(form.ipv6Prefix ?? 64)}
                disabled={formIpv6Mode !== 'static'}
                onChange={(e) => setForm({ ...form, ipv6Prefix: Number(e.target.value) })}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
