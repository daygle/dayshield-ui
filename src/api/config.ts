import apiClient from './client';
import type { ApiResponse, ConfigRevision, SystemConfig } from '../types';

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
