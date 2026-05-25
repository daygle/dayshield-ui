import { useEffect, useState } from 'react';
import {
  getAcmeAccount,
  updateAcmeAccount,
  getAcmeCertificates,
  getAcmeCertStatus,
  issueAcmeCertificate,
  issueAcmeCertificates,
  deleteAcmeCertificate,
} from '../../api/acme';
import type {
  AcmeAccount,
  AcmeCertificate,
  AcmeCertificateStatus,
  AcmeCertStatus,
  AcmeDnsProvider,
} from '../../types';
import Card from '../../components/Card';
import Table, { Column } from '../../components/Table';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext';

type CertRow = AcmeCertificate & Record<string, unknown>;

const statusBadge = (status: AcmeCertificateStatus) => {
  const map: Record<AcmeCertificateStatus, string> = {
    valid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${map[status]}`}
    >
      {status}
    </span>
  );
};

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);
}

const defaultCertForm = { domain: '', sans: '', autoRenew: true };

export default function ACME() {
  const { formatDate } = useDisplayPreferences();
  const [account, setAccount] = useState<AcmeAccount | null>(null);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<AcmeCertStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [reissueSaving, setReissueSaving] = useState(false);

  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<Partial<AcmeAccount>>({});
  const [accountDomains, setAccountDomains] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);

  const [issueOpen, setIssueOpen] = useState(false);
  const [certForm, setCertForm] = useState(defaultCertForm);
  const [issueSaving, setIssueSaving] = useState(false);

  const loadAll = () => {
    setLoading(true);
    Promise.all([getAcmeAccount(), getAcmeCertificates(), getAcmeCertStatus()])
      .then(([acc, c, statusRes]) => {
        setAccount(acc.data);
        setAccountForm(acc.data);
        setAccountDomains((acc.data.domains ?? []).join(', '));
        setCerts(Array.isArray(c.data) ? (c.data as CertRow[]) : []);
        setStatus(statusRes.data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const handleSaveAccount = () => {
    setAccountSaving(true);
    updateAcmeAccount({
      ...accountForm,
      domains: accountDomains
        .split(',')
        .map((domain) => domain.trim())
        .filter(Boolean),
    })
      .then((res) => {
        setAccount(res.data);
        setAccountForm(res.data);
        setAccountDomains((res.data.domains ?? []).join(', '));
        setAccountEditOpen(false);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setAccountSaving(false));
  };

  const handleIssueCert = () => {
    setIssueSaving(true);
    issueAcmeCertificate({
      domain: certForm.domain,
      sans: certForm.sans
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      autoRenew: certForm.autoRenew,
    })
      .then(() => {
        setIssueOpen(false);
        setCertForm(defaultCertForm);
        loadAll();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIssueSaving(false));
  };

  const handleReissue = () => {
    setReissueSaving(true);
    issueAcmeCertificates()
      .then(() => {
        loadAll();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setReissueSaving(false));
  };

  const handleDeleteCertificate = () => {
    setDeleteSaving(true);
    deleteAcmeCertificate()
      .then(() => {
        setDeleteOpen(false);
        loadAll();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleteSaving(false));
  };

  const certColumns: Column<CertRow>[] = [
    { key: 'domain', header: 'Domain' },
    {
      key: 'sans',
      header: 'SANs',
      render: (row) => {
        const sans = row.sans as string[] | undefined;
        return sans && Array.isArray(sans) && sans.length ? sans.join(', ') : '-';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => statusBadge(row.status as AcmeCertificateStatus),
    },
    { key: 'issuer', header: 'Issuer' },
    {
      key: 'notAfter',
      header: 'Expires',
      render: (row) => {
        const notAfter = String(row.notAfter ?? '').trim();
        if (!notAfter) return '';

        const parsed = new Date(notAfter);
        if (Number.isNaN(parsed.getTime())) return '';

        const days = daysUntil(notAfter);
        const color = days < 14 ? 'text-red-600' : days < 30 ? 'text-yellow-600' : 'text-gray-800';
        return (
          <span className={`font-medium ${color}`}>
            {formatDate(parsed)} ({days}d)
          </span>
        );
      },
    },
    {
      key: 'autoRenew',
      header: 'Auto-renew',
      render: (row) => (
        <span className={row.autoRenew ? 'text-green-600' : 'text-gray-400'}>
          {row.autoRenew ? '✓' : '✗'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">Loading ACME data…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Edit Account Modal */}
      <Modal
        open={accountEditOpen}
        title="Edit ACME Account"
        onClose={() => setAccountEditOpen(false)}
        onConfirm={handleSaveAccount}
        confirmLabel="Save"
        loading={accountSaving}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4">
          <FormField
            id="acme-email"
            label="Email"
            type="email"
            placeholder="admin@example.com"
            value={accountForm.email ?? ''}
            onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
          />
          <FormField
            id="acme-server"
            label="ACME Directory URL"
            placeholder="https://acme-v02.api.letsencrypt.org/directory"
            value={accountForm.directory_url ?? ''}
            onChange={(e) => setAccountForm({ ...accountForm, directory_url: e.target.value })}
          />
          <FormField
            id="acme-challenge-type"
            label="ACME Challenge Type"
            as="select"
            value={accountForm.challenge_type ?? 'http01'}
            onChange={(e) =>
              setAccountForm({
                ...accountForm,
                challenge_type: e.target.value as 'http01' | 'dns01',
                dns_provider:
                  e.target.value === 'dns01'
                    ? (accountForm.dns_provider ?? 'manual')
                    : undefined,
              })
            }
          >
            <option value="http01">HTTP-01 (port 80)</option>
            <option value="dns01">DNS-01 (manual TXT record, Cloudflare, or Namecheap)</option>
          </FormField>
          {accountForm.challenge_type === 'dns01' && (
            <FormField
              id="acme-dns-provider"
              label="DNS provider"
              as="select"
              value={accountForm.dns_provider ?? 'manual'}
              onChange={(e) =>
                setAccountForm({
                  ...accountForm,
                  dns_provider: e.target.value as AcmeDnsProvider,
                })
              }
            >
              <option value="manual">Manual TXT record</option>
              <option value="cloudflare">Cloudflare DNS API</option>
              <option value="namecheap">Namecheap DNS API</option>
            </FormField>
          )}
          {accountForm.challenge_type === 'dns01' &&
            accountForm.dns_provider === 'cloudflare' && (
              <>
                <FormField
                  id="acme-cloudflare-zone-id"
                  label="Cloudflare Zone ID"
                  placeholder="Enter Cloudflare zone ID"
                  value={accountForm.cloudflare_zone_id ?? ''}
                  onChange={(e) =>
                    setAccountForm({
                      ...accountForm,
                      cloudflare_zone_id: e.target.value,
                    })
                  }
                />
                <FormField
                  id="acme-cloudflare-api-token"
                  label="Cloudflare API Token"
                  type="password"
                  placeholder="Enter Cloudflare API token"
                  value={accountForm.cloudflare_api_token ?? ''}
                  onChange={(e) =>
                    setAccountForm({
                      ...accountForm,
                      cloudflare_api_token: e.target.value,
                    })
                  }
                />
              </>
            )}
          <FormField
            id="acme-domains"
            label="Domains"
            as="textarea"
            rows={3}
            placeholder="example.com, www.example.com, *.example.com"
            hint="Comma-separated list of domains to request certificates for. Use *.example.com for wildcard certificates."
            value={accountDomains}
            onChange={(e) => setAccountDomains(e.target.value)}
          />
          {accountForm.challenge_type === 'http01' && accountDomains.includes('*.') && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Wildcard certificates require DNS-01 validation. Change the challenge type to
              DNS-01 before saving this configuration.
            </div>
          )}
          <p className="text-xs text-gray-500">
            Use{' '}
            <code className="font-mono">
              https://acme-staging-v02.api.letsencrypt.org/directory
            </code>{' '}
            for testing to avoid Let&apos;s Encrypt rate limits.
          </p>
        </div>
      </Modal>

      {/* Issue Certificate Modal */}
      <Modal
        open={issueOpen}
        title="Issue Certificate"
        onClose={() => setIssueOpen(false)}
        onConfirm={handleIssueCert}
        confirmLabel="Issue"
        loading={issueSaving}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4">
          <FormField
            id="cert-domain"
            label="Primary Domain"
            required
            placeholder="example.com"
            value={certForm.domain}
            onChange={(e) => setCertForm({ ...certForm, domain: e.target.value })}
          />
          <FormField
            id="cert-sans"
            label="Subject Alternative Names (comma-separated)"
            placeholder="www.example.com, api.example.com"
            value={certForm.sans}
            onChange={(e) => setCertForm({ ...certForm, sans: e.target.value })}
          />
        </div>
      </Modal>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Account */}
      {account && (
        <Card
          title="ACME Account"
          actions={
            <button
              onClick={() => {
                setAccountForm(account);
                setAccountEditOpen(true);
              }}
              className="btn-icon btn-icon-secondary"
              title="Edit ACME account"
              aria-label="Edit ACME account"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-800">{account.email || '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ACME Server</dt>
              <dd className="font-medium text-gray-800 break-all">
                {account.directory_url || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Challenge Type</dt>
              <dd className="font-medium text-gray-800">{account.challenge_type ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Domains</dt>
              <dd className="font-medium text-gray-800">
                {account.domains && account.domains.length > 0 ? account.domains.join(', ') : '-'}
              </dd>
            </div>
            {account.challenge_type === 'dns01' && (
              <>
                <div>
                  <dt className="text-gray-500">DNS Provider</dt>
                  <dd className="font-medium text-gray-800">
                    {account.dns_provider === 'cloudflare'
                      ? 'Cloudflare DNS API'
                      : account.dns_provider === 'namecheap'
                      ? 'Namecheap DNS API'
                      : 'Manual TXT record'}
                  </dd>
                </div>
                {account.dns_provider === 'cloudflare' && (
                  <div>
                    <dt className="text-gray-500">Cloudflare Zone</dt>
                    <dd className="font-medium text-gray-800">
                      {account.cloudflare_zone_id ?? '-'}
                    </dd>
                  </div>
                )}
              </>
            )}
            <div>
              <dt className="text-gray-500">Registered</dt>
              <dd
                className={`font-medium ${account.registered ? 'text-green-600' : 'text-gray-400'}`}
              >
                {account.registered ? 'Yes' : 'No'}
              </dd>
            </div>
            {account.keyId && (
              <div className="col-span-3">
                <dt className="text-gray-500">Key ID</dt>
                <dd className="font-mono text-xs text-gray-800 break-all">{account.keyId}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* Certificates */}
      <Card
        title="Certificates"
        subtitle="TLS certificates issued via the ACME protocol. Use Issue Certificate to add or renew certificates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIssueOpen(true)}
              disabled={issueSaving || loading}
              title="Issue"
              aria-label="Issue"
            >
              Issue
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReissue}
              disabled={reissueSaving || loading || !status?.cert_exists}
              loading={reissueSaving}
              title="Reissue certificate"
              aria-label="Reissue certificate"
            >
              Reissue
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteSaving || loading || !status?.cert_exists}
              title="Delete certificate"
              aria-label="Delete certificate"
            >
              Delete
            </Button>
          </div>
        }
      >
        <Table
          columns={certColumns}
          data={certs}
          keyField="id"
          loading={false}
          emptyMessage="No certificates issued yet."
        />
      </Card>
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete ACME Certificate"
        onConfirm={handleDeleteCertificate}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteSaving}
      >
        <p>Delete the current ACME certificate for {status?.domain ?? 'the configured domain'}? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
