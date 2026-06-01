import React, { useCallback, useEffect, useState } from 'react';
import { getCaddyConfig, getCaddyStatus, updateCaddyConfig } from '../../api/caddy';
import type { CaddyConfig, CaddySite, CaddyStatus } from '../../types';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import ErrorBoundary from '../../components/ErrorBoundary';
import TrashIcon from '../../components/TrashIcon';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/Modal';
import { ServiceControlCluster } from '../../components/ServiceControlButtons';

const DEFAULT_SITE: CaddySite = {
  domain: '',
  upstream: 'http://127.0.0.1:8080',
  enabled: true,
};

const DEFAULT_CONFIG: CaddyConfig = {
  enabled: false,
  acmeEmail: '',
  logLevel: 'info',
  sites: [],
};

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatServiceState(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return 'Unknown';
  return raw
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function statusBadge(status: CaddyStatus | null) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        Status unknown
      </span>
    );
  }

  if (!status.binaryPresent) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Caddy not installed
      </span>
    );
  }

  if (!status.configured) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        Not configured
      </span>
    );
  }

  if (status.running) {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
        Running
      </span>
    );
  }

  if (status.enabled) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        Enabled, not running
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
      Disabled
    </span>
  );
}

function CaddyPageContent() {
  const [config, setConfig] = useState<CaddyConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<CaddyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const { addToast } = useToast();

  const notifySuccess = useCallback((text: string) => addToast(text, 'success'), [addToast]);
  const notifyError = useCallback((text: string) => addToast(text, 'error'), [addToast]);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([getCaddyConfig(), getCaddyStatus()])
      .then(([cfg, stat]) => {
        setConfig(cfg.data);
        setStatus(stat.data);
      })
      .catch((err: Error) => notifyError(`Failed to load Caddy data: ${err.message}`))
      .finally(() => setLoading(false));
  }, [notifyError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const siteValidation = React.useMemo(
    () =>
      config.sites.map((site) => {
        const domain = site.domain.trim();
        const upstream = site.upstream.trim();
        let domainError = '';
        let upstreamError = '';

        if (!domain) {
          domainError = 'Domain is required.';
        } else if (!HOSTNAME_PATTERN.test(domain)) {
          domainError = 'Domain must be a valid hostname (example: app.example.com).';
        }

        if (!upstream) {
          upstreamError = 'Upstream URL is required.';
        } else {
          try {
            const parsed = new URL(upstream);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              upstreamError = 'Upstream URL must start with http:// or https://.';
            }
          } catch {
            upstreamError = 'Upstream URL must be a valid URL.';
          }
        }

        return { domainError, upstreamError };
      }),
    [config.sites]
  );

  const enabledSiteCount = config.sites.filter((site) => site.enabled).length;
  const emailError =
    config.enabled && !EMAIL_PATTERN.test(config.acmeEmail.trim())
      ? 'A valid contact email is required for automatic HTTPS.'
      : '';
  const hasSiteErrors = config.sites.some(
    (site, index) =>
      site.enabled && (siteValidation[index]?.domainError || siteValidation[index]?.upstreamError)
  );
  const hasErrors = hasSiteErrors || Boolean(emailError);

  const moveSite = (index: number, direction: -1 | 1) => {
    setConfig((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.sites.length) return current;
      const nextSites = [...current.sites];
      const [site] = nextSites.splice(index, 1);
      nextSites.splice(nextIndex, 0, site);
      return { ...current, sites: nextSites };
    });
  };

  const handleSave = () => {
    if (hasErrors) {
      notifyError('Fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    updateCaddyConfig(config)
      .then((res) => {
        setConfig(res.data);
        notifySuccess('Caddy configuration saved.');
        return getCaddyStatus();
      })
      .then((stat) => {
        setStatus(stat.data);
      })
      .catch((err: Error) => notifyError(`Save failed: ${err.message}`))
      .finally(() => setSaving(false));
  };

  const updateSite = (index: number, next: CaddySite) => {
    setConfig((current) => ({
      ...current,
      sites: current.sites.map((site, siteIndex) => (siteIndex === index ? next : site)),
    }));
  };

  const addSite = () => {
    setConfig((current) => ({ ...current, sites: [...current.sites, { ...DEFAULT_SITE }] }));
  };

  const removeSite = (index: number) => {
    setConfig((current) => ({
      ...current,
      sites: current.sites.filter((_, siteIndex) => siteIndex !== index),
    }));
  };

  const toggleEnabled = () => {
    if (config.enabled && status?.running) {
      setDisableConfirmOpen(true);
      return;
    }

    setConfig((current) => ({ ...current, enabled: !current.enabled }));
  };

  const busy = loading || saving;
  const serviceControlsDisabled = busy || status?.configured === false;

  return (
    <div className="space-y-6">
      <Modal
        open={disableConfirmOpen}
        title="Disable running proxy?"
        onClose={() => setDisableConfirmOpen(false)}
        onConfirm={() => {
          setDisableConfirmOpen(false);
          setConfig((current) => ({ ...current, enabled: false }));
        }}
        confirmLabel="Disable Proxy"
        confirmVariant="danger"
        size="md"
      >
        <p className="text-sm text-gray-700">
          The Caddy reverse proxy is currently running. Disabling it will stop serving your sites
          after saving this configuration.
        </p>
      </Modal>

      <Card
        title="Caddy Reverse Proxy Overview"
        subtitle="Front internal services with public hostnames and automatic HTTPS certificates."
        actions={
          <div className="flex items-center gap-2">
            {statusBadge(status)}
            <ServiceControlCluster
              serviceId="caddy"
              disabled={serviceControlsDisabled}
              showStatusBadge={false}
              onError={notifyError}
              onSuccess={(message) => {
                notifySuccess(message);
                loadAll();
              }}
            />
            <Button
              type="button"
              disabled={busy}
              variant={config.enabled ? 'danger' : 'secondary'}
              size="sm"
              onClick={toggleEnabled}
              title={config.enabled ? 'Disable Caddy configuration' : 'Enable Caddy configuration'}
              aria-label={
                config.enabled ? 'Disable Caddy configuration' : 'Enable Caddy configuration'
              }
            >
              {config.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              type="button"
              disabled={busy || hasErrors}
              loading={saving}
              variant="secondary"
              size="sm"
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        }
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Service</p>
              <p className="mt-1 text-sm text-gray-800">
                State:{' '}
                <span className="font-medium">
                  {formatServiceState(status ? `${status.activeState} ${status.subState}` : null)}
                </span>
              </p>
              <p className="text-sm text-gray-800">
                Proxy enabled: <span className="font-medium">{config.enabled ? 'Yes' : 'No'}</span>
              </p>
              <p className="text-sm text-gray-800">
                Unit enabled:{' '}
                <span className="font-medium">{status?.unitEnabled ? 'Yes' : 'No'}</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Environment
              </p>
              <p className="mt-1 text-sm text-gray-800">
                Binary present:{' '}
                <span className="font-medium">{status?.binaryPresent ? 'Yes' : 'No'}</span>
              </p>
              <p className="text-sm text-gray-800">
                Version: <span className="font-medium">{status?.version ?? 'Unavailable'}</span>
              </p>
              <p className="text-sm text-gray-800">
                Active sites: <span className="font-medium">{enabledSiteCount}</span>
              </p>
            </div>
            {status?.lastError && (
              <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {status.lastError}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Configuration"
        subtitle="Caddy obtains and renews TLS certificates automatically via Let's Encrypt for each site domain."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            id="caddy-acme-email"
            label="ACME Contact Email"
            type="email"
            placeholder="admin@example.com"
            aria-label="Caddy ACME contact email"
            error={emailError || undefined}
            value={config.acmeEmail}
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, acmeEmail: e.target.value }))}
            hint="Used by Let's Encrypt for certificate issuance and expiry notices."
          />
          <FormField
            id="caddy-log-level"
            label="Log Level"
            as="select"
            aria-label="Caddy log level"
            value={config.logLevel}
            disabled={busy}
            onChange={(e) => setConfig((current) => ({ ...current, logLevel: e.target.value }))}
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </FormField>
        </div>
      </Card>

      <Card
        title="Sites"
        subtitle="Each site maps a public domain to an internal HTTP or HTTPS upstream."
        actions={
          <button
            disabled={busy}
            onClick={addSite}
            className="btn-icon btn-icon-secondary"
            title="Add new site"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        }
      >
        <div className="space-y-4">
          {hasSiteErrors && (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              One or more sites are invalid. Fix the highlighted fields before saving.
            </p>
          )}
          <p id="caddy-site-keyboard-hint" className="text-xs text-gray-500">
            Reorder sites with the ↑/↓ buttons, or focus a site and use Alt+↑ / Alt+↓.
          </p>
          {config.sites.length === 0 ? (
            <p className="text-sm text-gray-400">No sites defined yet.</p>
          ) : (
            config.sites.map((site, index) => (
              <div
                key={`${site.domain}-${index}`}
                className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_1fr_auto]"
                tabIndex={0}
                aria-describedby="caddy-site-keyboard-hint"
                onKeyDown={(e) => {
                  if (e.altKey && e.key === 'ArrowUp') {
                    e.preventDefault();
                    moveSite(index, -1);
                  }
                  if (e.altKey && e.key === 'ArrowDown') {
                    e.preventDefault();
                    moveSite(index, 1);
                  }
                }}
                aria-label={`Site ${index + 1}`}
              >
                <FormField
                  id={`caddy-domain-${index}`}
                  label="Domain"
                  placeholder="app.example.com"
                  aria-label={`Site ${index + 1} domain`}
                  error={siteValidation[index]?.domainError || undefined}
                  value={site.domain}
                  disabled={busy}
                  onChange={(e) => updateSite(index, { ...site, domain: e.target.value })}
                />
                <FormField
                  id={`caddy-upstream-${index}`}
                  label="Upstream URL"
                  placeholder="http://10.0.0.5:8080"
                  aria-label={`Site ${index + 1} upstream URL`}
                  error={siteValidation[index]?.upstreamError || undefined}
                  value={site.upstream}
                  disabled={busy}
                  onChange={(e) => updateSite(index, { ...site, upstream: e.target.value })}
                />
                <div className="flex items-end gap-2">
                  <Button
                    variant={site.enabled ? 'secondary' : 'primary'}
                    size="sm"
                    aria-label={`${site.enabled ? 'Disable' : 'Enable'} site ${index + 1}`}
                    disabled={busy}
                    onClick={() => updateSite(index, { ...site, enabled: !site.enabled })}
                    title={site.enabled ? 'Disable this site' : 'Enable this site'}
                  >
                    {site.enabled ? 'On' : 'Off'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Move site ${index + 1} up`}
                    disabled={busy || index === 0}
                    onClick={() => moveSite(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Move site ${index + 1} down`}
                    disabled={busy || index === config.sites.length - 1}
                    onClick={() => moveSite(index, 1)}
                  >
                    ↓
                  </Button>
                  <button
                    className="btn-icon btn-icon-danger"
                    aria-label={`Remove site ${index + 1}`}
                    disabled={busy}
                    onClick={() => removeSite(index)}
                    title="Remove site"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

export default function CaddyPage() {
  return (
    <ErrorBoundary fallbackMessage="The Caddy page failed to render. Please refresh and try again.">
      <CaddyPageContent />
    </ErrorBoundary>
  );
}
