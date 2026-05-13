import { useEffect, useRef, useState } from 'react'
import { useSystemStatus } from '../../hooks/useSystemStatus'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useSecurityStatus } from '../../hooks/useSecurityStatus'
import { useAcmeStatus } from '../../hooks/useAcmeStatus'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
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

type DashboardCardId =
  | 'system'
  | 'network'
  | 'acme'
  | 'suricata'
  | 'crowdsec'
  | 'firewall'
  | 'interface'

type DashboardCardConfig = {
  id: DashboardCardId
  visible: boolean
  width: 1 | 2 | 3
}

const defaultDashboardCardConfigs: DashboardCardConfig[] = [
  { id: 'system', visible: true, width: 1 },
  { id: 'network', visible: true, width: 1 },
  { id: 'acme', visible: true, width: 1 },
  { id: 'suricata', visible: true, width: 2 },
  { id: 'crowdsec', visible: true, width: 1 },
  { id: 'firewall', visible: true, width: 1 },
  { id: 'interface', visible: true, width: 1 },
]

const dashboardCardTitles: Record<DashboardCardId, string> = {
  system: 'System Status',
  network: 'Network Status',
  acme: 'Certificate Status',
  suricata: 'Suricata Alerts',
  crowdsec: 'CrowdSec Decisions',
  firewall: 'Firewall Summary',
  interface: 'Interface Summary',
}

const dashboardCardDescriptions: Record<DashboardCardId, string> = {
  system: 'Hostname, uptime, CPU, RAM and disk stats.',
  network: 'WAN/LAN status and traffic throughput.',
  acme: 'ACME certificate health and renewal status.',
  suricata: 'Suricata alert rate and danger state.',
  crowdsec: 'Active CrowdSec decisions summary.',
  firewall: 'Firewall rule and state counts.',
  interface: 'Interface link and IP status overview.',
}

const cardWidthClass = (width: number) => {
  if (width === 2) return 'md:col-span-2'
  if (width === 3) return 'md:col-span-3'
  return 'md:col-span-1'
}

const formatInterfaceDisplayName = (friendlyName: string | undefined, nicName: string): string => {
  const friendly = friendlyName?.trim()
  if (!friendly) return nicName
  if (friendly.toLowerCase() === nicName.trim().toLowerCase()) return friendly
  return `${friendly} (${nicName})`
}

const loadDashboardCardConfig = (): DashboardCardConfig[] => {
  if (typeof window === 'undefined') return defaultDashboardCardConfigs
  try {
    const raw = window.localStorage.getItem('dashboardCardConfig')
    if (!raw) return defaultDashboardCardConfigs
    const parsed = JSON.parse(raw) as DashboardCardConfig[]
    if (!Array.isArray(parsed)) return defaultDashboardCardConfigs

    const validIds = new Set(defaultDashboardCardConfigs.map((card) => card.id))
    const loaded = parsed
      .filter((card) => validIds.has(card.id))
      .map((card) => ({
        ...defaultDashboardCardConfigs.find((d) => d.id === card.id)!,
        visible: typeof card.visible === 'boolean' ? card.visible : true,
        width: card.width === 1 || card.width === 2 || card.width === 3 ? card.width : 1,
      }))

    const missing = defaultDashboardCardConfigs.filter((card) => !loaded.some((item) => item.id === card.id))
    return [...loaded, ...missing]
  } catch {
    return defaultDashboardCardConfigs
  }
}

