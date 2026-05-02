import apiClient from './client'
import type { ApiResponse, CrowdSecStatus, CrowdSecDecision, CrowdSecAlert } from '../types'

// ── Status ────────────────────────────────────────────────────────────────────

export const getCrowdSecStatus = (): Promise<ApiResponse<CrowdSecStatus>> =>
  apiClient
    .get<ApiResponse<CrowdSecStatus>>('/crowdsec/status')
    .then((r) => r.data)

// ── Decisions ─────────────────────────────────────────────────────────────────

export const getCrowdSecDecisions = (): Promise<ApiResponse<CrowdSecDecision[]>> =>
  apiClient
    .get<ApiResponse<CrowdSecDecision[]>>('/crowdsec/decisions')
    .then((r) => r.data)

export const deleteCrowdSecDecision = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/crowdsec/decisions/${id}`)
    .then((r) => r.data)

// ── Alerts ────────────────────────────────────────────────────────────────────

export const getCrowdSecAlerts = (limit = 100): Promise<ApiResponse<CrowdSecAlert[]>> =>
  apiClient
    .get<ApiResponse<CrowdSecAlert[]>>('/crowdsec/alerts', { params: { limit } })
    .then((r) => r.data)
