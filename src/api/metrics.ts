import apiClient from './client'
import type { ApiResponse, MetricsSnapshot, MetricsHistory } from '../types'

interface BackendMetricsSnapshot {
  timestamp?: number
  system?: {
    cpu_percent?: number
    ram_percent?: number
    loadavg_1?: number
    loadavg_5?: number
    loadavg_15?: number
    temperature_c?: number
    uptime_seconds?: number
  }
  network?: Array<{
    name?: string
    rx_bps?: number
    tx_bps?: number
  }>
  firewall?: {
    state_count?: number
    rule_hit_counts?: Array<{
      handle?: number
      packets?: number
    }>
  }
  suricata?: {
    alerts_last_minute?: number
  }
  crowdsec?: {
    decisions_last_minute?: number
  }
}

function toIsoTimestamp(ts: unknown): string {
  if (typeof ts === 'string') return ts
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    const ms = ts > 10_000_000_000 ? ts : ts * 1000
    return new Date(ms).toISOString()
  }
  return new Date().toISOString()
}

export function normalizeMetricsSnapshot(raw: unknown): MetricsSnapshot {
  const value = (raw ?? {}) as Record<string, unknown>
  if ('cpu_percent' in value && 'wan_rx_bps' in value) {
    const snap = value as Partial<MetricsSnapshot>
    return {
      timestamp: toIsoTimestamp(snap.timestamp),
      cpu_percent: typeof snap.cpu_percent === 'number' ? snap.cpu_percent : 0,
      ram_percent: typeof snap.ram_percent === 'number' ? snap.ram_percent : 0,
      ram_used_bytes: typeof snap.ram_used_bytes === 'number' ? snap.ram_used_bytes : 0,
      ram_total_bytes: typeof snap.ram_total_bytes === 'number' ? snap.ram_total_bytes : 0,
      loadavg: Array.isArray(snap.loadavg) ? snap.loadavg : [0, 0, 0],
      temperature: typeof snap.temperature === 'number' ? snap.temperature : undefined,
      uptime: typeof snap.uptime === 'number' ? snap.uptime : 0,
      disk_percent: typeof snap.disk_percent === 'number' ? snap.disk_percent : 0,
      disk_used_bytes: typeof snap.disk_used_bytes === 'number' ? snap.disk_used_bytes : 0,
      disk_total_bytes: typeof snap.disk_total_bytes === 'number' ? snap.disk_total_bytes : 0,
      wan_rx_bps: typeof snap.wan_rx_bps === 'number' ? snap.wan_rx_bps : 0,
      wan_tx_bps: typeof snap.wan_tx_bps === 'number' ? snap.wan_tx_bps : 0,
      lan_ifaces: Array.isArray(snap.lan_ifaces) ? snap.lan_ifaces : [],
      firewall_state_count: typeof snap.firewall_state_count === 'number' ? snap.firewall_state_count : 0,
      firewall_rule_hits: Array.isArray(snap.firewall_rule_hits) ? snap.firewall_rule_hits : [],
      suricata_alert_rate: typeof snap.suricata_alert_rate === 'number' ? snap.suricata_alert_rate : 0,
      crowdsec_decision_rate: typeof snap.crowdsec_decision_rate === 'number' ? snap.crowdsec_decision_rate : 0,
    }
  }

  const backend = value as BackendMetricsSnapshot
  const network = Array.isArray(backend.network) ? backend.network : []
  const wan = network[0]
  const lan = network.slice(1)
  const loadavg: [number, number, number] = [
    backend.system?.loadavg_1 ?? 0,
    backend.system?.loadavg_5 ?? 0,
    backend.system?.loadavg_15 ?? 0,
  ]

  return {
    timestamp: toIsoTimestamp(backend.timestamp),
    cpu_percent: backend.system?.cpu_percent ?? 0,
    ram_percent: backend.system?.ram_percent ?? 0,
    ram_used_bytes: 0,
    ram_total_bytes: 0,
    loadavg,
    temperature: backend.system?.temperature_c,
    uptime: backend.system?.uptime_seconds ?? 0,
    disk_percent: 0,
    disk_used_bytes: 0,
    disk_total_bytes: 0,
    wan_rx_bps: wan?.rx_bps ?? 0,
    wan_tx_bps: wan?.tx_bps ?? 0,
    lan_ifaces: lan.map((iface) => ({
      name: iface.name ?? 'iface',
      rx_bps: iface.rx_bps ?? 0,
      tx_bps: iface.tx_bps ?? 0,
      enabled: true,
    })),
    firewall_state_count: backend.firewall?.state_count ?? 0,
    firewall_rule_hits: Array.isArray(backend.firewall?.rule_hit_counts)
      ? backend.firewall!.rule_hit_counts!.map((r) => ({
          rule_id: r.handle ?? 0,
          description: `Rule ${r.handle ?? 0}`,
          hits: r.packets ?? 0,
        }))
      : [],
    suricata_alert_rate: backend.suricata?.alerts_last_minute ?? 0,
    crowdsec_decision_rate: backend.crowdsec?.decisions_last_minute ?? 0,
  }
}

export function normalizeMetricsHistory(raw: unknown, seconds: number): MetricsHistory {
  const value = raw as unknown

  if (value && typeof value === 'object' && 'points' in (value as Record<string, unknown>)) {
    const h = value as MetricsHistory
    return {
      points: Array.isArray(h.points) ? h.points : [],
      seconds: typeof h.seconds === 'number' ? h.seconds : seconds,
    }
  }

  const points = Array.isArray(value)
    ? value.map((item) => {
        const s = normalizeSnapshot(item)
        return {
          timestamp: s.timestamp,
          cpu_percent: s.cpu_percent,
          ram_percent: s.ram_percent,
          wan_rx_bps: s.wan_rx_bps,
          wan_tx_bps: s.wan_tx_bps,
          suricata_alert_rate: s.suricata_alert_rate,
          crowdsec_decision_rate: s.crowdsec_decision_rate,
        }
      })
    : []

  return { points, seconds }
}

export const getMetrics = (): Promise<ApiResponse<MetricsSnapshot>> =>
  apiClient
    .get<ApiResponse<unknown>>('/metrics')
    .then((r) => ({ ...r.data, data: normalizeMetricsSnapshot(r.data.data) }))

export const getMetricsHistory = (seconds = 300): Promise<ApiResponse<MetricsHistory>> =>
  apiClient
    .get<ApiResponse<unknown>>('/metrics/history', { params: { seconds } })
    .then((r) => ({ ...r.data, data: normalizeMetricsHistory(r.data.data, seconds) }))
