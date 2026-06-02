import apiClient from './client';
import type {
  ApiResponse,
  SystemStatus,
  SystemConfig,
  UpdateSettings,
  UpdatesStatus,
  UpdatesActionResult,
  UpdateComponent,
  RootfsUpdateStatus,
  RootfsTransactionState,
  SystemSchedules,
  ScheduleJobType,
  DashboardSystemStatus,
  NetworkStatus,
  SecurityStatus,
  AcmeStatus,
  ComponentUpdateStatus,
  UpdateOperationProgress,
} from '../types';

interface BackendSystemStatus {
  name?: string;
  version?: string;
  timestamp?: string;
  services_healthy?: boolean;
  service_count?: number;
}

interface BackendSystemConfig {
  hostname?: string;
  timezone?: string;
  ntpServers?: string[];
  dnsServers?: string[];
  sshEnabled?: boolean;
  sshPort?: number;
  sshPermitRootLogin?: boolean;
  sshPasswordAuthentication?: boolean;
  sshAuthorizedKeys?: string[];
  sshListenInterfaces?: string[];
  webPort?: number;
  ipv6Enabled?: boolean;
  managementTlsAcmeDomain?: string | null;
  ntp_servers?: string[];
  dns_servers?: string[];
  ssh_enabled?: boolean;
  ssh_port?: number;
  ssh_permit_root_login?: boolean;
  ssh_password_authentication?: boolean;
  ssh_authorized_keys?: string[];
  ssh_listen_interfaces?: string[];
  web_port?: number;
  ipv6_enabled?: boolean;
  management_tls_acme_domain?: string;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

function normalizeSystemStatus(raw: unknown): SystemStatus {
  const value = (raw ?? {}) as Record<string, unknown>;

  // Native UI shape
  if ('cpuUsage' in value || 'activeConnections' in value || 'lastUpdated' in value) {
    const st = value as Partial<SystemStatus>;
    return {
      hostname: st.hostname ?? 'dayshield',
      version: st.version ?? '0.1.0',
      uptime: typeof st.uptime === 'number' && Number.isFinite(st.uptime) ? st.uptime : 0,
      cpuUsage: typeof st.cpuUsage === 'number' && Number.isFinite(st.cpuUsage) ? st.cpuUsage : 0,
      memoryUsed:
        typeof st.memoryUsed === 'number' && Number.isFinite(st.memoryUsed) ? st.memoryUsed : 0,
      memoryTotal:
        typeof st.memoryTotal === 'number' && Number.isFinite(st.memoryTotal) ? st.memoryTotal : 0,
      diskUsed: typeof st.diskUsed === 'number' && Number.isFinite(st.diskUsed) ? st.diskUsed : 0,
      diskTotal:
        typeof st.diskTotal === 'number' && Number.isFinite(st.diskTotal) ? st.diskTotal : 0,
      activeConnections:
        typeof st.activeConnections === 'number' && Number.isFinite(st.activeConnections)
          ? st.activeConnections
          : 0,
      lastUpdated:
        typeof st.lastUpdated === 'string' && !Number.isNaN(new Date(st.lastUpdated).getTime())
          ? st.lastUpdated
          : new Date().toISOString(),
      interfaces:
        typeof st.interfaces === 'number' && Number.isFinite(st.interfaces) ? st.interfaces : 0,
      firewallRules:
        typeof st.firewallRules === 'number' && Number.isFinite(st.firewallRules)
          ? st.firewallRules
          : 0,
    };
  }

  // Backend /system/status shape
  const st = value as BackendSystemStatus;
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
  };
}

