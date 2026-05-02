import apiClient from './client'
import type {
  ApiResponse,
  NotifyConfig,
  NotifyTestRequest,
  NotifyTestResult,
} from '../types'

export const getNotifyConfig = (): Promise<ApiResponse<NotifyConfig>> =>
  apiClient
    .get<ApiResponse<NotifyConfig>>('/notify/config')
    .then((r) => r.data)

export const saveNotifyConfig = (
  config: NotifyConfig,
): Promise<ApiResponse<NotifyConfig>> =>
  apiClient
    .post<ApiResponse<NotifyConfig>>('/notify/config', config)
    .then((r) => r.data)

export const sendTestEmail = (
  req: NotifyTestRequest,
): Promise<ApiResponse<NotifyTestResult>> =>
  apiClient
    .post<ApiResponse<NotifyTestResult>>('/notify/test', req)
    .then((r) => r.data)

export const getNotifyCategories = (): Promise<ApiResponse<string[]>> =>
  apiClient
    .get<ApiResponse<string[]>>('/notify/categories')
    .then((r) => r.data)
