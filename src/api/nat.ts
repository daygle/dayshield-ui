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

export const updateNatRule = (
  id: number,
  rule: Partial<Omit<NatRule, 'id'>>,
): Promise<ApiResponse<NatRule>> =>
  apiClient
    .put<ApiResponse<NatRule>>(`/nat/rules/${id}`, rule)
    .then((r) => r.data)

export const deleteNatRule = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/nat/rules/${id}`)
    .then((r) => r.data)

// ── Port Forwards ─────────────────────────────────────────────────────────────

export const getPortForwards = (): Promise<ApiResponse<PortForward[]>> =>
  apiClient
    .get<ApiResponse<PortForward[]>>('/nat/portforwards')
    .then((r) => r.data)

export const createPortForward = (
  pf: Omit<PortForward, 'id'>,
): Promise<ApiResponse<PortForward>> =>
  apiClient
    .post<ApiResponse<PortForward>>('/nat/portforwards', pf)
    .then((r) => r.data)

export const updatePortForward = (
  id: number,
  pf: Partial<Omit<PortForward, 'id'>>,
): Promise<ApiResponse<PortForward>> =>
  apiClient
    .put<ApiResponse<PortForward>>(`/nat/portforwards/${id}`, pf)
    .then((r) => r.data)

export const deletePortForward = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/nat/portforwards/${id}`)
    .then((r) => r.data)
