import { useEffect, useRef, useState } from 'react'
import { useSystemStatus } from '../../hooks/useSystemStatus'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useSecurityStatus } from '../../hooks/useSecurityStatus'
import { useAcmeStatus } from '../../hooks/useAcmeStatus'
import Card from '../../components/Card'
import ErrorBanner from '../../components/ErrorBanner'
import Sparkline from '../../components/Sparkline'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function formatBps(bps: number): string {
  if (bps < 1000) return `${bps.toFixed(0)} B/s`
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(1)} KB/s`
  if (bps < 1_000_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`
  return `${(bps / 1_000_000_000).toFixed(2)} GB/s`
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number') return fallback
  return Number.isFinite(value) ? value : fallback
}

function formatPercent(value: unknown, digits = 1): string {
  return `${toFiniteNumber(value).toFixed(digits)}%`
}

function ProgressBar({ value, warn = 80 }: { value: number; warn?: number }) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${clamped > warn ? 'bg-red-500' : 'bg-blue-500'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function Badge({
  variant,
  children,
}: {
  variant: 'green' | 'red' | 'yellow' | 'gray' | 'blue'
  children: React.ReactNode
}) {
  const cls = {
    green: 'bg-green-100 text-green-700 border-green-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
  }[variant]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {children}
    </span>
  )
}

function MetricRow({
  label,
  value,
  bar,
  warn,
}: {
  label: string
  value: string
  bar?: number
  warn?: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-800">{value}</span>
      </div>
      {bar !== undefined && <ProgressBar value={bar} warn={warn} />}
    </div>
  )
}

// ── Throughput sparkline buffer hook ─────────────────────────────────────────

