import apiClient from './client'
import type { ApiResponse, SystemStatus, SystemConfig } from '../types'

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
