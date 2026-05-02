import apiClient from './client'
import type { ApiResponse, DnsConfig, DnsForwarder, DnsHostOverride } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

export const getDnsConfig = (): Promise<ApiResponse<DnsConfig>> =>
  apiClient
    .get<ApiResponse<DnsConfig>>('/dns/config')
    .then((r) => r.data)

export const updateDnsConfig = (config: Partial<DnsConfig>): Promise<ApiResponse<DnsConfig>> =>
  apiClient
    .post<ApiResponse<DnsConfig>>('/dns/config', config)
    .then((r) => r.data)

// ── Forwarders ────────────────────────────────────────────────────────────────

export const getDnsForwarders = (): Promise<ApiResponse<DnsForwarder[]>> =>
  apiClient
    .get<ApiResponse<DnsForwarder[]>>('/dns/forwarders')
    .then((r) => r.data)

export const createDnsForwarder = (
  forwarder: Omit<DnsForwarder, 'id'>,
): Promise<ApiResponse<DnsForwarder>> =>
  apiClient
    .post<ApiResponse<DnsForwarder>>('/dns/forwarders', forwarder)
    .then((r) => r.data)

export const deleteDnsForwarder = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dns/forwarders/${id}`)
    .then((r) => r.data)

// ── Host overrides ────────────────────────────────────────────────────────────

export const getDnsHostOverrides = (): Promise<ApiResponse<DnsHostOverride[]>> =>
  apiClient
    .get<ApiResponse<DnsHostOverride[]>>('/dns/hosts')
    .then((r) => r.data)

export const createDnsHostOverride = (
  host: Omit<DnsHostOverride, 'id'>,
): Promise<ApiResponse<DnsHostOverride>> =>
  apiClient
    .post<ApiResponse<DnsHostOverride>>('/dns/hosts', host)
    .then((r) => r.data)

export const deleteDnsHostOverride = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/dns/hosts/${id}`)
    .then((r) => r.data)
