import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyQosConfig, getQosConfig, getQosStatus, updateQosConfig } from '../../api/qos';
import { getInterfacesInventory } from '../../api/interfaces';
import type {
  NetworkInterface,
  QosConfig,
  QosDiffservMode,
  QosInterface,
  QosInterfaceStatus,
  QosQueueDiscipline,
} from '../../types';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TrashIcon from '../../components/TrashIcon';
import { useToast } from '../../context/ToastContext';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';

const DEFAULT_CONFIG: QosConfig = {
  enabled: false,
  interfaces: [],
};

const IFACE_NAME_RE = /^[A-Za-z0-9_.-]{1,15}$/;
const MAX_BANDWIDTH_MBPS = 100000;

const QDISC_OPTIONS: { value: QosQueueDiscipline; label: string }[] = [
  { value: 'cake', label: 'CAKE' },
  { value: 'fq_codel', label: 'fq_codel' },
];

const DIFFSERV_OPTIONS: { value: QosDiffservMode; label: string }[] = [
  { value: 'besteffort', label: 'Best effort' },
  { value: 'diffserv3', label: 'Diffserv 3' },
  { value: 'diffserv4', label: 'Diffserv 4' },
  { value: 'diffserv8', label: 'Diffserv 8' },
];

type InterfaceOption = {
  name: string;
  label: string;
};

type IconProps = { className?: string };

function SaveIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h11l3 3v13H5V4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v6h8V4M8 20v-6h8v6" />
    </svg>
  );
}

function RefreshIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 10-2.34 5.66" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12V8m0 4h-4" />
    </svg>
  );
}

function PlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ApplyIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 6l6 6-6 6" />
    </svg>
  );
}

function defaultPolicy(name = ''): QosInterface {
  return {
    name,
    enabled: true,
    bandwidth_kbps: undefined,
    qdisc: 'cake',
    diffserv: 'diffserv4',
    nat_aware: true,
    wash: false,
  };
}

function normalizeConfig(config: QosConfig | null | undefined): QosConfig {
  return {
    enabled: Boolean(config?.enabled),
    interfaces: (config?.interfaces ?? []).map((iface) => ({
      ...defaultPolicy(iface.name),
      ...iface,
      enabled: iface.enabled !== false,
      bandwidth_kbps: iface.bandwidth_kbps ?? undefined,
      qdisc: iface.qdisc ?? 'cake',
      diffserv: iface.diffserv ?? 'diffserv4',
      nat_aware: Boolean(iface.nat_aware),
      wash: Boolean(iface.wash),
    })),
  };
}

function cleanConfig(config: QosConfig): QosConfig {
  return {
    enabled: config.enabled,
    interfaces: config.interfaces.map((iface) => ({
      ...iface,
      name: iface.name.trim(),
      bandwidth_kbps: iface.bandwidth_kbps ?? undefined,
    })),
  };
}

function formatMbps(kbps: number | null | undefined): string {
  if (typeof kbps !== 'number' || !Number.isFinite(kbps) || kbps <= 0) return '';
  const mbps = kbps / 1000;
  return Number.isInteger(mbps) ? String(mbps) : String(Number(mbps.toFixed(3)));
}

function parseMbpsToKbps(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const mbps = Number(trimmed);
  if (!Number.isFinite(mbps)) return Number.NaN;
  return Math.round(mbps * 1000);
}

function buildInterfaceOptions(configured: NetworkInterface[], names: string[]): InterfaceOption[] {
  const configuredByName = new Map(configured.map((iface) => [iface.name, iface]));

  return names
    .filter((name) => name !== 'lo')
    .map((name) => {
      const iface = configuredByName.get(name);
      return {
        name,
        label: iface ? formatInterfaceDisplayName(iface.description, iface.name) : name,
      };
    });
}

function displayQdisc(value: string | null | undefined): string {
  if (value === 'cake') return 'CAKE';
  if (value === 'fq_codel') return 'fq_codel';
  return value || 'None';
}