export default function Dashboard() {
  const sys = useSystemStatus()
  const net = useNetworkStatus()
  const sec = useSecurityStatus()
  const acme = useAcmeStatus()

  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [cardConfig, setCardConfig] = useState<DashboardCardConfig[]>(loadDashboardCardConfig)

  useEffect(() => {
    window.localStorage.setItem('dashboardCardConfig', JSON.stringify(cardConfig))
  }, [cardConfig])

  const { rxHistory, txHistory } = useThroughputBuffer(
    net.data?.wan_rx_bps,
    net.data?.wan_tx_bps,
  )

  const alertRate = toFiniteNumber(sec.data?.suricata_alert_rate)
  const hasWarningAlerts = alertRate >= 1 && alertRate < 5
  const hasCriticalAlerts = alertRate >= 5

  const moveCard = (index: number, direction: -1 | 1) => {
    setCardConfig((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const updateCard = (id: DashboardCardId, partial: Partial<DashboardCardConfig>) => {
    setCardConfig((current) =>
      current.map((card) => (card.id === id ? { ...card, ...partial } : card)),
    )
  }

  const renderCardBody = (id: DashboardCardId) => {
    switch (id) {
      case 'system':
        return (
          <>
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
          </>
        )
      case 'network':
        return (
          <>
            {net.isError && <ErrorBanner message={net.error?.message ?? 'Failed to load network status'} />}
            {net.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
            {net.data && (
              <div className="space-y-3">
                <MetricRow
                  label="WAN Interface"
                  value={formatInterfaceDisplayName(net.data.wan_iface_description, net.data.wan_iface)}
                />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">WAN IPv4</span>
                  <span className="font-medium text-gray-800">{net.data.wan_ip ?? '-'}</span>
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
                          <span className="font-medium text-gray-700">
                            {formatInterfaceDisplayName(iface.description, iface.name)}
                          </span>
                          <span className="text-gray-500">{iface.ip ?? '-'}</span>
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
          </>
        )
      case 'acme':
        return (
          <>
            {acme.isError && <ErrorBanner message={acme.error?.message ?? 'Failed to load ACME status'} />}
            {acme.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
            {acme.data && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Domains</p>
                  <div className="flex flex-wrap gap-1">
                    {acme.data.domains.length > 0 ? (
                      acme.data.domains.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200"
                        >
                          {d}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">No domains</span>
                    )}
                  </div>
                </div>
                {acme.data.cert_exists ? (
                  <div className="space-y-3">
                    <MetricRow label="Expires in" value={`${acme.data.expires_in_days} days`} />
                    {acme.data.next_renewal && (
                      <MetricRow
                        label="Next Renewal"
                        value={new Date(acme.data.next_renewal).toLocaleDateString()}
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-gray-500">
                    <p>No certificate file exists for the primary domain.</p>
                    {acme.data.domains.length === 0 ? (
                      <p>Configure ACME to issue certificates.</p>
                    ) : (
                      <p>Run certificate issuance to create the certificate.</p>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Renewal Status</span>
                  {acme.data.needs_renewal ? (
                    <Badge variant="red">Due</Badge>
                  ) : acme.data.cert_exists ? (
                    <Badge variant="green">OK</Badge>
                  ) : (
                    <Badge variant="gray">Unknown</Badge>
                  )}
                </div>
              </div>
            )}
          </>
        )
      case 'suricata':
        return (
          <>
            {sec.isError && <ErrorBanner message={sec.error?.message ?? 'Failed to load security status'} />}
            {sec.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
            {sec.data && (
              <div className="space-y-3">
                <div className="text-sm text-gray-500">Suricata alert rate</div>
                <div className="text-2xl font-semibold text-gray-900">{alertRate.toFixed(1)} alerts/sec</div>
                <p className="text-sm text-gray-500">Detailed alert data is unavailable in this version.</p>
                {hasWarningAlerts && !hasCriticalAlerts && (
                  <p className="text-xs text-yellow-700">High alert rate detected; investigate Suricata alerts page.</p>
                )}
                {hasCriticalAlerts && (
                  <p className="text-xs text-red-700">Critical alert flood detected; check Suricata immediately.</p>
                )}
              </div>
            )}
          </>
        )
      case 'crowdsec':
        return (
          <>
            {sec.isError && <ErrorBanner message={sec.error?.message ?? 'Failed to load security status'} />}
            {sec.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
            {sec.data && (
              <div className="space-y-3">
                <div className="text-sm text-gray-500">Active CrowdSec decisions</div>
                <div className="text-2xl font-semibold text-gray-900">{sec.data.crowdsec_active_decisions}</div>
                <p className="text-sm text-gray-500">Detailed decision rows are unavailable in this version.</p>
              </div>
            )}
          </>
        )
      case 'firewall':
        return (
          <>
            {sec.isError && <ErrorBanner message={sec.error?.message ?? 'Failed to load security status'} />}
            {sec.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
            {sec.data && (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-3xl font-bold text-gray-900">{sec.data.firewall_rule_count}</p>
                  <p className="text-sm text-gray-500 mt-1">Configured firewall rules</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-3xl font-bold text-blue-600">{sec.data.firewall_state_count}</p>
                  <p className="text-sm text-gray-500 mt-1">Active connection tracking states</p>
                </div>
              </div>
            )}
          </>
        )
      case 'interface':
        return (
          <>
            {net.isError && <ErrorBanner message={net.error?.message ?? 'Failed to load network status'} />}
            {net.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
            {net.data && (
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {formatInterfaceDisplayName(net.data.wan_iface_description, net.data.wan_iface)}
                    </p>
                    <p className="text-xs text-gray-500">{net.data.wan_ip ?? '-'}</p>
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
                {net.data.lan_ifaces.map((iface) => (
                  <div key={iface.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {formatInterfaceDisplayName(iface.description, iface.name)}
                      </p>
                      <p className="text-xs text-gray-500">{iface.ip ?? '-'}</p>
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
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Customize which cards appear, rearrange their order, and resize the layout to suit your workflow.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setCustomizeOpen(true)}>
          Customize Dashboard
        </Button>
      </div>

      {cardConfig.every((card) => !card.visible) && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          No dashboard cards are visible. Open Customize Dashboard to restore card visibility.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cardConfig.map((card) =>
          card.visible ? (
            <div key={card.id} className={`col-span-1 ${cardWidthClass(card.width)}`}>
              <Card
                title={dashboardCardTitles[card.id]}
                actions={card.id === 'suricata' ? (hasCriticalAlerts ? <Badge variant="red">Critical</Badge> : hasWarningAlerts ? <Badge variant="yellow">High</Badge> : undefined) : undefined}
              >
                {renderCardBody(card.id)}
              </Card>
            </div>
          ) : null,
        )}
      </div>

      <Modal
        open={customizeOpen}
        title="Customize Dashboard"
        onClose={() => setCustomizeOpen(false)}
        onConfirm={() => setCustomizeOpen(false)}
        confirmLabel="Done"
        size="lg"
      >
        <div className="space-y-4">
          {cardConfig.map((card, index) => (
            <div key={card.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{dashboardCardTitles[card.id]}</div>
                  <p className="text-sm text-gray-500">{dashboardCardDescriptions[card.id]}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => moveCard(index, -1)} disabled={index === 0}>
                    Move Up
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => moveCard(index, 1)} disabled={index === cardConfig.length - 1}>
                    Move Down
                  </Button>
                  <Button
                    size="sm"
                    variant={card.visible ? 'secondary' : 'primary'}
                    onClick={() => updateCard(card.id, { visible: !card.visible })}
                  >
                    {card.visible ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  Size:
                  <select
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
                    value={card.width}
                    onChange={(event) => updateCard(card.id, { width: Number(event.target.value) as 1 | 2 | 3 })}
                  >
                    <option value={1}>Small</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Large</option>
                  </select>
                </label>
                <div className="text-xs text-gray-500">
                  Small = 1 column, Medium = 2 columns, Large = full width on desktop.
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

