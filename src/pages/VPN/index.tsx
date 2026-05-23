import { useEffect, useMemo, useState } from 'react';
import {
  getWgServer,
  getWgPeers,
  createWgInterface,
  generateWgKeys,
  createWgPeer,
  deleteWgPeer,
} from '../../api/wireguard';
import type { WgServer, WgPeer } from '../../types';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import AddressPrefixField from '../../components/AddressPrefixField';
import { ServiceControlCluster } from '../../components/ServiceControlButtons';


type PeerRow = WgPeer & Record<string, unknown>;

const defaultPeerForm = {
  name: '',
  publicKey: '',
  presharedKey: '',
  allowedIPs: '',
  endpoint: '',
  persistentKeepalive: 25,
  enabled: true,
};

const defaultServerForm = {
  interface: 'wg0',
  description: '',
  listenPort: 51820,
  addresses: '10.8.0.1/24',
  mtu: '',
  enabled: true,
  publicKey: '',
  privateKey: '',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function VPN() {
  const [server, setServer] = useState<WgServer | null>(null);
  const [peers, setPeers] = useState<PeerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [peerModalOpen, setPeerModalOpen] = useState(false);
  const [peerForm, setPeerForm] = useState(defaultPeerForm);
  const [peerSaving, setPeerSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [serverSaving, setServerSaving] = useState(false);
  const [serverForm, setServerForm] = useState(defaultServerForm);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const updatePrimaryTunnelAddress = (nextIp?: string, nextPrefix?: string) => {
    const entries = serverForm.addresses
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const first = entries[0] ?? defaultServerForm.addresses;
    const [currentIpRaw, currentPrefixRaw] = first.split('/');
    const currentIp = currentIpRaw?.trim() || '10.8.0.1';
    const currentPrefix = currentPrefixRaw?.trim() || '24';
    const mergedIp = (nextIp ?? currentIp).trim() || currentIp;
    const mergedPrefix = (nextPrefix ?? currentPrefix).trim() || currentPrefix;
    const merged = `${mergedIp}/${mergedPrefix}`;
    const rest = entries.slice(1);
    setServerForm((prev) => ({
      ...prev,
      addresses: [merged, ...rest].join(', '),
    }));
  };

  const primaryTunnelAddress = (() => {
    const first =
      serverForm.addresses
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)[0] ?? defaultServerForm.addresses;
    const [ip, prefix] = first.split('/');
    return {
      ip: ip?.trim() || '10.8.0.1',
      prefix: prefix?.trim() || '24',
    };
  })();

  const loadAll = () => {
    setLoading(true);
    Promise.all([getWgServer(), getWgPeers()])
      .then(([srv, prs]) => {
        setServer(srv.data);
        setPeers(prs.data as PeerRow[]);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  useEffect(() => {
    if (!server) return;
    setServerForm({
      interface: server.interface || defaultServerForm.interface,
      description: server.description || defaultServerForm.description,
      listenPort: server.listenPort || defaultServerForm.listenPort,
      addresses: server.addresses?.join(', ') || defaultServerForm.addresses,
      mtu: server.mtu ? String(server.mtu) : '',
      enabled: server.enabled ?? true,
      publicKey: server.publicKey || '',
      privateKey: '',
    });
    setShowPrivateKey(false);
  }, [server]);

  const handleToggleEnabled = () => {
    if (!server) return;
    setServerSaving(true);
    createWgInterface({
      ...server,
      enabled: !server.enabled,
    })
      .then(() => loadAll())
      .catch((err: Error) => setError(err.message))
      .finally(() => setServerSaving(false));
  };

  const handleGenerateServerKeys = () => {
    const name = serverForm.interface.trim() || defaultServerForm.interface;
    generateWgKeys(name)
      .then((res) => {
        setServerForm((current) => ({
          ...current,
          privateKey: res.data.private_key,
          publicKey: res.data.public_key,
        }));
        setShowPrivateKey(true);
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleSaveServer = () => {
    if (!serverForm.interface.trim()) {
      setError('Interface is required.');
      return;
    }
    if (!serverForm.addresses.trim()) {
      setError('Server tunnel address is required.');
      return;
    }

    setServerSaving(true);
    createWgInterface({
      interface: serverForm.interface.trim(),
      description: serverForm.description.trim(),
      publicKey: serverForm.publicKey.trim(),
      privateKey: serverForm.privateKey.trim(),
      listenPort: Number(serverForm.listenPort) || defaultServerForm.listenPort,
      mtu:
        serverForm.mtu.trim() === ''
          ? undefined
          : Number.isNaN(Number(serverForm.mtu))
          ? undefined
          : Number(serverForm.mtu),
      addresses: serverForm.addresses
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      peers: server?.peers ?? [],
      enabled: serverForm.enabled,
    })
      .then(() => {
        setServerForm((f) => ({ ...f, privateKey: '' }));
        setShowPrivateKey(false);
        loadAll();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setServerSaving(false));
  };

  const handleAddPeer = () => {
    setPeerSaving(true);
    createWgPeer({
      name: peerForm.name,
      publicKey: peerForm.publicKey,
      presharedKey: peerForm.presharedKey || undefined,
      allowedIPs: peerForm.allowedIPs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      endpoint: peerForm.endpoint || undefined,
      persistentKeepalive: peerForm.persistentKeepalive,
      enabled: peerForm.enabled,
    })
      .then(() => {
        setPeerModalOpen(false);
        setPeerForm(defaultPeerForm);
        loadAll();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPeerSaving(false));
  };

  const handleDeletePeer = () => {
    if (deleteId === null) return;
    setDeleting(true);
    deleteWgPeer(deleteId)
      .then(() => {
        setDeleteId(null);
        loadAll();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false));
  };

  const listenPortLabel = useMemo(() => {
    if (!server) return 'Not configured';
    if (server.listenPort === 0) return 'Auto (kernel-assigned)';
    return server.listenPort > 0 ? String(server.listenPort) : 'Not configured';
  }, [server]);

  const isServerConfigured = Boolean(server?.interface);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading VPN configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <Modal
        open={peerModalOpen}
        title="Add VPN Peer"
        onClose={() => {
          setPeerModalOpen(false);
          setPeerForm(defaultPeerForm);
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
            onChange={(e) =>
              setPeerForm({ ...peerForm, persistentKeepalive: Number(e.target.value) })
            }
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
        <p className="text-sm text-gray-600">Remove this VPN peer?</p>
      </Modal>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card
        title="VPN Overview"
        subtitle="Service status and tunnel details"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ServiceControlCluster
              serviceId="vpn"
              disabled={!server}
              className="h-8"
              onError={(msg) => setError(msg)}
            />
            <Button
              type="button"
              onClick={handleToggleEnabled}
              disabled={!server || serverSaving}
              variant={server?.enabled ? 'secondary' : 'primary'}
              size="sm"
              className="h-8"
              title={server?.enabled ? 'Disable VPN' : 'Enable VPN'}
              aria-label={server?.enabled ? 'Disable VPN' : 'Enable VPN'}
            >
              {server?.enabled ? 'Disable VPN' : 'Enable VPN'}
            </Button>
            <Button
              type="button"
              onClick={loadAll}
              disabled={loading || serverSaving}
              variant="secondary"
              size="sm"
              className="h-8 w-8 justify-center p-0"
              title="Refresh VPN status"
              aria-label="Refresh VPN status"
            >
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 12a8 8 0 10-2.343 5.657M20 12V8m0 4h-4"
                />
              </svg>
            </Button>
          </div>
        }
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-gray-500 mb-1">Status</dt>
            <dd className="text-gray-900">{server?.enabled ? 'Enabled' : 'Disabled'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Interface</dt>
            <dd className="font-mono text-gray-900">{server?.interface || 'Not configured'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Listen Port</dt>
            <dd className="font-mono text-gray-900">{listenPortLabel}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">MTU</dt>
            <dd className="font-mono text-gray-900">
              {server?.mtu ? String(server.mtu) : 'Default'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Peers</dt>
            <dd className="text-gray-900">{peers.length}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <dt className="text-gray-500 mb-1">Tunnel Addresses</dt>
            <dd className="font-mono text-gray-900">
              {server?.addresses?.length ? server.addresses.join(', ') : 'None configured'}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <dt className="text-gray-500 mb-1">Public Key</dt>
            <dd className="font-mono text-xs text-gray-900 break-all p-2 bg-gray-50 rounded border border-gray-200">
              {server?.publicKey || 'Not available'}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="VPN Settings"
          subtitle="Configure VPN interface, tunnel, keys, and service state"
          actions={
            <Button
              type="button"
              onClick={handleSaveServer}
              disabled={serverSaving}
              variant="secondary"
              size="sm"
              className="h-8 w-8 justify-center p-0"
              title={isServerConfigured ? 'Save VPN Settings' : 'Create VPN'}
              aria-label={isServerConfigured ? 'Save VPN Settings' : 'Create VPN'}
            >
              {serverSaving ? (
                <svg
                  className="h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : isServerConfigured ? (
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.25}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75H6a2.25 2.25 0 00-2.25 2.25v12A2.25 2.25 0 006 20.25h12A2.25 2.25 0 0020.25 18V7.5L16.5 3.75z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3.75V9h7.5V3.75" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.25}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5.25v13.5M5.25 12h13.5" />
                </svg>
              )}
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="server-description"
              label="Name"
              className="col-span-2"
              placeholder="Remote Access"
              value={serverForm.description}
              onChange={(e) => setServerForm({ ...serverForm, description: e.target.value })}
            />
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
              onChange={(e) =>
                setServerForm({ ...serverForm, listenPort: Number(e.target.value) || 51820 })
              }
            />
            <FormField
              id="server-mtu"
              label="MTU"
              type="number"
              min={68}
              max={65535}
              placeholder="Leave blank for default"
              value={serverForm.mtu}
              onChange={(e) => setServerForm({ ...serverForm, mtu: e.target.value })}
            />
            <AddressPrefixField
              id="server-address"
              label="Server Tunnel Address"
              className="col-span-2"
              addressPlaceholder="10.8.0.1"
              addressValue={primaryTunnelAddress.ip}
              prefixValue={primaryTunnelAddress.prefix}
              prefixOptions={[...Array(33).keys()]}
              onAddressChange={(value) => updatePrimaryTunnelAddress(value, undefined)}
              onPrefixChange={(value) => updatePrimaryTunnelAddress(undefined, value)}
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
              type={showPrivateKey ? 'text' : 'password'}
              autoComplete="new-password"
              className="col-span-2"
              placeholder="Generate a keypair to populate this"
              value={serverForm.privateKey}
              onChange={(e) => setServerForm({ ...serverForm, privateKey: e.target.value })}
            />
            <div className="col-span-2 flex items-center justify-end">
              <button
                type="button"
                className="text-xs text-gray-600 hover:text-gray-900"
                onClick={() => setShowPrivateKey((v) => !v)}
              >
                {showPrivateKey ? 'Hide private key' : 'Show private key'}
              </button>
            </div>
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
              <p className="text-xs text-gray-500">
                Generate a new keypair before saving settings.
              </p>
            </div>
          </div>
        </Card>

        <Card
          title={`Peers (${peers.length})`}
          subtitle="Manage VPN peers and view their status"
          actions={
            <Button
              type="button"
              onClick={() => setPeerModalOpen(true)}
              disabled={!isServerConfigured}
              variant="secondary"
              size="sm"
              className="h-8 w-8 justify-center p-0"
              title="Create Peer"
              aria-label="Create Peer"
            >
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.25}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5.25v13.5M5.25 12h13.5" />
              </svg>
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Total</p>
                <p className="text-lg font-semibold text-gray-900">{peers.length}</p>
              </div>
              <div>
                <p className="text-gray-500">Active</p>
                <p className="text-lg font-semibold text-green-600">
                  {peers.filter((p) => p.enabled).length}
                </p>
              </div>
              <div>
                <p className="text-gray-500">RX / TX</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatBytes(peers.reduce((s, p) => s + ((p.transferRx as number) || 0), 0))} /{' '}
                  {formatBytes(peers.reduce((s, p) => s + ((p.transferTx as number) || 0), 0))}
                </p>
              </div>
            </div>

            {peers.length > 0 ? (
              <div className="space-y-3 max-h-[32rem] overflow-y-auto">
                {peers.map((peer) => (
                  <div
                    key={peer.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 text-sm">
                      <div className="font-medium text-gray-900">
                        {peer.name}
                        {!peer.enabled && <span className="ml-2 text-gray-400">○ Disabled</span>}
                      </div>
                      <p className="mt-1 text-xs font-mono text-gray-600">
                        {peer.publicKey?.slice(0, 24)}…
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        IPs: {(peer.allowedIPs as string[]).join(', ')}
                      </p>
                      {peer.endpoint && (
                        <p className="mt-1 text-xs text-gray-500">Endpoint: {peer.endpoint}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteId(peer.id as number)}
                      className="btn-icon btn-icon-danger"
                      title="Delete peer"
                      aria-label="Delete peer"
                    >
                      <svg
                        className="h-5 w-5"
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
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No peers configured.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
