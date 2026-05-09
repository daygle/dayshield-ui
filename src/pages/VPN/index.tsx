import { useEffect, useState } from 'react'
import {
  getWgServer,
  getWgPeers,
  createWgPeer,
  deleteWgPeer,
} from '../../api/wireguard'
import {
  getWireGuardFirewallRules,
  createWireGuardFirewallRule,
  deleteWireGuardFirewallRule,
} from '../../api/firewall'
import type { WgServer, WgPeer, FirewallRule } from '../../types'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type PeerRow = WgPeer & Record<string, unknown>

const defaultPeerForm = {
  name: '',
  publicKey: '',
  presharedKey: '',
  allowedIPs: '',
  endpoint: '',
  persistentKeepalive: 25,
  enabled: true,
}

const defaultRuleForm = {
  priority: 0,
  action: 'accept' as const,
  description: '',
  source: '',
  destination: '',
  protocol: 'any' as const,
  destination_port: undefined as number | undefined,
  enabled: true,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function VPN() {
  const [server, setServer] = useState<WgServer | null>(null)
  const [peers, setPeers] = useState<PeerRow[]>([])
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<'config' | 'peers' | 'firewall' | null>(null)

  const [peerModalOpen, setPeerModalOpen] = useState(false)
  const [peerForm, setPeerForm] = useState(defaultPeerForm)
  const [peerSaving, setPeerSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState<Partial<FirewallRule>>(defaultRuleForm)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [deleteRuleLoading, setDeleteRuleLoading] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getWgServer(), getWgPeers()])
      .then(([srv, prs]) => {
        setServer(srv.data)
        setPeers(prs.data as PeerRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const loadRules = () => {
    if (!server) return
    getWireGuardFirewallRules(server.interface)
      .then((res) => setRules(res.data))
      .catch((err) => console.error('Failed to load firewall rules:', err))
  }

  useEffect(loadAll, [])

  const handleExpandSection = (section: 'config' | 'peers' | 'firewall') => {
    if (expandedSection === section) {
      setExpandedSection(null)
    } else {
      setExpandedSection(section)
      if (section === 'firewall') loadRules()
    }
  }

  const handleAddPeer = () => {
    setPeerSaving(true)
    createWgPeer({
      name: peerForm.name,
      publicKey: peerForm.publicKey,
      presharedKey: peerForm.presharedKey || undefined,
      allowedIPs: peerForm.allowedIPs.split(',').map((s) => s.trim()).filter(Boolean),
      endpoint: peerForm.endpoint || undefined,
      persistentKeepalive: peerForm.persistentKeepalive,
      enabled: peerForm.enabled,
    })
      .then(() => {
        setPeerModalOpen(false)
        setPeerForm(defaultPeerForm)
        loadAll()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPeerSaving(false))
  }

  const handleDeletePeer = () => {
    if (deleteId === null) return
    setDeleting(true)
    deleteWgPeer(deleteId)
      .then(() => {
        setDeleteId(null)
        loadAll()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false))
  }

  const handleCreateRule = () => {
    if (!server || !ruleForm.action) return
    setRuleSaving(true)
    createWireGuardFirewallRule(server.interface, ruleForm as Omit<FirewallRule, 'id' | 'interface'>)
      .then(() => {
        setRuleModalOpen(false)
        setRuleForm(defaultRuleForm)
        loadRules()
      })
      .catch((err) => console.error('Failed to create rule:', err))
      .finally(() => setRuleSaving(false))
  }

  const handleDeleteRule = () => {
    if (!server || !deleteRuleId) return
    setDeleteRuleLoading(true)
    deleteWireGuardFirewallRule(server.interface, deleteRuleId)
      .then(() => {
        setDeleteRuleId(null)
        loadRules()
      })
      .catch((err) => console.error('Failed to delete rule:', err))
      .finally(() => setDeleteRuleLoading(false))
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading VPN configuration...</div>
  }

  if (!server) {
    return <div className="text-center py-8 text-gray-500">No WireGuard server configured.</div>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* WireGuard Server Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">{server.interface} - WireGuard VPN</h3>
              <p className="text-sm text-gray-500">Port {server.listenPort} • {server.addresses.join(', ')}</p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
            server.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            <span className={`h-2 w-2 rounded-full ${server.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            {server.enabled ? 'Running' : 'Stopped'}
          </div>
        </div>

        {/* Sections */}
        <div className="divide-y">
          {/* Server Configuration Section */}
          <div>
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              onClick={() => handleExpandSection('config')}
            >
              <span className="font-medium text-gray-800">Server Configuration</span>
              <span className={`text-gray-500 transition-transform ${
                expandedSection === 'config' ? 'rotate-180' : ''
              }`}>
                ▼
              </span>
            </button>
            {expandedSection === 'config' && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                  <div>
                    <dt className="text-gray-500 mb-1">Interface</dt>
                    <dd className="font-mono text-gray-900">{server.interface}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 mb-1">Port</dt>
                    <dd className="font-mono text-gray-900">{server.listenPort}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 mb-1">Addresses</dt>
                    <dd className="font-mono text-gray-900">{server.addresses.join(', ')}</dd>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <dt className="text-gray-500 mb-1">Public Key</dt>
                    <dd className="font-mono text-xs text-gray-900 break-all p-2 bg-white rounded border border-gray-200">
                      {server.publicKey}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {/* Peers Section */}
          <div>
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              onClick={() => handleExpandSection('peers')}
            >
              <span className="font-medium text-gray-800">
                Peers ({peers.length})
              </span>
              <span className={`text-gray-500 transition-transform ${
                expandedSection === 'peers' ? 'rotate-180' : ''
              }`}>
                ▼
              </span>
            </button>
            {expandedSection === 'peers' && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="text-2xl font-bold text-gray-900">{peers.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Active</p>
                      <p className="text-2xl font-bold text-green-600">{peers.filter((p) => p.enabled).length}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">RX / TX</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatBytes(peers.reduce((s, p) => s + ((p.transferRx as number) || 0), 0))} /{' '}
                        {formatBytes(peers.reduce((s, p) => s + ((p.transferTx as number) || 0), 0))}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setPeerModalOpen(true)}>
                    + Add Peer
                  </Button>
                </div>

                {peers.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {peers.map((peer) => (
                      <div
                        key={peer.id}
                        className="bg-white p-3 rounded border border-gray-200 flex items-start justify-between"
                      >
                        <div className="flex-1 text-sm">
                          <div className="font-medium text-gray-800">
                            {peer.name}
                            {!peer.enabled && <span className="text-gray-400 ml-2">○ Disabled</span>}
                          </div>
                          <p className="text-gray-600 text-xs font-mono mt-1">
                            {peer.publicKey?.slice(0, 24)}…
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            IPs: {(peer.allowedIPs as string[]).join(', ')}
                          </p>
                          {peer.endpoint && (
                            <p className="text-gray-500 text-xs">
                              Endpoint: {peer.endpoint}
                            </p>
                          )}
                          {peer.lastHandshake && (
                            <p className="text-gray-500 text-xs">
                              Handshake: {new Date(peer.lastHandshake as string).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteId(peer.id as number)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No peers configured.</p>
                )}
              </div>
            )}
          </div>

          {/* Firewall Rules Section */}
          <div>
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              onClick={() => handleExpandSection('firewall')}
            >
              <span className="font-medium text-gray-800">
                Firewall Rules ({rules.length})
              </span>
              <span className={`text-gray-500 transition-transform ${
                expandedSection === 'firewall' ? 'rotate-180' : ''
              }`}>
                ▼
              </span>
            </button>
            {expandedSection === 'firewall' && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 space-y-4">
                <Button size="sm" onClick={() => setRuleModalOpen(true)}>
                  + Add Rule
                </Button>

                {rules.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="bg-white p-3 rounded border border-gray-200 flex items-start justify-between"
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
                            {!rule.enabled && <span className="text-gray-400">○ Disabled</span>}
                          </div>
                          <p className="text-gray-600 mt-1">{rule.description || '(no description)'}</p>
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Peer Modal */}
      <Modal
        open={peerModalOpen}
        title="Add WireGuard Peer"
        onClose={() => {
          setPeerModalOpen(false)
          setPeerForm(defaultPeerForm)
        }}
        onConfirm={handleAddPeer}
        confirmLabel="Add Peer"
        loading={peerSaving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4 space-y-4">
          <FormField
            id="peer-name"
            label="Name"
            required
            placeholder="My Laptop"
            className="col-span-2"
            value={peerForm.name}
            onChange={(e) => setPeerForm({ ...peerForm, name: e.target.value })}
          />
          <FormField
            id="peer-pubkey"
            label="Public Key"
            required
            placeholder="Base64 encoded public key"
            className="col-span-2"
            value={peerForm.publicKey}
            onChange={(e) => setPeerForm({ ...peerForm, publicKey: e.target.value })}
          />
          <FormField
            id="peer-psk"
            label="Pre-shared Key"
            placeholder="Optional"
            className="col-span-2"
            value={peerForm.presharedKey}
            onChange={(e) => setPeerForm({ ...peerForm, presharedKey: e.target.value })}
          />
          <FormField
            id="peer-ips"
            label="Allowed IPs"
            required
            placeholder="10.0.0.2/32, 192.168.1.0/24"
            className="col-span-2"
            value={peerForm.allowedIPs}
            onChange={(e) => setPeerForm({ ...peerForm, allowedIPs: e.target.value })}
          />
          <FormField
            id="peer-endpoint"
            label="Endpoint"
            placeholder="1.2.3.4:51820"
            value={peerForm.endpoint}
            onChange={(e) => setPeerForm({ ...peerForm, endpoint: e.target.value })}
          />
          <FormField
            id="peer-keepalive"
            label="Persistent Keepalive (s)"
            type="number"
            min={0}
            value={String(peerForm.persistentKeepalive)}
            onChange={(e) => setPeerForm({ ...peerForm, persistentKeepalive: Number(e.target.value) })}
          />
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="peer-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              checked={peerForm.enabled}
              onChange={(e) => setPeerForm({ ...peerForm, enabled: e.target.checked })}
            />
            <label htmlFor="peer-enabled" className="text-sm font-medium text-gray-700">
              Enabled
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Peer Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete Peer"
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeletePeer}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">Remove this WireGuard peer?</p>
      </Modal>

      {/* Add Firewall Rule Modal */}
      <Modal
        open={ruleModalOpen}
        title={`Add Firewall Rule for ${server.interface}`}
        onClose={() => {
          setRuleModalOpen(false)
          setRuleForm(defaultRuleForm)
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
            placeholder="e.g., Allow peer traffic"
            value={ruleForm.description ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
            className="col-span-2"
          />
          <FormField
            id="rule-source"
            label="Source"
            placeholder="10.0.0.0/24 or leave empty"
            value={ruleForm.source ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value || undefined })}
          />
          <FormField
            id="rule-destination"
            label="Destination"
            placeholder="10.0.0.0/24 or leave empty"
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

      {/* Delete Rule Modal */}
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
          Are you sure you want to delete this firewall rule?
        </p>
      </Modal>
    </div>
  )
}

        getWgPeers().then((r) => setPeers(r.data as PeerRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPeerSaving(false))
  }

  const handleDeletePeer = () => {
    if (deleteId === null) return
    setDeleting(true)
    deleteWgPeer(deleteId)
      .then(() => {
        setDeleteId(null)
        getWgPeers().then((r) => setPeers(r.data as PeerRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false))
  }

  const peerColumnsWithActions: Column<PeerRow>[] = [
    ...peerColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button variant="danger" size="sm" onClick={() => setDeleteId(row.id as number)}>
          Delete
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* WireGuard Server Info */}
      {server && (
        <Card title="WireGuard Server">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className={`font-medium ${server.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {server.enabled ? 'Running' : 'Stopped'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Interface</dt>
              <dd className="font-medium text-gray-800">{server.interface}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Listen Port</dt>
              <dd className="font-medium text-gray-800">{server.listenPort}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Addresses</dt>
              <dd className="font-medium text-gray-800">{server.addresses.join(', ')}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">Public Key</dt>
              <dd className="font-mono text-xs text-gray-800 break-all">{server.publicKey}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Traffic totals */}
      {peers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
            <p className="text-sm text-gray-500 mb-1">Total Peers</p>
            <p className="text-2xl font-bold text-gray-900">{peers.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
            <p className="text-sm text-gray-500 mb-1">Active Peers</p>
            <p className="text-2xl font-bold text-green-600">
              {peers.filter((p) => p.enabled).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
            <p className="text-sm text-gray-500 mb-1">Total RX / TX</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatBytes(peers.reduce((s, p) => s + ((p.transferRx as number) || 0), 0))} /{' '}
              {formatBytes(peers.reduce((s, p) => s + ((p.transferTx as number) || 0), 0))}
            </p>
          </div>
        </div>
      )}

      {/* Peers */}
      <Card
        title="Peers"
        subtitle="WireGuard peer configurations"
        actions={
          <Button size="sm" onClick={() => setPeerModalOpen(true)}>
            + Add Peer
          </Button>
        }
      >
        <Table
          columns={peerColumnsWithActions}
          data={peers}
          keyField="id"
          loading={loading}
          emptyMessage="No peers configured."
        />
      </Card>

      {/* Add Peer Modal */}
      <Modal
        open={peerModalOpen}
        title="Add WireGuard Peer"
        onClose={() => setPeerModalOpen(false)}
        onConfirm={handleAddPeer}
        confirmLabel="Add Peer"
        loading={peerSaving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="peer-name"
            label="Name"
            required
            placeholder="My Laptop"
            className="col-span-2"
            value={peerForm.name}
            onChange={(e) => setPeerForm({ ...peerForm, name: e.target.value })}
          />
          <FormField
            id="peer-pubkey"
            label="Public Key"
            required
            placeholder="Base64 encoded public key"
            className="col-span-2"
            value={peerForm.publicKey}
            onChange={(e) => setPeerForm({ ...peerForm, publicKey: e.target.value })}
          />
          <FormField
            id="peer-psk"
            label="Pre-shared Key"
            placeholder="Optional"
            className="col-span-2"
            value={peerForm.presharedKey}
            onChange={(e) => setPeerForm({ ...peerForm, presharedKey: e.target.value })}
          />
          <FormField
            id="peer-ips"
            label="Allowed IPs"
            required
            placeholder="10.0.0.2/32, 192.168.1.0/24"
            className="col-span-2"
            value={peerForm.allowedIPs}
            onChange={(e) => setPeerForm({ ...peerForm, allowedIPs: e.target.value })}
          />
          <FormField
            id="peer-endpoint"
            label="Endpoint"
            placeholder="1.2.3.4:51820"
            value={peerForm.endpoint}
            onChange={(e) => setPeerForm({ ...peerForm, endpoint: e.target.value })}
          />
          <FormField
            id="peer-keepalive"
            label="Persistent Keepalive (s)"
            type="number"
            min={0}
            value={String(peerForm.persistentKeepalive)}
            onChange={(e) => setPeerForm({ ...peerForm, persistentKeepalive: Number(e.target.value) })}
          />
        </div>
      </Modal>

      {/* Delete Peer Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete Peer"
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeletePeer}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">Remove this WireGuard peer?</p>
      </Modal>
    </div>
  )
}

