import apiClient from './client'
import type {
  ApiResponse,
  SystemStatus,
  SystemConfig,
  UpdateSettings,
  UpdatesStatus,
  UpdatesActionResult,
  UpdateComponent,
  DashboardSystemStatus,
  NetworkStatus,
  SecurityStatus,
  AcmeStatus,
} from '../types'

interface BackendSystemStatus {
  name?: string
  version?: string
  timestamp?: string
  services_healthy?: boolean
  service_count?: number
}

interface BackendSystemConfig {
  hostname?: string
  timezone?: string
  ntp_servers?: string[]
  dns_servers?: string[]
  ssh_enabled?: boolean
  ssh_port?: number
  web_port?: number
}

function normalizeSystemStatus(raw: unknown): SystemStatus {
  const value = (raw ?? {}) as Record<string, unknown>

  // Native UI shape
  if ('cpuUsage' in value || 'activeConnections' in value || 'lastUpdated' in value) {
    const st = value as Partial<SystemStatus>
    return {
      hostname: st.hostname ?? 'dayshield',
      version: st.version ?? '0.1.0',
      uptime: typeof st.uptime === 'number' && Number.isFinite(st.uptime) ? st.uptime : 0,
      cpuUsage: typeof st.cpuUsage === 'number' && Number.isFinite(st.cpuUsage) ? st.cpuUsage : 0,
      memoryUsed: typeof st.memoryUsed === 'number' && Number.isFinite(st.memoryUsed) ? st.memoryUsed : 0,
      memoryTotal: typeof st.memoryTotal === 'number' && Number.isFinite(st.memoryTotal) ? st.memoryTotal : 0,
      diskUsed: typeof st.diskUsed === 'number' && Number.isFinite(st.diskUsed) ? st.diskUsed : 0,
      diskTotal: typeof st.diskTotal === 'number' && Number.isFinite(st.diskTotal) ? st.diskTotal : 0,
      activeConnections:
        typeof st.activeConnections === 'number' && Number.isFinite(st.activeConnections)
          ? st.activeConnections
          : 0,
      lastUpdated:
        typeof st.lastUpdated === 'string' && !Number.isNaN(new Date(st.lastUpdated).getTime())
          ? st.lastUpdated
          : new Date().toISOString(),
      interfaces: typeof st.interfaces === 'number' && Number.isFinite(st.interfaces) ? st.interfaces : 0,
      firewallRules:
        typeof st.firewallRules === 'number' && Number.isFinite(st.firewallRules) ? st.firewallRules : 0,
    }
  }

  // Backend /system/status shape
  const st = value as BackendSystemStatus
  return {
    hostname: typeof st.name === 'string' && st.name.length ? st.name : 'DayShield Core',
    version: typeof st.version === 'string' ? st.version : '0.1.0',
    uptime: 0,
    cpuUsage: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    diskUsed: 0,
    diskTotal: 0,
    activeConnections:
      typeof st.service_count === 'number' && Number.isFinite(st.service_count)
        ? st.service_count
        : 0,
    lastUpdated:
      typeof st.timestamp === 'string' && !Number.isNaN(new Date(st.timestamp).getTime())
        ? st.timestamp
        : new Date().toISOString(),
    interfaces: 0,
    firewallRules: 0,
  }
}

function normalizeSystemConfig(raw: unknown): SystemConfig {
  const value = (raw ?? {}) as Record<string, unknown>

  // Native UI shape
  if ('ntpServers' in value || 'dnsServers' in value || 'sshEnabled' in value || 'webPort' in value) {
    const cfg = value as Partial<SystemConfig>
    return {
      hostname: cfg.hostname ?? 'dayshield',
      timezone: cfg.timezone ?? 'UTC',
      ntpServers: Array.isArray(cfg.ntpServers) ? cfg.ntpServers : [],
      dnsServers: Array.isArray(cfg.dnsServers) ? cfg.dnsServers : [],
      sshEnabled: Boolean(cfg.sshEnabled),
      sshPort: typeof cfg.sshPort === 'number' ? cfg.sshPort : 22,
      webPort: typeof cfg.webPort === 'number' ? cfg.webPort : 8443,
    }
  }

  // Backend snake_case shape
  const cfg = value as BackendSystemConfig
  return {
    hostname: cfg.hostname ?? 'dayshield',
    timezone: cfg.timezone ?? 'UTC',
    ntpServers: Array.isArray(cfg.ntp_servers) ? cfg.ntp_servers : [],
    dnsServers: Array.isArray(cfg.dns_servers) ? cfg.dns_servers : [],
    sshEnabled: Boolean(cfg.ssh_enabled),
    sshPort: typeof cfg.ssh_port === 'number' ? cfg.ssh_port : 22,
    webPort: typeof cfg.web_port === 'number' ? cfg.web_port : 8443,
  }
}

