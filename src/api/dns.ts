import apiClient from './client'
import type { ApiResponse, DnsConfig, DnsForwarder, DnsHostOverride } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────
// Core DNS API: GET/POST /dns/config, GET/POST/DELETE /dns/overrides

export const getDnsConfig = (): Promise<ApiResponse<DnsConfig>> =>
  apiClient
    .get<ApiResponse<DnsConfig>>('/dns/config')
    .then((r) => r.data)

export const updateDnsConfig = (config: Partial<DnsConfig>): Promise<ApiResponse<DnsConfig>> =>
  apiClient
    .post<ApiResponse<DnsConfig>>('/dns/config', config)
    .then((r) => r.data)

// ── Overrides (host + domain) ─────────────────────────────────────────────────
// Returns { host_overrides: DnsHostOverride[], domain_overrides: DnsHostOverride[] }

export const getDnsOverrides = (): Promise<ApiResponse<{ host_overrides: DnsHostOverride[]; domain_overrides: DnsHostOverride[] }>> =>
  apiClient
    .get<ApiResponse<{ host_overrides: DnsHostOverride[]; domain_overrides: DnsHostOverride[] }>>('/dns/overrides')
    .then((r) => r.data)

export const createDnsOverride = (
  override: { kind: 'host' | 'domain'; name: string; target: string },
): Promise<ApiResponse<DnsHostOverride>> =>
  apiClient
    .post<ApiResponse<DnsHostOverride>>('/dns/overrides', override)
    .then((r) => r.data)

export const deleteDnsOverride = (name: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dns/overrides/${encodeURIComponent(name)}`)
    .then((r) => r.data)

// Legacy / compatibility wrappers for older UI pages
export const getDnsForwarders = (): Promise<ApiResponse<DnsForwarder[]>> =>
  Promise.resolve({ data: [], success: true })

export const createDnsForwarder = (_forwarder: Omit<DnsForwarder, 'id'>): Promise<ApiResponse<DnsForwarder>> =>
  Promise.resolve({ data: { id: 0, ..._forwarder }, success: true })

export const deleteDnsForwarder = (_id: number): Promise<ApiResponse<void>> =>
  Promise.resolve({ data: undefined, success: true })

export const getDnsHostOverrides = (): Promise<ApiResponse<DnsHostOverride[]>> =>
  getDnsOverrides().then((r) => ({ ...r, data: r.data.host_overrides }))

export const createDnsHostOverride = (override: Omit<DnsHostOverride, 'id'>): Promise<ApiResponse<DnsHostOverride>> =>
  createDnsOverride({ kind: 'host', name: `${override.hostname}.${override.domain}`, target: override.ipv4 ?? override.ipv6 ?? '' })

export const deleteDnsHostOverride = deleteDnsOverride