function normalizeSystemConfig(raw: unknown): SystemConfig {
  const value = (raw ?? {}) as Record<string, unknown>;

  // Native UI shape
  if (
    'ntpServers' in value ||
    'dnsServers' in value ||
    'sshEnabled' in value ||
    'webPort' in value ||
    'ipv6Enabled' in value
  ) {
    const cfg = value as Partial<SystemConfig>;
    return {
      hostname: cfg.hostname ?? 'dayshield',
      timezone: cfg.timezone ?? 'UTC',
      ntpServers: Array.isArray(cfg.ntpServers) ? cfg.ntpServers : [],
      dnsServers: Array.isArray(cfg.dnsServers) ? cfg.dnsServers : [],
      sshEnabled: Boolean(cfg.sshEnabled),
      sshPort: typeof cfg.sshPort === 'number' ? cfg.sshPort : 22,
      sshPermitRootLogin: cfg.sshPermitRootLogin ?? true,
      sshPasswordAuthentication: cfg.sshPasswordAuthentication ?? true,
      sshAuthorizedKeys: Array.isArray(cfg.sshAuthorizedKeys) ? cfg.sshAuthorizedKeys : [],
      sshListenInterfaces: Array.isArray(cfg.sshListenInterfaces) ? cfg.sshListenInterfaces : [],
      webPort: typeof cfg.webPort === 'number' ? cfg.webPort : 8443,
      ipv6Enabled: Boolean(cfg.ipv6Enabled),
      managementTlsAcmeDomain: cfg.managementTlsAcmeDomain ?? null,
    };
  }

  // Backend snake_case shape
  const cfg = value as BackendSystemConfig;
  return {
    hostname: cfg.hostname ?? 'dayshield',
    timezone: cfg.timezone ?? 'UTC',
    ntpServers: Array.isArray(cfg.ntpServers)
      ? cfg.ntpServers
      : Array.isArray(cfg.ntp_servers)
        ? cfg.ntp_servers
        : [],
    dnsServers: Array.isArray(cfg.dnsServers)
      ? cfg.dnsServers
      : Array.isArray(cfg.dns_servers)
        ? cfg.dns_servers
        : [],
    sshEnabled: typeof cfg.sshEnabled === 'boolean' ? cfg.sshEnabled : Boolean(cfg.ssh_enabled),
    sshPort:
      typeof cfg.sshPort === 'number'
        ? cfg.sshPort
        : typeof cfg.ssh_port === 'number'
          ? cfg.ssh_port
          : 22,
    sshPermitRootLogin:
      typeof cfg.sshPermitRootLogin === 'boolean'
        ? cfg.sshPermitRootLogin
        : typeof cfg.ssh_permit_root_login === 'boolean'
          ? cfg.ssh_permit_root_login
          : true,
    sshPasswordAuthentication:
      typeof cfg.sshPasswordAuthentication === 'boolean'
        ? cfg.sshPasswordAuthentication
        : typeof cfg.ssh_password_authentication === 'boolean'
          ? cfg.ssh_password_authentication
          : true,
    sshAuthorizedKeys: Array.isArray(cfg.sshAuthorizedKeys)
      ? cfg.sshAuthorizedKeys
      : Array.isArray(cfg.ssh_authorized_keys)
        ? cfg.ssh_authorized_keys
        : [],
    sshListenInterfaces: Array.isArray(cfg.sshListenInterfaces)
      ? cfg.sshListenInterfaces
      : Array.isArray(cfg.ssh_listen_interfaces)
        ? cfg.ssh_listen_interfaces
        : [],
    webPort:
      typeof cfg.webPort === 'number'
        ? cfg.webPort
        : typeof cfg.web_port === 'number'
          ? cfg.web_port
          : 8443,
    ipv6Enabled: typeof cfg.ipv6Enabled === 'boolean' ? cfg.ipv6Enabled : Boolean(cfg.ipv6_enabled),
    managementTlsAcmeDomain:
      typeof cfg.managementTlsAcmeDomain === 'string'
        ? cfg.managementTlsAcmeDomain
        : typeof cfg.management_tls_acme_domain === 'string'
          ? cfg.management_tls_acme_domain
          : null,
  };
}

