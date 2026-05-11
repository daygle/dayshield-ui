import apiClient from './client'
import type { ApiResponse } from '../types'

export type HistoricalLogQuery = {
  from: string
  to: string
  source?: 'all' | 'system' | 'firewall' | 'suricata'
  q?: string
  limit?: number
}

export const searchLogs = (
  query: HistoricalLogQuery,
): Promise<ApiResponse<unknown[]>> =>
  apiClient
    .get<ApiResponse<unknown[]>>('/logs/search', { params: query })
    .then((r) => r.data)
