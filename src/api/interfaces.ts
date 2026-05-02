import apiClient from './client'
import type { ApiResponse, NetworkInterface } from '../types'

export const getInterfaces = (): Promise<ApiResponse<NetworkInterface[]>> =>
  apiClient
    .get<ApiResponse<NetworkInterface[]>>('/interfaces')
    .then((r) => r.data)

export const getInterface = (name: string): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .get<ApiResponse<NetworkInterface>>(`/interfaces/${name}`)
    .then((r) => r.data)

export const createInterface = (
  iface: Omit<NetworkInterface, 'name'> & { name: string },
): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .post<ApiResponse<NetworkInterface>>('/interfaces', iface)
    .then((r) => r.data)

export const updateInterface = (
  name: string,
  iface: Partial<NetworkInterface>,
): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .put<ApiResponse<NetworkInterface>>(`/interfaces/${name}`, iface)
    .then((r) => r.data)

export const deleteInterface = (name: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/interfaces/${name}`)
    .then((r) => r.data)
