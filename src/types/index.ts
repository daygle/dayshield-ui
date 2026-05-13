// Generic API response wrapper
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  error?: string
}

// ── Network interfaces ────────────────────────────────────────────────────────

export interface NetworkInterface {
  name: string
  description: string
  type: 'ethernet' | 'vlan' | 'bridge' | 'loopback' | 'wireless'
  parentInterface?: string
  vlanId?: number
  enabled: boolean
  dhcp4?: boolean
  wanMode?: 'dhcp' | 'pppoe'       // only relevant for WAN-designated interfaces
  pppoeUsername?: string
  pppoePassword?: string
  ipv4Address?: string
  ipv4Prefix?: number
  ipv6Address?: string
  ipv6Prefix?: number
  mac?: string
  mtu?: number
  speed?: number
  duplex?: 'full' | 'half' | 'auto'
  gateway?: string  // static WAN gateway IP
  mss?: number
  kernelState?: string
  kernelAddresses?: string[]
  kernelFlags?: string[]
  kernelRxPackets?: number
  kernelRxBytes?: number
  kernelTxPackets?: number
  kernelTxBytes?: number
}

export interface KernelInterface {
  name: string
  mac?: string
  mtu?: number
  state?: string
  flags?: string[]
  addresses?: string[]
  rx_packets?: number
  rx_bytes?: number
  tx_packets?: number
  tx_bytes?: number
}

export interface InterfacesInventory {
  configured: NetworkInterface[]
  kernel: KernelInterface[]
  names: string[]
  unusedKernelNames: string[]
}

// ── Gateways ──────────────────────────────────────────────────────────────────────

export type GatewayState = 'online' | 'offline' | 'unknown'

export interface Gateway {
  name: string
  description?: string
  interface: string
  gateway_ip?: string
  monitor_ip?: string
  weight: number
  enabled: boolean
}

export interface GatewayStatus extends Gateway {
  state: GatewayState
  active_ip?: string
}

export interface ListGatewaysResponse {
  gateways: GatewayStatus[]
  default_interface?: string
}

// ── Firewall rules ────────────────────────────────────────────────────────────

export type FirewallAction = 'accept' | 'drop' | 'reject' | 'jump' | 'log'
export type FirewallProtocol = 'tcp' | 'udp' | 'icmp' | 'icmpv6' | 'any'
export type FirewallChainPolicy = 'accept' | 'drop'

/** Time-based schedule that gates when a firewall rule is active. */
export interface FirewallSchedule {
  /** Days of week: 0=Sunday … 6=Saturday.  Empty = all days. */
  days: number[]
  /** Start of active window, e.g. "08:00", or null for midnight. */
  time_start: string | null
  /** End of active window, e.g. "17:00", or null for midnight. */
  time_end: string | null
  /** First active date "YYYY-MM-DD", or null for no lower bound. */
  date_start: string | null
  /** Last active date "YYYY-MM-DD", or null for no upper bound. */
  date_end: string | null
}

export interface FirewallRule {
  id: string               // UUID
  description: string | null
  priority: number         // lower = higher priority; rules are sorted ascending
  source: string | null    // CIDR or null for any
  destination: string | null
  protocol: FirewallProtocol | null
  source_port: number | null
  destination_port: number | null
  action: FirewallAction
  interface: string | null
  log: boolean
  enabled: boolean
  schedule: FirewallSchedule | null
}

/** Per-rule hit counter returned by GET /firewall/stats. */
export interface FirewallRuleStats {
  id: string
  packets: number
  bytes: number
}

export interface FirewallSettings {
  input_policy: FirewallChainPolicy
  forward_policy: FirewallChainPolicy
  output_policy: FirewallChainPolicy
  drop_invalid_state: boolean
  syn_flood_protection: boolean
  syn_flood_rate: number
  syn_flood_burst: number
  management_anti_lockout: boolean
  management_interface: string | null
  management_allowed_sources: string[]
  management_ports: number[]
}

// ── Aliases ───────────────────────────────────────────────────────────────────

export type AliasType = 'host' | 'network' | 'port' | 'urltable'

export interface Alias {
  name: string
  alias_type: AliasType
  description: string | null
  values: string[]  // IPs / CIDRs / ports / URLs depending on alias_type
  ttl: number | null
  enabled: boolean
}