function toBackendSystemConfig(config: Partial<SystemConfig>): Partial<BackendSystemConfig> {
  return {
    hostname: config.hostname,
    timezone: config.timezone,
    ntp_servers: config.ntpServers,
    dns_servers: config.dnsServers,
    ssh_enabled: config.sshEnabled,
    ssh_port: config.sshPort,
    web_port: config.webPort,
  }
}

export const getSystemStatus = (): Promise<ApiResponse<SystemStatus>> =>
  apiClient
    .get<ApiResponse<unknown>>('/system/status')
    .then((r) => ({ ...r.data, data: normalizeSystemStatus(r.data.data) }))

export const getSystemConfig = (): Promise<ApiResponse<SystemConfig>> =>
  apiClient
    .get<ApiResponse<unknown>>('/system/config')
    .then((r) => ({ ...r.data, data: normalizeSystemConfig(r.data.data) }))

export const updateSystemConfig = (
  config: Partial<SystemConfig>,
): Promise<ApiResponse<SystemConfig>> =>
  apiClient
    .put<ApiResponse<unknown>>('/system/config', toBackendSystemConfig(config))
    .then((r) => ({ ...r.data, data: normalizeSystemConfig(r.data.data) }))

export const rebootSystem = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/system/reboot')
    .then((r) => r.data)

export const shutdownSystem = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/system/shutdown')
    .then((r) => r.data)

export const getUpdatesStatus = (): Promise<ApiResponse<UpdatesStatus>> =>
  apiClient
    .get<ApiResponse<UpdatesStatus>>('/system/updates/status')
    .then((r) => r.data)

export const getUpdateSettings = (): Promise<ApiResponse<UpdateSettings>> =>
  apiClient
    .get<ApiResponse<UpdateSettings>>('/system/updates/settings')
    .then((r) => r.data)

export const updateUpdateSettings = (
  settings: UpdateSettings,
): Promise<ApiResponse<UpdateSettings>> =>
  apiClient
    .put<ApiResponse<UpdateSettings>>('/system/updates/settings', settings)
    .then((r) => r.data)

export const checkForUpdates = (): Promise<ApiResponse<UpdatesStatus>> =>
  apiClient
    .post<ApiResponse<UpdatesStatus>>('/system/updates/check')
    .then((r) => r.data)

export const applyUpdates = (
  component: UpdateComponent = 'both',
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<UpdatesActionResult>>('/system/updates/apply', { component })
    .then((r) => r.data)

export const rollbackUpdates = (
  component: UpdateComponent = 'both',
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<UpdatesActionResult>>('/system/updates/rollback', { component })
    .then((r) => r.data)

export const validateUpdates = (
  component: UpdateComponent = 'both',
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<UpdatesActionResult>>('/system/updates/validate', { component })
    .then((r) => r.data)

// ── Dashboard-specific endpoints ──────────────────────────────────────────────

export const getDashboardSystemStatus = (): Promise<ApiResponse<DashboardSystemStatus>> =>
  apiClient
    .get<ApiResponse<DashboardSystemStatus>>('/dashboard/system')
    .then((r) => r.data)

export const getDashboardNetworkStatus = (): Promise<ApiResponse<NetworkStatus>> =>
  apiClient
    .get<ApiResponse<NetworkStatus>>('/dashboard/network')
    .then((r) => r.data)

export const getDashboardSecurityStatus = (): Promise<ApiResponse<SecurityStatus>> =>
  apiClient
    .get<ApiResponse<SecurityStatus>>('/dashboard/security')
    .then((r) => r.data)

export const getDashboardAcmeStatus = (): Promise<ApiResponse<AcmeStatus>> =>
  apiClient
    .get<ApiResponse<AcmeStatus>>('/dashboard/acme')
    .then((r) => r.data)

