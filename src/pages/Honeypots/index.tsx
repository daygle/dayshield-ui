import { useEffect, useMemo, useState } from 'react';
import {
  getHoneypotConfig,
  getHoneypotEvents,
  getHoneypotRecommendations,
  getHoneypotSourceIps,
  updateHoneypotConfig,
} from '../../api/honeypots';
import type {
  HoneypotConfig,
  HoneypotEvent,
  HoneypotListenerConfig,
  HoneypotRecommendation,
  HoneypotSourceIp,
  HoneypotType,
} from '../../types';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ErrorBanner from '../../components/ErrorBanner';
import ErrorBoundary from '../../components/ErrorBoundary';
import FormField from '../../components/FormField';
import Modal from '../../components/Modal';
import Table, { Column } from '../../components/Table';
import { useToast } from '../../context/ToastContext';

type ListenerRow = HoneypotListenerConfig & Record<string, unknown>;
type EventRow = HoneypotEvent & Record<string, unknown>;
type SourceIpRow = HoneypotSourceIp & Record<string, unknown>;

const DEFAULT_CONFIG: HoneypotConfig = {
  enabled: false,
  listeners: [],
};

const DEFAULT_LISTENER: HoneypotListenerConfig = {
  id: 'ssh-honeypot',
  name: 'SSH honeypot',
  enabled: true,
  honeypotType: 'ssh',
  bindAddress: '0.0.0.0',
  port: 2222,
  riskScore: 0.95,
  banner: null,
};

const HONEYPOT_TYPE_LABELS: Record<HoneypotType, string> = {
  ssh: 'SSH',
  telnet: 'Telnet',
  http: 'HTTP',
  ftp: 'FTP',
  smtp: 'SMTP',
  mysql: 'MySQL',
  rdp: 'RDP',
  generic_tcp: 'Generic TCP',
};

const HONEYPOT_TYPES = Object.keys(HONEYPOT_TYPE_LABELS) as HoneypotType[];

const formatTime = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return new Date(value * 1000).toLocaleString();
};

const shortId = (value?: string | null): string => (value ? value.slice(0, 8) : '-');

const makeId = (base: string, existing: HoneypotListenerConfig[]): string => {
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  let id = clean || 'honeypot';
  let index = 2;
  const ids = new Set(existing.map((listener) => listener.id));
  while (ids.has(id)) {
    id = `${clean || 'honeypot'}-${index}`;
    index += 1;
  }
  return id;
};

const normalizeListener = (listener: HoneypotListenerConfig): HoneypotListenerConfig => ({
  ...listener,
  id: listener.id.trim(),
  name: listener.name.trim(),
  bindAddress: listener.bindAddress.trim(),
  port: Number(listener.port),
  riskScore: Number(listener.riskScore),
  banner: listener.banner?.trim() ? listener.banner.trim() : null,
});

const badge = (enabled: boolean) => (
  <span
    className={[
      'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
      enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
    ].join(' ')}
  >
    {enabled ? 'Enabled' : 'Disabled'}
  </span>
);

export default function Honeypots() {
  return (
    <ErrorBoundary fallbackMessage="The Honeypots page failed to render. Please refresh and try again.">
      <HoneypotsContent />
    </ErrorBoundary>
  );
}