// ── DNS ───────────────────────────────────────────────────────────────────────
// Fields use snake_case to match Unbound/backend serialization directly.

export interface DnsConfig {
  enabled: boolean
  /** Interface names or IP addresses Unbound binds to (e.g. ["eth1", "127.0.0.1"]). */
  listen_addresses: string[]
  /** UDP/TCP port Unbound listens on. Default 53. */
  port: number
  /** Upstream forwarder IPs. Empty = full recursion mode. */
  forwarders: string[]
  dnssec: boolean
  /** Optional DNS-over-TLS listener. */
  dot_enabled?: boolean
  /** DNS-over-TLS listen port. Defaults to 853. */
  dot_port?: number
  /** Restrict DNS-over-TLS service exposure to LAN clients only. */
  dot_lan_only?: boolean
  /** PEM-encoded TLS certificate for the DoT listener. */
  dot_certificate?: string
  /** PEM-encoded TLS private key for the DoT listener. */
  dot_private_key?: string
  /** ACME domain selected for DoT certificate selection. */
  dot_acme_domain?: string
  /** Optional ACME storage path for the selected DoT certificate. */
  dot_acme_cert_storage_path?: string
  /** Static local records embedded in the DNS config (managed separately via /dns/overrides). */
  local_records: DnsLocalRecord[]
  /** Optional per-interface blocklist sources. */
  interface_blocklists?: DnsInterfaceBlocklists[]
}

export interface DnsInterfaceBlocklists {
  interface: string
  blocklists: DnsBlocklistEntry[]
}

export interface DnsBlocklistEntry {
  id: string
  name?: string | null
  url: string
  enabled: boolean
}

export interface DnsLocalRecord {
  name: string         // hostname or FQDN
  record_type: string  // 'A' | 'AAAA' | 'CNAME' | 'PTR' | 'MX' | 'TXT'
  value: string
}

/** Host override: maps a fully-qualified hostname to an IP address. */
export interface DnsHostOverride {
  hostname: string   // FQDN e.g. "myserver.home.lan"
  address: string    // IPv4 or IPv6
}

/** Domain override: forwards all queries for a domain to a specific resolver. */
export interface DnsDomainOverride {
  domain: string     // e.g. "internal.corp"
  forward_to: string // IP of the upstream DNS to forward to
}

// ── DHCP ─────────────────────────────────────────────────────────────────────

export interface DhcpConfig {
  enabled: boolean
  interface: string
  subnet: string      // CIDR e.g. "192.168.1.0/24" — must match the LAN network
  rangeStart: string
  rangeEnd: string
  subnetMask: string  // derived dotted-decimal, read-only from API
  gateway: string
  dnsServers: string[]
  leaseTime: number   // seconds
  domainName: string
}

/** Per-interface DHCP configuration. Used by /interfaces/{name}/dhcp endpoints. */
export interface DhcpConfigPerInterface {
  enabled: boolean
  subnet: string      // CIDR e.g. "192.168.1.0/24" — must match the interface network
  rangeStart: string
  rangeEnd: string
  subnetMask: string  // derived dotted-decimal, read-only from API
  gateway: string
  dnsServers: string[]
  leaseTime: number   // seconds
  domainName: string
}

export interface DhcpStaticLease {
  id: string
  mac: string
  ipAddress: string
  hostname: string
  description: string
}

export interface DhcpLease {
  mac: string
  ipAddress: string
  hostname: string
  starts: string    // ISO timestamp or empty string
  ends: string      // Unix epoch seconds (string) or ISO timestamp
  state: 'active' | 'expired' | 'reserved' | 'declined' | 'reclaimed'
}

// ── WireGuard ─────────────────────────────────────────────────────────────────

export interface WgServer {
  interface: string
  publicKey: string
  privateKey?: string
  listenPort: number
  addresses: string[]
  peers?: WgPeer[]
  dns?: string[]
  mtu?: number
  enabled: boolean
}

export interface WgPeer {
  id: number
  name: string
  publicKey: string
  presharedKey?: string
  allowedIPs: string[]
  endpoint?: string
  persistentKeepalive: number
  enabled: boolean
  lastHandshake?: string   // ISO timestamp
  transferRx?: number      // bytes
  transferTx?: number      // bytes
}

