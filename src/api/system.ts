import apiClient from './client'
import type {
  ApiResponse,
  SystemStatus,
  SystemConfig,
  DashboardSystemStatus,
  NetworkStatus,
  SecurityStatus,
  AcmeStatus,
} from '../types'

export const getSystemStatus = (): Promise<ApiResponse<SystemStatus>> =>
  apiClient
    .get<ApiResponse<SystemStatus>>('/system/status')
    .then((r) => r.data)

export const getSystemConfig = (): Promise<ApiResponse<SystemConfig>> =>
  apiClient
    .get<ApiResponse<SystemConfig>>('/system/config')
    .then((r) => r.data)

export const updateSystemConfig = (
  config: Partial<SystemConfig>,
): Promise<ApiResponse<SystemConfig>> =>
  apiClient
    .put<ApiResponse<SystemConfig>>('/system/config', config)
    .then((r) => r.data)

export const rebootSystem = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/system/reboot')
    .then((r) => r.data)

export const shutdownSystem = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/system/shutdown')
    .then((r) => r.data)

// ── Dashboard-specific endpoints ──────────────────────────────────────────────

export const getDashboardSystemStatus = (): Promise<ApiResponse<DashboardSystemStatus>> =>
  apiClient
    .get<ApiResponse<DashboardSystemStatus>>('/dashboard/system')
    .then((r) => r.data)

export const getDashboardNetworkStatus = (): Promise<ApiResponse<NetworkStatus>> =>
  apiClient
    .get<ApiResponse<NetworkStatus>>('/dashboard/network')
    .then((r) => r.data)

export const getDashboardSecurityStatus = (): Promise<ApiResponse<SecurityStatus>> =>
  apiClient
    .get<ApiResponse<SecurityStatus>>('/dashboard/security')
    .then((r) => r.data)

export const getDashboardAcmeStatus = (): Promise<ApiResponse<AcmeStatus>> =>
  apiClient
    .get<ApiResponse<AcmeStatus>>('/dashboard/acme')
    .then((r) => r.data)

