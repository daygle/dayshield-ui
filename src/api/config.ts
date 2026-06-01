import apiClient from './client';
import type { ApiResponse, ConfigHistorySettings, ConfigRevision, SystemConfig } from '../types';

/** List archived configuration revisions, newest first. */
export const listConfigHistory = (): Promise<ApiResponse<ConfigRevision[]>> =>
  apiClient
    .get<ApiResponse<ConfigRevision[]>>('/config/history')
    .then((r) => ({ ...r.data, data: r.data.data ?? [] }));

/** Fetch the full configuration captured in a single revision. */
export const getConfigRevision = (id: string): Promise<ApiResponse<SystemConfig>> =>
  apiClient
    .get<ApiResponse<SystemConfig>>(`/config/history/${encodeURIComponent(id)}`)
    .then((r) => r.data);

/** Restore a revision, making it the live configuration. */
export const restoreConfigRevision = (id: string): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>(`/config/history/${encodeURIComponent(id)}/restore`, {})
    .then((r) => r.data);

/** Delete a single archived revision. */
export const deleteConfigRevision = (id: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/config/history/${encodeURIComponent(id)}`)
    .then((r) => r.data);

/** Get the configuration history retention settings. */
export const getConfigHistorySettings = (): Promise<ApiResponse<ConfigHistorySettings>> =>
  apiClient.get<ApiResponse<ConfigHistorySettings>>('/config/history-settings').then((r) => r.data);

/** Update the configuration history retention settings. */
export const updateConfigHistorySettings = (
  settings: ConfigHistorySettings
): Promise<ApiResponse<ConfigHistorySettings>> =>
  apiClient
    .put<ApiResponse<ConfigHistorySettings>>('/config/history-settings', settings)
    .then((r) => r.data);
