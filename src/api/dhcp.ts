import apiClient from './client'
import type { ApiResponse, DhcpConfig, DhcpConfigPerInterface, DhcpStaticLease, DhcpLease } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

export const getDhcpConfig = (): Promise<ApiResponse<DhcpConfig>> =>
  apiClient
    .get<ApiResponse<DhcpConfig>>('/dhcp/config')
    .then((r) => r.data)

export const updateDhcpConfig = (config: Partial<DhcpConfig>): Promise<ApiResponse<DhcpConfig>> =>
  apiClient
    .post<ApiResponse<DhcpConfig>>('/dhcp/config', config)
    .then((r) => r.data)

// ── Per-interface DHCP ────────────────────────────────────────────────────────

export const getInterfaceDhcpConfig = (interfaceName: string): Promise<ApiResponse<DhcpConfigPerInterface>> =>
  apiClient
    .get<ApiResponse<DhcpConfigPerInterface>>(`/interfaces/${encodeURIComponent(interfaceName)}/dhcp/config`)
    .then((r) => r.data)

export const updateInterfaceDhcpConfig = (
  interfaceName: string,
  config: Partial<DhcpConfigPerInterface>,
): Promise<ApiResponse<DhcpConfigPerInterface>> =>
  apiClient
    .post<ApiResponse<DhcpConfigPerInterface>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/dhcp/config`,
      config,
    )
    .then((r) => r.data)
// ── Per-interface static leases ───────────────────────────────────────────────

export const getInterfaceStaticLeases = (interfaceName: string): Promise<ApiResponse<DhcpStaticLease[]>> =>
  apiClient
    .get<ApiResponse<DhcpStaticLease[]>>(`/interfaces/${encodeURIComponent(interfaceName)}/dhcp/static-leases`)
    .then((r) => r.data)

export const createInterfaceStaticLease = (
  interfaceName: string,
  lease: Omit<DhcpStaticLease, 'id'>,
): Promise<ApiResponse<DhcpStaticLease>> =>
  apiClient
    .post<ApiResponse<DhcpStaticLease>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/dhcp/static-leases`,
      lease,
    )
    .then((r) => r.data)

export const deleteInterfaceStaticLease = (
  interfaceName: string,
  leaseId: string,
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/dhcp/static-leases/${encodeURIComponent(leaseId)}`,
    )
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

export const deleteDhcpStaticLease = (id: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dhcp/static-leases/${encodeURIComponent(id)}`)
    .then((r) => r.data)

// ── Active leases ─────────────────────────────────────────────────────────────

export const getDhcpLeases = (): Promise<ApiResponse<DhcpLease[]>> =>
  apiClient
    .get<ApiResponse<DhcpLease[]>>('/dhcp/leases')
    .then((r) => r.data)
