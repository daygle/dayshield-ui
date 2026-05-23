import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getSuricataConfig,
  getInterfaceSuricataConfig,
  type InterfaceSuricataConfig,
  updateSuricataConfig,
  updateInterfaceSuricataConfig,
  getSuricataAlerts,
  getSuricataRulesets,
} from '../../api/suricata';
import { getInterfacesInventory } from '../../api/interfaces';
import { getSystemConfig } from '../../api/system';
import type {
  SuricataConfig,
  SuricataAlert,
  SuricataSeverity,
  SuricataRuleset,
  NetworkInterface,
} from '../../types';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Table, { Column } from '../../components/Table';
import { ServiceControlCluster } from '../../components/ServiceControlButtons';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext';
import { SuricataRulesetGroupsSection } from './RulesetsPage';

type AlertRow = SuricataAlert & Record<string, unknown>;

const severityBadge = (severity: SuricataSeverity) => {
  const map: Record<SuricataSeverity, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-orange-100 text-orange-700',
    low: 'bg-yellow-100 text-yellow-700',
    informational: 'bg-blue-100 text-blue-700',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[severity]}`}
    >
      {severity}
    </span>
  );
};

const actionBadge = (action: 'alert' | 'drop') => (
  <span
    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
      action === 'drop' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
    }`}
  >
    {action}
  </span>
);

