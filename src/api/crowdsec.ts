import apiClient from './client'
import type { ApiResponse, CrowdSecStatus, CrowdSecDecision, CrowdSecAlert } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

export const getCrowdSecConfig = (): Promise<ApiResponse<CrowdSecStatus>> =>
  apiClient
    .get<ApiResponse<CrowdSecStatus>>('/crowdsec/config')
    .then((r) => r.data)

export const updateCrowdSecConfig = (
  config: Partial<CrowdSecStatus>,
): Promise<ApiResponse<CrowdSecStatus>> =>
  apiClient
    .post<ApiResponse<CrowdSecStatus>>('/crowdsec/config', config)
    .then((r) => r.data)

// ── Decisions ─────────────────────────────────────────────────────────────────

export const getCrowdSecDecisions = (): Promise<ApiResponse<CrowdSecDecision[]>> =>
  apiClient
    .get<ApiResponse<CrowdSecDecision[]>>('/crowdsec/decisions')
    .then((r) => r.data)

// Legacy / compatibility wrappers for older UI pages
export const getCrowdSecStatus = getCrowdSecConfig
export const getCrowdSecAlerts = (): Promise<ApiResponse<CrowdSecAlert[]>> =>
  apiClient
    .get<ApiResponse<CrowdSecAlert[]>>('/crowdsec/alerts')
    .then((r) => r.data)
export const deleteCrowdSecDecision = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/crowdsec/decisions/${id}`)
    .then((r) => r.data)
