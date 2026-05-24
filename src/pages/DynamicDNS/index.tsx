import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import TrashIcon from '../../components/TrashIcon';
import { useToast } from '../../context/ToastContext';
import { getInterfacesInventory } from '../../api/interfaces';
import { getSystemConfig } from '../../api/system';
import {
  getDynamicDnsConfig,
  getDynamicDnsStatus,
  triggerDynamicDnsUpdate,
  updateDynamicDnsConfig,
} from '../../api/dynamicDns';
import type {
  DynamicDnsConfig,
  DynamicDnsEntry,
  DynamicDnsProvider,
  DynamicDnsStatus,
  NetworkInterface,
} from '../../types';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';

const PROVIDERS: Array<{ value: DynamicDnsProvider; label: string }> = [
  { value: 'duck_dns', label: 'DuckDNS' },
  { value: 'no_ip', label: 'No-IP' },
  { value: 'dynu', label: 'Dynu' },
  { value: 'free_dns', label: 'FreeDNS (Afraid.org)' },
  { value: 'cloudflare', label: 'Cloudflare DNS' },
  { value: 'custom', label: 'Custom URL' },
];

const createEntryId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `ddns-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const DEFAULT_ENTRY = (iface: string): DynamicDnsEntry => ({
  id: createEntryId(),
  enabled: true,
  provider: 'duck_dns',
  interface: iface,
  addressFamily: 'ipv4',
  hostname: '',
  username: '',
  password: '',
  passwordConfigured: false,
  updateUrl: '',
});

const DEFAULT_CONFIG: DynamicDnsConfig = {
  enabled: false,
  checkIntervalSeconds: 300,
  entries: [],
};

function providerNeedsUsername(provider: DynamicDnsProvider): boolean {
  return provider === 'no_ip' || provider === 'dynu' || provider === 'cloudflare';
}

function providerNeedsCustomUrl(provider: DynamicDnsProvider): boolean {
  return provider === 'custom';
}

function providerSecretLabel(provider: DynamicDnsProvider): string {
  if (provider === 'duck_dns') return 'Token';
  if (provider === 'free_dns') return 'Update Token';
  if (provider === 'cloudflare') return 'API Token';
  return 'Password / API Key';
}

function providerUsernameLabel(provider: DynamicDnsProvider): string {
  if (provider === 'cloudflare') return 'Zone ID';
  return 'Username';
}

function providerHelpText(provider: DynamicDnsProvider): string {
  if (provider === 'custom') {
    return 'Use placeholders: {hostname}, {username}, {password}, {ip}';
  }
  if (provider === 'duck_dns') {
    return 'Hostname should be your DuckDNS subdomain (without .duckdns.org).';
  }
  if (provider === 'cloudflare') {
    return 'Hostname should be the full DNS name (for example, host.example.com).';
  }
  return '';
}

function validateEntry(entry: DynamicDnsEntry, ipv6Enabled: boolean): string | null {
  if (!entry.enabled) return null;
  if (!entry.interface.trim()) return 'Interface is required.';
  if (entry.addressFamily === 'ipv6' && !ipv6Enabled)
    return 'IPv6 Dynamic DNS entries require IPv6 to be enabled in System settings.';
  if (!entry.hostname.trim()) return 'Hostname is required.';
  if (providerNeedsUsername(entry.provider) && !entry.username?.trim()) {
    return entry.provider === 'cloudflare' ? 'Zone ID is required.' : 'Username is required.';
  }
  if (!entry.passwordConfigured && !entry.password.trim())
    return `${providerSecretLabel(entry.provider)} is required.`;
  if (providerNeedsCustomUrl(entry.provider)) {
    if (!entry.updateUrl?.trim()) return 'Custom update URL is required.';
    if (!entry.updateUrl.includes('{ip}')) return 'Custom update URL must include {ip}.';
  }
  return null;
}

export default function DynamicDnsPage() {
  const [config, setConfig] = useState<DynamicDnsConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<DynamicDnsStatus | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [ipv6Enabled, setIpv6Enabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningUpdate, setRunningUpdate] = useState(false);
  const { addToast } = useToast();

  const interfaceOptions = useMemo(
    () =>
      interfaces
        .filter((iface) => iface.type !== 'loopback')
        .map((iface) => ({
          value: iface.name,
          label: formatInterfaceDisplayName(iface.description, iface.name),
        })),
    [interfaces]
  );

  const firstInterface = interfaceOptions[0]?.value ?? '';

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      getDynamicDnsConfig(),
      getDynamicDnsStatus(),
      getInterfacesInventory(),
      getSystemConfig(),
    ])
      .then(([cfg, stat, inventory, system]) => {
        setConfig(cfg.data);
        setStatus(stat.data);
        setInterfaces(inventory.data.configured);
        setIpv6Enabled(Boolean(system.data.ipv6Enabled));
      })
      .catch((err: Error) => addToast(`Failed to load Dynamic DNS data: ${err.message}`, 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const entryErrors = useMemo(() => {
    const out = new Map<string, string>();
    for (const entry of config.entries) {
      const error = validateEntry(entry, ipv6Enabled);
      if (error) out.set(entry.id, error);
    }
    return out;
  }, [config.entries, ipv6Enabled]);

  const hasErrors = entryErrors.size > 0;

  const upsertEntry = (id: string, patch: Partial<DynamicDnsEntry>) => {
    setConfig((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  };

  const addEntry = () => {
    setConfig((prev) => ({
      ...prev,
      entries: [...prev.entries, DEFAULT_ENTRY(firstInterface)],
    }));
  };

  const removeEntry = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      entries: prev.entries.filter((entry) => entry.id !== id),
    }));
  };

  const handleSave = () => {
    if (hasErrors) {
      addToast('Fix entry errors before saving.', 'error');
      return;
    }

    setSaving(true);
    updateDynamicDnsConfig(config)
      .then((res) => {
        setConfig(res.data);
        addToast('Dynamic DNS configuration saved.', 'success');
      })
      .catch((err: Error) => addToast(`Save failed: ${err.message}`, 'error'))
      .finally(() => setSaving(false));
  };

  const handleUpdateNow = () => {
    setRunningUpdate(true);
    triggerDynamicDnsUpdate()
      .then((res) => {
        setStatus(res.data);
        const failedCount = res.data.entries.filter((entry) => !entry.success).length;
        if (failedCount > 0) {
          addToast(`Dynamic DNS update completed with ${failedCount} failure(s).`, 'warning');
        } else {
          addToast('Dynamic DNS update completed successfully.', 'success');
        }
      })
      .catch((err: Error) => addToast(`Update failed: ${err.message}`, 'error'))
      .finally(() => setRunningUpdate(false));
  };

  const busy = loading || saving;

  const enabledCount = useMemo(
    () => config.entries.filter((entry) => entry.enabled).length,
    [config.entries]
  );

  const configuredInterfaces = useMemo(
    () => new Set(config.entries.map((entry) => entry.interface).filter(Boolean)),
    [config.entries]
  );

  const statusCount = status?.entries?.length ?? 0;
  const successfulUpdates = status?.entries?.filter((entry) => entry.success).length ?? 0;
  const failedUpdates = status?.entries?.filter((entry) => !entry.success).length ?? 0;

  return (
    <div className="space-y-6">
      <Card
        title="Dynamic DNS Overview"
        subtitle="Service status, coverage, and latest update health."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || runningUpdate || !config.enabled}
              onClick={handleUpdateNow}
              className="btn-icon btn-icon-secondary"
              title="Update DNS now"
              aria-label="Update DNS now"
            >
              {runningUpdate ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
                  <circle cx="12" cy="12" r="10" className="opacity-25" />
                  <path className="opacity-75" d="M12 2a10 10 0 100 20" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 10-2.343 5.657M20 12V8m0 4h-4" />
                </svg>
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={[
                'inline-flex h-8 w-8 items-center justify-center rounded-md border shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                config.enabled
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
              title={config.enabled ? 'Disable Dynamic DNS' : 'Enable Dynamic DNS'}
              aria-label={config.enabled ? 'Disable Dynamic DNS' : 'Enable Dynamic DNS'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 text-sm">
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Service</div>
            <div className={`mt-1 font-semibold ${config.enabled ? 'text-green-600' : 'text-gray-500'}`}>
              {config.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Entries</div>
            <div className="mt-1 font-semibold text-gray-900">{config.entries.length}</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Enabled Entries</div>
            <div className="mt-1 font-semibold text-gray-900">{enabledCount}</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Configured Interfaces</div>
            <div className="mt-1 font-semibold text-gray-900">{configuredInterfaces.size}</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 md:col-span-2">
            <div className="text-gray-500">Check Interval</div>
            <div className="mt-1 font-semibold text-gray-900">{config.checkIntervalSeconds}s</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 md:col-span-2">
            <div className="text-gray-500">Last Run</div>
            <div className="mt-1 font-semibold text-gray-900">
              {status?.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : 'Never'}
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 md:col-span-2">
            <div className="text-gray-500">Latest Update</div>
            <div className="mt-1 font-semibold text-gray-900">
              {statusCount > 0 ? `${successfulUpdates} successful` : 'No results yet'}
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 md:col-span-2">
            <div className="text-gray-500">Failures</div>
            <div className="mt-1 font-semibold text-gray-900">{status ? failedUpdates : '-'}</div>
          </div>
        </div>
      </Card>

      <Card title="Settings" subtitle="Control service-wide timing and update behavior.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Check Interval (seconds)"
            id="ddns-interval"
            type="number"
            min={30}
            step={30}
            value={config.checkIntervalSeconds}
            disabled={busy}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                checkIntervalSeconds: Number(e.target.value) || 300,
              }))
            }
            hint="Minimum 30 seconds."
          />
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Service State</div>
            <div className={`mt-1 text-sm font-semibold ${config.enabled ? 'text-green-600' : 'text-gray-500'}`}>
              {config.enabled ? 'Enabled' : 'Disabled'}
            </div>
            <p className="mt-2 text-xs text-gray-500">When enabled, Dynamic DNS updates will run for all active entries.</p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" disabled={busy} loading={saving} onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="Entries"
        subtitle="Each entry binds one hostname to one interface IP."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={addEntry}
            className="btn-icon btn-icon-secondary"
            title="Add Dynamic DNS entry"
            aria-label="Add Dynamic DNS entry"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : config.entries.length === 0 ? (
          <p className="text-sm text-gray-500">No Dynamic DNS entries yet.</p>
        ) : (
          <div className="space-y-4">
            {config.entries.map((entry, idx) => {
              const error = entryErrors.get(entry.id);
              return (
                <div key={entry.id} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Entry {idx + 1}</h4>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          disabled={busy}
                          onChange={(e) => upsertEntry(entry.id, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeEntry(entry.id)}
                        className="btn-icon btn-icon-danger"
                        title="Delete entry"
                        aria-label="Delete entry"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      id={`ddns-provider-${entry.id}`}
                      label="Provider"
                      as="select"
                      value={entry.provider}
                      disabled={busy}
                      onChange={(e) =>
                        upsertEntry(entry.id, {
                          provider: e.target.value as DynamicDnsProvider,
                          username: '',
                          password: '',
                          passwordConfigured: false,
                          updateUrl: '',
                        })
                      }
                    >
                      {PROVIDERS.map((provider) => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </FormField>

                    <FormField
                      id={`ddns-iface-${entry.id}`}
                      label="Interface"
                      as="select"
                      value={entry.interface}
                      disabled={busy}
                      onChange={(e) => upsertEntry(entry.id, { interface: e.target.value })}
                    >
                      <option value="">Select interface</option>
                      {interfaceOptions.map((iface) => (
                        <option key={iface.value} value={iface.value}>
                          {iface.label}
                        </option>
                      ))}
                    </FormField>

                    {ipv6Enabled ? (
                      <FormField
                        id={`ddns-family-${entry.id}`}
                        label="Address Family"
                        as="select"
                        value={entry.addressFamily ?? 'ipv4'}
                        disabled={busy}
                        onChange={(e) =>
                          upsertEntry(entry.id, {
                            addressFamily: e.target.value as DynamicDnsEntry['addressFamily'],
                          })
                        }
                      >
                        <option value="ipv4">IPv4</option>
                        <option value="ipv6">IPv6</option>
                      </FormField>
                    ) : (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Address Family</p>
                        <p className="mt-1 text-sm text-gray-700">IPv4 only</p>
                      </div>
                    )}

                    <FormField
                      id={`ddns-host-${entry.id}`}
                      label="Hostname"
                      value={entry.hostname}
                      disabled={busy}
                      onChange={(e) => upsertEntry(entry.id, { hostname: e.target.value })}
                      hint={providerHelpText(entry.provider)}
                    />

                    {providerNeedsUsername(entry.provider) && (
                      <FormField
                        id={`ddns-user-${entry.id}`}
                        label={providerUsernameLabel(entry.provider)}
                        value={entry.username ?? ''}
                        disabled={busy}
                        onChange={(e) => upsertEntry(entry.id, { username: e.target.value })}
                        hint={
                          entry.provider === 'cloudflare'
                            ? 'Cloudflare Zone ID containing this hostname.'
                            : undefined
                        }
                      />
                    )}

                    <FormField
                      id={`ddns-pass-${entry.id}`}
                      label={providerSecretLabel(entry.provider)}
                      type="password"
                      value={entry.password}
                      disabled={busy}
                      placeholder={entry.passwordConfigured ? 'Stored value set. Enter a new value to replace it.' : ''}
                      onChange={(e) => upsertEntry(entry.id, { password: e.target.value })}
                    />

                    {providerNeedsCustomUrl(entry.provider) && (
                      <FormField
                        id={`ddns-url-${entry.id}`}
                        label="Custom Update URL"
                        className="md:col-span-2"
                        value={entry.updateUrl ?? ''}
                        disabled={busy}
                        onChange={(e) => upsertEntry(entry.id, { updateUrl: e.target.value })}
                        hint="Include placeholders like {ip}, {hostname}, {username}, {password}."
                      />
                    )}
                  </div>

                  {error && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
