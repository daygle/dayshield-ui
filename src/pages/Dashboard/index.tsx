import { useEffect, useState } from 'react'
import { getSystemStatus } from '../../api/client'
import type { SystemStatus } from '../../types'
import Card from '../../components/Card'

// TODO: Add real-time auto-refresh (polling or WebSocket) for live metrics
// TODO: Add charts for CPU / memory usage over time
// TODO: Add recent log/alert feed section
// TODO: Add quick-action buttons (e.g. reload firewall, restart interface)

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(1)} GB`
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  color?: string
}

function StatCard({ label, value, sub, color = 'text-gray-900' }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSystemStatus()
      .then((res) => setStatus(res.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        Loading system status…
      </div>
    )
  }

  if (error || !status) {
    return (
      <Card title="System Status" className="border-red-200">
        <p className="text-sm text-red-600">
          {error ?? 'Failed to load system status.'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Make sure <code>dayshield-core</code> is running on{' '}
          <code>http://localhost:8080</code>.
        </p>
      </Card>
    )
  }

  const memPct = Math.round((status.memoryUsed / status.memoryTotal) * 100)
  const diskPct = Math.round((status.diskUsed / status.diskTotal) * 100)

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Hostname" value={status.hostname} />
        <StatCard label="Uptime" value={formatUptime(status.uptime)} />
        <StatCard
          label="CPU Usage"
          value={`${status.cpuUsage}%`}
          color={status.cpuUsage > 80 ? 'text-red-600' : 'text-gray-900'}
        />
        <StatCard
          label="Active Connections"
          value={String(status.activeConnections)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Memory */}
        <Card title="Memory">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Used</span>
              <span>
                {formatBytes(status.memoryUsed)} / {formatBytes(status.memoryTotal)} ({memPct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${memPct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${memPct}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Disk */}
        <Card title="Disk">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Used</span>
              <span>
                {formatBytes(status.diskUsed)} / {formatBytes(status.diskTotal)} ({diskPct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${diskPct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${diskPct}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Info */}
      <Card title="System Info">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Version</dt>
            <dd className="font-medium text-gray-800">{status.version}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Interfaces</dt>
            <dd className="font-medium text-gray-800">{status.interfaces}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Firewall Rules</dt>
            <dd className="font-medium text-gray-800">{status.firewallRules}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Updated</dt>
            <dd className="font-medium text-gray-800">
              {new Date(status.lastUpdated).toLocaleString()}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
