import { useState } from 'react'
import type { NetworkInterface, DhcpConfigPerInterface, DhcpStaticLease } from '../../types'
import { getInterfaceDhcpConfig, updateInterfaceDhcpConfig, getInterfaceStaticLeases, createInterfaceStaticLease, deleteInterfaceStaticLease } from '../../api/dhcp'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'

interface InterfaceDetailsProps {
  iface: NetworkInterface
  onUpdate?: () => void
  initialSection?: 'dhcp' | 'leases' | null
}

export default function InterfaceDetails({ iface, onUpdate, initialSection = null }: InterfaceDetailsProps) {
  const [expandedSection, setExpandedSection] = useState<'dhcp' | 'leases' | null>(initialSection)

  // DHCP state
  const [dhcpConfig, setDhcpConfig] = useState<DhcpConfigPerInterface | null>(null)
  const [dhcpLoading, setDhcpLoading] = useState(false)
  const [dhcpEditing, setDhcpEditing] = useState(false)
  const [dhcpForm, setDhcpForm] = useState<Partial<DhcpConfigPerInterface>>({})
  const [dhcpSaving, setDhcpSaving] = useState(false)

  // Static leases state
  const [staticLeases, setStaticLeases] = useState<DhcpStaticLease[]>([])
  const [leasesLoading, setLeasesLoading] = useState(false)
  const [leaseModalOpen, setLeaseModalOpen] = useState(false)
  const [leaseForm, setLeaseForm] = useState<Partial<DhcpStaticLease>>({})
  const [leaseSaving, setLeaseSaving] = useState(false)
  const [deleteLeaseId, setDeleteLeaseId] = useState<string | null>(null)
  const [deleteLeaseLoading, setDeleteLeaseLoading] = useState(false)

  // Load DHCP configuration
  const loadDhcp = () => {
    setDhcpLoading(true)
    getInterfaceDhcpConfig(iface.name)
      .then((res) => {
        setDhcpConfig(res.data)
        setDhcpForm(res.data)
      })
      .catch((err) => console.error('Failed to load DHCP config:', err))
      .finally(() => setDhcpLoading(false))
  }

  // Load static leases for this interface
  const loadLeases = () => {
    setLeasesLoading(true)
    getInterfaceStaticLeases(iface.name)
      .then((res) => setStaticLeases(res.data))
      .catch((err) => console.error('Failed to load static leases:', err))
      .finally(() => setLeasesLoading(false))
  }

  const handleExpandSection = (section: 'dhcp' | 'leases') => {
    if (expandedSection === section) {
      setExpandedSection(null)
    } else {
      setExpandedSection(section)
      if (section === 'dhcp') loadDhcp()
      else loadLeases()
    }
  }

  const handleSaveDhcp = () => {
    setDhcpSaving(true)
    updateInterfaceDhcpConfig(iface.name, dhcpForm)
      .then(() => {
        setDhcpEditing(false)
        loadDhcp()
        onUpdate?.()
      })
      .catch((err) => console.error('Failed to save DHCP config:', err))
      .finally(() => setDhcpSaving(false))
  }

  const handleCreateLease = () => {
    if (!leaseForm.mac || !leaseForm.ipAddress) return
    setLeaseSaving(true)
    createInterfaceStaticLease(iface.name, leaseForm as Omit<DhcpStaticLease, 'id'>)
      .then(() => {
        setLeaseModalOpen(false)
        setLeaseForm({})
        loadLeases()
        onUpdate?.()
      })
      .catch((err) => console.error('Failed to create lease:', err))
      .finally(() => setLeaseSaving(false))
  }

  const handleDeleteLease = () => {
    if (!deleteLeaseId) return
    setDeleteLeaseLoading(true)
    deleteInterfaceStaticLease(iface.name, deleteLeaseId)
      .then(() => {
        setDeleteLeaseId(null)
        loadLeases()
        onUpdate?.()
      })
      .catch((err) => console.error('Failed to delete lease:', err))
      .finally(() => setDeleteLeaseLoading(false))
  }

  return (
    <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
      {/* DHCP Section */}
      <div className="border-b border-gray-200 pb-3">
          <button
            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded transition-colors"
            onClick={() => handleExpandSection('dhcp')}
          >
            <span className="font-semibold text-gray-800">
              DHCP Configuration
            </span>
            <span className={`text-gray-500 transition-transform ${
              expandedSection === 'dhcp' ? 'rotate-180' : ''
            }`}>
              ▼
            </span>
          </button>

          {expandedSection === 'dhcp' && (
            <div className="mt-3 space-y-3 pl-2">
              {dhcpLoading ? (
                <p className="text-sm text-gray-500">Loading DHCP configuration...</p>
              ) : dhcpEditing ? (
                <div className="space-y-3 bg-white p-3 rounded border border-gray-200">
                  <FormField
                    id="dhcp-subnet"
                    label="Subnet (CIDR)"
                    placeholder="192.168.1.0/24"
                    value={dhcpForm.subnet ?? ''}
                    onChange={(e) => setDhcpForm({ ...dhcpForm, subnet: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      id="dhcp-range-start"
                      label="Range Start"
                      placeholder="192.168.1.100"
                      value={dhcpForm.rangeStart ?? ''}
                      onChange={(e) => setDhcpForm({ ...dhcpForm, rangeStart: e.target.value })}
                    />
                    <FormField
                      id="dhcp-range-end"
                      label="Range End"
                      placeholder="192.168.1.200"
                      value={dhcpForm.rangeEnd ?? ''}
                      onChange={(e) => setDhcpForm({ ...dhcpForm, rangeEnd: e.target.value })}
                    />
                  </div>
                  <FormField
                    id="dhcp-gateway"
                    label="Gateway"
                    placeholder="192.168.1.1"
                    value={dhcpForm.gateway ?? ''}
                    onChange={(e) => setDhcpForm({ ...dhcpForm, gateway: e.target.value })}
                  />
                  <FormField
                    id="dhcp-dns"
                    label="DNS Servers (comma-separated)"
                    placeholder="8.8.8.8, 8.8.4.4"
                    value={dhcpForm.dnsServers?.join(', ') ?? ''}
                    onChange={(e) =>
                      setDhcpForm({
                        ...dhcpForm,
                        dnsServers: e.target.value.split(',').map(s => s.trim()),
                      })
                    }
                  />
                  <FormField
                    id="dhcp-lease-time"
                    label="Lease Time (seconds)"
                    type="number"
                    value={String(dhcpForm.leaseTime ?? 86400)}
                    onChange={(e) => setDhcpForm({ ...dhcpForm, leaseTime: Number(e.target.value) })}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDhcpEditing(false)
                        setDhcpForm(dhcpConfig || {})
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveDhcp}
                      loading={dhcpSaving}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-3 rounded border border-gray-200 space-y-2 text-sm">
                  <p><span className="font-medium">Subnet:</span> {dhcpConfig?.subnet}</p>
                  <p><span className="font-medium">Range:</span> {dhcpConfig?.rangeStart} — {dhcpConfig?.rangeEnd}</p>
                  <p><span className="font-medium">Gateway:</span> {dhcpConfig?.gateway}</p>
                  <p><span className="font-medium">DNS Servers:</span> {dhcpConfig?.dnsServers?.join(', ') || '—'}</p>
                  <p><span className="font-medium">Lease Time:</span> {dhcpConfig?.leaseTime} seconds</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => setDhcpEditing(true)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Static Leases Section */}
      <div className="border-b border-gray-200 pb-3">
          <button
            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded transition-colors"
            onClick={() => handleExpandSection('leases')}
          >
            <span className="font-semibold text-gray-800">
              Static DHCP Leases ({staticLeases.length})
            </span>
            <span className={`text-gray-500 transition-transform ${
              expandedSection === 'leases' ? 'rotate-180' : ''
            }`}>
              ▼
            </span>
          </button>

          {expandedSection === 'leases' && (
            <div className="mt-3 space-y-3 pl-2">
              {leasesLoading ? (
                <p className="text-sm text-gray-500">Loading static leases...</p>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => setLeaseModalOpen(true)}
                  >
                    + Add Lease
                  </Button>
                  {staticLeases.length > 0 ? (
                    <div className="space-y-2">
                      {staticLeases.map((lease) => (
                        <div
                          key={lease.id}
                          className="bg-white p-3 rounded border border-gray-200 flex items-center justify-between"
                        >
                          <div className="flex-1 text-sm">
                            <div className="font-medium text-gray-800">
                              {lease.hostname || '(no hostname)'}
                            </div>
                            <p className="text-gray-600 text-xs">
                              {lease.mac} → {lease.ipAddress}
                            </p>
                            {lease.description && (
                              <p className="text-gray-500 text-xs mt-1">{lease.description}</p>
                            )}
                          </div>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeleteLeaseId(lease.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No static leases configured for this interface.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      

      {/* Add Static Lease Modal */}
      <Modal
        open={leaseModalOpen}
        title={`Add Static Lease for ${iface.description || iface.name}`}
        onClose={() => {
          setLeaseModalOpen(false)
          setLeaseForm({})
        }}
        onConfirm={handleCreateLease}
        confirmLabel="Create"
        loading={leaseSaving}
        size="lg"
      >
        <div className="space-y-4">
          <FormField
            id="lease-hostname"
            label="Hostname"
            placeholder="e.g., printer.local"
            value={leaseForm.hostname ?? ''}
            onChange={(e) => setLeaseForm({ ...leaseForm, hostname: e.target.value || undefined })}
          />
          <FormField
            id="lease-mac"
            label="MAC Address"
            placeholder="aa:bb:cc:dd:ee:ff"
            value={leaseForm.mac ?? ''}
            onChange={(e) => setLeaseForm({ ...leaseForm, mac: e.target.value })}
            required
          />
          <FormField
            id="lease-ip"
            label="IP Address"
            placeholder="192.168.1.100"
            value={leaseForm.ipAddress ?? ''}
            onChange={(e) => setLeaseForm({ ...leaseForm, ipAddress: e.target.value })}
            required
          />
          <FormField
            id="lease-description"
            label="Description"
            placeholder="e.g., Office Printer"
            value={leaseForm.description ?? ''}
            onChange={(e) => setLeaseForm({ ...leaseForm, description: e.target.value || undefined })}
          />
        </div>
      </Modal>

      {/* Delete Lease Confirmation */}
      <Modal
        open={deleteLeaseId !== null}
        title="Delete Static Lease"
        onClose={() => setDeleteLeaseId(null)}
        onConfirm={handleDeleteLease}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLeaseLoading}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this static lease? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
