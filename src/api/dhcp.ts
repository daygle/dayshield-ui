import apiClient from './client'
import type { ApiResponse, DhcpConfig, DhcpPool, DhcpStaticLease, DhcpLease } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

export const getDhcpConfig = (): Promise<ApiResponse<DhcpConfig>> =>
  apiClient
    .get<ApiResponse<DhcpConfig>>('/dhcp/config')
    .then((r) => r.data)

export const updateDhcpConfig = (config: Partial<DhcpConfig>): Promise<ApiResponse<DhcpConfig>> =>
  apiClient
    .post<ApiResponse<DhcpConfig>>('/dhcp/config', config)
    .then((r) => r.data)

// ── Pools ─────────────────────────────────────────────────────────────────────

export const getDhcpPools = (): Promise<ApiResponse<DhcpPool[]>> =>
  apiClient
    .get<ApiResponse<DhcpPool[]>>('/dhcp/pools')
    .then((r) => r.data)

export const createDhcpPool = (
  pool: Omit<DhcpPool, 'id'>,
): Promise<ApiResponse<DhcpPool>> =>
  apiClient
    .post<ApiResponse<DhcpPool>>('/dhcp/pools', pool)
    .then((r) => r.data)

export const deleteDhcpPool = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dhcp/pools/${id}`)
    .then((r) => r.data)

// ── Static leases ─────────────────────────────────────────────────────────────

export const getDhcpStaticLeases = (): Promise<ApiResponse<DhcpStaticLease[]>> =>
  apiClient
    .get<ApiResponse<DhcpStaticLease[]>>('/dhcp/static-leases')
    .then((r) => r.data)

export const createDhcpStaticLease = (
  lease: Omit<DhcpStaticLease, 'id'>,
): Promise<ApiResponse<DhcpStaticLease>> =>
  apiClient
    .post<ApiResponse<DhcpStaticLease>>('/dhcp/static-leases', lease)
    .then((r) => r.data)

export const deleteDhcpStaticLease = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dhcp/static-leases/${id}`)
    .then((r) => r.data)

// ── Active leases ─────────────────────────────────────────────────────────────

export const getDhcpLeases = (): Promise<ApiResponse<DhcpLease[]>> =>
  apiClient
    .get<ApiResponse<DhcpLease[]>>('/dhcp/leases')
    .then((r) => r.data)
