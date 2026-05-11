import { useEffect, useRef, useCallback, useState } from 'react'
import { useMetrics } from '../../hooks/useMetrics'
import { useMetricsHistory } from '../../hooks/useMetricsHistory'
import { useMetricsStream } from '../../hooks/useMetricsStream'
import Card from '../../components/Card'
import ErrorBanner from '../../components/ErrorBanner'
import type { MetricsSnapshot, MetricsHistoryPoint, LanIfaceMetrics, FirewallRuleHit, NetworkInterface } from '../../types'
import { getInterfaces } from '../../api/interfaces'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: unknown): string {
  const value = toFiniteNumber(bytes)
  if (value < 1024) return `${value.toFixed(0)} B`
  if (value < 1_048_576) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1_073_741_824) return `${(value / 1_048_576).toFixed(1)} MB`
  return `${(value / 1_073_741_824).toFixed(2)} GB`
}

function formatBps(bps: unknown): string {
  const value = toFiniteNumber(bps)
  if (value < 1000) return `${value.toFixed(0)} B/s`
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)} KB/s`
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB/s`
  return `${(value / 1_000_000_000).toFixed(2)} GB/s`
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number') return fallback
  return Number.isFinite(value) ? value : fallback
}

function formatPercent(value: unknown, digits = 1): string {
  return `${toFiniteNumber(value).toFixed(digits)}%`
}

// ── Canvas utilities ──────────────────────────────────────────────────────────

