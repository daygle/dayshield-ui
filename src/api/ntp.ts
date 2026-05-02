import apiClient from './client'
import type { ApiResponse, NtpConfig, NtpStatus } from '../types'

export const getNtpConfig = (): Promise<ApiResponse<NtpConfig>> =>
  apiClient
    .get<ApiResponse<NtpConfig>>('/ntp/config')
    .then((r) => r.data)

export const updateNtpConfig = (config: NtpConfig): Promise<ApiResponse<NtpConfig>> =>
  apiClient
    .post<ApiResponse<NtpConfig>>('/ntp/config', config)
    .then((r) => r.data)

export const getNtpStatus = (): Promise<ApiResponse<NtpStatus>> =>
  apiClient
    .get<ApiResponse<NtpStatus>>('/ntp/status')
    .then((r) => r.data)

export const postNtpResync = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/ntp/resync')
    .then((r) => r.data)
