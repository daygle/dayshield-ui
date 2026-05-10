import apiClient from './client'
import type { ApiResponse, NtpConfig, NtpStatus } from '../types'

interface BackendNtpConfig {
  enabled?: boolean
  upstream_servers?: string[]
  serve_clients?: boolean
  listen_interfaces?: string[]
}

interface BackendNtpStatus {
  synchronized?: boolean
  server?: string | null
  offset_ms?: number
  jitter_ms?: number
  stratum?: number
}

function normalizeNtpConfig(raw: unknown): NtpConfig {
  const value = (raw ?? {}) as Record<string, unknown>
  if (Array.isArray(value.servers) || 'serveLan' in value || 'listenInterfaces' in value) {
    const ui = value as NtpConfig
    return {
      enabled: Boolean(ui.enabled),
      servers: Array.isArray(ui.servers) ? ui.servers : [],
      serveLan: Boolean(ui.serveLan),
      listenInterfaces: Array.isArray(ui.listenInterfaces) ? ui.listenInterfaces : [],
    }
  }

  const cfg = value as BackendNtpConfig
  return {
    enabled: Boolean(cfg.enabled),
    servers: Array.isArray(cfg.upstream_servers) ? cfg.upstream_servers : [],
    serveLan: Boolean(cfg.serve_clients),
    listenInterfaces: Array.isArray(cfg.listen_interfaces) ? cfg.listen_interfaces : [],
  }
}

function toBackendNtpConfig(config: NtpConfig): BackendNtpConfig {
  return {
    enabled: config.enabled,
    upstream_servers: config.servers,
    serve_clients: config.serveLan,
    listen_interfaces: config.listenInterfaces,
  }
}

function normalizeNtpStatus(raw: unknown): NtpStatus {
  const value = (raw ?? {}) as Record<string, unknown>
  if ('synced' in value || 'upstream' in value || 'offset' in value || 'jitter' in value) {
    const st = value as NtpStatus
    return {
      synced: Boolean(st.synced),
      upstream: st.upstream ?? '',
      offset: typeof st.offset === 'number' ? st.offset : 0,
      jitter: typeof st.jitter === 'number' ? st.jitter : 0,
      stratum: typeof st.stratum === 'number' ? st.stratum : 0,
    }
  }

  const st = value as BackendNtpStatus
  return {
    synced: Boolean(st.synchronized),
    upstream: st.server ?? '',
    offset: typeof st.offset_ms === 'number' ? st.offset_ms : 0,
    jitter: typeof st.jitter_ms === 'number' ? st.jitter_ms : 0,
    stratum: typeof st.stratum === 'number' ? st.stratum : 0,
  }
}

export const getNtpConfig = (): Promise<ApiResponse<NtpConfig>> =>
  apiClient
    .get<ApiResponse<unknown>>('/ntp/config')
    .then((r) => ({ ...r.data, data: normalizeNtpConfig(r.data.data) }))

export const updateNtpConfig = (config: NtpConfig): Promise<ApiResponse<NtpConfig>> =>
  apiClient
    .post<ApiResponse<unknown>>('/ntp/config', toBackendNtpConfig(config))
    .then((r) => ({ ...r.data, data: normalizeNtpConfig(r.data.data) }))

export const getNtpStatus = (): Promise<ApiResponse<NtpStatus>> =>
  apiClient
    .get<ApiResponse<unknown>>('/ntp/status')
    .then((r) => ({ ...r.data, data: normalizeNtpStatus(r.data.data) }))

export const postNtpResync = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/ntp/resync')
    .then((r) => r.data)
