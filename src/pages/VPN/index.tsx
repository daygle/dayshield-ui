import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getWgServer,
  getWgPeers,
  createWgInterface,
  generateWgKeys,
  createWgPeer,
  deleteWgPeer,
} from '../../api/wireguard'
import type { WgServer, WgPeer } from '../../types'
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

const defaultServerForm = {
  interface: 'wg0',
  listenPort: 51820,
  addresses: '10.8.0.1/24',
  enabled: true,
  publicKey: '',
  privateKey: '',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function VPN() {
  const [server, setServer] = useState<WgServer | null>(null)
  const [peers, setPeers] = useState<PeerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<'config' | 'peers' | null>(null)

  const [peerModalOpen, setPeerModalOpen] = useState(false)
  const [peerForm, setPeerForm] = useState(defaultPeerForm)
  const [peerSaving, setPeerSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [serverModalOpen, setServerModalOpen] = useState(false)
  const [serverSaving, setServerSaving] = useState(false)
  const [serverForm, setServerForm] = useState(defaultServerForm)

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

  useEffect(loadAll, [])

  const handleExpandSection = (section: 'config' | 'peers') => {
    if (expandedSection === section) {
      setExpandedSection(null)
    } else {
      setExpandedSection(section)
    }
  }

  const openServerModal = () => {
    setServerForm({
      interface: server?.interface || defaultServerForm.interface,
      listenPort: server?.listenPort || defaultServerForm.listenPort,
      addresses: server?.addresses?.join(', ') || defaultServerForm.addresses,
      enabled: server?.enabled ?? true,
      publicKey: server?.publicKey || '',
      privateKey: '',
    })
    setServerModalOpen(true)
  }

  const handleGenerateServerKeys = () => {
    const name = serverForm.interface.trim() || defaultServerForm.interface
    generateWgKeys(name)
      .then((res) => {
        setServerForm((current) => ({
          ...current,
          privateKey: res.data.private_key,
          publicKey: res.data.public_key,
        }))
      })
      .catch((err: Error) => setError(err.message))
  }

  const handleSaveServer = () => {
    setServerSaving(true)
    createWgInterface({
      interface: serverForm.interface.trim(),
      publicKey: serverForm.publicKey.trim(),
      privateKey: serverForm.privateKey.trim(),
      listenPort: Number(serverForm.listenPort) || defaultServerForm.listenPort,
      addresses: serverForm.addresses.split(',').map((s) => s.trim()).filter(Boolean),
      peers: server?.peers ?? [],
      enabled: serverForm.enabled,
    })
      .then(() => {
        setServerModalOpen(false)
        loadAll()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setServerSaving(false))
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

  const listenPortLabel = useMemo(() => {
    if (!server) return 'Not configured'
    return server.listenPort > 0 ? String(server.listenPort) : 'Not configured'
  }, [server])

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading VPN configuration...</div>
  }

  if (!server || !server.interface) {
    return (
      <div className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 text-center space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">No WireGuard server configured</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create the VPN interface first, then add peers and export client settings.
            </p>
          </div>
          <Button onClick={openServerModal}>Create VPN Server</Button>
        </div>

        <Modal
          open={serverModalOpen}
          title="Create WireGuard Server"
          onClose={() => setServerModalOpen(false)}
          onConfirm={handleSaveServer}
          confirmLabel="Create Server"
          loading={serverSaving}
          size="lg"
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="server-interface"
              label="Interface"
              required
              value={serverForm.interface}
              onChange={(e) => setServerForm({ ...serverForm, interface: e.target.value })}
            />
            <FormField
              id="server-port"
              label="Listen Port"
              type="number"
              min={1}
              max={65535}
              value={String(serverForm.listenPort)}
              onChange={(e) => setServerForm({ ...serverForm, listenPort: Number(e.target.value) || 51820 })}
            />
            <FormField
              id="server-addresses"
              label="Tunnel Addresses"
              className="col-span-2"
              placeholder="10.8.0.1/24, fd10:8::1/64"
              value={serverForm.addresses}
              onChange={(e) => setServerForm({ ...serverForm, addresses: e.target.value })}
            />
            <FormField
              id="server-public-key"
              label="Public Key"
              className="col-span-2"
              placeholder="Generate or paste a base64 public key"
              value={serverForm.publicKey}
              onChange={(e) => setServerForm({ ...serverForm, publicKey: e.target.value })}
            />
            <FormField
              id="server-private-key"
              label="Private Key"
              className="col-span-2"
              placeholder="Generate a keypair to populate this"
              value={serverForm.privateKey}
              onChange={(e) => setServerForm({ ...serverForm, privateKey: e.target.value })}
            />
            <div className="col-span-2 flex items-center gap-3">
              <input
                id="server-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={serverForm.enabled}
                onChange={(e) => setServerForm({ ...serverForm, enabled: e.target.checked })}
              />
              <label htmlFor="server-enabled" className="text-sm font-medium text-gray-700">
                Enabled
              </label>
            </div>
            <div className="col-span-2 flex justify-between items-center gap-3">
              <Button variant="secondary" size="sm" onClick={handleGenerateServerKeys}>
                Generate Keys
              </Button>
              <p className="text-xs text-gray-500">Generate a new keypair before creating the server.</p>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-center justify-between gap-3">
        <span>
          VPN firewall rules are managed from Firewall Rules.
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={openServerModal}>
            Server Settings
          </Button>
          <Link
            to={`/firewall?section=rules&iface=${encodeURIComponent(server.interface)}`}
            className="font-medium underline hover:text-blue-900"
          >
            Open Firewall Rules
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">WireGuard VPN</h3>
            <p className="text-sm text-gray-500 mt-1">Interface {server.interface}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              server.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              <span className={`h-2 w-2 rounded-full ${server.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              {server.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              UDP {listenPortLabel}
            </span>
          </div>
        </div>

        <div className="divide-y">
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
                    <dt className="text-gray-500 mb-1">Listen Port</dt>
                    <dd className="font-mono text-gray-900">{listenPortLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 mb-1">Peer Count</dt>
                    <dd className="text-gray-900">{peers.length}</dd>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <dt className="text-gray-500 mb-1">Tunnel Addresses</dt>
                    <dd className="font-mono text-gray-900">
                      {server.addresses.length ? server.addresses.join(', ') : 'None configured'}
                    </dd>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <dt className="text-gray-500 mb-1">Public Key</dt>
                    <dd className="font-mono text-xs text-gray-900 break-all p-2 bg-white rounded border border-gray-200">
                      {server.publicKey || 'Not available'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          <div>
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              onClick={() => handleExpandSection('peers')}
            >
              <span className="font-medium text-gray-800">Peers ({peers.length})</span>
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
                            <p className="text-gray-500 text-xs">Endpoint: {peer.endpoint}</p>
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
        </div>
      </div>

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

      <Modal
        open={serverModalOpen}
        title={server?.interface ? `Server Settings — ${server.interface}` : 'Create WireGuard Server'}
        onClose={() => setServerModalOpen(false)}
        onConfirm={handleSaveServer}
        confirmLabel={server?.interface ? 'Save Server' : 'Create Server'}
        loading={serverSaving}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="server-interface"
            label="Interface"
            required
            value={serverForm.interface}
            onChange={(e) => setServerForm({ ...serverForm, interface: e.target.value })}
          />
          <FormField
            id="server-port"
            label="Listen Port"
            type="number"
            min={1}
            max={65535}
            value={String(serverForm.listenPort)}
            onChange={(e) => setServerForm({ ...serverForm, listenPort: Number(e.target.value) || 51820 })}
          />
          <FormField
            id="server-addresses"
            label="Tunnel Addresses"
            className="col-span-2"
            placeholder="10.8.0.1/24, fd10:8::1/64"
            value={serverForm.addresses}
            onChange={(e) => setServerForm({ ...serverForm, addresses: e.target.value })}
          />
          <FormField
            id="server-public-key"
            label="Public Key"
            className="col-span-2"
            placeholder="Generate or paste a base64 public key"
            value={serverForm.publicKey}
            onChange={(e) => setServerForm({ ...serverForm, publicKey: e.target.value })}
          />
          <FormField
            id="server-private-key"
            label="Private Key"
            className="col-span-2"
            placeholder="Generate a keypair to populate this"
            value={serverForm.privateKey}
            onChange={(e) => setServerForm({ ...serverForm, privateKey: e.target.value })}
          />
          <div className="col-span-2 flex items-center gap-3">
            <input
              id="server-enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              checked={serverForm.enabled}
              onChange={(e) => setServerForm({ ...serverForm, enabled: e.target.checked })}
            />
            <label htmlFor="server-enabled" className="text-sm font-medium text-gray-700">
              Enabled
            </label>
          </div>
          <div className="col-span-2 flex justify-between items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleGenerateServerKeys}>
              Generate Keys
            </Button>
            <p className="text-xs text-gray-500">Generate a new keypair before creating the server.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
