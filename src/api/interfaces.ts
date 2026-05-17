import apiClient from './client'
import type { ApiResponse, InterfacesInventory, Ipv6Mode, KernelInterface, NetworkInterface } from '../types'

type InterfacesPayload =
  | BackendInterface[]
  | {
      configured?: BackendInterface[]
      kernel?: KernelInterface[]
    }

type BackendInterface = {
  name: string
  description?: string
  type?: NetworkInterface['type']
  parent_interface?: string
  parent?: string
  enabled?: boolean
  dhcp4?: boolean
  dhcp6?: boolean
  accept_ra?: boolean
  ipv6_mode?: Ipv6Mode
  track_source_interface?: string
  track_prefix_id?: number
  delegated_prefix_len?: number
  ia_pd_hint_len?: number
  resolved_ipv6_prefix?: string
  wan_mode?: 'dhcp' | 'pppoe'
  pppoe_username?: string
  pppoe_password?: string
  ipv4_address?: string
  ipv4_prefix?: number
  ipv6_address?: string
  ipv6_prefix?: number
  mac?: string
  mtu?: number
  mss?: number
  vlan_id?: number
  vlan?: number
  gateway?: string
}

const DEFAULT_TYPE: NetworkInterface['type'] = 'ethernet'

type InterfaceUpsertPayload = {
  name: string
  description?: string
  type?: NetworkInterface['type']
  enabled: boolean
  dhcp4?: boolean
  dhcp6?: boolean
  accept_ra?: boolean
  ipv6_mode?: Ipv6Mode
  track_source_interface?: string
  track_prefix_id?: number
  delegated_prefix_len?: number
  ia_pd_hint_len?: number
  wan_mode?: 'dhcp' | 'pppoe'
  pppoe_username?: string
  pppoe_password?: string
  ipv4_address?: string
  ipv4_prefix?: number
  ipv6_address?: string
  ipv6_prefix?: number
  mtu?: number
  mss?: number
  vlan?: number
  parent_interface?: string
  gateway?: string
}

function toInterfaceUpsertPayload(iface: NetworkInterface): InterfaceUpsertPayload {
  const ipv6Mode: Ipv6Mode = iface.ipv6Mode ?? (iface.dhcp6 ? 'dhcp6' : iface.acceptRa ? 'slaac' : 'static')

  return {
    name: iface.name,
    description: iface.description || undefined,
    type: iface.type,
    enabled: iface.enabled,
    dhcp4: iface.dhcp4,
    dhcp6: ipv6Mode === 'dhcp6',
    accept_ra: ipv6Mode === 'slaac',
    ipv6_mode: ipv6Mode,
    track_source_interface: iface.trackSourceInterface || undefined,
    track_prefix_id: iface.trackPrefixId,
    delegated_prefix_len: iface.delegatedPrefixLen,
    ia_pd_hint_len: iface.iaPdHintLen,
    wan_mode: iface.wanMode,
    pppoe_username: iface.pppoeUsername || undefined,
    pppoe_password: iface.pppoePassword || undefined,
    ipv4_address: iface.ipv4Address || undefined,
    ipv4_prefix: iface.ipv4Prefix,
    ipv6_address: iface.ipv6Address || undefined,
    ipv6_prefix: iface.ipv6Prefix,
    mtu: iface.mtu,
    mss: iface.mss,
    vlan: iface.vlanId,
    parent_interface: iface.parentInterface || undefined,
    gateway: iface.gateway || undefined,
  }
}

function inferIpv6Mode(raw: BackendInterface): Ipv6Mode {
  if (raw.ipv6_mode) return raw.ipv6_mode
  if (raw.dhcp6) return 'dhcp6'
  if (raw.accept_ra) return 'slaac'
  return 'static'
}

function toNetworkInterface(raw: BackendInterface): NetworkInterface {
  const vlanId = raw.vlan ?? raw.vlan_id
  const ipv6Mode = inferIpv6Mode(raw)
  return {
    name: raw.name,
    description: raw.description ?? '',
    type: raw.type ?? (typeof vlanId === 'number' ? 'vlan' : DEFAULT_TYPE),
    parentInterface: raw.parent_interface ?? raw.parent,
    vlanId,
    enabled: raw.enabled ?? true,
    dhcp4: raw.dhcp4,
    dhcp6: ipv6Mode === 'dhcp6',
    acceptRa: ipv6Mode === 'slaac',
    ipv6Mode,
    trackSourceInterface: raw.track_source_interface,
    trackPrefixId: raw.track_prefix_id,
    delegatedPrefixLen: raw.delegated_prefix_len,
    iaPdHintLen: raw.ia_pd_hint_len,
    resolvedIpv6Prefix: raw.resolved_ipv6_prefix,
    wanMode: raw.wan_mode,
    pppoeUsername: raw.pppoe_username,
    pppoePassword: raw.pppoe_password,
    ipv4Address: raw.ipv4_address,
    ipv4Prefix: raw.ipv4_prefix,
    ipv6Address: raw.ipv6_address,
    ipv6Prefix: raw.ipv6_prefix,
    mac: raw.mac,
    mtu: raw.mtu,
    mss: raw.mss,
    gateway: raw.gateway,
  }
}