function normalizeUpdateSettings(raw: unknown): UpdateSettings {
  const value = asRecord(raw);
  return {
    autoCheckEnabled: Boolean(value.autoCheckEnabled ?? value.auto_check_enabled),
    autoCheckFrequency:
      (asString(
        value.autoCheckFrequency ?? value.auto_check_frequency
      ) as UpdateSettings['autoCheckFrequency']) ?? 'daily',
    autoCheckTime: asString(value.autoCheckTime ?? value.auto_check_time) ?? '03:00',
    autoCheckWeekday:
      (asString(
        value.autoCheckWeekday ?? value.auto_check_weekday
      ) as UpdateSettings['autoCheckWeekday']) ?? 'monday',
    autoCheckMonthDays: (Array.isArray(value.autoCheckMonthDays)
      ? value.autoCheckMonthDays
      : Array.isArray(value.auto_check_month_days)
        ? value.auto_check_month_days
        : [1]
    ).filter((item): item is number => typeof item === 'number' && Number.isFinite(item)),
    autoApplyUpdates: Boolean(value.autoApplyUpdates ?? value.auto_apply_updates ?? false),
    autoRebootAfterApply: Boolean(
      value.autoRebootAfterApply ?? value.auto_reboot_after_apply ?? false
    ),
    rebootRequiredAfterApply: Boolean(
      value.rebootRequiredAfterApply ?? value.reboot_required_after_apply ?? true
    ),
    deployRuntimeAfterApply: Boolean(
      value.deployRuntimeAfterApply ?? value.deploy_runtime_after_apply ?? true
    ),
    registryUrl: asString(value.registryUrl ?? value.registry_url),
    verifyArtifactSignatures: asBoolean(
      value.verifyArtifactSignatures ?? value.verify_artifact_signatures
    ),
    encryptUpdateConfigBackups: asBoolean(
      value.encryptUpdateConfigBackups ?? value.encrypt_update_config_backups
    ),
    requireSignedCommits: Boolean(value.requireSignedCommits ?? value.require_signed_commits),
    verifyRootfsMetadata: Boolean(value.verifyRootfsMetadata ?? value.verify_rootfs_metadata),
    trustedSignersFile: asString(value.trustedSignersFile ?? value.trusted_signers_file) ?? '',
    bootstrapMissingRootfsRepo: Boolean(
      value.bootstrapMissingRootfsRepo ?? value.bootstrap_missing_rootfs_repo
    ),
    coreRepoPath: asString(value.coreRepoPath ?? value.core_repo_path) ?? '',
    uiRepoPath: asString(value.uiRepoPath ?? value.ui_repo_path) ?? '',
    rootfsRepoPath: asString(value.rootfsRepoPath ?? value.rootfs_repo_path) ?? '',
    coreRepoUrl: asString(value.coreRepoUrl ?? value.core_repo_url) ?? '',
    uiRepoUrl: asString(value.uiRepoUrl ?? value.ui_repo_url) ?? '',
    rootfsRepoUrl: asString(value.rootfsRepoUrl ?? value.rootfs_repo_url) ?? '',
    coreBranch: asString(value.coreBranch ?? value.core_branch) ?? 'main',
    uiBranch: asString(value.uiBranch ?? value.ui_branch) ?? 'main',
    rootfsBranch: asString(value.rootfsBranch ?? value.rootfs_branch) ?? 'main',
  };
}

function normalizeComponentUpdateStatus(raw: unknown): ComponentUpdateStatus {
  const value = asRecord(raw);
  return {
    component: asString(value.component) ?? 'core',
    repoPath: asString(value.repoPath ?? value.repo_path) ?? '',
    branch: asString(value.branch) ?? 'main',
    validRepo: Boolean(value.validRepo ?? value.valid_repo),
    dirtyWorktree: Boolean(value.dirtyWorktree ?? value.dirty_worktree),
    currentCommit: asString(value.currentCommit ?? value.current_commit),
    remoteCommit: asString(value.remoteCommit ?? value.remote_commit),
    currentVersion: asString(value.currentVersion ?? value.current_version),
    remoteVersion: asString(value.remoteVersion ?? value.remote_version),
    registryVersion: asString(value.registryVersion ?? value.registry_version),
    updateAvailable: Boolean(value.updateAvailable ?? value.update_available),
    rollbackCommit: asString(value.rollbackCommit ?? value.rollback_commit),
    rollbackVersion: asString(value.rollbackVersion ?? value.rollback_version),
    lastAppliedCommit: asString(value.lastAppliedCommit ?? value.last_applied_commit),
    lastAppliedVersion: asString(value.lastAppliedVersion ?? value.last_applied_version),
    lastError: asString(value.lastError ?? value.last_error),
  };
}

