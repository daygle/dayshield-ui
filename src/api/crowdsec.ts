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

// Compatibility wrappers for page code that still references these names.
export const getCrowdSecStatus = getCrowdSecConfig
// Note: /crowdsec/alerts and DELETE /crowdsec/decisions/{id} are not implemented
// in the backend — the backend only exposes GET /crowdsec/decisions.
export const getCrowdSecAlerts = (): Promise<ApiResponse<CrowdSecAlert[]>> =>
  Promise.resolve({ data: [], success: true })
export const deleteCrowdSecDecision = (_id: number): Promise<ApiResponse<void>> =>
  Promise.reject(new Error('CrowdSec decision deletion is not supported. Decisions expire automatically based on their duration.'))
