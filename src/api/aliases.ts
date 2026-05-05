import apiClient from './client'
import type { ApiResponse, Alias } from '../types'

// Core alias API: GET/POST /firewall/aliases, DELETE /firewall/aliases/{name}
// Aliases are identified by name (not numeric id) for delete.

export const getAliases = (): Promise<ApiResponse<Alias[]>> =>
  apiClient
    .get<ApiResponse<Alias[]>>('/firewall/aliases')
    .then((r: { data: ApiResponse<Alias[]> }) => r.data)

export const createAlias = (alias: Omit<Alias, 'id'>): Promise<ApiResponse<Alias>> =>
  apiClient
    .post<ApiResponse<Alias>>('/firewall/aliases', alias)
    .then((r: { data: ApiResponse<Alias> }) => r.data)

export const deleteAlias = (name: string | number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/firewall/aliases/${encodeURIComponent(String(name))}`)
    .then((r: { data: ApiResponse<void> }) => r.data)
