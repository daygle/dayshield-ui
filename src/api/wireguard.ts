import apiClient from './client'
import type { ApiResponse, WgServer, WgPeer } from '../types'

// ── Server ────────────────────────────────────────────────────────────────────

export const getWgServer = (): Promise<ApiResponse<WgServer>> =>
  apiClient
    .get<ApiResponse<WgServer>>('/vpn/wireguard/server')
    .then((r) => r.data)

export const updateWgServer = (server: Partial<WgServer>): Promise<ApiResponse<WgServer>> =>
  apiClient
    .post<ApiResponse<WgServer>>('/vpn/wireguard/server', server)
    .then((r) => r.data)

// ── Peers ─────────────────────────────────────────────────────────────────────

export const getWgPeers = (): Promise<ApiResponse<WgPeer[]>> =>
  apiClient
    .get<ApiResponse<WgPeer[]>>('/vpn/wireguard/peers')
    .then((r) => r.data)

export const createWgPeer = (
  peer: Omit<WgPeer, 'id' | 'lastHandshake' | 'transferRx' | 'transferTx'>,
): Promise<ApiResponse<WgPeer>> =>
  apiClient
    .post<ApiResponse<WgPeer>>('/vpn/wireguard/peers', peer)
    .then((r) => r.data)

export const updateWgPeer = (
  id: number,
  peer: Partial<Omit<WgPeer, 'id' | 'lastHandshake' | 'transferRx' | 'transferTx'>>,
): Promise<ApiResponse<WgPeer>> =>
  apiClient
    .put<ApiResponse<WgPeer>>(`/vpn/wireguard/peers/${id}`, peer)
    .then((r) => r.data)

export const deleteWgPeer = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/vpn/wireguard/peers/${id}`)
    .then((r) => r.data)
