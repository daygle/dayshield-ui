import apiClient from './client'
import type {
  ApiResponse,
  DnsBlocklistEntry,
  DnsConfig,
  DnsHostOverride,
  DnsDomainOverride,
} from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

export const getDnsConfig = (): Promise<ApiResponse<DnsConfig>> =>
  apiClient
    .get<ApiResponse<DnsConfig>>('/dns/config')
    .then((r) => r.data)

export const updateDnsConfig = (config: Partial<DnsConfig>): Promise<ApiResponse<DnsConfig>> =>
  apiClient
    .post<ApiResponse<DnsConfig>>('/dns/config', config)
    .then((r) => r.data)

// ── Overrides ────────────────────────────────────────────────────────────────

export interface DnsOverridesData {
  host_overrides: DnsHostOverride[]
  domain_overrides: DnsDomainOverride[]
}

export const getDnsOverrides = (): Promise<ApiResponse<DnsOverridesData>> =>
  apiClient
    .get<ApiResponse<DnsOverridesData>>('/dns/overrides')
    .then((r) => r.data)

export const createDnsOverride = (
  override: { kind: 'host' | 'domain'; name: string; target: string },
): Promise<ApiResponse<DnsHostOverride | DnsDomainOverride>> =>
  apiClient
    .post<ApiResponse<DnsHostOverride | DnsDomainOverride>>('/dns/overrides', override)
    .then((r) => r.data)

export const deleteDnsOverride = (name: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dns/overrides/${encodeURIComponent(name)}`)
    .then((r) => r.data)

// ── Convenience wrappers ──────────────────────────────────────────────────────

export const createDnsHostOverride = (
  hostname: string,
  address: string,
): Promise<ApiResponse<DnsHostOverride | DnsDomainOverride>> =>
  createDnsOverride({ kind: 'host', name: hostname, target: address })

export const createDnsDomainOverride = (
  domain: string,
  forwardTo: string,
): Promise<ApiResponse<DnsHostOverride | DnsDomainOverride>> =>
  createDnsOverride({ kind: 'domain', name: domain, target: forwardTo })

export const deleteDnsHostOverride = (hostname: string): Promise<ApiResponse<void>> =>
  deleteDnsOverride(hostname)

export const deleteDnsDomainOverride = (domain: string): Promise<ApiResponse<void>> =>
  deleteDnsOverride(domain)

// ── Per-interface blocklists ────────────────────────────────────────────────

export const getInterfaceDnsBlocklists = (
  interfaceName: string,
): Promise<ApiResponse<DnsBlocklistEntry[]>> =>
  apiClient
    .get<ApiResponse<DnsBlocklistEntry[]>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/dns/blocklists`,
    )
    .then((r) => r.data)

export const createInterfaceDnsBlocklist = (
  interfaceName: string,
  payload: { url: string; name?: string; enabled?: boolean },
): Promise<ApiResponse<DnsBlocklistEntry>> =>
  apiClient
    .post<ApiResponse<DnsBlocklistEntry>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/dns/blocklists`,
      payload,
    )
    .then((r) => r.data)

export const deleteInterfaceDnsBlocklist = (
  interfaceName: string,
  blocklistId: string,
): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/dns/blocklists/${encodeURIComponent(blocklistId)}`,
    )
    .then((r) => r.data)
