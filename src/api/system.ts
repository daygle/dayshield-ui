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
  management_tls_acme_domain?: string
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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
    managementTlsAcmeDomain: typeof cfg.management_tls_acme_domain === 'string' ? cfg.management_tls_acme_domain : null,
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
    management_tls_acme_domain: config.managementTlsAcmeDomain ?? undefined,
  }
}

export const getSystemStatus = async (): Promise<ApiResponse<SystemStatus>> => {
  const baseResponse = await apiClient.get<ApiResponse<unknown>>('/system/status')
  const base = normalizeSystemStatus(baseResponse.data.data)

  const [dashboardSystemResult, dashboardNetworkResult, dashboardSecurityResult, metricsResult] = await Promise.allSettled([
    apiClient.get<ApiResponse<DashboardSystemStatus>>('/dashboard/system'),
    apiClient.get<ApiResponse<NetworkStatus>>('/dashboard/network'),
    apiClient.get<ApiResponse<SecurityStatus>>('/dashboard/security'),
    apiClient.get<ApiResponse<unknown>>('/metrics'),
  ])

  const next: SystemStatus = { ...base }

  if (dashboardSystemResult.status === 'fulfilled') {
    const dashboardSystem = dashboardSystemResult.value.data.data
    next.hostname = dashboardSystem.hostname || next.hostname
    next.uptime = toFiniteNumber(dashboardSystem.uptime, next.uptime)
    next.cpuUsage = toFiniteNumber(dashboardSystem.cpu_percent, next.cpuUsage)
  }

  if (dashboardNetworkResult.status === 'fulfilled') {
    const network = dashboardNetworkResult.value.data.data
    const lanCount = Array.isArray(network.lan_ifaces) ? network.lan_ifaces.length : 0
    next.interfaces = (network.wan_iface ? 1 : 0) + lanCount
  }

  if (dashboardSecurityResult.status === 'fulfilled') {
    const security = dashboardSecurityResult.value.data.data
    next.firewallRules = toFiniteNumber(security.firewall_rule_count, next.firewallRules)
    next.activeConnections = toFiniteNumber(security.firewall_state_count, next.activeConnections)
  }

  if (metricsResult.status === 'fulfilled') {
    const metrics = (metricsResult.value.data.data ?? {}) as Record<string, unknown>
    const system = (metrics.system ?? {}) as Record<string, unknown>

    next.lastUpdated =
      typeof metrics.timestamp === 'number' && Number.isFinite(metrics.timestamp)
        ? new Date(metrics.timestamp * 1000).toISOString()
        : next.lastUpdated
    next.uptime = toFiniteNumber(system.uptime_seconds, next.uptime)
    next.cpuUsage = toFiniteNumber(system.cpu_percent, next.cpuUsage)
    next.memoryUsed = toFiniteNumber(system.ram_used_bytes, next.memoryUsed)
    next.memoryTotal = toFiniteNumber(system.ram_total_bytes, next.memoryTotal)
    next.diskUsed = toFiniteNumber(system.disk_used_bytes, next.diskUsed)
    next.diskTotal = toFiniteNumber(system.disk_total_bytes, next.diskTotal)
  }

  return {
    ...baseResponse.data,
    data: next,
  }
}

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
  forcePartialApply: boolean = false,
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<UpdatesActionResult>>('/system/updates/apply', { component, forcePartialApply })
    .then((r) => r.data)

export const rollbackUpdates = (
  component: UpdateComponent = 'both',
  forcePartialApply: boolean = false,
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<UpdatesActionResult>>('/system/updates/rollback', { component, forcePartialApply })
    .then((r) => r.data)

export const validateUpdates = (
  component: UpdateComponent = 'both',
  forcePartialApply: boolean = false,
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<UpdatesActionResult>>('/system/updates/validate', { component, forcePartialApply })
    .then((r) => r.data)

export const markApplianceRebuildComplete = (): Promise<ApiResponse<UpdatesStatus>> =>
  apiClient
    .post<ApiResponse<UpdatesStatus>>('/system/updates/appliance-rebuild-complete')
    .then((r) => r.data)

export const rollbackRootfsLiveUpdate = (): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<UpdatesActionResult>>('/system/updates/rootfs-live-rollback')
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

