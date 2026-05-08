import apiClient from './client'
import type { ApiResponse, FirewallRule, FirewallSettings } from '../types'

function normalize<T>(payload: unknown): ApiResponse<T> {
  const p = payload as { success?: boolean; data?: T; message?: string; error?: string }
  if (typeof p === 'object' && p !== null && 'success' in p && 'data' in p) {
    return p as ApiResponse<T>
  }
  return { success: true, data: payload as T }
}

// Core firewall API: GET /firewall/rules (list), POST /firewall/rules (append).
// Individual rule GET/PUT/DELETE by id are not implemented in the core.

export const getFirewallRules = (): Promise<ApiResponse<FirewallRule[]>> =>
  apiClient
    .get<ApiResponse<FirewallRule[]>>('/firewall/rules')
    .then((r) => normalize<FirewallRule[]>(r.data))

export const createFirewallRule = (
  rule: Omit<FirewallRule, 'id'>,
): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .post<ApiResponse<FirewallRule>>('/firewall/rules', rule)
    .then((r) => normalize<FirewallRule>(r.data))

export const updateFirewallRule = (
  id: string,
  rule: Partial<Omit<FirewallRule, 'id'>>,
): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .put<ApiResponse<FirewallRule>>(`/firewall/rules/${encodeURIComponent(id)}`, rule)
    .then((r) => normalize<FirewallRule>(r.data))

export const deleteFirewallRule = (id: number | string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/firewall/rules/${encodeURIComponent(String(id))}`)
    .then((r) => normalize<void>(r.data))

export const getFirewallSettings = (): Promise<ApiResponse<FirewallSettings>> =>
  apiClient
    .get<ApiResponse<FirewallSettings>>('/firewall/settings')
    .then((r) => normalize<FirewallSettings>(r.data))

export const updateFirewallSettings = (
  settings: FirewallSettings,
): Promise<ApiResponse<FirewallSettings>> =>
  apiClient
    .put<ApiResponse<FirewallSettings>>('/firewall/settings', settings)
    .then((r) => normalize<FirewallSettings>(r.data))