function drawSparkline(
  canvas: HTMLCanvasElement,
  data: number[],
  color: string,
) {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx || data.length < 2) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'

  data.forEach((val, i) => {
    const x = i * step
    const y = height - (val / max) * (height - 4) - 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  // fill area
  ctx.lineTo((data.length - 1) * step, height)
  ctx.lineTo(0, height)
  ctx.closePath()
  ctx.globalAlpha = 0.13
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawThroughput(
  canvas: HTMLCanvasElement,
  rxData: number[],
  txData: number[],
) {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const allVals = [...rxData, ...txData]
  const max = Math.max(...allVals, 1)
  const padTop = 8
  const padBottom = 20
  const padLeft = 4
  const padRight = 4
  const drawH = height - padTop - padBottom
  const drawW = width - padLeft - padRight

  // Grid lines
  ctx.strokeStyle = 'rgba(148,163,184,0.2)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (drawH / 4) * i
    ctx.beginPath()
    ctx.moveTo(padLeft, y)
    ctx.lineTo(width - padRight, y)
    ctx.stroke()
  }

  // Y-axis labels
  ctx.fillStyle = 'rgba(100,116,139,0.8)'
  ctx.font = `10px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(formatBps(max), padLeft, padTop - 1)
  ctx.fillText('0', padLeft, height - padBottom + 10)

  function drawLine(c: CanvasRenderingContext2D, data: number[], color: string) {
    if (data.length < 2) return
    const step = drawW / (data.length - 1)
    c.beginPath()
    c.strokeStyle = color
    c.lineWidth = 1.5
    c.lineJoin = 'round'
    data.forEach((val, i) => {
      const x = padLeft + i * step
      const y = padTop + drawH - (val / max) * drawH
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    })
    c.stroke()

    // fill
    c.lineTo(padLeft + (data.length - 1) * step, padTop + drawH)
    c.lineTo(padLeft, padTop + drawH)
    c.closePath()
    c.globalAlpha = 0.1
    c.fillStyle = color
    c.fill()
    c.globalAlpha = 1
  }

  drawLine(ctx, rxData, '#22c55e')
  drawLine(ctx, txData, '#3b82f6')

  // Legend
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#22c55e'
  ctx.fillRect(padLeft, height - padBottom + 14, 10, 3)
  ctx.fillStyle = 'rgba(100,116,139,0.9)'
  ctx.fillText('↓ RX', padLeft + 12, height - padBottom + 17)

  ctx.fillStyle = '#3b82f6'
  ctx.fillRect(padLeft + 50, height - padBottom + 14, 10, 3)
  ctx.fillStyle = 'rgba(100,116,139,0.9)'
  ctx.fillText('↑ TX', padLeft + 62, height - padBottom + 17)
}

function drawBarChart(
  canvas: HTMLCanvasElement,
  items: FirewallRuleHit[],
) {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx || items.length === 0) return

  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const max = Math.max(...items.map((x) => x.hits), 1)
  const barH = Math.max(14, Math.floor((height - items.length * 4) / items.length))
  const labelW = Math.min(130, width * 0.4)
  const barAreaW = width - labelW - 50

  items.forEach((item, i) => {
    const y = i * (barH + 4) + 2
    const barW = (item.hits / max) * barAreaW
    const description = typeof item.description === 'string'
      ? item.description
      : `Rule ${item.rule_id}`

    // Label
    ctx.fillStyle = 'rgba(71,85,105,0.9)'
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'right'
    const label = description.length > 18
      ? description.slice(0, 17) + '…'
      : description
    ctx.fillText(label, labelW - 6, y + barH - 3)

    // Bar bg
    ctx.fillStyle = 'rgba(226,232,240,0.8)'
    ctx.beginPath()
    ctx.roundRect(labelW, y, barAreaW, barH, 3)
    ctx.fill()

    // Bar fill
    if (barW > 0) {
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.roundRect(labelW, y, barW, barH, 3)
      ctx.fill()
    }

    // Count
    ctx.fillStyle = 'rgba(71,85,105,0.9)'
    ctx.textAlign = 'left'
    ctx.fillText(String(item.hits), labelW + barAreaW + 4, y + barH - 3)
  })
}

// ── Canvas components ─────────────────────────────────────────────────────────

interface SparklineGraphProps {
  data: number[]
  color?: string
  height?: number
}

function SparklineGraph({ data, color = '#3b82f6', height = 48 }: SparklineGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    if (canvasRef.current) drawSparkline(canvasRef.current, data, color)
  }, [data, color])

  useEffect(() => {
    draw()
    const obs = new ResizeObserver(draw)
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="block"
    />
  )
}

interface ThroughputGraphProps {
  rxData: number[]
  txData: number[]
  height?: number
}

function ThroughputGraph({ rxData, txData, height = 140 }: ThroughputGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    if (canvasRef.current) drawThroughput(canvasRef.current, rxData, txData)
  }, [rxData, txData])

  useEffect(() => {
    draw()
    const obs = new ResizeObserver(draw)
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="block"
    />
  )
}

interface FirewallRuleHitsChartProps {
  items: FirewallRuleHit[]
  height?: number
}

function FirewallRuleHitsChart({ items, height }: FirewallRuleHitsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const computedH = height ?? Math.max(80, items.length * 22)

  const draw = useCallback(() => {
    if (canvasRef.current) drawBarChart(canvasRef.current, items)
  }, [items])

  useEffect(() => {
    draw()
    const obs = new ResizeObserver(draw)
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: computedH }}
      className="block"
    />
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ value, warn = 80 }: { value: number; warn?: number }) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all duration-300 ${clamped > warn ? 'bg-red-500' : 'bg-blue-500'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function MetricCard({
  title,
  value,
  sub,
  percent,
  warn,
  sparkData,
  sparkColor,
  children,
}: {
  title: string
  value: string
  sub?: string
  percent?: number
  warn?: number
  sparkData?: number[]
  sparkColor?: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col gap-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {percent !== undefined && <ProgressBar value={percent} warn={warn} />}
      {sparkData && sparkData.length > 1 && (
        <SparklineGraph data={sparkData} color={sparkColor ?? '#3b82f6'} height={40} />
      )}
      {children}
    </div>
  )
}

function TemperatureBadge({ celsius }: { celsius: number }) {
  const temp = toFiniteNumber(celsius)
  const color =
    temp >= 80 ? 'bg-red-100 text-red-700 border-red-200' :
    temp >= 65 ? 'bg-orange-100 text-orange-700 border-orange-200' :
    temp >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
    'bg-green-100 text-green-700 border-green-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${color}`}>
      {temp.toFixed(1)} °C
    </span>
  )
}

function UptimeDisplay({ seconds }: { seconds: number }) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return (
    <div className="flex gap-3 mt-1">
      {[
        { label: 'd', val: d },
        { label: 'h', val: h },
        { label: 'm', val: m },
      ].map(({ label, val }) => (
        <div key={label} className="text-center">
          <span className="text-xl font-bold text-gray-900">{val}</span>
          <span className="text-xs text-gray-400 ml-0.5">{label}</span>
        </div>
      ))}
    </div>
  )
}