function HoneypotsContent() {
  const [savedConfig, setSavedConfig] = useState<HoneypotConfig>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState<HoneypotConfig>(DEFAULT_CONFIG);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [sourceIps, setSourceIps] = useState<SourceIpRow[]>([]);
  const [recommendations, setRecommendations] = useState<HoneypotRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listenerModalOpen, setListenerModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listenerForm, setListenerForm] = useState<HoneypotListenerConfig>(DEFAULT_LISTENER);
  const { addToast } = useToast();

  const isDirty = useMemo(
    () => JSON.stringify(savedConfig) !== JSON.stringify(draft),
    [draft, savedConfig]
  );

  const enabledListeners = draft.listeners.filter((listener) => listener.enabled);
  const eventsLast24h = events.filter(
    (event) => event.timestamp >= Math.floor(Date.now() / 1000) - 86_400
  ).length;

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getHoneypotConfig(),
      getHoneypotEvents(100),
      getHoneypotSourceIps(1000),
      getHoneypotRecommendations(),
    ])
      .then(([configRes, eventsRes, ipsRes, recRes]) => {
        const nextConfig = configRes.data ?? DEFAULT_CONFIG;
        setSavedConfig(nextConfig);
        setDraft(nextConfig);
        setEvents((eventsRes.data ?? []) as EventRow[]);
        setSourceIps((ipsRes.data ?? []) as SourceIpRow[]);
        setRecommendations(recRes.data ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const recommendationForType = (type: HoneypotType) =>
    recommendations.find((recommendation) => recommendation.honeypotType === type);

  const listenerValidation = useMemo(() => {
    const listener = normalizeListener(listenerForm);
    const errors: string[] = [];
    if (!/^[A-Za-z0-9_-]{1,63}$/.test(listener.id)) {
      errors.push('Listener ID must use only letters, numbers, hyphens, or underscores.');
    }
    if (
      draft.listeners.some(
        (existing) => existing.id === listener.id && existing.id !== editingId
      )
    ) {
      errors.push('Listener ID already exists.');
    }
    if (!listener.name) errors.push('Name is required.');
    if (!listener.bindAddress) errors.push('Bind address is required.');
    if (!Number.isFinite(listener.port) || listener.port < 1 || listener.port > 65535) {
      errors.push('Port must be between 1 and 65535.');
    }
    if (!Number.isFinite(listener.riskScore) || listener.riskScore < 0 || listener.riskScore > 1) {
      errors.push('Risk score must be between 0 and 100.');
    }
    if ((listener.banner ?? '').length > 1024) {
      errors.push('Banner must be at most 1024 characters.');
    }
    return {
      errors,
      isValid: errors.length === 0,
    };
  }, [draft.listeners, editingId, listenerForm]);

  const validateConfig = (config: HoneypotConfig): string | null => {
    if (config.enabled && !config.listeners.some((listener) => listener.enabled)) {
      return 'Enable at least one listener before turning on honeypots.';
    }
    const bindings = new Set<string>();
    for (const listener of config.listeners.filter((item) => item.enabled)) {
      const binding = `${listener.bindAddress}:${listener.port}`;
      if (bindings.has(binding)) return `Duplicate listener binding: ${binding}`;
      bindings.add(binding);
    }
    return null;
  };

  const saveConfig = () => {
    const payload: HoneypotConfig = {
      enabled: draft.enabled,
      listeners: draft.listeners.map(normalizeListener),
    };
    const validationError = validateConfig(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    updateHoneypotConfig(payload)
      .then((res) => {
        setSavedConfig(res.data);
        setDraft(res.data);
        setError(null);
        addToast('Honeypot settings saved', 'success');
        return Promise.all([getHoneypotEvents(100), getHoneypotSourceIps(1000)]);
      })
      .then(([eventRes, ipRes]) => {
        setEvents((eventRes.data ?? []) as EventRow[]);
        setSourceIps((ipRes.data ?? []) as SourceIpRow[]);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const openAddListener = (recommendation?: HoneypotRecommendation) => {
    const type = recommendation?.honeypotType ?? 'ssh';
    setEditingId(null);
    setListenerForm({
      id: makeId(`${type}-honeypot`, draft.listeners),
      name: `${recommendation?.name ?? HONEYPOT_TYPE_LABELS[type]} honeypot`,
      enabled: true,
      honeypotType: type,
      bindAddress: '0.0.0.0',
      port: recommendation?.defaultPort ?? recommendationForType(type)?.defaultPort ?? 2222,
      riskScore: 0.95,
      banner: null,
    });
    setListenerModalOpen(true);
  };

  const openEditListener = (listener: HoneypotListenerConfig) => {
    setEditingId(listener.id);
    setListenerForm({ ...listener });
    setListenerModalOpen(true);
  };

  const saveListener = () => {
    const listener = normalizeListener(listenerForm);
    if (!listenerValidation.isValid) {
      setError(listenerValidation.errors[0] ?? 'Please fix the listener form.');
      return;
    }
    setDraft((current) => {
      const exists = current.listeners.some((item) => item.id === editingId);
      const listeners = exists
        ? current.listeners.map((item) => (item.id === editingId ? listener : item))
        : [...current.listeners, listener];
      return { ...current, listeners };
    });
    setError(null);
    setListenerModalOpen(false);
  };

  const removeListener = (id: string) => {
    setDraft((current) => ({
      ...current,
      listeners: current.listeners.filter((listener) => listener.id !== id),
    }));
  };

  const listenerColumns: Column<ListenerRow>[] = [
    {
      key: 'name',
      header: 'Listener',
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          <div className="font-mono text-xs text-gray-500">{row.id}</div>
        </div>
      ),
    },
    {
      key: 'honeypotType',
      header: 'Type',
      render: (row) => HONEYPOT_TYPE_LABELS[row.honeypotType as HoneypotType],
    },
    {
      key: 'bindAddress',
      header: 'Bind',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.bindAddress}:{row.port}
        </span>
      ),
    },
    {
      key: 'riskScore',
      header: 'AI Risk',
      render: (row) => `${Math.round(Number(row.riskScore) * 100)}%`,
    },
    {
      key: 'enabled',
      header: 'State',
      render: (row) => (
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={Boolean(row.enabled)}
            aria-label={`Toggle ${row.name}`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                listeners: current.listeners.map((listener) =>
                  listener.id === row.id
                    ? { ...listener, enabled: event.target.checked }
                    : listener
                ),
              }))
            }
          />
          {badge(Boolean(row.enabled))}
        </label>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => openEditListener(row)}
            className="btn-icon btn-icon-secondary"
            title="Edit listener"
            aria-label="Edit listener"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => removeListener(String(row.id))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-red-50 text-gray-500 hover:text-red-600"
            title="Remove listener"
            aria-label="Remove listener"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  const sourceIpColumns: Column<SourceIpRow>[] = [
    {
      key: 'ip',
      header: 'IP',
      render: (row) => <span className="font-mono text-xs">{row.ip}</span>,
    },
    { key: 'event_count', header: 'Events' },
    {
      key: 'last_honeypot_type',
      header: 'Last Honeypot',
      render: (row) => HONEYPOT_TYPE_LABELS[row.last_honeypot_type as HoneypotType],
    },
    {
      key: 'last_seen',
      header: 'Last Seen',
      render: (row) => formatTime(Number(row.last_seen)),
    },
    {
      key: 'last_ai_threat_event_id',
      header: 'AI Event',
      render: (row) => <span className="font-mono text-xs">{shortId(row.last_ai_threat_event_id)}</span>,
    },
  ];

  const eventColumns: Column<EventRow>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (row) => formatTime(Number(row.timestamp)),
    },
    {
      key: 'src_ip',
      header: 'Source',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.src_ip}:{row.src_port}
        </span>
      ),
    },
    {
      key: 'honeypot_type',
      header: 'Honeypot',
      render: (row) => HONEYPOT_TYPE_LABELS[row.honeypot_type as HoneypotType],
    },
    {
      key: 'payload_preview',
      header: 'Payload',
      render: (row) => (
        <span className="font-mono text-xs text-gray-600">
          {String(row.payload_preview ?? '-').slice(0, 96)}
        </span>
      ),
    },
    {
      key: 'ai_threat_event_id',
      header: 'AI Event',
      render: (row) => <span className="font-mono text-xs">{shortId(row.ai_threat_event_id)}</span>,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <div className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
        <div className="h-56 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      <Modal
        open={listenerModalOpen}
        title={editingId ? 'Edit Honeypot Listener' : 'Add Honeypot Listener'}
        onClose={() => setListenerModalOpen(false)}
        onConfirm={saveListener}
        confirmLabel={editingId ? 'Update Listener' : 'Add Listener'}
        size="lg"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="honeypot-listener-id"
            label="Listener ID"
            required
            value={listenerForm.id}
            error={listenerValidation.errors.find((message) => message.includes('ID'))}
            onChange={(event) =>
              setListenerForm((current) => ({ ...current, id: event.target.value }))
            }
          />
          <FormField
            id="honeypot-listener-name"
            label="Name"
            required
            value={listenerForm.name}
            onChange={(event) =>
              setListenerForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          <FormField
            as="select"
            id="honeypot-listener-type"
            label="Type"
            value={listenerForm.honeypotType}
            onChange={(event) => {
              const type = event.target.value as HoneypotType;
              setListenerForm((current) => ({
                ...current,
                honeypotType: type,
                port: recommendationForType(type)?.defaultPort ?? current.port,
              }));
            }}
          >
            {HONEYPOT_TYPES.map((type) => (
              <option key={type} value={type}>
                {HONEYPOT_TYPE_LABELS[type]}
              </option>
            ))}
          </FormField>
          <FormField
            id="honeypot-bind-address"
            label="Bind Address"
            required
            value={listenerForm.bindAddress}
            onChange={(event) =>
              setListenerForm((current) => ({ ...current, bindAddress: event.target.value }))
            }
          />
          <FormField
            id="honeypot-port"
            label="Port"
            required
            type="number"
            min={1}
            max={65535}
            value={listenerForm.port}
            onChange={(event) =>
              setListenerForm((current) => ({ ...current, port: Number(event.target.value) }))
            }
          />
          <FormField
            id="honeypot-risk-score"
            label="AI Risk Score (%)"
            required
            type="number"
            min={0}
            max={100}
            step={1}
            value={Math.round(listenerForm.riskScore * 100)}
            onChange={(event) =>
              setListenerForm((current) => ({
                ...current,
                riskScore: Number(event.target.value) / 100,
              }))
            }
          />
          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={listenerForm.enabled}
              onChange={(event) =>
                setListenerForm((current) => ({ ...current, enabled: event.target.checked }))
              }
            />
            <span className="text-sm font-medium text-gray-700">Enable listener</span>
          </label>
          <FormField
            as="textarea"
            id="honeypot-banner"
            label="Custom Banner"
            rows={3}
            className="md:col-span-2"
            value={listenerForm.banner ?? ''}
            onChange={(event) =>
              setListenerForm((current) => ({ ...current, banner: event.target.value }))
            }
          />
        </div>
      </Modal>

      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Honeypots</h1>
          <p className="text-sm text-gray-500">
            Captured source IPs are submitted to the AI Threat Engine as scored events.
          </p>
        </div>
      </div>

      <Card
        title="Honeypot Overview"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={draft.enabled ? 'danger' : 'secondary'}
              disabled={loading || saving}
              onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
            >
              {draft.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              size="sm"
              loading={saving}
              disabled={!isDirty || loading}
              onClick={saveConfig}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Service</p>
            <div className="mt-2">{badge(draft.enabled)}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Active Listeners</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{enabledListeners.length}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Collected IPs</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{sourceIps.length}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Events 24h</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{eventsLast24h}</p>
          </div>
        </div>
      </Card>

      <Card
        title="Listeners"
        actions={
          <button
            onClick={() => openAddListener()}
            className="btn-icon btn-icon-secondary"
            title="Add listener"
            aria-label="Add listener"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        <Table
          columns={listenerColumns}
          data={draft.listeners as ListenerRow[]}
          keyField="id"
          emptyMessage="No honeypot listeners configured."
        />
      </Card>

      <Card title="Suggested Honeypots">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((recommendation) => (
            <div
              key={recommendation.honeypotType}
              className="flex flex-col justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">{recommendation.name}</h3>
                  <span className="font-mono text-xs text-gray-500">
                    :{recommendation.defaultPort}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{recommendation.description}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => openAddListener(recommendation)}>
                Add
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Collected IPs">
        <Table
          columns={sourceIpColumns}
          data={sourceIps}
          keyField="ip"
          emptyMessage="No source IPs collected yet."
        />
      </Card>

      <Card title="Recent Honeypot Events">
        <Table
          columns={eventColumns}
          data={events}
          keyField="id"
          emptyMessage="No honeypot events detected yet."
        />
      </Card>
    </div>
  );
}
