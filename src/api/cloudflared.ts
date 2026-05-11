import apiClient from './client'
import type {
  ApiResponse,
  CloudflaredActionResponse,
  CloudflaredConfig,
  CloudflaredLogsResponse,
  CloudflaredStatus,
} from '../types'

/** Get saved Cloudflared tunnel configuration. */
export const getCloudflaredConfig = (): Promise<ApiResponse<CloudflaredConfig>> =>
  apiClient
    .get<ApiResponse<CloudflaredConfig>>('/cloudflared/config')
    .then((r) => r.data)

/** Save Cloudflared tunnel configuration. */
export const updateCloudflaredConfig = (
  config: CloudflaredConfig,
): Promise<ApiResponse<CloudflaredConfig>> =>
  apiClient
    .post<ApiResponse<CloudflaredConfig>>('/cloudflared/config', config)
    .then((r) => r.data)

/** Get current Cloudflared service status. */
export const getCloudflaredStatus = (): Promise<ApiResponse<CloudflaredStatus>> =>
  apiClient
    .get<ApiResponse<CloudflaredStatus>>('/cloudflared/status')
    .then((r) => r.data)

/** Restart the Cloudflared system service. */
export const restartCloudflared = (): Promise<ApiResponse<CloudflaredActionResponse>> =>
  apiClient
    .post<ApiResponse<CloudflaredActionResponse>>('/cloudflared/restart')
    .then((r) => r.data)

/** Read recent Cloudflared logs. */
export const getCloudflaredLogs = (lines = 100): Promise<ApiResponse<CloudflaredLogsResponse>> =>
  apiClient
    .get<ApiResponse<CloudflaredLogsResponse>>('/cloudflared/logs', { params: { lines } })
    .then((r) => r.data)