function normalizeUpdateOperationProgress(raw: unknown): UpdateOperationProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = asRecord(raw);
  const operation = asString(value.operation);
  if (!operation) return undefined;
  const percent = asNumber(value.percent ?? value.progressPercent ?? value.progress_percent);

  return {
    operation,
    phase: asString(value.phase) ?? 'running',
    status: asString(value.status) ?? 'running',
    message: asString(value.message) ?? '',
    component: asString(value.component),
    percent:
      typeof percent === 'number' ? Math.max(0, Math.min(100, Math.round(percent))) : undefined,
    bytesDownloaded: asNumber(value.bytesDownloaded ?? value.bytes_downloaded),
    bytesTotal: asNumber(value.bytesTotal ?? value.bytes_total),
    startedAt: asString(value.startedAt ?? value.started_at) ?? new Date().toISOString(),
    updatedAt: asString(value.updatedAt ?? value.updated_at) ?? new Date().toISOString(),
    completedAt: asString(value.completedAt ?? value.completed_at),
  };
}

function normalizeUpdatesStatus(raw: unknown): UpdatesStatus {
  const value = asRecord(raw);
  const settings = normalizeUpdateSettings(
    value.settings ?? value.updateSettings ?? value.update_settings
  );
  const componentsRaw = Array.isArray(value.components) ? value.components : [];
  const operationLogsRaw = value.operationLogs ?? value.operation_logs;

  return {
    settings,
    lastCheckedAt: asString(value.lastCheckedAt ?? value.last_checked_at),
    lastAppliedAt: asString(value.lastAppliedAt ?? value.last_applied_at),
    pendingReboot: Boolean(value.pendingReboot ?? value.pending_reboot),
    pendingApplianceRebuild: Boolean(
      value.pendingApplianceRebuild ?? value.pending_appliance_rebuild
    ),
    applianceRebuildReason: asString(
      value.applianceRebuildReason ?? value.appliance_rebuild_reason
    ),
    applianceRebuildMarkedAt: asString(
      value.applianceRebuildMarkedAt ?? value.appliance_rebuild_marked_at
    ),
    components: componentsRaw.map(normalizeComponentUpdateStatus),
    availableUpdateCount: asNumber(value.availableUpdateCount ?? value.available_update_count),
    operationLogs: Array.isArray(operationLogsRaw)
      ? operationLogsRaw.map((entry: unknown) => {
          const item = asRecord(entry);
          return {
            timestamp: asString(item.timestamp) ?? new Date().toISOString(),
            operation: asString(item.operation) ?? 'check',
            level: asString(item.level) ?? 'info',
            message: asString(item.message) ?? '',
            component: asString(item.component),
            fromVersion: asString(item.fromVersion ?? item.from_version),
            toVersion: asString(item.toVersion ?? item.to_version),
          };
        })
      : undefined,
    progress: normalizeUpdateOperationProgress(
      value.progress ?? value.updateProgress ?? value.update_progress
    ),
  };
}

function normalizeUpdatesActionResult(raw: unknown): UpdatesActionResult {
  const value = asRecord(raw);
  return {
    operation: asString(value.operation) ?? 'apply',
    success: Boolean(value.success),
    message: asString(value.message) ?? '',
    details: asStringArray(value.details) ?? [],
    status: normalizeUpdatesStatus(value.status),
  };
}

function toBackendSystemConfig(config: Partial<SystemConfig>): Partial<BackendSystemConfig> {
  return {
    hostname: config.hostname,
    timezone: config.timezone,
    ntpServers: config.ntpServers,
    dnsServers: config.dnsServers,
    sshEnabled: config.sshEnabled,
    sshPort: config.sshPort,
    sshPermitRootLogin: config.sshPermitRootLogin,
    sshPasswordAuthentication: config.sshPasswordAuthentication,
    sshAuthorizedKeys: config.sshAuthorizedKeys,
    sshListenInterfaces: config.sshListenInterfaces,
    webPort: config.webPort,
    ipv6Enabled: config.ipv6Enabled,
    managementTlsAcmeDomain: config.managementTlsAcmeDomain ?? undefined,
  };
}