function InterfaceTable({ ifaces, labelFor }: { ifaces: LanIfaceMetrics[]; labelFor?: (name: string) => string }) {
  if (ifaces.length === 0) {
    return <p className="text-sm text-gray-400">No LAN interfaces</p>
  }
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Interface</th>
            <th className="text-left px-2 py-1.5 text-gray-500 font-medium">IP</th>
            <th className="text-right px-2 py-1.5 text-gray-500 font-medium">↓ RX</th>
            <th className="text-right px-2 py-1.5 text-gray-500 font-medium">↑ TX</th>
            <th className="text-center px-2 py-1.5 text-gray-500 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {ifaces.map((iface) => (
            <tr key={iface.name} className="hover:bg-gray-50">
              <td className="px-2 py-2 font-medium text-gray-800">{labelFor ? labelFor(iface.name) : iface.name}</td>
              <td className="px-2 py-2 font-mono text-gray-500">{iface.ip ?? '—'}</td>
              <td className="px-2 py-2 text-right text-green-600 font-mono">{formatBps(iface.rx_bps)}</td>
              <td className="px-2 py-2 text-right text-blue-600 font-mono">{formatBps(iface.tx_bps)}</td>
              <td className="px-2 py-2 text-center">
                <span className={`inline-block w-2 h-2 rounded-full ${iface.enabled ? 'bg-green-500' : 'bg-red-400'}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
      {connected ? 'Live' : 'Polling'}
    </span>
  )
}

// ── History helpers ───────────────────────────────────────────────────────────

function extractField<K extends keyof MetricsHistoryPoint>(
  points: MetricsHistoryPoint[],
  key: K,
): number[] {
  return points.map((p) => toFiniteNumber(p[key]))
}

// ── Metrics Page ──────────────────────────────────────────────────────────────

export default function Metrics() {
  const poll = useMetrics()
  const history = useMetricsHistory(300)
  const stream = useMetricsStream()

  const [configuredInterfaces, setConfiguredInterfaces] = useState<NetworkInterface[]>([])
  useEffect(() => {
    getInterfaces().then((r) => setConfiguredInterfaces(r.data ?? [])).catch(() => {})
  }, [])
  const labelFor = (name: string): string => {
    const iface = configuredInterfaces.find((i) => i.name === name)
    return iface?.description?.trim() || name
  }

  // Prefer live WebSocket data, fall back to polled data
  const snap: MetricsSnapshot | null = stream.data ?? poll.data ?? null

  // Accumulate live WAN throughput ring buffer (last 60 samples @ ~2s = ~2 min)
  const rxBuf = useRef<number[]>([])
  const txBuf = useRef<number[]>([])
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!snap) return
    rxBuf.current = [...rxBuf.current.slice(-59), toFiniteNumber(snap.wan_rx_bps)]
    txBuf.current = [...txBuf.current.slice(-59), toFiniteNumber(snap.wan_tx_bps)]
    forceRender((n) => n + 1)
  }, [snap])

  const historyPoints = history.data?.points ?? []
  const cpuSparkData = historyPoints.length > 1
    ? extractField(historyPoints, 'cpu_percent')
    : []
  const ramSparkData = historyPoints.length > 1
    ? extractField(historyPoints, 'ram_percent')
    : []
  const suricataSparkData = extractField(historyPoints, 'suricata_alert_rate')
  const crowdsecSparkData = extractField(historyPoints, 'crowdsec_decision_rate')

  const rxHistory = historyPoints.length > 1
    ? extractField(historyPoints, 'wan_rx_bps')
    : rxBuf.current
  const txHistory = historyPoints.length > 1
    ? extractField(historyPoints, 'wan_tx_bps')
    : txBuf.current

  const isLoading = poll.isLoading && !snap
  const isError = poll.isError && !snap

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Metrics</h1>
        <LiveDot connected={stream.connected} />
      </div>

      {isError && (
        <ErrorBanner message={poll.error?.message ?? 'Failed to load metrics'} />
      )}
      {isLoading && (
        <p className="text-sm text-gray-400">Loading metrics…</p>
      )}

      {/* ── TOP ROW: CPU · RAM · Loadavg · Temperature ───────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <MetricCard
          title="CPU Usage"
          value={snap ? formatPercent(snap.cpu_percent) : '—'}
          percent={snap ? toFiniteNumber(snap.cpu_percent) : undefined}
          warn={85}
          sparkData={cpuSparkData}
          sparkColor="#3b82f6"
        />

        <MetricCard
          title="RAM Usage"
          value={snap ? formatPercent(snap.ram_percent) : '—'}
          sub={snap ? `${formatBytes(toFiniteNumber(snap.ram_used_bytes))} / ${formatBytes(toFiniteNumber(snap.ram_total_bytes))}` : undefined}
          percent={snap ? toFiniteNumber(snap.ram_percent) : undefined}
          warn={85}
          sparkData={ramSparkData}
          sparkColor="#8b5cf6"
        />

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Load Average</p>
          {snap ? (
            <div className="mt-2 space-y-1.5">
              {([1, 5, 15] as const).map((min, idx) => (
                (() => {
                  const load = toFiniteNumber(snap.loadavg?.[idx])
                  return (
                <div key={min} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 text-xs">{min}m</span>
                  <span className={`font-bold ${load > 2 ? 'text-red-600' : load > 1 ? 'text-yellow-600' : 'text-gray-900'}`}>
                    {load.toFixed(2)}
                  </span>
                </div>
                  )
                })()
              ))}
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-300 mt-2">—</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Temperature</p>
          {snap?.temperature != null ? (
            <TemperatureBadge celsius={toFiniteNumber(snap.temperature)} />
          ) : (
            <span className="text-gray-300 text-lg font-bold">N/A</span>
          )}
          <div className="mt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Uptime</p>
            {snap ? (
              <UptimeDisplay seconds={snap.uptime} />
            ) : (
              <p className="text-2xl font-bold text-gray-300">—</p>
            )}
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: WAN Throughput · LAN Interfaces ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card title="WAN Throughput">
          <div className="space-y-2">
            {snap && (
              <div className="flex gap-6 text-xs">
                <span className="text-green-600 font-medium">↓ RX {formatBps(snap.wan_rx_bps)}</span>
                <span className="text-blue-600 font-medium">↑ TX {formatBps(snap.wan_tx_bps)}</span>
              </div>
            )}
            <ThroughputGraph rxData={rxHistory} txData={txHistory} height={150} />
          </div>
        </Card>

        <Card title="LAN Interfaces">
          {snap ? (
            <InterfaceTable ifaces={snap.lan_ifaces} labelFor={labelFor} />
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </Card>
      </div>

      {/* ── MIDDLE ROW 2: Disk ───────────────────────────────────────── */}
      {snap && (
        <Card title="Disk Usage">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Usage</span>
                <span className="font-medium text-gray-800">{formatPercent(snap.disk_percent)}</span>
              </div>
              <ProgressBar value={toFiniteNumber(snap.disk_percent)} warn={80} />
              <p className="text-xs text-gray-400 mt-1">
                {formatBytes(toFiniteNumber(snap.disk_used_bytes))} used of {formatBytes(toFiniteNumber(snap.disk_total_bytes))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── BOTTOM ROW: Firewall · Suricata · CrowdSec ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Firewall */}
        <Card title="Firewall">
          {snap ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Active States</span>
                <span className="text-2xl font-bold text-blue-600">{toFiniteNumber(snap.firewall_state_count).toLocaleString()}</span>
              </div>
              {snap.firewall_rule_hits && Array.isArray(snap.firewall_rule_hits) && snap.firewall_rule_hits.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Rule Hit Counters</p>
                  <FirewallRuleHitsChart items={snap.firewall_rule_hits} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </Card>

        {/* Suricata */}
        <Card title="Suricata IDS">
          {snap ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Alert Rate</span>
                <span className={`text-xl font-bold ${toFiniteNumber(snap.suricata_alert_rate) > 10 ? 'text-red-600' : toFiniteNumber(snap.suricata_alert_rate) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {toFiniteNumber(snap.suricata_alert_rate).toFixed(1)}<span className="text-sm font-normal text-gray-400">/min</span>
                </span>
              </div>
              {suricataSparkData.length > 1 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">5-min history</p>
                  <SparklineGraph
                    data={suricataSparkData}
                    color={toFiniteNumber(snap.suricata_alert_rate) > 0 ? '#f59e0b' : '#22c55e'}
                    height={48}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </Card>

        {/* CrowdSec */}
        <Card title="CrowdSec">
          {snap ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Decision Rate</span>
                <span className={`text-xl font-bold ${toFiniteNumber(snap.crowdsec_decision_rate) > 5 ? 'text-red-600' : toFiniteNumber(snap.crowdsec_decision_rate) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {toFiniteNumber(snap.crowdsec_decision_rate).toFixed(1)}<span className="text-sm font-normal text-gray-400">/min</span>
                </span>
              </div>
              {crowdsecSparkData.length > 1 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">5-min history</p>
                  <SparklineGraph
                    data={crowdsecSparkData}
                    color={toFiniteNumber(snap.crowdsec_decision_rate) > 0 ? '#ef4444' : '#22c55e'}
                    height={48}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </Card>
      </div>
    </div>
  )
}
