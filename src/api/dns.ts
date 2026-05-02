import apiClient from './client'
import type { ApiResponse, DnsConfig, DnsHostOverride } from '../types'

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
