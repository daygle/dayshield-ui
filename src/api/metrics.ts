import apiClient from './client'
import type { ApiResponse, MetricsSnapshot, MetricsHistory } from '../types'

export const getMetrics = (): Promise<ApiResponse<MetricsSnapshot>> =>
  apiClient
    .get<ApiResponse<MetricsSnapshot>>('/metrics')
    .then((r) => r.data)

export const getMetricsHistory = (seconds = 300): Promise<ApiResponse<MetricsHistory>> =>
  apiClient
    .get<ApiResponse<MetricsHistory>>('/metrics/history', { params: { seconds } })
    .then((r) => r.data)
