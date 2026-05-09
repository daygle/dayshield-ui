import apiClient from './client'
import type { ApiResponse, NetworkInterface } from '../types'

type InterfacesPayload =
  | NetworkInterface[]
  | {
      configured?: NetworkInterface[]
      kernel?: unknown[]
    }

function normalizeInterfaces(payload: InterfacesPayload): NetworkInterface[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.configured)) return payload.configured
  return []
}

export const getInterfaces = (): Promise<ApiResponse<NetworkInterface[]>> =>
  apiClient
    .get<ApiResponse<InterfacesPayload>>('/interfaces')
    .then((r) => ({
      ...r.data,
      data: normalizeInterfaces(r.data.data),
    }))

// Core upserts by name via POST — use this for both create and update.
export const createInterface = (
  iface: Omit<NetworkInterface, 'name'> & { name: string },
): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .post<ApiResponse<NetworkInterface>>('/interfaces', iface)
    .then((r) => r.data)

export const updateInterface = (
  iface: NetworkInterface,
): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .post<ApiResponse<NetworkInterface>>('/interfaces', iface)
    .then((r) => r.data)

export const deleteInterface = (name: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/interfaces/${encodeURIComponent(name)}`)
    .then((r) => r.data)
