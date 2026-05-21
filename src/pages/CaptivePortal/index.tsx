import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCaptivePortalSession,
  getCaptivePortalConfig,
  getCaptivePortalSessions,
  getCaptivePortalStatus,
  revokeCaptivePortalSession,
  updateCaptivePortalConfig,
} from '../../api/captivePortal';
import { getInterfacesInventory } from '../../api/interfaces';
import type {
  CaptivePortalConfig,
  CaptivePortalSessionRow,
  CaptivePortalStatus,
  CaptivePortalVoucher,
  NetworkInterface,
} from '../../types';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import Table, { type Column } from '../../components/Table';
import { useToast } from '../../context/ToastContext';
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext';
import { formatInterfaceDisplayName } from '../../utils/interfaceLabel';

const DEFAULT_CONFIG: CaptivePortalConfig = {
  enabled: false,
  interfaces: [],
  authMode: 'click_through',
  listenAddress: '0.0.0.0',
  listenPort: 8080,
  redirectHttp: true,
  sessionTtlSeconds: 86400,
  idleTimeoutSeconds: 0,
  portalTitle: 'Internet Access',
  portalMessage: 'Please authorize to continue browsing.',
  termsRequired: false,
  successRedirectUrl: '',
  walledGardenIps: [],
  bypassMacs: [],
  vouchers: [],
};

interface SessionCreateForm {
  clientIp: string;
  clientMac: string;
  ttlSeconds: string;
}

type CaptivePortalSessionRecord = CaptivePortalSessionRow & Record<string, unknown>;

const DEFAULT_SESSION_FORM: SessionCreateForm = {
  clientIp: '',
  clientMac: '',
  ttlSeconds: '',
};