function SuricataContent() {
  const { formatDateTime } = useDisplayPreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedInterface = searchParams.get('iface');
  const [config, setConfig] = useState<SuricataConfig | null>(null);
  const [interfaceConfig, setInterfaceConfig] = useState<InterfaceSuricataConfig | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [rulesets, setRulesets] = useState<SuricataRuleset[]>([]);
  const [rulesetLoading, setRulesetLoading] = useState(true);
  const [rulesetError, setRulesetError] = useState<string | null>(null);
  const [ipv6Enabled, setIpv6Enabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary bar helpers
  const monitoredCount = config?.interfaces.length ?? 0;
  const totalIfaces = interfaces.length;

  const extractInterfaceIpv4Cidr = useCallback((iface?: NetworkInterface | null): string | null => {
    if (!iface) return null;
    if (iface.ipv4Address && iface.ipv4Prefix != null) {
      return `${iface.ipv4Address}/${iface.ipv4Prefix}`;
    }
    const runtimeIpv4 = (iface.kernelAddresses ?? []).find(
      (addr) => addr.includes('.') && addr.includes('/')
    );
    return runtimeIpv4 ?? null;
  }, []);

  const extractInterfaceIpv6Cidr = useCallback((iface?: NetworkInterface | null): string | null => {
    if (!iface) return null;
    if (iface.ipv6Address && iface.ipv6Prefix != null) {
      return `${iface.ipv6Address}/${iface.ipv6Prefix}`;
    }
    const runtimeIpv6 = (iface.kernelAddresses ?? []).find((addr) => {
      const lower = addr.toLowerCase();
      return addr.includes(':') && addr.includes('/') && !lower.startsWith('fe80:');
    });
    return runtimeIpv6 ?? null;
  }, []);

  const extractInterfaceCidrs = useCallback(
    (iface?: NetworkInterface | null): string[] => {
      const cidrs = [extractInterfaceIpv4Cidr(iface)].filter((cidr): cidr is string =>
        Boolean(cidr)
      );
      if (ipv6Enabled) {
        const ipv6 = extractInterfaceIpv6Cidr(iface);
        if (ipv6) cidrs.push(ipv6);
      }
      return cidrs;
    },
    [extractInterfaceIpv4Cidr, extractInterfaceIpv6Cidr, ipv6Enabled]
  );

  const loadRulesets = useCallback(() => {
    setRulesetLoading(true);
    return getSuricataRulesets(selectedInterface ?? undefined)
      .then((res) => {
        setRulesets(res.data ?? []);
        setRulesetError(null);
      })
      .catch((err: Error) => setRulesetError(err.message))
      .finally(() => setRulesetLoading(false));
  }, [selectedInterface]);

  const loadAll = useCallback(() => {
    setLoading(true);
    const loadPromise = selectedInterface
      ? Promise.all([
          getSuricataConfig(),
          getInterfaceSuricataConfig(selectedInterface),
          getSuricataAlerts(),
          getSystemConfig(),
        ])
      : Promise.all([getSuricataConfig(), getSuricataAlerts(), getSystemConfig()]);

    loadPromise
      .then((results) => {
        if (selectedInterface) {
          const [cfg, ifaceCfg, al, system] = results as [
            { data: SuricataConfig },
            { data: InterfaceSuricataConfig },
            { data: SuricataAlert[] },
            { data: { ipv6Enabled: boolean } },
          ];
          setConfig(cfg.data);
          setInterfaceConfig(ifaceCfg.data);
          setAlerts(al.data as AlertRow[]);
          setIpv6Enabled(Boolean(system.data.ipv6Enabled));
          setError(null);
          return;
        }

        const [cfg, al, system] = results as [
          { data: SuricataConfig },
          { data: SuricataAlert[] },
          { data: { ipv6Enabled: boolean } },
        ];
        setConfig(cfg.data);
        setInterfaceConfig(null);
        setAlerts(al.data as AlertRow[]);
        setIpv6Enabled(Boolean(system.data.ipv6Enabled));
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));

    loadRulesets();
  }, [selectedInterface, loadRulesets]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    getInterfacesInventory()
      .then((inventoryRes) => {
        const configured = (inventoryRes.data?.configured ?? []).filter(
          (iface) => iface.enabled !== false
        );
        const names = inventoryRes.data?.names ?? [];
        const known = new Set(configured.map((iface) => iface.name));
        const extras = names
          .filter((name) => name !== 'lo' && !known.has(name))
          .map((name) => ({
            name,
            description: '',
            type: 'ethernet' as const,
            enabled: true,
          }));

        const nextInterfaces = [...configured, ...extras];
        setInterfaces(nextInterfaces);

        if (!selectedInterface && nextInterfaces.length > 0) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('iface', nextInterfaces[0].name);
              return next;
            },
            { replace: true }
          );
        }
      })
      .catch(() => setInterfaces([]));
  }, [selectedInterface, setSearchParams]);

  const handleSelectInterface = (interfaceName: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (interfaceName) next.set('iface', interfaceName);
      else next.delete('iface');
      return next;
    });
  };

  const handleToggleMode = () => {
    if (!config) return;
    updateSuricataConfig({ mode: config.mode === 'ids' ? 'ips' : 'ids' })
      .then((res) => {
        setConfig(res.data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  const hasInstalledRulesets = rulesets.some((ruleset) => ruleset.installed);
  const canEnableSuricata = config?.enabled || (!rulesetLoading && hasInstalledRulesets);
  const rulesetWarningMessage = !rulesetLoading && !hasInstalledRulesets
    ? config?.enabled
      ? 'Suricata is enabled but no rulesets are installed; service startup may fail. Install a ruleset or disable Suricata.'
      : 'Install a ruleset before enabling Suricata. Suricata cannot start without rules.'
    : undefined;

  const handleToggleSuricataEnabled = () => {
    if (!config) return;
    if (!config.enabled && !hasInstalledRulesets) {
      setError('Install a Suricata ruleset before enabling Suricata.');
      return;
    }
    updateSuricataConfig({ enabled: !config.enabled })
      .then((res) => {
        setConfig(res.data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleToggleInterfaceMonitoring = (interfaceName: string, monitored: boolean) => {
    updateInterfaceSuricataConfig(interfaceName, monitored)
      .then((res) => {
        setConfig((prev) => (prev ? { ...prev, interfaces: res.data.interfaces } : prev));
        if (selectedInterface === interfaceName) {
          setInterfaceConfig(res.data);
        }
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleAutoPopulateHomeNetworks = useCallback(() => {
    if (!config) return;

    // Get CIDRs from monitored interfaces
    const homeNets = config.interfaces
      .map((ifaceName) => interfaces.find((iface) => iface.name === ifaceName))
      .flatMap((iface) => extractInterfaceCidrs(iface));

    if (homeNets.length === 0) {
      return false;
    }

    updateSuricataConfig({ homeNet: homeNets })
      .then((res) => {
        setConfig(res.data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));

    return true;
  }, [config, extractInterfaceCidrs, interfaces]);

  // Auto-populate Home Networks when empty and monitored interfaces are available
  useEffect(() => {
    if (!config || config.homeNet.length > 0 || config.interfaces.length === 0) return;

    const hasMonitoredIfaceWithIp = config.interfaces.some((ifaceName) => {
      const iface = interfaces.find((i) => i.name === ifaceName);
      return extractInterfaceCidrs(iface).length > 0;
    });

    if (hasMonitoredIfaceWithIp) {
      handleAutoPopulateHomeNetworks();
    }
  }, [config, extractInterfaceCidrs, handleAutoPopulateHomeNetworks, interfaces]);

  const derivedHomeNets = React.useMemo(() => {
    if (!config) return [];
    return config.interfaces
      .map((ifaceName) => interfaces.find((iface) => iface.name === ifaceName))
      .flatMap((iface) => extractInterfaceCidrs(iface));
  }, [config, interfaces, extractInterfaceCidrs]);

  const displayedHomeNets = config?.homeNet.length ? config.homeNet : derivedHomeNets;

  const interfaceLabels = React.useMemo(
    () =>
      new Map(
        interfaces.map((iface) => [
          iface.name,
          formatInterfaceDisplayName(iface.description, iface.name),
        ])
      ),
    [interfaces]
  );

  const interfaceLabel = useCallback(
    (name: string): string => interfaceLabels.get(name) ?? name,
    [interfaceLabels]
  );

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
      render: (row) => ((row.interface as string) ? interfaceLabel(row.interface as string) : '-'),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => actionBadge(row.action as 'alert' | 'drop'),
    },
  ];

  const selectedInterfaceMeta = React.useMemo(
    () => interfaces.find((iface) => iface.name === selectedInterface) ?? null,
    [interfaces, selectedInterface]
  );

  const selectedInterfaceLabel = selectedInterfaceMeta
    ? interfaceLabel(selectedInterfaceMeta.name)
    : selectedInterface || '';
  const alertsIncludeInterface = alerts.some((alert) => Boolean(alert.interface));

  const filteredAlerts = React.useMemo(() => {
    if (!selectedInterface) return alerts;
    if (alertsIncludeInterface) {
      return alerts.filter((alert) => String(alert.interface ?? '') === selectedInterface);
    }
    return interfaceConfig?.monitored ? alerts : [];
  }, [alerts, selectedInterface, alertsIncludeInterface, interfaceConfig?.monitored]);

  return (
    <div className="space-y-6">
      {loading && (
        <div
          className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600"
          role="status"
          aria-live="polite"
        >
          Loading Suricata configuration and alerts...
        </div>
      )}
      {error && (
        <div
          className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}
      {rulesetError && !error && (
        <div
          className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700"
          role="alert"
          aria-live="polite"
        >
          {rulesetError}
        </div>
      )}

      {/* Global Suricata Status Card */}
      {config && (
        <Card
          title="Suricata Overview"
          subtitle="Global IDS/IPS status, monitored interfaces, and trusted network ranges"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ServiceControlCluster
                serviceId="suricata"
                disabled={loading}
                onError={setError}
                onSuccess={() => setError(null)}
              />
              <Button
                size="sm"
                variant={config?.enabled ? 'secondary' : 'primary'}
                disabled={loading || (!config.enabled && !canEnableSuricata)}
                onClick={handleToggleSuricataEnabled}
                title={!config.enabled && !canEnableSuricata ? rulesetWarningMessage : undefined}
              >
                {config?.enabled ? 'Disable Suricata' : 'Enable Suricata'}
              </Button>
              <Button size="sm" variant="secondary" disabled={loading} onClick={loadAll}>
                Refresh
              </Button>
            </div>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
              <dd
                className={`mt-1 text-sm font-semibold ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}
              >
                {config.enabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Mode</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-800 uppercase">{config.mode}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                Interfaces Monitored
              </dt>
              <dd className="mt-1 text-sm font-semibold text-gray-800">
                {monitoredCount} / {totalIfaces}
              </dd>
            </div>
            <div className="md:col-span-3">
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                Home Networks
              </dt>
              <dd className="mt-1 font-medium text-gray-800">
                {displayedHomeNets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {displayedHomeNets.map((net) => (
                      <div
                        key={net}
                        className="text-sm font-mono text-gray-700 bg-gray-50 rounded px-2 py-1"
                      >
                        {net}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">Not configured</div>
                )}
                {config.homeNet.length === 0 && displayedHomeNets.length > 0 && (
                  <div className="mt-1 text-xs text-blue-700">
                    Auto-derived from monitored interface IPs
                  </div>
                )}
              </dd>
            </div>
          </dl>
          {rulesetWarningMessage && (
            <div
              className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700"
              role="alert"
            >
              {rulesetWarningMessage}
            </div>
          )}
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
              const isMonitored = config.interfaces.includes(iface.name);
              const isSelected = selectedInterface === iface.name;
              const interfaceIps = extractInterfaceCidrs(iface).join(', ');

              return (
                <button
                  key={iface.name}
                  type="button"
                  onClick={() => handleSelectInterface(iface.name)}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {formatInterfaceDisplayName(iface.description, iface.name)}
                      </h4>
                      <p className="mt-1 text-xs text-gray-500">
                        {interfaceIps || 'No IP address detected'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                          isMonitored ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {isMonitored ? 'Monitored' : 'Not monitored'}
                      </span>
                      <Button
                        size="sm"
                        variant={isMonitored ? 'secondary' : 'primary'}
                        disabled={loading}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleInterfaceMonitoring(iface.name, !isMonitored);
                        }}
                      >
                        {isMonitored ? 'Disable monitoring' : 'Enable monitoring'}
                      </Button>
                    </div>
                  </div>
                </button>
              );
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
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={handleToggleMode}
            >
              Switch to {config.mode === 'ips' ? 'IDS' : 'IPS'}
            </Button>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                Monitoring Status
              </dt>
              <dd
                className={`mt-1 font-semibold ${interfaceConfig.monitored ? 'text-green-600' : 'text-gray-400'}`}
              >
                {interfaceConfig.monitored ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                IP Address
              </dt>
              <dd className="mt-1 font-mono text-gray-900">
                {extractInterfaceCidrs(selectedInterfaceMeta).join(', ') || 'Not configured'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                Interface Type
              </dt>
              <dd className="mt-1 capitalize text-gray-900">
                {selectedInterfaceMeta?.type ?? 'Unknown'}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <Card
        title="Rulesets"
        subtitle="Enable complete rule groups here, or open a group to tune individual rules."
      >
        <SuricataRulesetGroupsSection />
      </Card>

      {/* Alerts */}
      <Card
        title="Recent Alerts"
        actions={
          <button
            type="button"
            disabled={loading}
            onClick={loadAll}
            title={loading ? 'Refreshing alerts' : 'Refresh alerts'}
            aria-label={loading ? 'Refreshing alerts' : 'Refresh alerts'}
            className="btn-icon btn-icon-secondary"
          >
            {loading ? (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.25}
              >
                <circle className="opacity-25" cx="12" r="10" strokeWidth="4" />
                <path className="opacity-75" d="M12 2a10 10 0 100 20" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.25}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 12a8 8 0 10-2.343 5.657M20 12V8m0 4h-4"
                />
              </svg>
            )}
          </button>
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
            Alert logs currently do not include interface tags on this appliance, so alerts are
            shown globally when this interface is monitored.
          </p>
        )}
      </Card>
    </div>
  );
}

export default function Suricata() {
  return (
    <ErrorBoundary fallbackMessage="The Suricata page failed to render. Please refresh and try again.">
      <SuricataContent />
    </ErrorBoundary>
  );
}
