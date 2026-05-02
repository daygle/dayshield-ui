import apiClient from './client'
import type { ApiResponse, FirewallRule } from '../types'

export const getFirewallRules = (): Promise<ApiResponse<FirewallRule[]>> =>
  apiClient
    .get<ApiResponse<FirewallRule[]>>('/firewall/rules')
    .then((r) => r.data)

export const getFirewallRule = (id: number): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .get<ApiResponse<FirewallRule>>(`/firewall/rules/${id}`)
    .then((r) => r.data)

export const createFirewallRule = (
  rule: Omit<FirewallRule, 'id'>,
): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .post<ApiResponse<FirewallRule>>('/firewall/rules', rule)
    .then((r) => r.data)

export const updateFirewallRule = (
  id: number,
  rule: Partial<Omit<FirewallRule, 'id'>>,
): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .put<ApiResponse<FirewallRule>>(`/firewall/rules/${id}`, rule)
    .then((r) => r.data)

export const deleteFirewallRule = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/firewall/rules/${id}`)
    .then((r) => r.data)