function splitListInput(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function toTextAreaList(values: string[]): string {
  return values.join('\n');
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromDatetimeLocal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeVoucher(voucher: CaptivePortalVoucher): CaptivePortalVoucher {
  const code = voucher.code.trim();
  const maxUses =
    typeof voucher.maxUses === 'number' && Number.isFinite(voucher.maxUses) && voucher.maxUses > 0
      ? Math.floor(voucher.maxUses)
      : undefined;
  return {
    ...voucher,
    id: voucher.id || `voucher-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    code,
    description: voucher.description?.trim() || undefined,
    expiresAt: voucher.expiresAt || undefined,
    maxUses,
  };
}

const sessionColumns = (
  formatDateTime: (value?: Date | string | number | null) => string,
  onRevoke: (sessionId: string) => void,
  revokingSessionId: string | null
): Column<CaptivePortalSessionRecord>[] => [
  {
    key: 'active',
    header: 'State',
    render: (row) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
          row.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {row.active ? 'Active' : 'Expired'}
      </span>
    ),
  },
  {
    key: 'clientIp',
    header: 'Client IP',
    render: (row) => <span className="font-mono text-xs">{row.clientIp}</span>,
  },
  {
    key: 'clientMac',
    header: 'Client MAC',
    render: (row) => <span className="font-mono text-xs">{row.clientMac || '-'}</span>,
  },
  {
    key: 'authorizedAt',
    header: 'Authorized',
    render: (row) => formatDateTime(row.authorizedAt),
  },
  {
    key: 'lastSeenAt',
    header: 'Last Seen',
    render: (row) => formatDateTime(row.lastSeenAt),
  },
  {
    key: 'expiresAt',
    header: 'Expires',
    render: (row) => formatDateTime(row.expiresAt),
  },
  {
    key: 'voucherId',
    header: 'Voucher',
    render: (row) => (
      <span className="font-mono text-xs">
        {row.voucherId ? String(row.voucherId).slice(0, 8) : '-'}
      </span>
    ),
  },
  {
    key: 'userAgent',
    header: 'User Agent',
    className: 'max-w-xs',
    render: (row) => (
      <span className="block truncate" title={row.userAgent || undefined}>
        {row.userAgent || '-'}
      </span>
    ),
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (row) => (
      <Button
        size="sm"
        variant="danger"
        disabled={revokingSessionId === row.id}
        loading={revokingSessionId === row.id}
        onClick={() => onRevoke(row.id)}
      >
        Revoke
      </Button>
    ),
  },
];

export default function CaptivePortalPage() {
  const { addToast } = useToast();
  const { formatDateTime } = useDisplayPreferences();

  const [config, setConfig] = useState<CaptivePortalConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<CaptivePortalStatus | null>(null);
  const [sessions, setSessions] = useState<CaptivePortalSessionRecord[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);

  const [walledGardenText, setWalledGardenText] = useState('');
  const [bypassMacsText, setBypassMacsText] = useState('');
  const [sessionForm, setSessionForm] = useState<SessionCreateForm>(DEFAULT_SESSION_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      getCaptivePortalConfig(),
      getCaptivePortalStatus(),
      getCaptivePortalSessions(),
      getInterfacesInventory(),
    ])
      .then(([cfg, stat, sess, inventory]) => {
        setConfig(cfg.data);
        setStatus(stat.data);
        setSessions(sess.data.sessions as CaptivePortalSessionRecord[]);
        const configured = Array.isArray(inventory.data?.configured)
          ? inventory.data.configured.filter((iface) => iface.type !== 'loopback')
          : [];
        setInterfaces(configured);
        setWalledGardenText(toTextAreaList(cfg.data.walledGardenIps));
        setBypassMacsText(toTextAreaList(cfg.data.bypassMacs));
      })
      .catch((err: Error) =>
        addToast(`Failed to load captive portal data: ${err.message}`, 'error')
      )
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const interfaceLabel = useCallback(
    (name: string) => {
      const iface = interfaces.find((entry) => entry.name === name);
      return formatInterfaceDisplayName(iface?.description, name);
    },
    [interfaces]
  );

  const statusBadge = useMemo(() => {
    if (!status) return null;
    if (status.enabled && status.sessionsActive > 0) {
      return (
        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
          Enabled / active sessions
        </span>
      );
    }
    if (status.enabled) {
      return (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          Enabled
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        Disabled
      </span>
    );
  }, [status]);

  const handleToggleInterface = (name: string) => {
    setConfig((current) => {
      const selected = current.interfaces.includes(name)
        ? current.interfaces.filter((entry) => entry !== name)
        : [...current.interfaces, name];
      return { ...current, interfaces: selected };
    });
  };

  const handleAddVoucher = () => {
    setConfig((current) => ({
      ...current,
      vouchers: [
        ...current.vouchers,
        {
          id: `voucher-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          code: '',
          description: '',
          enabled: true,
          expiresAt: null,
          maxUses: null,
          uses: 0,
        },
      ],
    }));
  };

  const handleUpdateVoucher = (voucherId: string, next: Partial<CaptivePortalVoucher>) => {
    setConfig((current) => ({
      ...current,
      vouchers: current.vouchers.map((voucher) =>
        voucher.id === voucherId ? { ...voucher, ...next } : voucher
      ),
    }));
  };

  const handleDeleteVoucher = (voucherId: string) => {
    setConfig((current) => ({
      ...current,
      vouchers: current.vouchers.filter((voucher) => voucher.id !== voucherId),
    }));
  };

  const validateBeforeSave = (): string | null => {
    if (config.enabled && config.interfaces.length === 0) {
      return 'Select at least one interface when captive portal is enabled.';
    }

    if (config.sessionTtlSeconds < 60) {
      return 'Session TTL must be at least 60 seconds.';
    }

    if (config.idleTimeoutSeconds > 0 && config.idleTimeoutSeconds < 60) {
      return 'Idle timeout must be 0 or at least 60 seconds.';
    }

    if (!config.listenAddress.trim()) {
      return 'Listen address is required.';
    }

    if (!config.portalTitle.trim()) {
      return 'Portal title is required.';
    }

    if (config.successRedirectUrl?.trim() && !isHttpUrl(config.successRedirectUrl.trim())) {
      return 'Success redirect URL must be a valid HTTP or HTTPS URL.';
    }

    if (config.authMode === 'voucher') {
      const enabledVouchers = config.vouchers.filter((voucher) => voucher.enabled);
      if (enabledVouchers.length === 0) {
        return 'Voucher mode requires at least one enabled voucher.';
      }
      const voucherCodes = enabledVouchers.map((voucher) => voucher.code.trim());
      if (voucherCodes.some((code) => code.length < 4 || code.length > 128)) {
        return 'Each enabled voucher code must be 4 to 128 characters.';
      }
      if (voucherCodes.some((code) => /\s/.test(code))) {
        return 'Voucher codes cannot contain whitespace.';
      }
      if (new Set(voucherCodes).size !== voucherCodes.length) {
        return 'Voucher codes must be unique.';
      }
      const invalidMaxUses = enabledVouchers.some(
        (voucher) =>
          voucher.maxUses != null &&
          (!Number.isFinite(voucher.maxUses) ||
            voucher.maxUses <= 0 ||
            voucher.uses > voucher.maxUses)
      );
      if (invalidMaxUses) {
        return 'Voucher max uses must be greater than current uses.';
      }
    }

    return null;
  };

  const performSave = (successMessage: string) => {
    const validationError = validateBeforeSave();
    if (validationError) {
      addToast(validationError, 'error');
      return;
    }

    const normalized: CaptivePortalConfig = {
      ...config,
      listenAddress: config.listenAddress.trim(),
      listenPort: Math.max(1, Math.min(65535, Number(config.listenPort) || 8080)),
      sessionTtlSeconds: Math.max(60, Number(config.sessionTtlSeconds) || 60),
      idleTimeoutSeconds: Math.max(0, Number(config.idleTimeoutSeconds) || 0),
      portalTitle: config.portalTitle.trim(),
      portalMessage: config.portalMessage.trim(),
      successRedirectUrl: config.successRedirectUrl?.trim() || undefined,
      walledGardenIps: splitListInput(walledGardenText),
      bypassMacs: splitListInput(bypassMacsText).map((value) => value.toLowerCase()),
      vouchers: config.vouchers
        .map((voucher) => normalizeVoucher(voucher))
        .filter((voucher) => voucher.code.length > 0),
    };

    setSaving(true);
    updateCaptivePortalConfig(normalized)
      .then((res) => {
        setConfig(res.data);
        setWalledGardenText(toTextAreaList(res.data.walledGardenIps));
        setBypassMacsText(toTextAreaList(res.data.bypassMacs));
        addToast(successMessage, 'success');
        return Promise.all([getCaptivePortalStatus(), getCaptivePortalSessions()]);
      })
      .then(([stat, sess]) => {
        setStatus(stat.data);
        setSessions(sess.data.sessions as CaptivePortalSessionRecord[]);
      })
      .catch((err: Error) =>
        addToast(`Failed to save captive portal config: ${err.message}`, 'error')
      )
      .finally(() => setSaving(false));
  };

  const handleSave = () => {
    performSave('Captive portal configuration saved.');
  };

  const handleRestart = () => {
    performSave('Captive portal service restart requested.');
  };

  const handleAuthorizeSession = () => {
    if (!sessionForm.clientIp.trim()) {
      addToast('Client IP is required to authorize a session.', 'error');
      return;
    }

    const ttlSeconds = Number(sessionForm.ttlSeconds);
    const request = {
      clientIp: sessionForm.clientIp.trim(),
      clientMac: sessionForm.clientMac.trim() || undefined,
      ttlSeconds:
        sessionForm.ttlSeconds.trim().length > 0 && Number.isFinite(ttlSeconds)
          ? Math.max(60, Math.floor(ttlSeconds))
          : undefined,
    };

    setAuthorizing(true);
    createCaptivePortalSession(request)
      .then(() => {
        addToast('Session authorized.', 'success');
        setSessionForm(DEFAULT_SESSION_FORM);
        return Promise.all([getCaptivePortalStatus(), getCaptivePortalSessions()]);
      })
      .then(([stat, sess]) => {
        setStatus(stat.data);
        setSessions(sess.data.sessions as CaptivePortalSessionRecord[]);
      })
      .catch((err: Error) => addToast(`Failed to authorize session: ${err.message}`, 'error'))
      .finally(() => setAuthorizing(false));
  };

  const handleRevokeSession = (sessionId: string) => {
    setRevokingSessionId(sessionId);
    revokeCaptivePortalSession(sessionId)
      .then(() => {
        addToast('Session revoked.', 'success');
        return Promise.all([getCaptivePortalStatus(), getCaptivePortalSessions()]);
      })
      .then(([stat, sess]) => {
        setStatus(stat.data);
        setSessions(sess.data.sessions as CaptivePortalSessionRecord[]);
      })
      .catch((err: Error) => addToast(`Failed to revoke session: ${err.message}`, 'error'))
      .finally(() => setRevokingSessionId(null));
  };

  const busy = loading || saving;

  return (
    <div className="space-y-6">
      <Card
        title="Captive Portal Overview"
        subtitle="Control network access for selected interfaces using click-through or voucher authorization."
        actions={
          <div className="flex items-center gap-2">
            {statusBadge}
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfig((current) => ({ ...current, enabled: !current.enabled }))}
              title={config.enabled ? 'Disable captive portal' : 'Enable captive portal'}
              aria-label={config.enabled ? 'Disable captive portal' : 'Enable captive portal'}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                config.enabled
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-900'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v8.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 5.5a7 7 0 109 0" />
              </svg>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleRestart}
              title={
                saving ? 'Restarting captive portal service' : 'Restart captive portal service'
              }
              aria-label={
                saving ? 'Restarting captive portal service' : 'Restart captive portal service'
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" d="M12 2a10 10 0 100 20" />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 12a8 8 0 10-2.343 5.657M20 12V8m0 4h-4"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={loadAll}
              title={loading ? 'Refreshing captive portal status' : 'Refresh captive portal status'}
              aria-label={
                loading ? 'Refreshing captive portal status' : 'Refresh captive portal status'
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 12a8 8 0 10-2.343 5.657M20 12V8m0 4h-4"
                />
              </svg>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              title={
                saving ? 'Saving captive portal configuration' : 'Save captive portal configuration'
              }
              aria-label={
                saving ? 'Saving captive portal configuration' : 'Save captive portal configuration'
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" d="M12 2a10 10 0 100 20" />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 20h4l10.5-10.5a1.5 1.5 0 00-4.5-4.5L4 15.5V20z"
                  />
                </svg>
              )}
            </button>
          </div>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-500">Loading captive portal status...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 text-sm text-gray-700 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Portal listener
              </p>
              <p className="mt-1 font-medium">
                {status?.listenAddress}:{status?.listenPort}
              </p>
              <p>
                Auth mode:{' '}
                <span className="font-medium">
                  {status?.authMode === 'voucher' ? 'Voucher' : 'Click-through'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sessions</p>
              <p className="mt-1">
                Active: <span className="font-medium">{status?.sessionsActive ?? 0}</span>
              </p>
              <p>
                Total: <span className="font-medium">{status?.sessionsTotal ?? 0}</span>
              </p>
              <p>
                Expired: <span className="font-medium">{status?.sessionsExpired ?? 0}</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Protected interfaces
              </p>
              {status?.interfaces?.length ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {status.interfaces.map((name) => (
                    <span
                      key={name}
                      className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                    >
                      {interfaceLabel(name)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-gray-500">None selected</p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Configuration"
        subtitle="Define listener behavior, interface scope, and authorization mode."
      >
        <div className="space-y-5">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((current) => ({ ...current, enabled: e.target.checked }))}
              disabled={busy}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Enable captive portal
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              id="cp-auth-mode"
              as="select"
              label="Authorization mode"
              value={config.authMode}
              disabled={busy}
              onChange={(e) =>
                setConfig((current) => ({
                  ...current,
                  authMode: e.target.value as CaptivePortalConfig['authMode'],
                }))
              }
            >
              <option value="click_through">Click-through</option>
              <option value="voucher">Voucher</option>
            </FormField>
            <FormField
              id="cp-listen-address"
              label="Listen address"
              value={config.listenAddress}
              disabled={busy}
              onChange={(e) =>
                setConfig((current) => ({ ...current, listenAddress: e.target.value }))
              }
            />
            <FormField
              id="cp-listen-port"
              label="Listen port"
              type="number"
              min={1}
              max={65535}
              value={config.listenPort}
              disabled={busy}
              onChange={(e) =>
                setConfig((current) => ({ ...current, listenPort: Number(e.target.value) || 0 }))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              id="cp-session-ttl"
              label="Session TTL (seconds)"
              type="number"
              min={60}
              value={config.sessionTtlSeconds}
              disabled={busy}
              onChange={(e) =>
                setConfig((current) => ({
                  ...current,
                  sessionTtlSeconds: Number(e.target.value) || 0,
                }))
              }
            />
            <FormField
              id="cp-idle-timeout"
              label="Idle timeout (seconds)"
              type="number"
              min={0}
              value={config.idleTimeoutSeconds}
              hint="Set to 0 to disable idle expiry"
              disabled={busy}
              onChange={(e) =>
                setConfig((current) => ({
                  ...current,
                  idleTimeoutSeconds: Number(e.target.value) || 0,
                }))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              id="cp-title"
              label="Portal title"
              value={config.portalTitle}
              disabled={busy}
              onChange={(e) =>
                setConfig((current) => ({ ...current, portalTitle: e.target.value }))
              }
            />
            <FormField
              id="cp-success-url"
              label="Success redirect URL"
              value={config.successRedirectUrl ?? ''}
              disabled={busy}
              onChange={(e) =>
                setConfig((current) => ({ ...current, successRedirectUrl: e.target.value }))
              }
            />
          </div>

          <FormField
            id="cp-message"
            as="textarea"
            rows={3}
            label="Portal message"
            value={config.portalMessage}
            disabled={busy}
            onChange={(e) =>
              setConfig((current) => ({ ...current, portalMessage: e.target.value }))
            }
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.redirectHttp}
                onChange={(e) =>
                  setConfig((current) => ({ ...current, redirectHttp: e.target.checked }))
                }
                disabled={busy}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Redirect HTTP to portal
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={config.termsRequired}
                onChange={(e) =>
                  setConfig((current) => ({ ...current, termsRequired: e.target.checked }))
                }
                disabled={busy}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Require terms acceptance
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Protected interfaces</p>
            {interfaces.length === 0 ? (
              <p className="text-sm text-gray-500">No configured interfaces found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {interfaces.map((iface) => (
                  <label
                    key={iface.name}
                    className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={config.interfaces.includes(iface.name)}
                      onChange={() => handleToggleInterface(iface.name)}
                      disabled={busy}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {formatInterfaceDisplayName(iface.description, iface.name)}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              id="cp-walled-garden"
              as="textarea"
              rows={4}
              label="Walled garden IPs/CIDRs"
              hint="One destination per line or comma-separated."
              value={walledGardenText}
              disabled={busy}
              onChange={(e) => setWalledGardenText(e.target.value)}
            />
            <FormField
              id="cp-bypass-macs"
              as="textarea"
              rows={4}
              label="Bypass MAC addresses"
              hint="One MAC address per line or comma-separated."
              value={bypassMacsText}
              disabled={busy}
              onChange={(e) => setBypassMacsText(e.target.value)}
            />
          </div>

          {config.authMode === 'voucher' && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Voucher codes</h4>
                <Button variant="secondary" size="sm" onClick={handleAddVoucher} disabled={busy}>
                  Add voucher
                </Button>
              </div>

              {config.vouchers.length === 0 ? (
                <p className="text-sm text-gray-500">No vouchers added yet.</p>
              ) : (
                <div className="space-y-3">
                  {config.vouchers.map((voucher) => (
                    <div key={voucher.id} className="rounded border border-gray-200 p-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <FormField
                          id={`voucher-code-${voucher.id}`}
                          label="Code"
                          value={voucher.code}
                          disabled={busy}
                          onChange={(e) =>
                            handleUpdateVoucher(voucher.id, { code: e.target.value })
                          }
                        />
                        <FormField
                          id={`voucher-description-${voucher.id}`}
                          label="Description"
                          value={voucher.description ?? ''}
                          disabled={busy}
                          onChange={(e) =>
                            handleUpdateVoucher(voucher.id, { description: e.target.value })
                          }
                        />
                        <FormField
                          id={`voucher-max-uses-${voucher.id}`}
                          label="Max uses"
                          type="number"
                          min={1}
                          value={voucher.maxUses ?? ''}
                          hint="Leave empty for unlimited uses"
                          disabled={busy}
                          onChange={(e) => {
                            const next = e.target.value.trim();
                            handleUpdateVoucher(voucher.id, {
                              maxUses: next.length > 0 ? Math.max(1, Number(next) || 1) : null,
                            });
                          }}
                        />
                        <FormField
                          id={`voucher-expires-${voucher.id}`}
                          label="Expires at"
                          type="datetime-local"
                          value={toDatetimeLocal(voucher.expiresAt)}
                          disabled={busy}
                          onChange={(e) =>
                            handleUpdateVoucher(voucher.id, {
                              expiresAt: fromDatetimeLocal(e.target.value),
                            })
                          }
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={voucher.enabled}
                            onChange={(e) =>
                              handleUpdateVoucher(voucher.id, { enabled: e.target.checked })
                            }
                            disabled={busy}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Enabled
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">Uses: {voucher.uses}</span>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteVoucher(voucher.id)}
                            disabled={busy}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Authorize Client Session"
        subtitle="Manually authorize a client by IP address from the admin UI."
        actions={
          <Button
            onClick={handleAuthorizeSession}
            loading={authorizing}
            disabled={loading || authorizing}
          >
            Authorize Session
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            id="cp-client-ip"
            label="Client IP"
            value={sessionForm.clientIp}
            onChange={(e) =>
              setSessionForm((current) => ({ ...current, clientIp: e.target.value }))
            }
            disabled={loading || authorizing}
            placeholder="192.168.1.100"
          />
          <FormField
            id="cp-client-mac"
            label="Client MAC (optional)"
            value={sessionForm.clientMac}
            onChange={(e) =>
              setSessionForm((current) => ({ ...current, clientMac: e.target.value }))
            }
            disabled={loading || authorizing}
            placeholder="aa:bb:cc:dd:ee:ff"
          />
          <FormField
            id="cp-client-ttl"
            label="TTL override (seconds)"
            type="number"
            min={60}
            value={sessionForm.ttlSeconds}
            onChange={(e) =>
              setSessionForm((current) => ({ ...current, ttlSeconds: e.target.value }))
            }
            disabled={loading || authorizing}
            hint="Optional. Leave empty to use global session TTL."
          />
        </div>
      </Card>

      <Card
        title="Active and Historical Sessions"
        subtitle="Review and revoke portal authorizations."
      >
        <Table<CaptivePortalSessionRecord>
          columns={sessionColumns(formatDateTime, handleRevokeSession, revokingSessionId)}
          data={sessions}
          keyField="id"
          loading={loading}
          emptyMessage="No captive portal sessions found."
        />
      </Card>
    </div>
  );
}
