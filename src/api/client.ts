import axios from 'axios'
import type { ApiResponse, NetworkInterface, FirewallRule, SystemStatus } from '../types'

const BASE_URL = 'http://localhost:8080'

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Request interceptor for auth headers (extend later)
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
)

// Response interceptor for error normalisation
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ?? error.message ?? 'Unknown error'
    return Promise.reject(new Error(message))
  },
)

// ── System ──────────────────────────────────────────────────────────────────

export const getSystemStatus = (): Promise<ApiResponse<SystemStatus>> =>
  apiClient.get<ApiResponse<SystemStatus>>('/system/status').then((r) => r.data)

// ── Interfaces ───────────────────────────────────────────────────────────────

export const getInterfaces = (): Promise<ApiResponse<NetworkInterface[]>> =>
  apiClient
    .get<ApiResponse<NetworkInterface[]>>('/interfaces')
    .then((r) => r.data)

export const createInterface = (
  iface: Omit<NetworkInterface, 'name'> & { name: string },
): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .post<ApiResponse<NetworkInterface>>('/interfaces', iface)
    .then((r) => r.data)

// ── Firewall rules ───────────────────────────────────────────────────────────

export const getFirewallRules = (): Promise<ApiResponse<FirewallRule[]>> =>
  apiClient
    .get<ApiResponse<FirewallRule[]>>('/firewall/rules')
    .then((r) => r.data)

export const createFirewallRule = (
  rule: Omit<FirewallRule, 'id'>,
): Promise<ApiResponse<FirewallRule>> =>
  apiClient
    .post<ApiResponse<FirewallRule>>('/firewall/rules', rule)
    .then((r) => r.data)