function useThroughputBuffer(rx: number | undefined, tx: number | undefined, size = 30) {
  const rxBuf = useRef<number[]>([])
  const txBuf = useRef<number[]>([])
  const [, forceRender] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      rxBuf.current = [...rxBuf.current.slice(-(size - 1)), rx ?? 0]
      txBuf.current = [...txBuf.current.slice(-(size - 1)), tx ?? 0]
      forceRender((n) => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [rx, tx, size])

  return { rxHistory: rxBuf.current, txHistory: txBuf.current }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const sys = useSystemStatus()
  const net = useNetworkStatus()
  const sec = useSecurityStatus()
  const acme = useAcmeStatus()

  const { rxHistory, txHistory } = useThroughputBuffer(
    net.data?.wan_rx_bps,
    net.data?.wan_tx_bps,
  )

  const hasCriticalAlerts =
    (sec.data?.suricata_alert_rate ?? 0) > 10

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* ── TOP ROW ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* System Status */}
        <Card title="System Status">
          {sys.isError && <ErrorBanner message={sys.error?.message ?? 'Failed to load system status'} />}
          {sys.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {sys.data && (
            <div className="space-y-3">
              <MetricRow label="Hostname" value={sys.data.hostname} />
              <MetricRow label="Uptime" value={formatUptime(sys.data.uptime)} />
              <MetricRow
                label="Load Average"
                value={sys.data.loadavg.map((v) => toFiniteNumber(v).toFixed(2)).join(' / ')}
              />
              <MetricRow
                label="CPU"
                value={formatPercent(sys.data.cpu_percent)}
                bar={toFiniteNumber(sys.data.cpu_percent)}
              />
              <MetricRow
                label="RAM"
                value={formatPercent(sys.data.ram_percent)}
                bar={toFiniteNumber(sys.data.ram_percent)}
              />
              <MetricRow
                label="Disk"
                value={formatPercent(sys.data.disk_percent)}
                bar={toFiniteNumber(sys.data.disk_percent)}
              />
              {sys.data.temperature != null && (
                <MetricRow
                  label="Temperature"
                  value={`${toFiniteNumber(sys.data.temperature).toFixed(1)} °C`}
                />
              )}
            </div>
          )}
        </Card>

        {/* Network Status */}
        <Card title="Network Status">
          {net.isError && <ErrorBanner message={net.error?.message ?? 'Failed to load network status'} />}
          {net.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {net.data && (
            <div className="space-y-3">
              <MetricRow label="WAN Interface" value={net.data.wan_iface} />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">WAN IPv4</span>
                <span className="font-medium text-gray-800">
                  {net.data.wan_ip ?? '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Gateway</span>
                {net.data.gateway_status === 'up' ? (
                  <Badge variant="green">Online</Badge>
                ) : net.data.gateway_status === 'down' ? (
                  <Badge variant="red">Offline</Badge>
                ) : (
                  <Badge variant="gray">Unknown</Badge>
                )}
              </div>

              {/* Throughput sparklines */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>↓ RX&nbsp;{formatBps(toFiniteNumber(net.data.wan_rx_bps))}</span>
                  <Sparkline data={rxHistory} color="#22c55e" height={32} width={100} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>↑ TX&nbsp;{formatBps(toFiniteNumber(net.data.wan_tx_bps))}</span>
                  <Sparkline data={txHistory} color="#3b82f6" height={32} width={100} />
                </div>
              </div>

              {net.data.lan_ifaces.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">LAN</p>
                  <div className="space-y-1">
                    {net.data.lan_ifaces.map((iface) => (
                      <div key={iface.name} className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700">{iface.name}</span>
                        <span className="text-gray-500">{iface.ip ?? '—'}</span>
                        {iface.enabled ? (
                          <Badge variant="green">Up</Badge>
                        ) : (
                          <Badge variant="red">Down</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Certificate Status */}
        <Card title="Certificate Status">
          {acme.isError && <ErrorBanner message={acme.error?.message ?? 'Failed to load ACME status'} />}
          {acme.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {acme.data && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Domains</p>
                <div className="flex flex-wrap gap-1">
                  {acme.data.domains.length > 0
                    ? acme.data.domains.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200"
                        >
                          {d}
                        </span>
                      ))
                    : <span className="text-sm text-gray-400">No domains</span>}
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Expires in</span>
                {acme.data.expires_in_days < 7 ? (
                  <Badge variant="red">⚠ {acme.data.expires_in_days}d</Badge>
                ) : acme.data.expires_in_days < 30 ? (
                  <Badge variant="yellow">{acme.data.expires_in_days}d</Badge>
                ) : (
                  <Badge variant="green">{acme.data.expires_in_days}d</Badge>
                )}
              </div>

              {acme.data.last_renewal && (
                <MetricRow
                  label="Last Renewed"
                  value={new Date(acme.data.last_renewal).toLocaleDateString()}
                />
              )}
              {acme.data.next_renewal && (
                <MetricRow
                  label="Next Renewal"
                  value={new Date(acme.data.next_renewal).toLocaleDateString()}
                />
              )}
              {acme.data.last_renewal_result !== undefined && acme.data.last_renewal_result !== null && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Last Result</span>
                  {acme.data.last_renewal_result === 'success' ? (
                    <Badge variant="green">Success</Badge>
                  ) : (
                    <Badge variant="red">Failed</Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── MIDDLE ROW ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Suricata Alerts */}
        <Card
          title="Suricata Alerts"
          className={hasCriticalAlerts ? 'border-red-300' : ''}
          actions={
            hasCriticalAlerts ? (
              <Badge variant="red">Critical</Badge>
            ) : undefined
          }
        >
          {sec.isError && <ErrorBanner message={sec.error?.message ?? 'Failed to load security status'} />}
          {sec.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {sec.data && (
            <div className="space-y-3">
              <div className="text-sm text-gray-500">Suricata alert rate</div>
              <div className="text-2xl font-semibold text-gray-900">{toFiniteNumber(sec.data.suricata_alert_rate).toFixed(1)} alerts/sec</div>
              <p className="text-sm text-gray-500">Detailed alert data is unavailable in this version.</p>
            </div>
          )}
        </Card>

        {/* CrowdSec Decisions */}
        <Card title="CrowdSec Decisions">
          {sec.isError && <ErrorBanner message={sec.error?.message ?? 'Failed to load security status'} />}
          {sec.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {sec.data && (
            <div className="space-y-3">
              <div className="text-sm text-gray-500">Active CrowdSec decisions</div>
              <div className="text-2xl font-semibold text-gray-900">{sec.data.crowdsec_active_decisions}</div>
              <p className="text-sm text-gray-500">Detailed decision rows are unavailable in this version.</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── BOTTOM ROW ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Firewall Summary */}
        <Card title="Firewall Summary">
          {sec.isError && <ErrorBanner message={sec.error?.message ?? 'Failed to load security status'} />}
          {sec.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {sec.data && (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-3xl font-bold text-gray-900">{sec.data.firewall_rule_count}</p>
                <p className="text-sm text-gray-500 mt-1">Rules</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-3xl font-bold text-blue-600">{sec.data.firewall_state_count}</p>
                <p className="text-sm text-gray-500 mt-1">Active States</p>
              </div>
            </div>
          )}
        </Card>

        {/* Interface Summary */}
        <Card title="Interface Summary">
          {net.isError && <ErrorBanner message={net.error?.message ?? 'Failed to load network status'} />}
          {net.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {net.data && (
            <div className="space-y-2">
              {/* WAN row */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{net.data.wan_iface}</p>
                  <p className="text-xs text-gray-500">{net.data.wan_ip ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">WAN</span>
                  {net.data.gateway_status === 'up' ? (
                    <Badge variant="green">Up</Badge>
                  ) : (
                    <Badge variant="red">Down</Badge>
                  )}
                </div>
              </div>
              {/* LAN rows */}
              {net.data.lan_ifaces.map((iface) => (
                <div key={iface.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{iface.name}</p>
                    <p className="text-xs text-gray-500">{iface.ip ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">LAN</span>
                    {iface.enabled ? (
                      <Badge variant="green">Up</Badge>
                    ) : (
                      <Badge variant="red">Down</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