export const getSystemStatus = async (): Promise<ApiResponse<SystemStatus>> => {
  const baseResponse = await apiClient.get<ApiResponse<unknown>>('/system/status');
  const base = normalizeSystemStatus(baseResponse.data.data);

  const [dashboardSystemResult, dashboardNetworkResult, dashboardSecurityResult, metricsResult] =
    await Promise.allSettled([
      apiClient.get<ApiResponse<DashboardSystemStatus>>('/dashboard/system'),
      apiClient.get<ApiResponse<NetworkStatus>>('/dashboard/network'),
      apiClient.get<ApiResponse<SecurityStatus>>('/dashboard/security'),
      apiClient.get<ApiResponse<unknown>>('/metrics'),
    ]);

  const next: SystemStatus = { ...base };

  if (dashboardSystemResult.status === 'fulfilled') {
    const dashboardSystem = dashboardSystemResult.value.data.data;
    next.hostname = dashboardSystem.hostname || next.hostname;
    next.uptime = toFiniteNumber(dashboardSystem.uptime, next.uptime);
    next.cpuUsage = toFiniteNumber(dashboardSystem.cpu_percent, next.cpuUsage);
  }

  if (dashboardNetworkResult.status === 'fulfilled') {
    const network = dashboardNetworkResult.value.data.data;
    const lanCount = Array.isArray(network.lan_ifaces) ? network.lan_ifaces.length : 0;
    next.interfaces = (network.wan_iface ? 1 : 0) + lanCount;
  }

  if (dashboardSecurityResult.status === 'fulfilled') {
    const security = dashboardSecurityResult.value.data.data;
    next.firewallRules = toFiniteNumber(security.firewall_rule_count, next.firewallRules);
    next.activeConnections = toFiniteNumber(security.firewall_state_count, next.activeConnections);
  }

  if (metricsResult.status === 'fulfilled') {
    const metrics = (metricsResult.value.data.data ?? {}) as Record<string, unknown>;
    const system = (metrics.system ?? {}) as Record<string, unknown>;

    next.lastUpdated =
      typeof metrics.timestamp === 'number' && Number.isFinite(metrics.timestamp)
        ? new Date(metrics.timestamp * 1000).toISOString()
        : next.lastUpdated;
    next.uptime = toFiniteNumber(system.uptime_seconds, next.uptime);
    next.cpuUsage = toFiniteNumber(system.cpu_percent, next.cpuUsage);
    next.memoryUsed = toFiniteNumber(system.ram_used_bytes, next.memoryUsed);
    next.memoryTotal = toFiniteNumber(system.ram_total_bytes, next.memoryTotal);
    next.diskUsed = toFiniteNumber(system.disk_used_bytes, next.diskUsed);
    next.diskTotal = toFiniteNumber(system.disk_total_bytes, next.diskTotal);
  }

  return {
    ...baseResponse.data,
    data: next,
  };
};

export const getSystemConfig = (): Promise<ApiResponse<SystemConfig>> =>
  apiClient
    .get<ApiResponse<unknown>>('/system/config')
    .then((r) => ({ ...r.data, data: normalizeSystemConfig(r.data.data) }));

export const updateSystemConfig = (
  config: Partial<SystemConfig>
): Promise<ApiResponse<SystemConfig>> =>
  apiClient
    .put<ApiResponse<unknown>>('/system/config', toBackendSystemConfig(config))
    .then((r) => ({ ...r.data, data: normalizeSystemConfig(r.data.data) }));

export const rebootSystem = (): Promise<ApiResponse<void>> =>
  apiClient.post<ApiResponse<void>>('/system/reboot').then((r) => r.data);

export const shutdownSystem = (): Promise<ApiResponse<void>> =>
  apiClient.post<ApiResponse<void>>('/system/shutdown').then((r) => r.data);

export type ServiceAction = 'start' | 'stop' | 'restart';

export interface ServiceUnitStatus {
  unit: string;
  available: boolean;
  running: boolean;
  loadState: string;
  activeState: string;
  subState: string;
  unitFileState: string;
  lastError?: string | null;
}

export interface ServiceActionDescriptor {
  id: ServiceAction;
  label: string;
  method: 'POST';
  href: string;
  variant: 'primary' | 'neutral' | 'danger';
  requiresConfirmation: boolean;
  enabled: boolean;
  disabledReason?: string | null;
}

