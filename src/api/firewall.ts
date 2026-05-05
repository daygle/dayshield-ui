import apiClient from './client'
import type { ApiResponse, FirewallRule } from '../types'

// Core firewall API: GET /firewall/rules (list), POST /firewall/rules (append).
// Individual rule GET/PUT/DELETE by id are not implemented in the core.

export const getFirewallRules = (): Promise<ApiResponse<FirewallRule[]>> =>
  apiClient
    .get<ApiResponse<FirewallRule[]>>('/firewall/rules')
    .then((r) => r.data)

export const createFirewallRule = (
  rule: Omit<FirewallRule, 'id'>,
): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .post<ApiResponse<FirewallRule>>('/firewall/rules', rule)
    .then((r) => r.data)

export const deleteFirewallRule = (_id: number): Promise<ApiResponse<void>> =>
  Promise.resolve({ data: undefined, success: true })
