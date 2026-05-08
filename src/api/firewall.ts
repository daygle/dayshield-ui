import apiClient from './client'
import type { ApiResponse, FirewallRule } from '../types'

// Core firewall API: GET /firewall/rules (list), POST /firewall/rules (append).
// Individual rule GET/PUT/DELETE by id are not implemented in the core.

export const getFirewallRules = (): Promise<ApiResponse<FirewallRule[]>> =>
  apiClient
    .get<ApiResponse<FirewallRule[]>>('/firewall/rules')
    .then((r: { data: ApiResponse<FirewallRule[]> }) => r.data)

export const createFirewallRule = (
  rule: Omit<FirewallRule, 'id'>,
): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .post<ApiResponse<FirewallRule>>('/firewall/rules', rule)
    .then((r: { data: ApiResponse<FirewallRule> }) => r.data)

export const deleteFirewallRule = (id: number | string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/firewall/rules/${encodeURIComponent(String(id))}`)
    .then((r: { data: ApiResponse<void> }) => r.data)
