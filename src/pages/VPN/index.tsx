import { useEffect, useState } from 'react'
import {
  getWgServer,
  getWgPeers,
  createWgPeer,
  deleteWgPeer,
} from '../../api/wireguard'
import type { WgServer, WgPeer } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type PeerRow = WgPeer & Record<string, unknown>

const peerColumns: Column<PeerRow>[] = [
  { key: 'name', header: 'Name' },
  { key: 'publicKey', header: 'Public Key', render: (row) => {
    const key = row.publicKey as string
    return <span className="font-mono text-xs">{key.slice(0, 16)}…</span>
  }},
  { key: 'allowedIPs', header: 'Allowed IPs', render: (row) => (row.allowedIPs as string[]).join(', ') },
  { key: 'endpoint', header: 'Endpoint', render: (row) => (row.endpoint as string) || '—' },
  {
    key: 'enabled',
    header: 'Status',
    render: (row) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        row.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${row.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
        {row.enabled ? 'Active' : 'Disabled'}
      </span>
    ),
  },
  {
    key: 'lastHandshake',
    header: 'Last Handshake',
    render: (row) => row.lastHandshake
      ? new Date(row.lastHandshake as string).toLocaleString()
      : '—',
  },
]

const defaultPeerForm = {
  name: '',
  publicKey: '',
  presharedKey: '',
  allowedIPs: '',
  endpoint: '',
  persistentKeepalive: 25,
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [peerModalOpen, setPeerModalOpen] = useState(false)
  const [peerForm, setPeerForm] = useState(defaultPeerForm)
  const [peerSaving, setPeerSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

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

