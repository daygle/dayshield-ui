import apiClient from './client';
import type { ApiResponse, Alias } from '../types';

// Core alias API: GET/POST /firewall/aliases, PUT/DELETE /firewall/aliases/{name}
// Aliases are identified by name (not numeric id) for update/delete.

export const getAliases = (): Promise<ApiResponse<Alias[]>> =>
  apiClient
    .get<ApiResponse<Alias[]>>('/firewall/aliases')
    .then((r: { data: ApiResponse<Alias[]> }) => r.data);

export const createAlias = (alias: Alias): Promise<ApiResponse<Alias>> =>
  apiClient
    .post<ApiResponse<Alias>>('/firewall/aliases', alias)
    .then((r: { data: ApiResponse<Alias> }) => r.data);

export const deleteAlias = (name: string | number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/firewall/aliases/${encodeURIComponent(String(name))}`)
    .then((r: { data: ApiResponse<void> }) => r.data);

export const updateAlias = (name: string | number, alias: Alias): Promise<ApiResponse<Alias>> =>
  apiClient
    .put<ApiResponse<Alias>>(`/firewall/aliases/${encodeURIComponent(String(name))}`, alias)
    .then((r: { data: ApiResponse<Alias> }) => r.data);
