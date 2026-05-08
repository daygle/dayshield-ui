import apiClient from './client'
import type { ApiResponse, WgPeer, WgServer } from '../types'

// ── Interfaces ────────────────────────────────────────────────────────────────
// Core manages WireGuard as a list of WireGuardInterface objects (each
// containing its peers inline).  Routes: GET/POST /wireguard/interfaces,
// DELETE /wireguard/interfaces/{name}, POST /wireguard/interfaces/{name}/generate-keys

export const getWgInterfaces = (): Promise<ApiResponse<WgServer[]>> =>
  apiClient
    .get<ApiResponse<WgServer[]>>('/wireguard/interfaces')
    .then((r) => r.data)

export const createWgInterface = (
  iface: WgServer,
): Promise<ApiResponse<WgServer>> =>
  apiClient
    .post<ApiResponse<WgServer>>('/wireguard/interfaces', iface)
    .then((r) => r.data)

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
      publicKey: '',
      listenPort: 0,
      addresses: [],
      dns: [],
      mtu: 0,
      enabled: false,
    },
  }))

export const getWgPeers = (): Promise<ApiResponse<WgPeer[]>> =>
  Promise.resolve({ data: [], success: true })

export const createWgPeer = (
  _peer: Omit<WgPeer, 'id'>,
): Promise<ApiResponse<WgPeer>> =>
  Promise.reject(new Error('WireGuard peer management is not yet available. Manage peers via the interface configuration.'))

export const deleteWgPeer = (_id: number): Promise<ApiResponse<void>> =>
  Promise.reject(new Error('WireGuard peer management is not yet available. Manage peers via the interface configuration.'))
