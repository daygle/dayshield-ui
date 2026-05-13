import apiClient from './client'
import type { ApiResponse, WgPeer, WgServer } from '../types'

type BackendWgPeer = {
  name?: string
  public_key?: string
  preshared_key?: string
  allowed_ips?: string[]
  endpoint?: string
  persistent_keepalive?: number
}

type BackendWgInterface = {
  name?: string
  description?: string
  private_key?: string
  public_key?: string
  listen_port?: number
  addresses?: string[]
  peers?: BackendWgPeer[]
  enabled?: boolean
}

function toUiPeer(raw: BackendWgPeer, idx: number): WgPeer {
  return {
    id: idx + 1,
    name: raw.name ?? `Peer ${idx + 1}`,
    publicKey: raw.public_key ?? '',
    presharedKey: raw.preshared_key,
    allowedIPs: Array.isArray(raw.allowed_ips) ? raw.allowed_ips : [],
    endpoint: raw.endpoint,
    persistentKeepalive: raw.persistent_keepalive ?? 0,
    enabled: true,
  }
}

function toUiInterface(raw: BackendWgInterface): WgServer {
  const peers = Array.isArray(raw.peers) ? raw.peers.map(toUiPeer) : []
  return {
    interface: raw.name ?? '',
    description: raw.description ?? '',
    publicKey: raw.public_key ?? '',
    privateKey: raw.private_key ?? '',
    listenPort: raw.listen_port ?? 0,
    addresses: Array.isArray(raw.addresses) ? raw.addresses : [],
    peers,
    enabled: raw.enabled ?? false,
  }
}

function toBackendInterface(iface: WgServer): BackendWgInterface {
  return {
    name: iface.interface,
    description: iface.description || undefined,
    private_key: iface.privateKey,
    public_key: iface.publicKey,
    listen_port: iface.listenPort,
    addresses: iface.addresses,
    peers: (iface.peers ?? []).map((peer) => ({
      name: peer.name,
      public_key: peer.publicKey,
      preshared_key: peer.presharedKey,
      allowed_ips: peer.allowedIPs,
      endpoint: peer.endpoint,
      persistent_keepalive: peer.persistentKeepalive,
    })),
    enabled: iface.enabled,
  }
}

// ── Interfaces ────────────────────────────────────────────────────────────────
// Core manages WireGuard as a list of WireGuardInterface objects (each
// containing its peers inline).  Routes: GET/POST /wireguard/interfaces,
// DELETE /wireguard/interfaces/{name}, POST /wireguard/interfaces/{name}/generate-keys

export const getWgInterfaces = (): Promise<ApiResponse<WgServer[]>> =>
  apiClient
    .get<ApiResponse<BackendWgInterface[]>>('/wireguard/interfaces')
    .then((r) => ({
      ...r.data,
      data: Array.isArray(r.data.data) ? r.data.data.map(toUiInterface) : [],
    }))

export const createWgInterface = (
  iface: WgServer,
): Promise<ApiResponse<WgServer>> =>
  apiClient
    .post<ApiResponse<BackendWgInterface>>('/wireguard/interfaces', toBackendInterface(iface))
    .then((r) => ({
      ...r.data,
      data: toUiInterface(r.data.data),
    }))

export const deleteWgInterface = (name: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/wireguard/interfaces/${encodeURIComponent(name)}`)
    .then((r) => r.data)

export const generateWgKeys = (
  name: string,
): Promise<ApiResponse<{ private_key: string; public_key: string }>> =>
  apiClient
    .post<ApiResponse<{ private_key: string; public_key: string }>>(
      `/wireguard/interfaces/${encodeURIComponent(name)}/generate-keys`,
    )
    .then((r) => r.data)

export const getWgServer = (): Promise<ApiResponse<WgServer>> =>
  getWgInterfaces().then((r) => ({
    ...r,
    data: r.data[0] ?? {
      interface: '',
      description: '',
      publicKey: '',
      privateKey: '',
      listenPort: 0,
      addresses: [],
      peers: [],
      enabled: false,
    },
  }))

export const getWgPeers = (): Promise<ApiResponse<WgPeer[]>> =>
  getWgServer().then((r) => ({
    success: r.success,
    data: r.data?.peers ?? [],
    message: r.message,
    error: r.error,
  }))

export const createWgPeer = (
  _peer: Omit<WgPeer, 'id'>,
): Promise<ApiResponse<WgPeer>> =>
  Promise.reject(new Error('WireGuard peer management is not yet available. Manage peers via the interface configuration.'))

export const deleteWgPeer = (_id: number): Promise<ApiResponse<void>> =>
  Promise.reject(new Error('WireGuard peer management is not yet available. Manage peers via the interface configuration.'))
