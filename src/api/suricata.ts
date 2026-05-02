import apiClient from './client'
import type { ApiResponse, SuricataConfig, SuricataRuleset, SuricataAlert } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

export const getSuricataConfig = (): Promise<ApiResponse<SuricataConfig>> =>
  apiClient
    .get<ApiResponse<SuricataConfig>>('/suricata/config')
    .then((r) => r.data)

export const updateSuricataConfig = (
  config: Partial<SuricataConfig>,
): Promise<ApiResponse<SuricataConfig>> =>
  apiClient
    .post<ApiResponse<SuricataConfig>>('/suricata/config', config)
    .then((r) => r.data)

// ── Rulesets ──────────────────────────────────────────────────────────────────

export const getSuricataRulesets = (): Promise<ApiResponse<SuricataRuleset[]>> =>
  apiClient
    .get<ApiResponse<SuricataRuleset[]>>('/suricata/rulesets')
    .then((r) => r.data)

export const updateSuricataRuleset = (
  id: number,
  patch: Pick<SuricataRuleset, 'enabled'>,
): Promise<ApiResponse<SuricataRuleset>> =>
  apiClient
    .put<ApiResponse<SuricataRuleset>>(`/suricata/rulesets/${id}`, patch)
    .then((r) => r.data)

// ── Alerts ────────────────────────────────────────────────────────────────────

export const getSuricataAlerts = (limit = 100): Promise<ApiResponse<SuricataAlert[]>> =>
  apiClient
    .get<ApiResponse<SuricataAlert[]>>('/suricata/alerts', { params: { limit } })
    .then((r) => r.data)
