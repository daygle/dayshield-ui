import apiClient from './client';
import type {
  ApiResponse,
  CaptivePortalConfig,
  CaptivePortalStatus,
  CaptivePortalSessionsResponse,
  CaptivePortalSession,
  CreateCaptivePortalSessionRequest,
} from '../types';

export const getCaptivePortalConfig = (): Promise<ApiResponse<CaptivePortalConfig>> =>
  apiClient.get<ApiResponse<CaptivePortalConfig>>('/captive-portal/config').then((r) => r.data);

export const updateCaptivePortalConfig = (
  config: CaptivePortalConfig
): Promise<ApiResponse<CaptivePortalConfig>> =>
  apiClient
    .put<ApiResponse<CaptivePortalConfig>>('/captive-portal/config', config)
    .then((r) => r.data);

export const getCaptivePortalStatus = (): Promise<ApiResponse<CaptivePortalStatus>> =>
  apiClient.get<ApiResponse<CaptivePortalStatus>>('/captive-portal/status').then((r) => r.data);

export const getCaptivePortalSessions = (): Promise<ApiResponse<CaptivePortalSessionsResponse>> =>
  apiClient
    .get<ApiResponse<CaptivePortalSessionsResponse>>('/captive-portal/sessions')
    .then((r) => r.data);

export const createCaptivePortalSession = (
  request: CreateCaptivePortalSessionRequest
): Promise<ApiResponse<CaptivePortalSession>> =>
  apiClient
    .post<ApiResponse<CaptivePortalSession>>('/captive-portal/sessions', request)
    .then((r) => r.data);

export const revokeCaptivePortalSession = (sessionId: string): Promise<ApiResponse<void>> =>
  apiClient.delete<ApiResponse<void>>(`/captive-portal/sessions/${sessionId}`).then((r) => r.data);
