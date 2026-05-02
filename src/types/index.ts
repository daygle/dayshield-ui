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
  enabled: boolean
  ipv4Address?: string
  ipv4Prefix?: number
  ipv6Address?: string
  ipv6Prefix?: number
  mac?: string
  mtu?: number
  speed?: number
  duplex?: 'full' | 'half' | 'auto'
}

// ── Firewall rules ────────────────────────────────────────────────────────────

export type FirewallAction = 'allow' | 'deny' | 'reject'
export type FirewallDirection = 'in' | 'out' | 'both'
export type FirewallProtocol = 'tcp' | 'udp' | 'icmp' | 'any'

export interface FirewallRule {
  id: number
  enabled: boolean
  description: string
  action: FirewallAction
  direction: FirewallDirection
  protocol: FirewallProtocol
  source: string
  sourcePort?: string
  destination: string
  destinationPort?: string
  interface?: string
  log: boolean
  order: number
}

// ── Aliases ───────────────────────────────────────────────────────────────────

export type AliasType = 'host' | 'network' | 'port' | 'url'

export interface Alias {
  id: number
  name: string
  type: AliasType
  description: string
  content: string[]  // IPs / CIDRs / ports / URLs
}

// ── DNS ───────────────────────────────────────────────────────────────────────

export type DnsMode = 'resolver' | 'forwarder'

export interface DnsConfig {
  enabled: boolean
  mode: DnsMode
  dnssec: boolean
  listenPort: number
  allowedNetworks: string[]
  blockPrivateReverse: boolean
}

export interface DnsForwarder {
  id: number
  address: string
  port: number
  domain: string   // empty string = all domains
  description: string
}

export interface DnsHostOverride {
  id: number
  hostname: string
  domain: string
  ipv4?: string
  ipv6?: string
  description: string
}

// ── DHCP ─────────────────────────────────────────────────────────────────────

export interface DhcpConfig {
  enabled: boolean
  interface: string
  rangeStart: string
  rangeEnd: string
  subnetMask: string
  gateway: string
  dnsServers: string[]
  leaseTime: number   // seconds
  domainName: string
}

export interface DhcpPool {
  id: number
  interface: string
  rangeStart: string
  rangeEnd: string
  description: string
}

export interface DhcpStaticLease {
  id: number
  mac: string
  ipAddress: string
  hostname: string
  description: string
}

export interface DhcpLease {
  mac: string
  ipAddress: string
  hostname: string
  starts: string    // ISO timestamp
  ends: string      // ISO timestamp
  state: 'active' | 'expired' | 'reserved'
}

// ── WireGuard ─────────────────────────────────────────────────────────────────

export interface WgServer {
  interface: string
  publicKey: string
  listenPort: number
  addresses: string[]
  dns: string[]
  mtu: number
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
  interface: string
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
  running: boolean
  version: string
  decisions: number
  alerts: number
  bouncers: number
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

// ── ACME / Certificates ───────────────────────────────────────────────────────

export type AcmeCertificateStatus = 'valid' | 'pending' | 'expired' | 'error'

export interface AcmeAccount {
  email: string
  server: string      // ACME directory URL, e.g. Let's Encrypt production
  registered: boolean
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
  ip?: string
  enabled: boolean
}

export interface NetworkStatus {
  wan_iface: string
  wan_ip?: string
  gateway_status: 'up' | 'down' | 'unknown'
  wan_rx_bps: number       // bytes per second
  wan_tx_bps: number       // bytes per second
  lan_ifaces: LanIface[]
}

export interface SecurityStatus {
  suricata_alerts: SuricataAlert[]
  crowdsec_decisions: CrowdSecDecision[]
  firewall_rule_count: number
  firewall_state_count: number
}

export interface AcmeStatus {
  domains: string[]
  expires_in_days: number
  last_renewal?: string    // ISO timestamp
  next_renewal?: string    // ISO timestamp
  last_renewal_result?: 'success' | 'failed' | null
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