// ── Suricata ──────────────────────────────────────────────────────────────────

export type SuricataMode = 'ids' | 'ips'

export interface SuricataConfig {
  enabled: boolean
  interfaces: string[]
  mode: SuricataMode
  homeNet: string[]
  externalNet: string[]
}

export interface SuricataRuleset {
  id: number
  name: string
  source: string
  enabled: boolean
  lastUpdated?: string
}

export type SuricataSeverity = 'high' | 'medium' | 'low' | 'informational'

export interface SuricataAlert {
  id: number
  timestamp: string
  interface?: string
  srcIp: string
  srcPort: number
  dstIp: string
  dstPort: number
  protocol: string
  signature: string
  category: string
  severity: SuricataSeverity
  action: 'alert' | 'drop'
}

// ── CrowdSec ──────────────────────────────────────────────────────────────────

export interface CrowdSecStatus {
  enabled: boolean
  lapi_url: string
  api_key: string
  update_interval: number
  ban_alias_name: string
}

export type CrowdSecDecisionType = 'ban' | 'captcha' | 'throttle'

export interface CrowdSecDecision {
  id: number
  value: string        // IP or range
  type: CrowdSecDecisionType
  origin: string
  duration: string
  createdAt: string
}

export interface CrowdSecAlert {
  id: number
  createdAt: string
  scenario: string
  sourceIp: string
  sourceCN: string
  decisions: number
}

// ── AI Threat Engine ──────────────────────────────────────────────────────────

export interface ThreatEvent {
  id: string
  timestamp: number
  src_ip: string
  dst_ip: string
  src_port: number | null
  dst_port: number | null
  protocol: string
  event_source: string
  action?: string
  signature?: string
  alert_severity?: number
  risk_score: number
  reasons: string[]
  blocked: boolean
  block_expires_at: number | null
  escalated: boolean
  quarantine: boolean
  manually_unblocked: boolean
  label?: number
  feedback?: string
  feedback_at?: number
}

export interface BlockedEntry {
  ip: string
  added_at: number
  expires_at: number | null
  quarantine: boolean
}

export type AiModelType = 'local' | 'remote'

export interface AiEngineConfig {
  enabled: boolean
  automatic_blocking: boolean
  risk_score_block_threshold: number
  escalation_window_seconds: number
  block_duration_seconds: number
  model_type: AiModelType
  training_enabled: boolean
  model_learning_rate: number
  remote_inference_url?: string
  remote_api_key?: string
}

// ── ACME / Certificates ───────────────────────────────────────────────────────

export type AcmeCertificateStatus = 'valid' | 'pending' | 'expired' | 'error'

export type AcmeChallengeType = 'http01' | 'dns01'

export interface AcmeAccount {
  enabled: boolean
  directory_url: string
  email: string
  domains: string[]
  challenge_type: AcmeChallengeType
  renew_interval_hours: number
  provider?: string
  cert_storage_path: string
  registered?: boolean
  keyId?: string
}

