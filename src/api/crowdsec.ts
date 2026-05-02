import apiClient from './client'
import type { ApiResponse, CrowdSecStatus, CrowdSecDecision } from '../types'

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
