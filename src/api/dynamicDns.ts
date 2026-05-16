import apiClient from './client'
import type { ApiResponse, DynamicDnsConfig, DynamicDnsStatus } from '../types'

export const getDynamicDnsConfig = (): Promise<ApiResponse<DynamicDnsConfig>> =>
  apiClient
    .get<ApiResponse<DynamicDnsConfig>>('/dynamic-dns/config')
    .then((r) => r.data)

export const updateDynamicDnsConfig = (
  config: DynamicDnsConfig,
): Promise<ApiResponse<DynamicDnsConfig>> =>
  apiClient
    .post<ApiResponse<DynamicDnsConfig>>('/dynamic-dns/config', config)
    .then((r) => r.data)

export const getDynamicDnsStatus = (): Promise<ApiResponse<DynamicDnsStatus>> =>
  apiClient
    .get<ApiResponse<DynamicDnsStatus>>('/dynamic-dns/status')
    .then((r) => r.data)

export const triggerDynamicDnsUpdate = (): Promise<ApiResponse<DynamicDnsStatus>> =>
  apiClient
    .post<ApiResponse<DynamicDnsStatus>>('/dynamic-dns/update')
    .then((r) => r.data)
