import React, { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getSuricataConfig,
  getInterfaceSuricataConfig,
  type InterfaceSuricataConfig,
  updateSuricataConfig,
  updateInterfaceSuricataConfig,
  getSuricataAlerts,
} from '../../api/suricata'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import type {
  SuricataConfig,
  SuricataAlert,
  SuricataSeverity,
  NetworkInterface,
} from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import FormField from '../../components/FormField'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'
import ErrorBoundary from '../../components/ErrorBoundary'

type AlertRow = SuricataAlert & Record<string, unknown>

const severityBadge = (severity: SuricataSeverity) => {
  const map: Record<SuricataSeverity, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-orange-100 text-orange-700',
    low: 'bg-yellow-100 text-yellow-700',
    informational: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[severity]}`}>
      {severity}
    </span>
  )
}

const actionBadge = (action: 'alert' | 'drop') => (
  <span
    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
      action === 'drop' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
    }`}
  >
    {action}
  </span>
)

function SuricataContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedInterface = searchParams.get('iface')
  const [config, setConfig] = useState<SuricataConfig | null>(null)
  const [interfaceConfig, setInterfaceConfig] = useState<InterfaceSuricataConfig | null>(null)
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(() => {
    setLoading(true)
    const loadPromise = selectedInterface
      ? Promise.all([
          getSuricataConfig(),
          getInterfaceSuricataConfig(selectedInterface),
          getSuricataAlerts(),
        ])
      : Promise.all([getSuricataConfig(), getSuricataAlerts()])

    loadPromise
      .then((results) => {
        if (selectedInterface) {
          const [cfg, ifaceCfg, al] = results as [
            { data: SuricataConfig },
            { data: InterfaceSuricataConfig },
            { data: SuricataAlert[] },
          ]
          setConfig(cfg.data)
          setInterfaceConfig(ifaceCfg.data)
          setAlerts(al.data as AlertRow[])
          setError(null)
          return
        }

        const [cfg, al] = results as [
          { data: SuricataConfig },
          { data: SuricataAlert[] },
        ]
        setConfig(cfg.data)
        setInterfaceConfig(null)
        setAlerts(al.data as AlertRow[])
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedInterface])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    Promise.all([getInterfaces(), getInterfacesInventory()])
      .then(([ifacesRes, inventoryRes]) => {
        const configured = (ifacesRes.data ?? []).filter((iface) => iface.enabled !== false)
        const known = new Set(configured.map((iface) => iface.name))
        const extras = (inventoryRes.data?.names ?? [])
          .filter((name) => name !== 'lo' && !known.has(name))
          .map((name) => ({
            name,
            description: '',
            type: 'ethernet' as const,
            enabled: true,
          }))

        const merged = [...configured, ...extras]
        setInterfaces(merged)

        if (!selectedInterface && merged.length > 0) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set('iface', merged[0].name)
            return next
          }, { replace: true })
        }
      })
      .catch(() => setInterfaces([]))
  }, [selectedInterface, setSearchParams])

  const handleSelectInterface = (interfaceName: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (interfaceName) next.set('iface', interfaceName)
      else next.delete('iface')
      return next
    })
  }

  const handleToggleEnabled = () => {
    if (!config) return
    updateSuricataConfig({ enabled: !config.enabled })
      .then((res) => {
        setConfig(res.data)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }

  const handleToggleMode = () => {
    if (!config) return
    updateSuricataConfig({ mode: config.mode === 'ids' ? 'ips' : 'ids' })
      .then((res) => {
        setConfig(res.data)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }

  const handleToggleSelectedInterface = () => {
    if (!selectedInterface || !interfaceConfig) return
    updateInterfaceSuricataConfig(selectedInterface, !interfaceConfig.monitored)
      .then((res) => {
        setInterfaceConfig(res.data)
        setConfig((prev) => (prev ? { ...prev, interfaces: res.data.interfaces } : prev))
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }

  const interfaceLabels = React.useMemo(
    () =>
      new Map(interfaces.map((iface) => [iface.name, formatInterfaceDisplayName(iface.description, iface.name)])),
    [interfaces],
  )

  const interfaceLabel = useCallback((name: string): string => interfaceLabels.get(name) ?? name, [interfaceLabels])

  const alertColumns: Column<AlertRow>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (row) => new Date(row.timestamp as string).toLocaleString(),
    },
    { key: 'srcIp', header: 'Src IP' },
    { key: 'dstIp', header: 'Dst IP' },
    { key: 'protocol', header: 'Proto' },
    { key: 'signature', header: 'Signature' },
    { key: 'category', header: 'Category' },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => severityBadge(row.severity as SuricataSeverity),
    },
    {
      key: 'interface',
      header: 'Interface',
      render: (row) => (row.interface as string) ? interfaceLabel(row.interface as string) : '-',
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => actionBadge(row.action as 'alert' | 'drop'),
    },
  ]

  const selectedInterfaceMeta = React.useMemo(
    () => interfaces.find((iface) => iface.name === selectedInterface) ?? null,
    [interfaces, selectedInterface],
  )

  const selectedInterfaceLabel = selectedInterfaceMeta
    ? interfaceLabel(selectedInterfaceMeta.name)
    : selectedInterface || ''
  const alertsIncludeInterface = alerts.some((alert) => Boolean(alert.interface))

  const filteredAlerts = React.useMemo(() => {
    if (!selectedInterface) return alerts
    if (alertsIncludeInterface) {
      return alerts.filter((alert) => String(alert.interface ?? '') === selectedInterface)
    }
    return interfaceConfig?.monitored ? alerts : []
  }, [alerts, selectedInterface, alertsIncludeInterface, interfaceConfig?.monitored])

  return (
    <div className="space-y-6">
      {loading && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600" role="status" aria-live="polite">
          Loading Suricata configuration, rulesets, and alerts…
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <Card
        title="Suricata"
        subtitle="Select the interface whose Suricata settings, rulesets, and recent alerts you want to review"
      >
        <div className="max-w-md">
          <FormField
            id="suricata-interface-selector"
            label="Interface"
            as="select"
            aria-label="Select Suricata interface"
            value={selectedInterface ?? ''}
            onChange={(e) => handleSelectInterface(e.target.value)}
          >
            <option value="">Select interface</option>
            {interfaces.map((iface) => (
              <option key={iface.name} value={iface.name}>
                {interfaceLabel(iface.name)}
              </option>
            ))}
          </FormField>
        </div>
      </Card>

      {/* Status card */}
      {config && (
        <Card
          title={selectedInterface ? `Suricata Settings: ${selectedInterfaceLabel}` : 'Suricata IDS/IPS'}
          subtitle={selectedInterface ? 'Per-interface Suricata monitoring state and engine mode' : 'Network threat detection and prevention'}
          actions={
            <div className="flex items-center gap-2">
              {selectedInterface && interfaceConfig && (
                <Button
                  variant={interfaceConfig.monitored ? 'secondary' : 'primary'}
                  size="sm"
                  aria-label={interfaceConfig.monitored ? 'Disable Suricata on selected interface' : 'Enable Suricata on selected interface'}
                  onClick={handleToggleSelectedInterface}
                >
                  {interfaceConfig.monitored ? 'Disable on Interface' : 'Enable on Interface'}
                </Button>
              )}
              <Button
                variant={config.mode === 'ips' ? 'danger' : 'secondary'}
                size="sm"
                aria-label="Toggle Suricata mode between IDS and IPS"
                onClick={handleToggleMode}
              >
                Mode: {config.mode.toUpperCase()}
              </Button>
              <Button
                variant={config.enabled ? 'danger' : 'primary'}
                size="sm"
                aria-label={config.enabled ? 'Stop Suricata' : 'Start Suricata'}
                onClick={handleToggleEnabled}
              >
                {config.enabled ? 'Stop' : 'Start'}
              </Button>
            </div>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className={`font-medium ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config.enabled ? 'Running' : 'Stopped'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Mode</dt>
              <dd className="font-medium text-gray-800 uppercase">{config.mode}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Interfaces</dt>
              <dd className="font-medium text-gray-800">{config.interfaces.map(interfaceLabel).join(', ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Home Networks</dt>
              <dd className="font-medium text-gray-800 text-xs">
                {config.homeNet.join(', ') || '-'}
              </dd>
            </div>
            {selectedInterface && (
              <div>
                <dt className="text-gray-500">Monitored on selected interface</dt>
                <dd
                  className={`font-medium ${
                    config.interfaces.includes(selectedInterface)
                      ? 'text-green-600'
                      : 'text-amber-600'
                  }`}
                >
                  {config.interfaces.includes(selectedInterface)
                    ? 'Yes'
                    : 'No'}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      <Card
        title="Rulesets"
        subtitle="Manage bundled rulesets on a dedicated page grouped by vendor/category"
        actions={
          <Link
            to="/suricata/rulesets"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Rulesets
          </Link>
        }
      >
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">What changed</div>
            <div className="font-medium text-gray-900">The old modal is replaced by a dedicated page.</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Grouping</div>
            <div className="font-medium text-gray-900">Rulesets are grouped by vendor/category.</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Drill down</div>
            <div className="font-medium text-gray-900">Pick a ruleset, then toggle individual rules.</div>
          </div>
        </div>
      </Card>

      {/* Alerts */}
      <Card
        title="Recent Alerts"
        subtitle={selectedInterface ? `Latest IDS/IPS events for ${selectedInterfaceLabel}` : 'Latest 100 IDS/IPS events'}
        actions={
          <Button variant="secondary" size="sm" onClick={loadAll}>
            Refresh
          </Button>
        }
      >
        <Table
          columns={alertColumns}
          data={filteredAlerts}
          keyField="id"
          loading={loading}
          emptyMessage="No alerts recorded."
        />
        {selectedInterface && !alertsIncludeInterface && (
          <p className="mt-3 text-xs text-gray-500">
            Alert logs currently do not include interface tags on this appliance, so alerts are shown globally when this interface is monitored.
          </p>
        )}
      </Card>

    </div>
  )
}

export default function Suricata() {
  return (
    <ErrorBoundary fallbackMessage="The Suricata page failed to render. Please refresh and try again.">
      <SuricataContent />
    </ErrorBoundary>
  )
}