export interface ServiceRuntimeStatus {
  id: string;
  title: string;
  category: string;
  description: string;
  configured: boolean;
  status: string;
  statusLabel: string;
  configuredUnits: string[];
  units: ServiceUnitStatus[];
  actions: ServiceActionDescriptor[];
  updatedAt: string;
}

export interface ServiceListResponse {
  generatedAt: string;
  services: ServiceRuntimeStatus[];
}

export interface ServiceActionResponse {
  action: ServiceAction;
  message: string;
  affectedUnits: string[];
  service: ServiceRuntimeStatus;
}

export const getSystemServices = (): Promise<ApiResponse<ServiceListResponse>> =>
  apiClient.get<ApiResponse<ServiceListResponse>>('/system/services').then((r) => r.data);

export const getSystemService = (serviceId: string): Promise<ApiResponse<ServiceRuntimeStatus>> =>
  apiClient
    .get<ApiResponse<ServiceRuntimeStatus>>(`/system/services/${encodeURIComponent(serviceId)}`)
    .then((r) => r.data);

export const controlSystemService = (
  serviceId: string,
  action: ServiceAction
): Promise<ApiResponse<ServiceActionResponse>> =>
  apiClient
    .post<
      ApiResponse<ServiceActionResponse>
    >(`/system/services/${encodeURIComponent(serviceId)}/${action}`)
    .then((r) => r.data);

export const getUpdatesStatus = (): Promise<ApiResponse<UpdatesStatus>> =>
  apiClient.get<ApiResponse<unknown>>('/system/updates/status').then((r) => ({
    ...r.data,
    data: normalizeUpdatesStatus(r.data.data),
  }));

export const getUpdateSettings = (): Promise<ApiResponse<UpdateSettings>> =>
  apiClient
    .get<ApiResponse<unknown>>('/system/updates/settings')
    .then((r) => ({ ...r.data, data: normalizeUpdateSettings(r.data.data) }));

export const updateUpdateSettings = (
  settings: UpdateSettings
): Promise<ApiResponse<UpdateSettings>> =>
  apiClient
    .put<ApiResponse<unknown>>('/system/updates/settings', settings)
    .then((r) => ({ ...r.data, data: normalizeUpdateSettings(r.data.data) }));

export const checkForUpdates = (): Promise<ApiResponse<UpdatesStatus>> =>
  apiClient.post<ApiResponse<unknown>>('/system/updates/check').then((r) => ({
    ...r.data,
    data: normalizeUpdatesStatus(r.data.data),
  }));

