import apiClient from './client'
import type { ApiResponse, SuricataConfig, SuricataRuleset, SuricataAlert } from '../types'

/** Get global Suricata configuration. */
export const getSuricataConfig = (): Promise<ApiResponse<SuricataConfig>> =>
  apiClient
    .get<ApiResponse<SuricataConfig>>('/suricata/config')
    .then((r) => r.data)

/** Update global Suricata configuration. */
export const updateSuricataConfig = (
  config: Partial<SuricataConfig>,
): Promise<ApiResponse<SuricataConfig>> =>
  apiClient
    .post<ApiResponse<SuricataConfig>>('/suricata/config', config)
    .then((r) => r.data)

/** List all Suricata rulesets. */
export const getSuricataRulesets = (): Promise<ApiResponse<SuricataRuleset[]>> =>
  apiClient
    .get<ApiResponse<SuricataRuleset[]>>('/suricata/rulesets')
    .then((r) => r.data)

/** Create a new Suricata ruleset from URL or local path. */
export const createSuricataRuleset = (
  data: { name: string; url?: string; path?: string; enabled?: boolean },
): Promise<ApiResponse<SuricataRuleset>> =>
  apiClient
    .post<ApiResponse<SuricataRuleset>>('/suricata/rulesets', data)
    .then((r) => r.data)

/** Update a Suricata ruleset. */
export const updateSuricataRuleset = (
  id: string | number,
  patch: Pick<SuricataRuleset, 'enabled'>,
): Promise<ApiResponse<SuricataRuleset>> =>
  apiClient
    .put<ApiResponse<SuricataRuleset>>(`/suricata/rulesets/${encodeURIComponent(String(id))}`, patch)
    .then((r) => r.data)

/** Trigger a check for updates for all managed Suricata rulesets. */
export const checkSuricataRulesetUpdates = (): Promise<ApiResponse<SuricataRuleset[]>> =>
  apiClient
    .post<ApiResponse<SuricataRuleset[]>>('/suricata/rulesets/check-updates')
    .then((r) => r.data)

const encodeRulesetId = (id: string | number) => encodeURIComponent(String(id))

const postRulesetAction = (
  id: string | number,
  action: 'install' | 'check-updates' | 'update' | 'enable' | 'disable',
): Promise<ApiResponse<SuricataRuleset>> =>
  apiClient
    .post<ApiResponse<SuricataRuleset>>(`/suricata/rulesets/${encodeRulesetId(id)}/${action}`)
    .then((r) => r.data)

export const installSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'install')

export const checkSuricataRulesetUpdate = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'check-updates')

export const updateManagedSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'update')

export const enableManagedSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'enable')

export const disableManagedSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'disable')

export const removeSuricataRuleset = (id: string | number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/suricata/rulesets/${encodeRulesetId(id)}`)
    .then((r) => r.data)

/** Fetch recent Suricata alerts. */
export const getSuricataAlerts = (limit = 100): Promise<ApiResponse<SuricataAlert[]>> =>
  apiClient
    .get<ApiResponse<SuricataAlert[]>>('/suricata/alerts', { params: { limit } })
    .then((r) => r.data)

export interface InterfaceSuricataConfig {
  interface: string
  monitored: boolean
  enabled: boolean
  mode: string
  interfaces: string[]
}

/** Read Suricata config for one interface. */
export const getInterfaceSuricataConfig = (
  interfaceName: string,
): Promise<ApiResponse<InterfaceSuricataConfig>> =>
  apiClient
    .get<ApiResponse<InterfaceSuricataConfig>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/suricata`,
    )
    .then((r) => r.data)

/** Enable or disable Suricata monitoring for one interface. */
export const updateInterfaceSuricataConfig = (
  interfaceName: string,
  monitored: boolean,
): Promise<ApiResponse<InterfaceSuricataConfig>> =>
  apiClient
    .post<ApiResponse<InterfaceSuricataConfig>>(
      `/interfaces/${encodeURIComponent(interfaceName)}/suricata`,
      { monitored },
    )
    .then((r) => r.data)
