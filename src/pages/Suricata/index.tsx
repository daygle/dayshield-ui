import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getSuricataConfig,
  getInterfaceSuricataConfig,
  type InterfaceSuricataConfig,
  updateSuricataConfig,
  updateInterfaceSuricataConfig,
  getSuricataAlerts,
} from '../../api/suricata'
import { getInterfaces, getInterfacesInventory } from '../../api/interfaces'
import { getSystemConfig } from '../../api/system'
import type {
  SuricataConfig,
  SuricataAlert,
  SuricataSeverity,
  NetworkInterface,
} from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext'
import { SuricataRulesetGroupsSection } from './RulesetsPage'

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
  const { formatDateTime } = useDisplayPreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedInterface = searchParams.get('iface')
  const [config, setConfig] = useState<SuricataConfig | null>(null)
  const [interfaceConfig, setInterfaceConfig] = useState<InterfaceSuricataConfig | null>(null)
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [ipv6Enabled, setIpv6Enabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Summary bar helpers
  const monitoredCount = config?.interfaces.length ?? 0;
  const totalIfaces = interfaces.length;

  const extractInterfaceIpv4Cidr = useCallback((iface?: NetworkInterface | null): string | null => {
    if (!iface) return null
    if (iface.ipv4Address && iface.ipv4Prefix != null) {
      return `${iface.ipv4Address}/${iface.ipv4Prefix}`
    }
    const runtimeIpv4 = (iface.kernelAddresses ?? []).find((addr) => addr.includes('.') && addr.includes('/'))
    return runtimeIpv4 ?? null
  }, [])

  const extractInterfaceIpv6Cidr = useCallback((iface?: NetworkInterface | null): string | null => {
    if (!iface) return null
    if (iface.ipv6Address && iface.ipv6Prefix != null) {
      return `${iface.ipv6Address}/${iface.ipv6Prefix}`
    }
    const runtimeIpv6 = (iface.kernelAddresses ?? []).find((addr) => {
      const lower = addr.toLowerCase()
      return addr.includes(':') && addr.includes('/') && !lower.startsWith('fe80:')
    })
    return runtimeIpv6 ?? null
  }, [])

  const extractInterfaceCidrs = useCallback((iface?: NetworkInterface | null): string[] => {
    const cidrs = [extractInterfaceIpv4Cidr(iface)].filter((cidr): cidr is string => Boolean(cidr))
    if (ipv6Enabled) {
      const ipv6 = extractInterfaceIpv6Cidr(iface)
      if (ipv6) cidrs.push(ipv6)
    }
    return cidrs
  }, [extractInterfaceIpv4Cidr, extractInterfaceIpv6Cidr, ipv6Enabled])

  const loadAll = useCallback(() => {
    setLoading(true)
    const loadPromise = selectedInterface
      ? Promise.all([
          getSuricataConfig(),
          getInterfaceSuricataConfig(selectedInterface),
          getSuricataAlerts(),
          getSystemConfig(),
        ])
      : Promise.all([getSuricataConfig(), getSuricataAlerts(), getSystemConfig()])

    loadPromise
      .then((results) => {
        if (selectedInterface) {
          const [cfg, ifaceCfg, al, system] = results as [
            { data: SuricataConfig },
            { data: InterfaceSuricataConfig },
            { data: SuricataAlert[] },
            { data: { ipv6Enabled: boolean } },
          ]
          setConfig(cfg.data)
          setInterfaceConfig(ifaceCfg.data)
          setAlerts(al.data as AlertRow[])
          setIpv6Enabled(Boolean(system.data.ipv6Enabled))
          setError(null)
          return
        }

        const [cfg, al, system] = results as [
          { data: SuricataConfig },
          { data: SuricataAlert[] },
          { data: { ipv6Enabled: boolean } },
        ]
        setConfig(cfg.data)
        setInterfaceConfig(null)
        setAlerts(al.data as AlertRow[])
        setIpv6Enabled(Boolean(system.data.ipv6Enabled))
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

  const handleAutoPopulateHomeNetworks = useCallback(() => {
    if (!config) return

    // Get CIDRs from monitored interfaces
    const homeNets = config.interfaces
      .map((ifaceName) => interfaces.find((iface) => iface.name === ifaceName))
      .flatMap((iface) => extractInterfaceCidrs(iface))

    if (homeNets.length === 0) {
      return false
    }

    updateSuricataConfig({ homeNet: homeNets })
      .then((res) => {
        setConfig(res.data)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))

    return true
  }, [config, extractInterfaceCidrs, interfaces])

  // Auto-populate Home Networks when empty and monitored interfaces are available
  useEffect(() => {
    if (!config || config.homeNet.length > 0 || config.interfaces.length === 0) return

    const hasMonitoredIfaceWithIp = config.interfaces.some(
      (ifaceName) => {
        const iface = interfaces.find((i) => i.name === ifaceName)
        return extractInterfaceCidrs(iface).length > 0
      }
    )

    if (hasMonitoredIfaceWithIp) {
      handleAutoPopulateHomeNetworks()
    }
  }, [config, extractInterfaceCidrs, handleAutoPopulateHomeNetworks, interfaces])

  const derivedHomeNets = React.useMemo(() => {
    if (!config) return []
    return config.interfaces
      .map((ifaceName) => interfaces.find((iface) => iface.name === ifaceName))
      .flatMap((iface) => extractInterfaceCidrs(iface))
  }, [config, interfaces, extractInterfaceCidrs])

  const displayedHomeNets = config?.homeNet.length ? config.homeNet : derivedHomeNets

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
      render: (row) => formatDateTime(row.timestamp as string),
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
          Loading Suricata configuration and alerts…
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Global Suricata Status Card */}
      {config && (
        <Card
          title="Suricata Status"
          subtitle="Global IDS/IPS configuration and settings"
          actions={
            <div className="flex items-center gap-2">
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
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
              <dd className={`mt-1 text-lg font-semibold ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config.enabled ? 'Running' : 'Stopped'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Mode</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-800 uppercase">{config.mode}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Interfaces Monitored</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-800">{monitoredCount} / {totalIfaces}</dd>
            </div>
            <div className="md:col-span-3">
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Home Networks</dt>
              <dd className="mt-1 font-medium text-gray-800">
                {displayedHomeNets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {displayedHomeNets.map((net) => (
                      <div key={net} className="text-sm font-mono text-gray-700 bg-gray-50 rounded px-2 py-1">
                        {net}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400">Not configured</span>
                )}
                {config.homeNet.length === 0 && displayedHomeNets.length > 0 && (
                  <div className="mt-1 text-xs text-blue-700">Auto-derived from monitored interface IPs</div>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Interface Monitoring Grid */}
      {config && interfaces.length > 0 && (
        <Card
          title="Interface Monitoring"
          subtitle={`Select an interface to view details (${monitoredCount} monitored)`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {interfaces.map((iface) => {
              const isMonitored = config.interfaces.includes(iface.name)
              const isSelected = selectedInterface === iface.name
              const interfaceIp = extractInterfaceCidrs(iface).join(', ')
              return (
                <button
                  key={iface.name}
                  onClick={() => handleSelectInterface(iface.name)}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {formatInterfaceDisplayName(iface.description, iface.name)}
                      </h4>
                      <p className="mt-1 text-xs text-gray-500">
                        {interfaceIp || 'No IP configured'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                        isMonitored
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {isMonitored ? 'Monitored' : 'Not monitored'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Selected Interface Details Card */}
      {config && selectedInterface && interfaceConfig && (
        <Card
          title={`Interface Details: ${selectedInterfaceLabel}`}
          subtitle={`Configure monitoring for ${selectedInterfaceLabel}`}
          actions={
            <Button
              variant={interfaceConfig.monitored ? 'secondary' : 'primary'}
              size="sm"
              aria-label={interfaceConfig.monitored ? 'Disable Suricata monitoring' : 'Enable Suricata monitoring'}
              onClick={handleToggleSelectedInterface}
            >
              {interfaceConfig.monitored ? 'Disable Monitoring' : 'Enable Monitoring'}
            </Button>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
              <dd className={`mt-1 font-semibold ${interfaceConfig.monitored ? 'text-green-600' : 'text-gray-400'}`}>
                {interfaceConfig.monitored ? 'Monitored' : 'Not monitored'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">IP Address</dt>
              <dd className="mt-1 font-mono text-gray-900">
                {extractInterfaceCidrs(selectedInterfaceMeta).join(', ') || 'Not configured'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Interface Type</dt>
              <dd className="mt-1 capitalize text-gray-900">{selectedInterfaceMeta?.type ?? 'Unknown'}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Rulesets section, clearly labeled */}
      <div className="mt-2">
        <Card
          title="Rulesets"
          subtitle="Manage ruleset groups here, then open a dedicated page to inspect the rules inside each group."
        >
          <SuricataRulesetGroupsSection />
        </Card>
      </div>


      {/* Alerts */}
      <Card
        title="Recent Alerts"
        actions={
          <Button variant="primary" size="sm" onClick={loadAll}>
            Refresh Alerts
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
