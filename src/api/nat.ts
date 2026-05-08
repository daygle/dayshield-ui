import apiClient from './client'
import type { ApiResponse, NatConfig, NatRule, PortForward } from '../types'

// ── NAT Config ────────────────────────────────────────────────────────────────

export const getNatConfig = (): Promise<ApiResponse<NatConfig>> =>
  apiClient.get<ApiResponse<NatConfig>>('/nat/config').then((r) => r.data)

export const updateNatConfig = (
  config: Partial<NatConfig>,
): Promise<ApiResponse<NatConfig>> =>
  apiClient
    .put<ApiResponse<NatConfig>>('/nat/config', config)
    .then((r) => r.data)

// ── Outbound NAT Rules ────────────────────────────────────────────────────────

export const getNatRules = (): Promise<ApiResponse<NatRule[]>> =>
  apiClient.get<ApiResponse<NatRule[]>>('/nat/rules').then((r) => r.data)

export const createNatRule = (
  rule: Omit<NatRule, 'id'>,
): Promise<ApiResponse<NatRule>> =>
  apiClient
    .post<ApiResponse<NatRule>>('/nat/rules', rule)
    .then((r) => r.data)

// Note: PUT /nat/rules/{id} is not implemented in the backend.
// To update a rule, delete it and re-create it.
export const updateNatRule = (
  _id: number,
  _rule: Partial<Omit<NatRule, 'id'>>,
): Promise<ApiResponse<NatRule>> =>
  Promise.reject(new Error('NAT rule update is not supported. Delete the rule and create a new one.'))

export const deleteNatRule = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/nat/rules/${id}`)
    .then((r) => r.data)

// ── Port Forwards ─────────────────────────────────────────────────────────────
// Note: /nat/portforwards is not implemented in the backend.
// Port forwarding is managed via NAT rules (DNAT rule type).

export const getPortForwards = (): Promise<ApiResponse<PortForward[]>> =>
  Promise.resolve({ data: [], success: true })

export const createPortForward = (
  _pf: Omit<PortForward, 'id'>,
): Promise<ApiResponse<PortForward>> =>
  Promise.reject(new Error('Port forwards are not supported as a separate resource. Create a NAT rule with type DNAT instead.'))

export const updatePortForward = (
  _id: number,
  _pf: Partial<Omit<PortForward, 'id'>>,
): Promise<ApiResponse<PortForward>> =>
  Promise.reject(new Error('Port forwards are not supported as a separate resource. Create a NAT rule with type DNAT instead.'))

export const deletePortForward = (_id: number): Promise<ApiResponse<void>> =>
  Promise.reject(new Error('Port forwards are not supported as a separate resource. Manage via NAT rules.'))
