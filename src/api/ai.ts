import apiClient from './client'
import type { ApiResponse, ThreatEvent, BlockedEntry, AiEngineConfig } from '../types'

export const getAiThreats = (limit = 100): Promise<ApiResponse<ThreatEvent[]>> =>
  apiClient
    .get<ApiResponse<ThreatEvent[]>>('/ai/threats', { params: { limit } })
    .then((r) => r.data)

export const getAiThreatById = (id: string): Promise<ApiResponse<ThreatEvent>> =>
  apiClient
    .get<ApiResponse<ThreatEvent>>(`/ai/threats/${encodeURIComponent(id)}`)
    .then((r) => r.data)

export const getAiBlockedEntries = (): Promise<ApiResponse<BlockedEntry[]>> =>
  apiClient
    .get<ApiResponse<BlockedEntry[]>>('/ai/blocked')
    .then((r) => r.data)

export const unblockAiIp = (
  ip: string,
): Promise<ApiResponse<{ ip: string; unblocked: boolean }>> =>
  apiClient
    .post<ApiResponse<{ ip: string; unblocked: boolean }>>(
      `/ai/unblock/${encodeURIComponent(ip)}`,
    )
    .then((r) => r.data)

export const getAiEngineConfig = (): Promise<ApiResponse<AiEngineConfig>> =>
  apiClient
    .get<ApiResponse<AiEngineConfig>>('/ai/config')
    .then((r) => r.data)

export const updateAiEngineConfig = (
  config: AiEngineConfig,
): Promise<ApiResponse<AiEngineConfig>> =>
  apiClient
    .post<ApiResponse<AiEngineConfig>>('/ai/config', config)
    .then((r) => r.data)