function validateConfig(config: QosConfig): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  config.interfaces.forEach((iface, index) => {
    const label = `Interface ${index + 1}`;
    const name = iface.name.trim();

    if (!name) {
      errors.push(`${label}: name is required.`);
    } else if (!IFACE_NAME_RE.test(name)) {
      errors.push(`${label}: use a Linux interface name up to 15 characters.`);
    } else if (seen.has(name)) {
      errors.push(`${label}: duplicate interface ${name}.`);
    }
    seen.add(name);

    if (
      typeof iface.bandwidth_kbps === 'number' &&
      (!Number.isFinite(iface.bandwidth_kbps) ||
        iface.bandwidth_kbps <= 0 ||
        iface.bandwidth_kbps > MAX_BANDWIDTH_MBPS * 1000)
    ) {
      errors.push(`${label}: bandwidth must be between 0 and ${MAX_BANDWIDTH_MBPS} Mbit/s.`);
    }
  });

  return errors;
}

function statusBadge(status: QosInterfaceStatus) {
  if (!status.enabled) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        Disabled
      </span>
    );
  }

  if (status.applied) {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
        Applied
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
      Pending
    </span>
  );
}

export default function QosPage() {
  const [config, setConfig] = useState<QosConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<QosInterfaceStatus[]>([]);
  const [interfaceOptions, setInterfaceOptions] = useState<InterfaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const { addToast } = useToast();

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([getQosConfig(), getQosStatus(), getInterfacesInventory()])
      .then(([cfg, stat, inventory]) => {
        setConfig(normalizeConfig(cfg.data));
        setStatus(stat.data);
        setInterfaceOptions(
          buildInterfaceOptions(inventory.data.configured ?? [], inventory.data.names ?? [])
        );
      })
      .catch((err: Error) => addToast(`Failed to load QoS data: ${err.message}`, 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const optionLabelByName = useMemo(
    () => new Map(interfaceOptions.map((option) => [option.name, option.label])),
    [interfaceOptions]
  );

  const configuredNames = useMemo(
    () => new Set(config.interfaces.map((iface) => iface.name.trim()).filter(Boolean)),
    [config.interfaces]
  );

  const updateInterface = (index: number, patch: Partial<QosInterface>) => {
    setConfig((current) => ({
      ...current,
      interfaces: current.interfaces.map((iface, ifaceIndex) =>
        ifaceIndex === index ? { ...iface, ...patch } : iface
      ),
    }));
  };

  const addInterface = () => {
    const available = interfaceOptions.find((option) => !configuredNames.has(option.name));
    setConfig((current) => ({
      ...current,
      interfaces: [...current.interfaces, defaultPolicy(available?.name ?? '')],
    }));
  };

  const removeInterface = (index: number) => {
    setConfig((current) => ({
      ...current,
      interfaces: current.interfaces.filter((_, ifaceIndex) => ifaceIndex !== index),
    }));
  };

  const handleSave = () => {
    const payload = cleanConfig(config);
    const errors = validateConfig(payload);
    if (errors.length > 0) {
      addToast(errors[0], 'error');
      return;
    }

    setSaving(true);
    updateQosConfig(payload)
      .then((res) => {
        setConfig(normalizeConfig(res.data));
        addToast('QoS configuration saved.', 'success');
        return getQosStatus();
      })
      .then((res) => setStatus(res.data))
      .catch((err: Error) => addToast(`Save failed: ${err.message}`, 'error'))
      .finally(() => setSaving(false));
  };

  const handleApply = () => {
    setApplying(true);
    applyQosConfig()
      .then(() => {
        addToast('QoS configuration applied.', 'success');
        return getQosStatus();
      })
      .then((res) => setStatus(res.data))
      .catch((err: Error) => addToast(`Apply failed: ${err.message}`, 'error'))
      .finally(() => setApplying(false));
  };

  const busy = loading || saving || applying;

  return (
    <div className="space-y-6">
      <datalist id="qos-interface-names">
        {interfaceOptions.map((option) => (
          <option key={option.name} value={option.name} label={option.label} />
        ))}
      </datalist>

      <Card
        title="QoS"
        subtitle="Smart Queue Management"
        actions={
          <>
            <Button type="button" variant="secondary" onClick={loadAll} disabled={busy}>
              <RefreshIcon />
              Refresh
            </Button>
            <Button type="button" variant="secondary" onClick={handleApply} loading={applying} disabled={busy}>
              <ApplyIcon />
              Re-apply
            </Button>
            <Button type="button" onClick={handleSave} loading={saving} disabled={busy}>
              <SaveIcon />
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(ev) => setConfig((current) => ({ ...current, enabled: ev.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Enable QoS
          </label>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Policies</p>
              <p className="font-semibold text-gray-900">{config.interfaces.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
              <p className="font-semibold text-gray-900">
                {config.enabled ? config.interfaces.filter((iface) => iface.enabled).length : 0}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Applied</p>
              <p className="font-semibold text-gray-900">{status.filter((item) => item.applied).length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Queue</p>
              <p className="font-semibold text-gray-900">
                {config.interfaces.some((iface) => iface.qdisc === 'cake') ? 'CAKE' : 'fq_codel'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Interface Policies"
        actions={
          <Button type="button" variant="secondary" onClick={addInterface} disabled={busy}>
            <PlusIcon />
            Add Interface
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-24 px-3 py-3 text-left font-semibold text-gray-600">Enabled</th>
                <th className="min-w-44 px-3 py-3 text-left font-semibold text-gray-600">Interface</th>
                <th className="min-w-32 px-3 py-3 text-left font-semibold text-gray-600">Mbit/s</th>
                <th className="min-w-32 px-3 py-3 text-left font-semibold text-gray-600">Queue</th>
                <th className="min-w-36 px-3 py-3 text-left font-semibold text-gray-600">Diffserv</th>
                <th className="w-24 px-3 py-3 text-left font-semibold text-gray-600">NAT</th>
                <th className="w-24 px-3 py-3 text-left font-semibold text-gray-600">Wash</th>
                <th className="w-16 px-3 py-3 text-right font-semibold text-gray-600">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : config.interfaces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400">
                    No QoS interface policies configured.
                  </td>
                </tr>
              ) : (
                config.interfaces.map((iface, index) => {
                  const cake = iface.qdisc === 'cake';
                  return (
                    <tr key={`${iface.name || 'new'}-${index}`}>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={iface.enabled}
                          onChange={(ev) => updateInterface(index, { enabled: ev.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Enable ${iface.name || `interface ${index + 1}`}`}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          list="qos-interface-names"
                          value={iface.name}
                          onChange={(ev) => updateInterface(index, { name: ev.target.value })}
                          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="wan0"
                        />
                        {iface.name && optionLabelByName.has(iface.name) && (
                          <p className="mt-1 text-xs text-gray-500">{optionLabelByName.get(iface.name)}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="number"
                          min="0.001"
                          max={MAX_BANDWIDTH_MBPS}
                          step="0.1"
                          value={formatMbps(iface.bandwidth_kbps)}
                          onChange={(ev) =>
                            updateInterface(index, {
                              bandwidth_kbps: parseMbpsToKbps(ev.target.value),
                            })
                          }
                          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="auto"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <select
                          value={iface.qdisc}
                          onChange={(ev) =>
                            updateInterface(index, { qdisc: ev.target.value as QosQueueDiscipline })
                          }
                          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {QDISC_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <select
                          value={iface.diffserv}
                          onChange={(ev) =>
                            updateInterface(index, { diffserv: ev.target.value as QosDiffservMode })
                          }
                          disabled={!cake}
                          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          {DIFFSERV_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={iface.nat_aware}
                          disabled={!cake}
                          onChange={(ev) => updateInterface(index, { nat_aware: ev.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                          aria-label={`Enable CAKE NAT awareness for ${iface.name || `interface ${index + 1}`}`}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={iface.wash}
                          disabled={!cake}
                          onChange={(ev) => updateInterface(index, { wash: ev.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                          aria-label={`Enable CAKE wash for ${iface.name || `interface ${index + 1}`}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => removeInterface(index)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label={`Remove ${iface.name || `interface ${index + 1}`}`}
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Runtime Status">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Interface</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">State</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Queue</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : status.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400">
                    No runtime status available.
                  </td>
                </tr>
              ) : (
                status.map((item) => {
                  const detail = item.lastError || item.details || 'No qdisc output.';
                  return (
                    <tr key={item.name}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {optionLabelByName.get(item.name) ?? item.name}
                      </td>
                      <td className="px-4 py-3">{statusBadge(item)}</td>
                      <td className="px-4 py-3 text-gray-700">{displayQdisc(item.qdisc)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <pre className="max-h-24 max-w-xl overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                          {detail}
                        </pre>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}