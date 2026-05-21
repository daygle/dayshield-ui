import apiClient from './client';
import type { ApiResponse, NatConfig, NatRule } from '../types';

// ── NAT Config ────────────────────────────────────────────────────────────────

export const getNatConfig = (): Promise<ApiResponse<NatConfig>> =>
  apiClient.get<ApiResponse<NatConfig>>('/nat/config').then((r) => r.data);

export const updateNatConfig = (config: Partial<NatConfig>): Promise<ApiResponse<NatConfig>> =>
  apiClient.put<ApiResponse<NatConfig>>('/nat/config', config).then((r) => r.data);

// ── Outbound NAT Rules ────────────────────────────────────────────────────────

export const getNatRules = (): Promise<ApiResponse<NatRule[]>> =>
  apiClient.get<ApiResponse<NatRule[]>>('/nat/rules').then((r) => r.data);

export const createNatRule = (rule: Omit<NatRule, 'id'>): Promise<ApiResponse<NatRule>> =>
  apiClient.post<ApiResponse<NatRule>>('/nat/rules', rule).then((r) => r.data);

// Note: PUT /nat/rules/{id} is now implemented in the backend.
export const updateNatRule = (
  id: string,
  rule: Partial<Omit<NatRule, 'id'>>
): Promise<ApiResponse<NatRule>> =>
  apiClient
    .put<ApiResponse<NatRule>>(`/nat/rules/${encodeURIComponent(id)}`, rule)
    .then((r) => r.data);

export const deleteNatRule = (id: string): Promise<ApiResponse<void>> =>
  apiClient.delete<ApiResponse<void>>(`/nat/rules/${encodeURIComponent(id)}`).then((r) => r.data);

// Port forwards are DNAT NAT rules - these wrappers filter by rule_type so
// the Port Forwards tab always shows only the relevant subset.

export const getPortForwards = (): Promise<ApiResponse<NatRule[]>> =>
  getNatRules().then((r) => ({ ...r, data: r.data.filter((rule) => rule.rule_type === 'dnat') }));

export const createPortForward = (rule: Omit<NatRule, 'id'>): Promise<ApiResponse<NatRule>> =>
  createNatRule({ ...rule, rule_type: 'dnat' });

export const updatePortForward = (
  id: string,
  rule: Partial<Omit<NatRule, 'id'>>
): Promise<ApiResponse<NatRule>> => updateNatRule(id, rule);

export const deletePortForward = (id: string): Promise<ApiResponse<void>> => deleteNatRule(id);

// Source NAT (SNAT) rules

export const getSourceNatRules = (): Promise<ApiResponse<NatRule[]>> =>
  getNatRules().then((r) => ({ ...r, data: r.data.filter((rule) => rule.rule_type === 'snat') }));

export const createSourceNatRule = (rule: Omit<NatRule, 'id'>): Promise<ApiResponse<NatRule>> =>
  createNatRule({ ...rule, rule_type: 'snat' });

export const updateSourceNatRule = (
  id: string,
  rule: Partial<Omit<NatRule, 'id'>>
): Promise<ApiResponse<NatRule>> => updateNatRule(id, rule);

export const deleteSourceNatRule = (id: string): Promise<ApiResponse<void>> => deleteNatRule(id);

// One-to-One NAT rules

export const getOneToOneNatRules = (): Promise<ApiResponse<NatRule[]>> =>
  getNatRules().then((r) => ({ ...r, data: r.data.filter((rule) => rule.rule_type === 'one_to_one') }));

export const createOneToOneNatRule = (rule: Omit<NatRule, 'id'>): Promise<ApiResponse<NatRule>> =>
  createNatRule({ ...rule, rule_type: 'one_to_one' });

export const updateOneToOneNatRule = (
  id: string,
  rule: Partial<Omit<NatRule, 'id'>>
): Promise<ApiResponse<NatRule>> => updateNatRule(id, rule);

export const deleteOneToOneNatRule = (id: string): Promise<ApiResponse<void>> => deleteNatRule(id);
