import apiClient from './client'
import type { ApiResponse, Alias } from '../types'

export const getAliases = (): Promise<ApiResponse<Alias[]>> =>
  apiClient
    .get<ApiResponse<Alias[]>>('/firewall/aliases')
    .then((r) => r.data)

export const getAlias = (id: number): Promise<ApiResponse<Alias>> =>
  apiClient
    .get<ApiResponse<Alias>>(`/firewall/aliases/${id}`)
    .then((r) => r.data)

export const createAlias = (alias: Omit<Alias, 'id'>): Promise<ApiResponse<Alias>> =>
  apiClient
    .post<ApiResponse<Alias>>('/firewall/aliases', alias)
    .then((r) => r.data)

export const updateAlias = (
  id: number,
  alias: Partial<Omit<Alias, 'id'>>,
): Promise<ApiResponse<Alias>> =>
  apiClient
    .put<ApiResponse<Alias>>(`/firewall/aliases/${id}`, alias)
    .then((r) => r.data)

export const deleteAlias = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/firewall/aliases/${id}`)
    .then((r) => r.data)
