import apiClient from './client'
import type { ApiResponse, WgServer } from '../types'

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
    .delete<ApiResponse<void>>(`/wireguard/interfaces/${name}`)
    .then((r) => r.data)

export const generateWgKeys = (
  name: string,
): Promise<ApiResponse<{ private_key: string; public_key: string }>> =>
  apiClient
    .post<ApiResponse<{ private_key: string; public_key: string }>>(
      `/wireguard/interfaces/${name}/generate-keys`,
    )
    .then((r) => r.data)