export interface AcmeCertificate {
  id: number
  domain: string
  sans: string[]                   // Subject Alternative Names
  status: AcmeCertificateStatus
  issuer: string
  notBefore: string                // ISO timestamp
  notAfter: string                 // ISO timestamp
  autoRenew: boolean
  lastRenewed?: string             // ISO timestamp
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardSystemStatus {
  hostname: string
  uptime: number           // seconds
  loadavg: [number, number, number]
  cpu_percent: number      // 0-100
  ram_percent: number      // 0-100
  disk_percent: number     // 0-100
  temperature?: number     // Celsius, optional
}

export interface LanIface {
  name: string
  description?: string
  ip?: string
  enabled: boolean
}

export interface NetworkStatus {
  wan_iface: string
  wan_iface_description?: string
  wan_ip?: string
  gateway_status: 'up' | 'down' | 'unknown'
  wan_rx_bps: number       // bytes per second
  wan_tx_bps: number       // bytes per second
  lan_ifaces: LanIface[]
}

export interface SecurityStatus {
  suricata_alert_rate: number    // alerts per second
  crowdsec_active_decisions: number
  firewall_rule_count: number
  firewall_state_count: number
}

export interface AcmeStatus {
  domains: string[]
  cert_exists: boolean
  needs_renewal: boolean
  expires_in_days: number        // 0 when no cert exists
  next_renewal?: string    // ISO timestamp
}

// ── System ────────────────────────────────────────────────────────────────────

export interface SystemStatus {
  hostname: string
  version: string
  uptime: number          // seconds
  cpuUsage: number        // percentage 0-100
  memoryUsed: number      // bytes
  memoryTotal: number     // bytes
  diskUsed: number        // bytes
  diskTotal: number       // bytes
  interfaces: number      // count of active interfaces
  firewallRules: number   // count of firewall rules
  activeConnections: number
  lastUpdated: string     // ISO timestamp
}

export interface SystemConfig {
  hostname: string
  timezone: string
  ntpServers: string[]
  dnsServers: string[]
  sshEnabled: boolean
  sshPort: number
  webPort: number
  managementTlsAcmeDomain?: string | null
}

export type UpdateComponent = 'core' | 'ui' | 'rootfs' | 'both'

export interface UpdateSettings {
  autoCheckEnabled: boolean
  checkIntervalMinutes: number
  rebootRequiredAfterApply: boolean
  deployRuntimeAfterApply: boolean
  updateMode?: string
  registryUrl?: string
  verifyArtifactSignatures?: boolean
  requireSignedCommits: boolean
  verifyRootfsManifest: boolean
  trustedSignersFile: string
  bootstrapMissingRootfsRepo: boolean
  coreRepoPath: string
  uiRepoPath: string
  rootfsRepoPath: string
  coreRepoUrl: string
  uiRepoUrl: string
  rootfsRepoUrl: string
  coreBranch: string
  uiBranch: string
  rootfsBranch: string
}

export interface RootfsLiveUpdateSummary {
  reportTimestamp?: string
  reportCommit?: string
  stagedFiles: string[]
  backupDir?: string
  changedUnits: string[]
  migrationFromVersion?: number
  migrationToVersion?: number
  rollbackAvailable: boolean
}

export interface ComponentUpdateStatus {
  component: 'core' | 'ui' | 'rootfs' | string
  repoPath: string
  branch: string
  validRepo: boolean
  dirtyWorktree: boolean
  currentCommit?: string
  remoteCommit?: string
  currentVersion?: string
  remoteVersion?: string
  updateAvailable: boolean
  rollbackCommit?: string
  lastAppliedCommit?: string
  lastAppliedVersion?: string
  lastError?: string
}

export interface UpdatesStatus {
  settings: UpdateSettings
  lastCheckedAt?: string
  lastAppliedAt?: string
  pendingReboot: boolean
  pendingApplianceRebuild: boolean
  applianceRebuildReason?: string
  applianceRebuildMarkedAt?: string
  rootfsLiveUpdate?: RootfsLiveUpdateSummary
  components: ComponentUpdateStatus[]
  /** Number of components with available updates (read-only, computed server-side) */
  availableUpdateCount?: number
}

export interface UpdatesActionResult {
  operation: string
  success: boolean
  message: string
  details: string[]
  status: UpdatesStatus
}

// ── Backup / Restore ─────────────────────────────────────────────────────────

export interface BackupEntry {
  filename: string
  size?: number          // bytes (may be undefined if still processing)
  createdAt: string      // ISO timestamp (always provided)
  sha256?: string        // (may be undefined if still processing)
  encrypted: boolean
}

export interface CreateBackupRequest {
  type: 'full' | 'selective'
  components?: string[] // used when type === 'selective'
  password?: string     // set to encrypt the backup
}

export interface RestoreBackupRequest {
  filename: string
  password?: string     // required for encrypted backups
}

export type BackupScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export interface BackupSchedule {
  enabled: boolean
  frequency: BackupScheduleFrequency
  time: string          // HH:MM 24-hour format
  retainCount: number
  encrypt: boolean
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotifyCategory =
  | 'firewall'
  | 'ids'
  | 'vpn'
  | 'system'
  | 'crowdsec'
  | 'acme'
  | 'dhcp'
  | 'backup'

export interface SmtpConfig {
  host: string
  port: number
  username: string
  password: string
  tls: boolean
  fromAddress: string
  fromName: string
}

export interface NotifyConfig {
  enabled: boolean
  smtp: SmtpConfig
  recipients: string[]
  categories: NotifyCategory[]
  rateLimitMinutes: number
  digestMode: boolean
  lastStatus?: NotifyLastStatus
}

export interface NotifyLastStatus {
  sentAt: string         // ISO timestamp
  success: boolean
  message?: string
}

export interface NotifyTestRequest {
  recipient: string
}

export interface NotifyTestResult {
  success: boolean
  message: string
}

// ── NAT ───────────────────────────────────────────────────────────────────────

export type NatOutboundMode = 'automatic' | 'hybrid' | 'manual'
export type NatProtocol = 'tcp' | 'udp' | 'tcp_udp' | 'any'
export type NatRuleType = 'masquerade' | 'snat' | 'dnat'

export interface NatTranslation {
  address: string | null
  port: number | null
  port_end: number | null
}

export interface NatConfig {
  outbound_mode: NatOutboundMode
  wan_interfaces: string[]
  rules: NatRule[]
  nat_reflection: boolean
}

export interface NatRule {
  id: string                        // UUID
  enabled: boolean
  description: string | null
  rule_type: NatRuleType
  interface: string | null          // outbound for masq/SNAT; inbound for DNAT
  source: string | null             // IPv4 CIDR filter, null = any
  destination: string | null
  protocol: NatProtocol
  source_port: number | null
  destination_port: number | null   // for DNAT: the external port being forwarded
  translation: NatTranslation | null
  nat_reflection: boolean
  priority: number
  log: boolean
  auto_firewall_rule: boolean       // auto-generate companion forward accept for DNAT
}

// ── NTP ───────────────────────────────────────────────────────────────────────

export interface NtpConfig {
  enabled: boolean
  servers: string[]          // upstream NTP servers (IPv4)
  serveLan: boolean          // serve NTP to LAN clients
  listenInterfaces: string[] // interface names to listen on
}

export interface NtpStatus {
  synced: boolean
  offset: number             // milliseconds
  jitter: number             // milliseconds
  upstream: string           // upstream server address
  stratum: number
}

// ── Cloudflared ─────────────────────────────────────────────────────────────

export interface CloudflaredIngressRule {
  hostname: string
  service: string
}

export interface CloudflaredConfig {
  enabled: boolean
  tunnelName: string
  tunnelToken: string
  tunnelTokenConfigured: boolean
  metricsAddress: string
  logLevel: string
  ingress: CloudflaredIngressRule[]
}

export interface CloudflaredStatus {
  configured: boolean
  enabled: boolean
  running: boolean
  unitEnabled: boolean
  binaryPresent: boolean
  activeState: string
  subState: string
  version?: string
  ingressCount: number
  lastError?: string | null
}

export interface CloudflaredLogsResponse {
  lines: string[]
}

export interface CloudflaredActionResponse {
  message: string
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  username: string
}

export interface AuthStatus {
  authenticated: boolean
  username?: string
  token?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface LanIfaceMetrics {
  name: string
  rx_bps: number
  tx_bps: number
  ip?: string
  enabled: boolean
}

export interface FirewallRuleHit {
  rule_id: number
  description: string
  hits: number
}

export interface MetricsSnapshot {
  timestamp: string
  cpu_percent: number
  ram_percent: number
  ram_used_bytes: number
  ram_total_bytes: number
  loadavg: [number, number, number]
  temperature?: number
  uptime: number
  disk_percent: number
  disk_used_bytes: number
  disk_total_bytes: number
  wan_rx_bps: number
  wan_tx_bps: number
  lan_ifaces: LanIfaceMetrics[]
  firewall_state_count: number
  firewall_rule_hits: FirewallRuleHit[]
  suricata_alert_rate: number   // alerts per minute
  crowdsec_decision_rate: number // decisions per minute
}

export interface MetricsHistoryPoint {
  timestamp: string
  cpu_percent: number
  ram_percent: number
  wan_rx_bps: number
  wan_tx_bps: number
  suricata_alert_rate: number
  crowdsec_decision_rate: number
}

export interface MetricsHistory {
  points: MetricsHistoryPoint[]
  seconds: number
}

// ── Admin security settings ───────────────────────────────────────────────────

export interface AdminSecuritySettings {
  session_timeout_minutes: number
  max_login_attempts: number
  lockout_duration_minutes: number
  min_password_length: number
  require_uppercase: boolean
  require_number: boolean
  require_special: boolean
}
