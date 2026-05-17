import apiClient from './client'
import type {
  ApiResponse,
  Dhcp6Config,
  Dhcp6ConfigPerInterface,
  Dhcp6StaticLease,
  Dhcp6Lease,
  DhcpConfig,
  DhcpConfigPerInterface,
  DhcpStaticLease,
  DhcpLease,
} from '../types'

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

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeDhcpLease(raw: unknown): DhcpLease | null {
  const value = (raw ?? {}) as Record<string, unknown>
  const mac = readString(value.mac ?? value.mac_address).trim()
  const ipAddress = readString(value.ipAddress ?? value.ip_address ?? value.address).trim()
  if (!mac || !ipAddress) return null

  return {
    mac,
    ipAddress,
    hostname: readString(value.hostname ?? value.client_hostname),
    starts: readString(value.starts ?? value.start ?? value.cltt),
    ends: readString(value.ends ?? value.end ?? value.expire ?? value.expires_at),
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

// ── DHCPv6 Config ───────────────────────────────────────────────────────────

export const getDhcp6Config = (): Promise<ApiResponse<Dhcp6Config>> =>
  apiClient
    .get<ApiResponse<Dhcp6Config>>('/dhcp6/config')
    .then((r) => r.data)

export const updateDhcp6Config = (config: Partial<Dhcp6Config>): Promise<ApiResponse<Dhcp6Config>> =>
  apiClient
    .post<ApiResponse<Dhcp6Config>>('/dhcp6/config', config)
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

export const getInterfaceDhcp6Config = (interfaceName: string): Promise<ApiResponse<Dhcp6ConfigPerInterface>> =>
  apiClient
    .get<ApiResponse<Dhcp6ConfigPerInterface>>(`/interfaces/${encodeURIComponent(interfaceName)}/dhcp6/config`)
    .then((r) => r.data)

export const updateInterfaceDhcp6Config = (
  interfaceName: string,
  config: Partial<Dhcp6ConfigPerInterface>,
): Promise<ApiResponse<Dhcp6ConfigPerInterface>> =>
  apiClient
    .post<ApiResponse<Dhcp6ConfigPerInterface>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/dhcp6/config`,
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

// ── DHCPv6 Static leases ──────────────────────────────────────────────────────

export const getDhcp6StaticLeases = (): Promise<ApiResponse<Dhcp6StaticLease[]>> =>
  apiClient
    .get<ApiResponse<Dhcp6StaticLease[]>>('/dhcp6/static-leases')
    .then((r) => r.data)

export const createDhcp6StaticLease = (
  lease: Omit<Dhcp6StaticLease, 'id'> & { mac?: string },
): Promise<ApiResponse<Dhcp6StaticLease>> =>
  apiClient
    .post<ApiResponse<Dhcp6StaticLease>>('/dhcp6/static-leases', lease)
    .then((r) => r.data)

export const deleteDhcp6StaticLease = (id: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dhcp6/static-leases/${encodeURIComponent(id)}`)
    .then((r) => r.data)

// ── DHCPv6 Active leases ──────────────────────────────────────────────────────

const DHCPv6_LEASE_STATES: ReadonlySet<Dhcp6Lease['state']> = new Set([
  'active',
  'expired',
  'declined',
  'reclaimed',
])

function normalizeDhcp6LeaseState(raw: unknown): Dhcp6Lease['state'] {
  const value = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (DHCPv6_LEASE_STATES.has(value as Dhcp6Lease['state'])) return value as Dhcp6Lease['state']
  return 'active'
}

function normalizeDhcp6Lease(raw: unknown): Dhcp6Lease | null {
  const value = (raw ?? {}) as Record<string, unknown>
  const ipAddress = readString(value.ipAddress ?? value.ip_address ?? value.address).trim()
  if (!ipAddress) return null
  return {
    ipAddress,
    duid: readString(value.duid),
    hostname: readString(value.hostname ?? value.client_hostname),
    ends: readString(value.ends ?? value.end ?? value.expire ?? value.expires_at),
    state: normalizeDhcp6LeaseState(value.state),
  }
}

export const getDhcp6Leases = (): Promise<ApiResponse<Dhcp6Lease[]>> =>
  apiClient
    .get<ApiResponse<unknown>>('/dhcp6/leases')
    .then((r) => {
      const raw = r.data.data
      const leases = Array.isArray(raw)
        ? raw.map(normalizeDhcp6Lease).filter((l): l is Dhcp6Lease => l !== null)
        : []
      return { ...r.data, data: leases }
    })