export const applyUpdates = (
  component: UpdateComponent = 'both',
  forcePartialApply: boolean = false
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<unknown>>('/system/updates/apply', { component, forcePartialApply })
    .then((r) => ({ ...r.data, data: normalizeUpdatesActionResult(r.data.data) }));

export const rollbackUpdates = (
  component: UpdateComponent = 'both',
  forcePartialApply: boolean = false
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<unknown>>('/system/updates/rollback', { component, forcePartialApply })
    .then((r) => ({ ...r.data, data: normalizeUpdatesActionResult(r.data.data) }));

export const validateUpdates = (
  component: UpdateComponent = 'both',
  forcePartialApply: boolean = false
): Promise<ApiResponse<UpdatesActionResult>> =>
  apiClient
    .post<ApiResponse<unknown>>('/system/updates/validate', { component, forcePartialApply })
    .then((r) => ({ ...r.data, data: normalizeUpdatesActionResult(r.data.data) }));

const ROOTFS_TX_STATES: RootfsTransactionState[] = [
  'idle',
  'checking',
  'staging',
  'applying',
  'rolling_back',
];

function normalizeRootfsUpdateStatus(raw: unknown): RootfsUpdateStatus {
  const value = asRecord(raw);
  const txRaw = asString(value.transactionState ?? value.transaction_state);
  const transactionState: RootfsTransactionState = ROOTFS_TX_STATES.includes(
    txRaw as RootfsTransactionState
  )
    ? (txRaw as RootfsTransactionState)
    : 'idle';
  const currentSlotRaw =
    (asString(value.currentSlot ?? value.current_slot) ?? 'A').toUpperCase();
  const standbySlotRaw =
    (asString(value.standbySlot ?? value.standby_slot) ??
      (currentSlotRaw === 'A' ? 'B' : 'A')).toUpperCase();
  return {
    supported: Boolean(value.supported),
    checkedAt: asString(value.checkedAt ?? value.checked_at) ?? new Date().toISOString(),
    currentSlot: (currentSlotRaw === 'B' ? 'B' : 'A'),
    currentVersion: asString(value.currentVersion ?? value.current_version) ?? null,
    standbySlot: (standbySlotRaw === 'B' ? 'B' : 'A'),
    standbyVersion: asString(value.standbyVersion ?? value.standby_version) ?? null,
    availableVersion: asString(value.availableVersion ?? value.available_version) ?? null,
    updateAvailable: Boolean(value.updateAvailable ?? value.update_available),
    rebootRequired: Boolean(value.rebootRequired ?? value.reboot_required),
    rollbackAvailable: Boolean(value.rollbackAvailable ?? value.rollback_available),
    recoveryActive: Boolean(value.recoveryActive ?? value.recovery_active),
    transactionState,
    lastError: asString(value.lastError ?? value.last_error) ?? null,
  };
}

export const getRootfsStatus = (): Promise<ApiResponse<RootfsUpdateStatus>> =>
  apiClient.get<ApiResponse<unknown>>('/system/rootfs/status').then((r) => ({
    ...r.data,
    data: normalizeRootfsUpdateStatus(r.data.data),
  }));

export const checkRootfsUpdates = (): Promise<ApiResponse<RootfsUpdateStatus>> =>
  apiClient.post<ApiResponse<unknown>>('/system/rootfs/check').then((r) => ({
    ...r.data,
    data: normalizeRootfsUpdateStatus(r.data.data),
  }));

export const stageRootfsUpdate = (): Promise<ApiResponse<unknown>> =>
  apiClient.post<ApiResponse<unknown>>('/system/rootfs/stage').then((r) => r.data);

export const applyRootfsUpdate = (): Promise<ApiResponse<unknown>> =>
  apiClient.post<ApiResponse<unknown>>('/system/rootfs/apply').then((r) => r.data);

export const rollbackRootfsUpdate = (): Promise<ApiResponse<unknown>> =>
  apiClient.post<ApiResponse<unknown>>('/system/rootfs/rollback').then((r) => r.data);

export const markApplianceRebuildComplete = (): Promise<ApiResponse<UpdatesStatus>> =>
  apiClient
    .post<ApiResponse<unknown>>('/system/updates/appliance-rebuild-complete')
    .then((r) => ({ ...r.data, data: normalizeUpdatesStatus(r.data.data) }));

export const getSystemSchedules = (): Promise<ApiResponse<SystemSchedules>> =>
  apiClient.get<ApiResponse<SystemSchedules>>('/system/schedules').then((r) => r.data);

export const updateSystemSchedules = (
  schedules: SystemSchedules
): Promise<ApiResponse<SystemSchedules>> =>
  apiClient.post<ApiResponse<SystemSchedules>>('/system/schedules', schedules).then((r) => r.data);

export const runSystemScheduleJob = (job: ScheduleJobType): Promise<ApiResponse<SystemSchedules>> =>
  apiClient
    .post<ApiResponse<SystemSchedules>>(`/system/schedules/run/${encodeURIComponent(job)}`)
    .then((r) => r.data);

// ── Dashboard-specific endpoints ──────────────────────────────────────────────

export const getDashboardSystemStatus = (): Promise<ApiResponse<DashboardSystemStatus>> =>
  apiClient.get<ApiResponse<DashboardSystemStatus>>('/dashboard/system').then((r) => r.data);

export const getDashboardNetworkStatus = (): Promise<ApiResponse<NetworkStatus>> =>
  apiClient.get<ApiResponse<NetworkStatus>>('/dashboard/network').then((r) => r.data);

export const getDashboardSecurityStatus = (): Promise<ApiResponse<SecurityStatus>> =>
  apiClient.get<ApiResponse<SecurityStatus>>('/dashboard/security').then((r) => r.data);

export const getDashboardAcmeStatus = (): Promise<ApiResponse<AcmeStatus>> =>
  apiClient.get<ApiResponse<AcmeStatus>>('/dashboard/acme').then((r) => r.data);
