import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getInterfacesInventory, createInterface, deleteInterface } from '../../api/interfaces'
import { getSystemConfig } from '../../api/system'
import type { NetworkInterface } from '../../types'
import Card from '../../components/Card'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import InterfaceDetails from './InterfaceDetails'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'

type InterfaceRow = NetworkInterface & Record<string, unknown>

const defaultForm: Partial<NetworkInterface> = {
  name: '',
  description: '',
  type: 'ethernet',
  parentInterface: '',
  vlanId: undefined,
  enabled: true,
  dhcp4: false,
  dhcp6: false,
  wanMode: undefined,
  pppoeUsername: '',
  pppoePassword: '',
  ipv4Address: '',
  ipv4Prefix: 24,
  ipv6Address: '',
  ipv6Prefix: 64,
  mss: undefined,
}

export default function Interfaces() {
  const [searchParams] = useSearchParams()
  const [ifaces, setIfaces] = useState<InterfaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<NetworkInterface>>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [deleteName, setDeleteName] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedInterface, setExpandedInterface] = useState<string | null>(searchParams.get('iface'))
  const [unusedKernelNames, setUnusedKernelNames] = useState<string[]>([])
  const [allInterfaceNames, setAllInterfaceNames] = useState<string[]>([])
  const [configuredVlanNames, setConfiguredVlanNames] = useState<string[]>([])
  const [useCustomName, setUseCustomName] = useState(false)
  const [ipv6Enabled, setIpv6Enabled] = useState(false)

  const requestedInterface = searchParams.get('iface')
  const isInterfaceRowArray = (value: unknown): value is InterfaceRow[] =>
    Array.isArray(value)

  const interfaceNameLabel = (name: string) => {
    const iface = ifaces.find((item) => item.name === name)
    return formatInterfaceDisplayName(iface?.description, name)
  }

  const load = () => {
    setLoading(true)
    getSystemConfig()
      .then((res) => setIpv6Enabled(Boolean(res.data?.ipv6Enabled)))
      .catch(() => setIpv6Enabled(false))
    getInterfacesInventory()
      .then((res) => {
        const rows = isInterfaceRowArray(res.data?.configured) ? res.data.configured : []
        setUnusedKernelNames(Array.isArray(res.data?.unusedKernelNames) ? res.data.unusedKernelNames : [])
        setAllInterfaceNames(Array.isArray(res.data?.names) ? res.data.names : [])
        setConfiguredVlanNames(rows.filter((iface) => iface.type === 'vlan').map((iface) => iface.name))
        setIfaces(rows)
        if (requestedInterface && rows.some((i) => i.name === requestedInterface)) {
          setExpandedInterface(requestedInterface)
        } else if (!expandedInterface && rows.length > 0) {
          setExpandedInterface(rows[0].name)
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [requestedInterface])

  const isVlanForm = form.type === 'vlan'
  const parentInterfaceOptions = allInterfaceNames
    .filter((name) => name !== 'lo' && name !== form.name && !configuredVlanNames.includes(name))

  const selectedInterfaceDetails = ifaces.find((iface) => iface.name === expandedInterface) ?? null

  const handleSave = () => {
    if (!form.name?.trim()) {
      setError('Interface name is required.')
      return
    }
    if (isVlanForm) {
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

    setSaving(true)
    createInterface(form as NetworkInterface)
      .then(() => {
        setModalOpen(false)
        setForm(defaultForm)
        setUseCustomName(false)
        load()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  const handleDelete = () => {
    if (!deleteName) return
    setDeleting(true)
    deleteInterface(deleteName)
      .then(() => {
        setDeleteName(null)
        load()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false))
  }

  return (
    <div className="space-y-4">
      <Card
        title="Network Interfaces"
        subtitle="Manage physical and virtual network interfaces"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
            title="Add interface"
            aria-label="Add interface"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {loading ? (
          <p className="text-gray-500">Loading interfaces...</p>
        ) : ifaces.length === 0 ? (
          <p className="text-gray-500">No interfaces found. Add one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Interfaces</div>
              <div className="space-y-2">
                {ifaces.map((iface) => {
                  const isSelected = expandedInterface === iface.name
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
                              iface.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${iface.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
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
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 shadow-sm transition-colors hover:bg-red-100 text-red-700 hover:text-red-900"
                        onClick={() => setDeleteName(iface.name)}
                        title="Delete interface"
                        aria-label="Delete interface"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      </button>
                    </div>
                  )
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

      {/* Add Interface Modal */}
      <Modal
        open={modalOpen}
        title="Add Interface"
        onClose={() => {
          setModalOpen(false)
          setForm(defaultForm)
          setUseCustomName(false)
          setError(null)
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
              const type = e.target.value as NetworkInterface['type']
              setForm({
                ...defaultForm,
                type,
                name: '',
                enabled: form.enabled ?? true,
                description: form.description ?? '',
              })
              setUseCustomName(false)
            }}
          >
            <option value="ethernet">Ethernet</option>
            <option value="vlan">VLAN</option>
          </FormField>
          <FormField
            id="iface-name"
            label="Interface Name"
            required
            as={(!isVlanForm && !useCustomName) ? 'select' : undefined}
            placeholder={isVlanForm ? 'e.g. eth0.100' : useCustomName ? 'e.g. eth0' : undefined}
            value={form.name ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
              const value = e.target.value
              if (!isVlanForm && value === '__custom__') {
                setUseCustomName(true)
                setForm({ ...form, name: '' })
                return
              }
              setForm({ ...form, name: value })
            }}
          >
            {!isVlanForm && !useCustomName && (
              <>
                <option value="">Select unused NIC</option>
                {unusedKernelNames.map((name) => (
                  <option key={name} value={name}>{interfaceNameLabel(name)}</option>
                ))}
                <option value="__custom__">Custom name...</option>
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
                  <option key={name} value={name}>{interfaceNameLabel(name)}</option>
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
          {!isVlanForm && useCustomName && (
            <div className="col-span-2 -mt-2">
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-700"
                onClick={() => {
                  setUseCustomName(false)
                  setForm({ ...form, name: '' })
                }}
              >
                Choose from unused NIC list instead
              </button>
            </div>
          )}
          <FormField
            id="iface-desc"
            label="Description"
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
                const v = e.target.value as NetworkInterface['wanMode'] | ''
                setForm({ ...form, wanMode: v || undefined, pppoeUsername: '', pppoePassword: '' })
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
          <FormField
            id="iface-ip"
            label="IPv4 Address"
            placeholder="192.168.1.1"
            value={form.ipv4Address ?? ''}
            disabled={form.dhcp4 ?? false}
            onChange={(e) => setForm({ ...form, ipv4Address: e.target.value })}
          />
          <FormField
            id="iface-prefix"
            label="Prefix Length"
            type="number"
            min={0}
            max={32}
            value={String(form.ipv4Prefix ?? 24)}
            disabled={form.dhcp4 ?? false}
            onChange={(e) => setForm({ ...form, ipv4Prefix: Number(e.target.value) })}
          >
            <select
              className="input"
              value={form.ipv4Prefix || ''}
              onChange={(e) => setForm({ ...form, ipv4Prefix: Number(e.target.value) })}
            >
              {[...Array(33).keys()].map((prefix) => (
                <option key={prefix} value={prefix}>{`/${prefix}`}</option>
              ))}
            </select>
          </FormField>
          {ipv6Enabled && (
            <>
              <div className="col-span-2 flex items-center gap-3">
                <input
                  id="iface-dhcp6"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={form.dhcp6 ?? false}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dhcp6: e.target.checked,
                      ipv6Address: e.target.checked ? '' : form.ipv6Address,
                      ipv6Prefix: e.target.checked ? 64 : form.ipv6Prefix,
                    })
                  }
                />
                <label htmlFor="iface-dhcp6" className="text-sm font-medium text-gray-700">
                  Obtain IPv6 address via DHCPv6
                </label>
              </div>
              <FormField
                id="iface-ipv6"
                label="IPv6 Address"
                placeholder="2001:db8::1"
                value={form.ipv6Address ?? ''}
                disabled={form.dhcp6 ?? false}
                onChange={(e) => setForm({ ...form, ipv6Address: e.target.value })}
              />
              <FormField
                id="iface-ipv6-prefix"
                label="IPv6 Prefix Length"
                type="number"
                min={0}
                max={128}
                value={String(form.ipv6Prefix ?? 64)}
                disabled={form.dhcp6 ?? false}
                onChange={(e) => setForm({ ...form, ipv6Prefix: Number(e.target.value) })}
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
    </div>
  )
}
