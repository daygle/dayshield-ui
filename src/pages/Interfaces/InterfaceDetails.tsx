import { useState } from 'react'
import type { NetworkInterface, DhcpConfigPerInterface, FirewallRule, DhcpStaticLease } from '../../types'
import { getInterfaceDhcpConfig, updateInterfaceDhcpConfig, getInterfaceStaticLeases, createInterfaceStaticLease, deleteInterfaceStaticLease } from '../../api/dhcp'
import {
  getInterfaceFirewallRules,
  createInterfaceFirewallRule,
  deleteInterfaceFirewallRule,
} from '../../api/firewall'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Modal from '../../components/Modal'

interface InterfaceDetailsProps {
  iface: NetworkInterface
  onUpdate?: () => void
  initialSection?: 'dhcp' | 'leases' | 'firewall' | null
}

export default function InterfaceDetails({ iface, onUpdate, initialSection = null }: InterfaceDetailsProps) {
  const [expandedSection, setExpandedSection] = useState<'dhcp' | 'leases' | 'firewall' | null>(initialSection)

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

  // Firewall rules state
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState<Partial<FirewallRule>>({})
  const [ruleSaving, setRuleSaving] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [deleteRuleLoading, setDeleteRuleLoading] = useState(false)

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

  // Load firewall rules for this interface
  const loadRules = () => {
    setRulesLoading(true)
    getInterfaceFirewallRules(iface.name)
      .then((res) => setRules(res.data))
      .catch((err) => console.error('Failed to load rules:', err))
      .finally(() => setRulesLoading(false))
  }

  const handleExpandSection = (section: 'dhcp' | 'leases' | 'firewall') => {
    if (expandedSection === section) {
      setExpandedSection(null)
    } else {
      setExpandedSection(section)
      if (section === 'dhcp') loadDhcp()
      else if (section === 'leases') loadLeases()
      else loadRules()
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

  const handleCreateRule = () => {
    if (!ruleForm.action) return
    setRuleSaving(true)
    createInterfaceFirewallRule(iface.name, ruleForm as Omit<FirewallRule, 'id' | 'interface'>)
      .then(() => {
        setRuleModalOpen(false)
        setRuleForm({})
        loadRules()
        onUpdate?.()
      })
      .catch((err) => console.error('Failed to create rule:', err))
      .finally(() => setRuleSaving(false))
  }

  const handleDeleteRule = () => {
    if (!deleteRuleId) return
    setDeleteRuleLoading(true)
    deleteInterfaceFirewallRule(iface.name, deleteRuleId)
      .then(() => {
        setDeleteRuleId(null)
        loadRules()
        onUpdate?.()
      })
      .catch((err) => console.error('Failed to delete rule:', err))
      .finally(() => setDeleteRuleLoading(false))
  }

  return (
    <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
      {/* DHCP Section */}
      {iface.dhcp4 && (
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
      )}

      {/* Static Leases Section */}
      {iface.dhcp4 && (
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
      )}

      {/* Firewall Rules Section */}
      <div>
        <button
          className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded transition-colors"
          onClick={() => handleExpandSection('firewall')}
        >
          <span className="font-semibold text-gray-800">
            Firewall Rules ({rules.length})
          </span>
          <span className={`text-gray-500 transition-transform ${
            expandedSection === 'firewall' ? 'rotate-180' : ''
          }`}>
            ▼
          </span>
        </button>

        {expandedSection === 'firewall' && (
          <div className="mt-3 space-y-3 pl-2">
            {rulesLoading ? (
              <p className="text-sm text-gray-500">Loading firewall rules...</p>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => setRuleModalOpen(true)}
                >
                  + Add Rule
                </Button>
                {rules.length > 0 ? (
                  <div className="space-y-2">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="bg-white p-3 rounded border border-gray-200 flex items-center justify-between"
                      >
                        <div className="flex-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Priority {rule.priority}</span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                rule.action === 'accept'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {rule.action}
                            </span>
                            {!rule.enabled && (
                              <span className="text-gray-400">○ Disabled</span>
                            )}
                          </div>
                          <p className="text-gray-600">
                            {rule.description || '(no description)'}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            {rule.source || 'any'} → {rule.destination || 'any'}
                            {rule.protocol && ` (${rule.protocol})`}
                          </p>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteRuleId(rule.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No firewall rules configured for this interface.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Firewall Rule Modal */}
      <Modal
        open={ruleModalOpen}
        title={`Add Firewall Rule for ${iface.description || iface.name}`}
        onClose={() => {
          setRuleModalOpen(false)
          setRuleForm({})
        }}
        onConfirm={handleCreateRule}
        confirmLabel="Create"
        loading={ruleSaving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4 space-y-4">
          <FormField
            id="rule-priority"
            label="Priority"
            type="number"
            value={String(ruleForm.priority ?? 0)}
            onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })}
          />
          <FormField
            id="rule-action"
            label="Action"
            as="select"
            value={ruleForm.action ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value as any })}
            required
          >
            <option value="">— Select action —</option>
            <option value="accept">Accept</option>
            <option value="drop">Drop</option>
            <option value="reject">Reject</option>
          </FormField>
          <FormField
            id="rule-description"
            label="Description"
            placeholder="e.g., Allow HTTP traffic"
            value={ruleForm.description ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
            className="col-span-2"
          />
          <FormField
            id="rule-source"
            label="Source"
            placeholder="192.168.0.0/24 or leave empty"
            value={ruleForm.source ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value || undefined })}
          />
          <FormField
            id="rule-destination"
            label="Destination"
            placeholder="192.168.1.0/24 or leave empty"
            value={ruleForm.destination ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, destination: e.target.value || undefined })}
          />
          <FormField
            id="rule-protocol"
            label="Protocol"
            as="select"
            value={ruleForm.protocol ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, protocol: (e.target.value || undefined) as any })}
          >
            <option value="">Any</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
          </FormField>
          <FormField
            id="rule-dport"
            label="Destination Port"
            type="number"
            placeholder="e.g. 80"
            value={String(ruleForm.destination_port ?? '')}
            onChange={(e) =>
              setRuleForm({
                ...ruleForm,
                destination_port: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="rule-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              checked={ruleForm.enabled ?? true}
              onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
            />
            <label htmlFor="rule-enabled" className="text-sm font-medium text-gray-700">
              Enabled
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Rule Confirmation */}
      <Modal
        open={deleteRuleId !== null}
        title="Delete Firewall Rule"
        onClose={() => setDeleteRuleId(null)}
        onConfirm={handleDeleteRule}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteRuleLoading}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this firewall rule? This action cannot be undone.
        </p>
      </Modal>

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