function parseInterfacesPayload(payload: InterfacesPayload): {
  configured: NetworkInterface[]
  kernel: KernelInterface[]
} {
  if (Array.isArray(payload)) {
    return {
      configured: payload.map(toNetworkInterface),
      kernel: [],
    }
  }

  return {
    configured: Array.isArray(payload?.configured)
      ? payload.configured.map(toNetworkInterface)
      : [],
    kernel: Array.isArray(payload?.kernel) ? payload.kernel : [],
  }
}

function normalizeInterfaces(payload: InterfacesPayload): NetworkInterface[] {
  return parseInterfacesPayload(payload).configured
}

function buildInterfaceInventory(payload: InterfacesPayload): InterfacesInventory {
  const { configured, kernel } = parseInterfacesPayload(payload)

  const kernelByName = new Map(kernel.map((iface) => [iface.name, iface]))
  const configuredEnriched = configured.map((iface) => {
    const kernelIface = kernelByName.get(iface.name)
    const firstIpv4Cidr = kernelIface?.addresses?.find((addr) => addr.includes('.') && addr.includes('/'))
    const [kernelIpv4Address, kernelIpv4Prefix] = firstIpv4Cidr ? firstIpv4Cidr.split('/') : [undefined, undefined]
    const firstIpv6Cidr = kernelIface?.addresses?.find((addr) => addr.includes(':') && addr.includes('/'))
    const [kernelIpv6Address, kernelIpv6Prefix] = firstIpv6Cidr ? firstIpv6Cidr.split('/') : [undefined, undefined]

    return {
      ...iface,
      mac: iface.mac ?? kernelIface?.mac,
      mtu: iface.mtu ?? kernelIface?.mtu,
      ipv4Address: iface.ipv4Address ?? kernelIpv4Address,
      ipv4Prefix: iface.ipv4Prefix ?? (kernelIpv4Prefix ? Number(kernelIpv4Prefix) : undefined),
      ipv6Address: iface.ipv6Address ?? kernelIpv6Address,
      ipv6Prefix: iface.ipv6Prefix ?? (kernelIpv6Prefix ? Number(kernelIpv6Prefix) : undefined),
      kernelState: kernelIface?.state,
      kernelAddresses: kernelIface?.addresses,
      kernelFlags: kernelIface?.flags,
      kernelRxPackets: kernelIface?.rx_packets,
      kernelRxBytes: kernelIface?.rx_bytes,
      kernelTxPackets: kernelIface?.tx_packets,
      kernelTxBytes: kernelIface?.tx_bytes,
    }
  })

  const configuredNames = new Set(configuredEnriched.map((iface) => iface.name))
  const kernelNames = new Set((kernel ?? []).map((iface) => iface.name))
  const names = Array.from(new Set([...configuredNames, ...kernelNames])).sort((a, b) => a.localeCompare(b))
  const unusedKernelNames = Array.from(kernelNames)
    .filter((name) => !configuredNames.has(name))
    .sort((a, b) => a.localeCompare(b))

  return {
    configured: configuredEnriched,
    kernel,
    names,
    unusedKernelNames,
  }
}

export const getInterfaces = (): Promise<ApiResponse<NetworkInterface[]>> =>
  apiClient
    .get<ApiResponse<InterfacesPayload>>('/interfaces')
    .then((r) => ({
      ...r.data,
      data: normalizeInterfaces(r.data.data),
    }))

export const getInterfacesInventory = (): Promise<ApiResponse<InterfacesInventory>> =>
  apiClient
    .get<ApiResponse<InterfacesPayload>>('/interfaces')
    .then((r) => ({
      ...r.data,
      data: buildInterfaceInventory(r.data.data),
    }))

// Core upserts by name via POST - use this for both create and update.
export const createInterface = (
  iface: Omit<NetworkInterface, 'name'> & { name: string },
): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .post<ApiResponse<NetworkInterface>>('/interfaces', toInterfaceUpsertPayload(iface as NetworkInterface))
    .then((r) => r.data)

export const updateInterface = (
  iface: NetworkInterface,
): Promise<ApiResponse<NetworkInterface>> =>
  apiClient
    .post<ApiResponse<NetworkInterface>>('/interfaces', toInterfaceUpsertPayload(iface))
    .then((r) => r.data)

export const deleteInterface = (name: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/interfaces/${encodeURIComponent(name)}`)
    .then((r) => r.data)
