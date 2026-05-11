import apiClient from './client'
import type { ApiResponse, CrowdSecStatus, CrowdSecDecision } from '../types'

/** Get CrowdSec integration configuration. */
export const getCrowdSecConfig = (): Promise<ApiResponse<CrowdSecStatus>> =>
  apiClient
    .get<ApiResponse<CrowdSecStatus>>('/crowdsec/config')
    .then((r) => r.data)

/** Update CrowdSec integration configuration. */
export const updateCrowdSecConfig = (
  config: Partial<CrowdSecStatus>,
): Promise<ApiResponse<CrowdSecStatus>> =>
  apiClient
    .post<ApiResponse<CrowdSecStatus>>('/crowdsec/config', config)
    .then((r) => r.data)

/** List active CrowdSec decisions. */
export const getCrowdSecDecisions = (): Promise<ApiResponse<CrowdSecDecision[]>> =>
  apiClient
    .get<ApiResponse<CrowdSecDecision[]>>('/crowdsec/decisions')
    .then((r) => r.data)
