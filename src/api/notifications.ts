import apiClient from './client'
import type {
  ApiResponse,
  NotifyCategory,
  NotifyConfig,
  NotifyTestRequest,
  NotifyTestResult,
} from '../types'

type BackendNotifyCategory = 'suricata' | 'crowd_sec' | 'crowdsec' | 'acme' | 'system'

interface BackendNotifyConfig {
  enabled?: boolean
  smtp_server?: string
  smtp_port?: number
  smtp_username?: string
  smtp_password?: string
  from_address?: string
  to_addresses?: string[]
  categories?: BackendNotifyCategory[]
  rate_limit_per_minute?: number
  digest_mode?: boolean
}

function mapBackendCategoryToUi(cat: BackendNotifyCategory): NotifyCategory {
  if (cat === 'suricata') return 'ids'
  if (cat === 'crowd_sec' || cat === 'crowdsec') return 'crowdsec'
  if (cat === 'acme') return 'acme'
  return 'system'
}

function mapUiCategoryToBackend(cat: NotifyCategory): BackendNotifyCategory {
  if (cat === 'ids') return 'suricata'
  if (cat === 'crowdsec') return 'crowd_sec'
  if (cat === 'acme') return 'acme'
  return 'system'
}

function normalizeNotifyConfig(raw: unknown): NotifyConfig {
  const value = (raw ?? {}) as Record<string, unknown>

  // Newer UI/native shape
  if (
    typeof value.enabled === 'boolean' &&
    typeof value.smtp === 'object' &&
    Array.isArray(value.recipients)
  ) {
    const cfg = value as Partial<NotifyConfig>
    const smtp = (cfg.smtp ?? {}) as Partial<NotifyConfig['smtp']>
    return {
      enabled: Boolean(cfg.enabled),
      smtp: {
        host: smtp.host ?? '',
        port: typeof smtp.port === 'number' ? smtp.port : 587,
        username: smtp.username ?? '',
        password: smtp.password ?? '',
        tls: smtp.tls !== false,
        fromAddress: smtp.fromAddress ?? '',
        fromName: smtp.fromName ?? 'DayShield Alerts',
      },
      recipients: Array.isArray(cfg.recipients) ? cfg.recipients : [],
      categories: Array.isArray(cfg.categories)
        ? cfg.categories
        : ['ids', 'crowdsec', 'acme', 'system'],
      rateLimitMinutes:
        typeof cfg.rateLimitMinutes === 'number' ? cfg.rateLimitMinutes : 10,
      digestMode: Boolean(cfg.digestMode),
    }
  }

  // Backend snake_case shape
  const cfg = value as BackendNotifyConfig
  return {
    enabled: Boolean(cfg.enabled),
    smtp: {
      host: cfg.smtp_server ?? '',
      port: typeof cfg.smtp_port === 'number' ? cfg.smtp_port : 587,
      username: cfg.smtp_username ?? '',
      password: cfg.smtp_password ?? '',
      tls: true,
      fromAddress: cfg.from_address ?? '',
      fromName: 'DayShield Alerts',
    },
    recipients: Array.isArray(cfg.to_addresses) ? cfg.to_addresses : [],
    categories: Array.isArray(cfg.categories)
      ? cfg.categories.map(mapBackendCategoryToUi)
      : ['ids', 'crowdsec', 'acme', 'system'],
    rateLimitMinutes:
      typeof cfg.rate_limit_per_minute === 'number' ? cfg.rate_limit_per_minute : 10,
    digestMode: Boolean(cfg.digest_mode),
  }
}

function toBackendNotifyConfig(config: NotifyConfig): BackendNotifyConfig {
  return {
    enabled: config.enabled,
    smtp_server: config.smtp.host,
    smtp_port: config.smtp.port,
    smtp_username: config.smtp.username,
    smtp_password: config.smtp.password,
    from_address: config.smtp.fromAddress,
    to_addresses: config.recipients,
    categories: Array.from(new Set(config.categories.map(mapUiCategoryToBackend))),
    rate_limit_per_minute: config.rateLimitMinutes,
    digest_mode: config.digestMode,
  }
}

export const getNotifyConfig = (): Promise<ApiResponse<NotifyConfig>> =>
  apiClient
    .get<ApiResponse<unknown>>('/notify/config')
    .then((r) => ({ ...r.data, data: normalizeNotifyConfig(r.data.data) }))

export const saveNotifyConfig = (
  config: NotifyConfig,
): Promise<ApiResponse<NotifyConfig>> =>
  apiClient
    .post<ApiResponse<unknown>>('/notify/config', toBackendNotifyConfig(config))
    .then((r) => ({ ...r.data, data: normalizeNotifyConfig(r.data.data) }))

export const sendTestEmail = (
  req: NotifyTestRequest,
): Promise<ApiResponse<NotifyTestResult>> =>
  apiClient
    .post<ApiResponse<NotifyTestResult>>('/notify/test', req)
    .then((r) => r.data)

export const getNotifyCategories = (): Promise<ApiResponse<string[]>> =>
  apiClient
    .get<ApiResponse<string[]>>('/notify/categories')
    .then((r) => r.data)
