import apiClient from './client'
import type { ApiResponse, SuricataConfig, SuricataRuleset, SuricataAlert } from '../types'

interface ManagedInstalledRulesetApi {
  id: string
  displayName: string
  sourceUrl: string
  installedVersion?: string | null
  latestVersion?: string | null
  enabled: boolean
  status?: string | null
  lastError?: string | null
  lastChecked?: string | null
  lastUpdated?: string | null
  updateAvailable?: boolean
}

interface ManagedAvailableRulesetApi {
  id: string
  displayName: string
  url: string
  installed: boolean
}

interface LegacySuricataRulesetApi {
  id: string | number
  name: string
  source: string
  enabled: boolean
  lastUpdated?: string | null
}

const normalizeManagedInstalledRuleset = (ruleset: ManagedInstalledRulesetApi): SuricataRuleset => ({
  id: ruleset.id,
  name: ruleset.displayName,
  source: ruleset.sourceUrl,
  enabled: ruleset.enabled,
  installed: true,
  installedVersion: ruleset.installedVersion ?? null,
  latestVersion: ruleset.latestVersion ?? null,
  updateAvailable: Boolean(ruleset.updateAvailable),
  status: ruleset.status ?? null,
  error: ruleset.lastError ?? null,
  lastChecked: ruleset.lastChecked ?? null,
  lastUpdated: ruleset.lastUpdated ?? undefined,
})

const normalizeLegacyRuleset = (ruleset: LegacySuricataRulesetApi): SuricataRuleset => ({
  id: ruleset.id,
  name: ruleset.name,
  source: ruleset.source,
  enabled: ruleset.enabled,
  installed: true,
  status: 'installed',
  updateAvailable: false,
  lastUpdated: ruleset.lastUpdated ?? undefined,
})

const normalizeManagedAvailableRuleset = (
  ruleset: ManagedAvailableRulesetApi,
  installedById: Map<string, ManagedInstalledRulesetApi>,
): SuricataRuleset => {
  const installed = installedById.get(ruleset.id)
  if (installed) {
    return normalizeManagedInstalledRuleset(installed)
  }

  return {
    id: ruleset.id,
    name: ruleset.displayName,
    source: ruleset.url,
    enabled: false,
    installed: false,
    status: 'available',
    updateAvailable: false,
  }
}

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
export const getSuricataRulesets = async (): Promise<ApiResponse<SuricataRuleset[]>> => {
  try {
    const [availableRes, installedRes] = await Promise.all([
      apiClient.get<ApiResponse<ManagedAvailableRulesetApi[]>>('/rulesets/available'),
      apiClient.get<ApiResponse<ManagedInstalledRulesetApi[]>>('/rulesets'),
    ])

    const installedRulesets = installedRes.data.data ?? []
    const installedById = new Map(installedRulesets.map((ruleset) => [ruleset.id, ruleset]))

    const merged: SuricataRuleset[] = (availableRes.data.data ?? []).map((ruleset) =>
      normalizeManagedAvailableRuleset(ruleset, installedById),
    )

    // Include installed rulesets that are no longer in curated sources.
    for (const installed of installedRulesets) {
      if (!merged.some((row) => String(row.id) === installed.id)) {
        merged.push(normalizeManagedInstalledRuleset(installed))
      }
    }

    return {
      success: true,
      data: merged,
    }
  } catch {
    // Backward compatibility for cores that only expose /suricata/rulesets.
    const legacy = await apiClient.get<ApiResponse<LegacySuricataRulesetApi[]>>('/suricata/rulesets')
    return {
      ...legacy.data,
      data: (legacy.data.data ?? []).map(normalizeLegacyRuleset),
    }
  }
}

/** Create a new Suricata ruleset from URL or local path. */
export const createSuricataRuleset = (
  data: { name: string; url?: string; path?: string; enabled?: boolean },
): Promise<ApiResponse<SuricataRuleset>> =>
  apiClient
    .post<ApiResponse<SuricataRuleset>>('/suricata/rulesets', data)
    .then((r) => r.data)

const encodeRulesetId = (id: string | number) => encodeURIComponent(String(id))

/** Update a Suricata ruleset. */
export const updateSuricataRuleset = (
  id: string | number,
  patch: Pick<SuricataRuleset, 'enabled'>,
): Promise<ApiResponse<SuricataRuleset>> =>
  apiClient
    .post<ApiResponse<SuricataRuleset>>(
      `/rulesets/${encodeRulesetId(id)}/${patch.enabled ? 'enable' : 'disable'}`,
    )
    .then((r) => r.data)

/** Trigger a check for updates for all managed Suricata rulesets. */
export const checkSuricataRulesetUpdates = (): Promise<ApiResponse<SuricataRuleset[]>> =>
  apiClient
    .post<ApiResponse<SuricataRuleset[]>>('/rulesets/check-all-updates')
    .then((r) => r.data)

const postRulesetAction = (
  id: string | number,
  action: 'install' | 'check-update' | 'update' | 'enable' | 'disable',
): Promise<ApiResponse<SuricataRuleset>> =>
  apiClient
    .post<ApiResponse<SuricataRuleset>>(`/rulesets/${encodeRulesetId(id)}/${action}`)
    .then((r) => r.data)

export const installSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'install')

export const checkSuricataRulesetUpdate = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'check-update')

export const updateManagedSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'update')

export const enableManagedSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'enable')

export const disableManagedSuricataRuleset = (id: string | number): Promise<ApiResponse<SuricataRuleset>> =>
  postRulesetAction(id, 'disable')

export const removeSuricataRuleset = (id: string | number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/rulesets/${encodeRulesetId(id)}`)
    .then((r) => r.data)

export interface RulesetRule {
  id: string
  action: string
  signature: string
  enabled: boolean
}

/** List all rules in a ruleset with their enabled/disabled state. */
export const getSuricataRulesetRules = (id: string | number): Promise<ApiResponse<RulesetRule[]>> =>
  apiClient
    .get<ApiResponse<RulesetRule[]>>(`/rulesets/${encodeRulesetId(id)}/rules`)
    .then((r) => r.data)

/** Update the set of disabled rule IDs for a ruleset. */
export const updateSuricataRulesetDisabledRules = (
  id: string | number,
  disabledIds: string[],
): Promise<ApiResponse<{ message: string }>> =>
  apiClient
    .post<ApiResponse<{ message: string }>>(`/rulesets/${encodeRulesetId(id)}/disabled-rules`, { ids: disabledIds })
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
