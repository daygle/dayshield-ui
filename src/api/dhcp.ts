import apiClient from './client'
import type { ApiResponse, DhcpConfig, DhcpConfigPerInterface, DhcpStaticLease, DhcpLease } from '../types'

const LEASE_STATES: ReadonlySet<DhcpLease['state']> = new Set([
  'active',
  'expired',
  'reserved',
  'declined',
  'reclaimed',
])

function normalizeLeaseState(raw: unknown): DhcpLease['state'] {
  const value = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (LEASE_STATES.has(value as DhcpLease['state'])) return value as DhcpLease['state']
  if (value) {
    console.warn(`Unknown DHCP lease state "${value}" returned by API; defaulting to "active".`)
  }
  return 'active'
}

function normalizeDhcpLease(raw: unknown): DhcpLease | null {
  const value = (raw ?? {}) as Record<string, unknown>
  const mac = String(value.mac ?? value.mac_address ?? '').trim()
  const ipAddress = String(value.ipAddress ?? value.ip_address ?? value.address ?? '').trim()
  if (!mac || !ipAddress) return null

  return {
    mac,
    ipAddress,
    hostname: String(value.hostname ?? value.client_hostname ?? ''),
    starts: String(value.starts ?? value.start ?? value.cltt ?? ''),
    ends: String(value.ends ?? value.end ?? value.expire ?? value.expires_at ?? ''),
    state: normalizeLeaseState(value.state),
  }
}

function normalizeDhcpLeases(raw: unknown): DhcpLease[] {
  const mapLeases = (leases: unknown[]): DhcpLease[] =>
    leases
      .map(normalizeDhcpLease)
      .filter((lease): lease is DhcpLease => lease !== null)

  if (Array.isArray(raw)) return mapLeases(raw)
  const value = (raw ?? {}) as Record<string, unknown>
  const leases = value.leases ?? value.active_leases ?? value.items
  return Array.isArray(leases) ? mapLeases(leases) : []
}

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
    .get<ApiResponse<unknown>>('/dhcp/leases')
    .then((r) => ({ ...r.data, data: normalizeDhcpLeases(r.data.data) }))
