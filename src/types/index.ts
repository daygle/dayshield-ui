// Generic API response wrapper
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  error?: string
}

// Network interface
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

// Firewall rule
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

// System status
export interface SystemStatus {
  hostname: string
  version: string
  uptime: number   // seconds
  cpuUsage: number // percentage 0-100
  memoryUsed: number  // bytes
  memoryTotal: number // bytes
  diskUsed: number    // bytes
  diskTotal: number   // bytes
  interfaces: number  // count of active interfaces
  firewallRules: number // count of firewall rules
  activeConnections: number
  lastUpdated: string // ISO timestamp
}
