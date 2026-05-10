import { useState } from 'react'
import type { NetworkInterface } from '../../types'
import { updateInterface } from '../../api/interfaces'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'

interface InterfaceDetailsProps {
  iface: NetworkInterface
  onUpdate?: () => void
}

export default function InterfaceDetails({ iface, onUpdate }: InterfaceDetailsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<NetworkInterface>>({
    name: iface.name,
    description: iface.description,
    type: iface.type,
    enabled: iface.enabled,
    dhcp4: iface.dhcp4,
    wanMode: iface.wanMode,
    pppoeUsername: iface.pppoeUsername,
    pppoePassword: iface.pppoePassword,
    ipv4Address: iface.ipv4Address,
    ipv4Prefix: iface.ipv4Prefix,
    gateway: iface.gateway,
    mtu: iface.mtu,
  })

  const ipv4ConfigurationType = iface.dhcp4
    ? 'DHCP'
    : iface.wanMode === 'pppoe'
      ? 'PPPoE'
      : iface.wanMode === 'dhcp'
        ? 'DHCP WAN'
        : 'Static'

  const handleSave = () => {
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Interface Name</p>
          <p className="mt-1 font-mono text-sm text-gray-900">{iface.name}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">IPv4 Configuration Type</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{ipv4ConfigurationType}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">MTU</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{iface.mtu ?? 'Default'}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">IPv4 Address</p>
          <p className="mt-1 font-mono text-sm text-gray-900">
            {iface.ipv4Address ? `${iface.ipv4Address}/${iface.ipv4Prefix ?? '—'}` : '—'}
          </p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Gateway</p>
          <p className="mt-1 font-mono text-sm text-gray-900">{iface.gateway ?? '—'}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Description</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{iface.description || '—'}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
          Edit Interface Settings
        </Button>
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
        </div>
      </Modal>
    </div>
  )
}
