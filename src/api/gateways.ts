import apiClient from './client'
import type { ApiResponse, Gateway, ListGatewaysResponse } from '../types'

export const getGateways = (): Promise<ApiResponse<ListGatewaysResponse>> =>
  apiClient
    .get<ApiResponse<ListGatewaysResponse>>('/gateways')
    .then((r) => r.data)

export const upsertGateway = (gateway: Gateway): Promise<ApiResponse<{ ok: boolean }>> =>
  apiClient
    .post<ApiResponse<{ ok: boolean }>>('/gateways', gateway)
    .then((r) => r.data)

export const deleteGateway = (name: string): Promise<ApiResponse<{ ok: boolean }>> =>
  apiClient
    .delete<ApiResponse<{ ok: boolean }>>(`/gateways/${name}`)
    .then((r) => r.data)
