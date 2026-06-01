import apiClient from './client';
import type {
  ApiResponse,
  CaddyActionResponse,
  CaddyConfig,
  CaddyLogsResponse,
  CaddyStatus,
} from '../types';

/** Get saved Caddy reverse-proxy configuration. */
export const getCaddyConfig = (): Promise<ApiResponse<CaddyConfig>> =>
  apiClient.get<ApiResponse<CaddyConfig>>('/caddy/config').then((r) => r.data);

/** Save Caddy reverse-proxy configuration. */
export const updateCaddyConfig = (config: CaddyConfig): Promise<ApiResponse<CaddyConfig>> =>
  apiClient.post<ApiResponse<CaddyConfig>>('/caddy/config', config).then((r) => r.data);

/** Get current Caddy service status. */
export const getCaddyStatus = (): Promise<ApiResponse<CaddyStatus>> =>
  apiClient.get<ApiResponse<CaddyStatus>>('/caddy/status').then((r) => r.data);

/** Restart the Caddy system service. */
export const restartCaddy = (): Promise<ApiResponse<CaddyActionResponse>> =>
  apiClient.post<ApiResponse<CaddyActionResponse>>('/caddy/restart').then((r) => r.data);

/** Read recent Caddy logs. */
export const getCaddyLogs = (lines = 100): Promise<ApiResponse<CaddyLogsResponse>> =>
  apiClient
    .get<ApiResponse<CaddyLogsResponse>>('/caddy/logs', { params: { lines } })
    .then((r) => r.data);
