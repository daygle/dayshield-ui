import { useEffect, useState } from 'react'
import {
  getAcmeAccount,
  updateAcmeAccount,
  getAcmeCertificates,
  issueAcmeCertificate,
  renewAcmeCertificate,
  deleteAcmeCertificate,
} from '../../api/acme'
import type { AcmeAccount, AcmeCertificate, AcmeCertificateStatus } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type CertRow = AcmeCertificate & Record<string, unknown>

const statusBadge = (status: AcmeCertificateStatus) => {
  const map: Record<AcmeCertificateStatus, string> = {
    valid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${map[status]}`}>
      {status}
    </span>
  )
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000)
}

const defaultCertForm = { domain: '', sans: '', autoRenew: true }

export default function ACME() {
  const [account, setAccount] = useState<AcmeAccount | null>(null)
  const [certs, setCerts] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [accountEditOpen, setAccountEditOpen] = useState(false)
  const [accountForm, setAccountForm] = useState<Partial<AcmeAccount>>({})
  const [accountSaving, setAccountSaving] = useState(false)

  const [issueOpen, setIssueOpen] = useState(false)
  const [certForm, setCertForm] = useState(defaultCertForm)
  const [issueSaving, setIssueSaving] = useState(false)

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [renewingId, setRenewingId] = useState<number | null>(null)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getAcmeAccount(), getAcmeCertificates()])
      .then(([acc, c]) => {
        setAccount(acc.data)
        setAccountForm(acc.data)
        setCerts(Array.isArray(c.data) ? (c.data as CertRow[]) : [])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const handleSaveAccount = () => {
    setAccountSaving(true)
    updateAcmeAccount(accountForm)
      .then((res) => {
        setAccount(res.data)
        setAccountForm(res.data)
        setAccountEditOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setAccountSaving(false))
  }

  const handleIssueCert = () => {
    setIssueSaving(true)
    issueAcmeCertificate({
      domain: certForm.domain,
      sans: certForm.sans.split(',').map((s) => s.trim()).filter(Boolean),
      autoRenew: certForm.autoRenew,
    })
      .then(() => {
        setIssueOpen(false)
        setCertForm(defaultCertForm)
        getAcmeCertificates().then((r) => setCerts(r.data as CertRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIssueSaving(false))
  }

  const handleRenew = (id: number) => {
    setRenewingId(id)
    renewAcmeCertificate(id)
      .then(() => getAcmeCertificates().then((r) => setCerts(Array.isArray(r.data) ? (r.data as CertRow[]) : [])))
      .catch((err: Error) => setError(err.message))
      .finally(() => setRenewingId(null))
  }

  const handleDelete = () => {
    if (deleteId === null) return
    setDeleting(true)
    deleteAcmeCertificate(deleteId)
      .then(() => {
        setDeleteId(null)
        getAcmeCertificates().then((r) => setCerts(Array.isArray(r.data) ? (r.data as CertRow[]) : []))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDeleting(false))
  }

  const certColumns: Column<CertRow>[] = [
    { key: 'domain', header: 'Domain' },
    {
      key: 'sans',
      header: 'SANs',
      render: (row) => {
        const sans = row.sans as string[] | undefined
        return sans && Array.isArray(sans) && sans.length ? sans.join(', ') : '—'
      },
    },
    { key: 'status', header: 'Status', render: (row) => statusBadge(row.status as AcmeCertificateStatus) },
    { key: 'issuer', header: 'Issuer' },
    {
      key: 'notAfter',
      header: 'Expires',
      render: (row) => {
        const days = daysUntil(row.notAfter as string)
        const color = days < 14 ? 'text-red-600' : days < 30 ? 'text-yellow-600' : 'text-gray-800'
        return (
          <span className={`font-medium ${color}`}>
            {new Date(row.notAfter as string).toLocaleDateString()} ({days}d)
          </span>
        )
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
    {
      key: 'actions',
      header: '',
      className: 'w-36 text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={() => handleRenew(row.id as number)}
            disabled={renewingId === (row.id as number)}
          >
            {renewingId === (row.id as number) ? 'Renewing…' : 'Renew'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteId(row.id as number)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        Loading ACME data…
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
            <Button size="sm" onClick={() => { setAccountForm(account); setAccountEditOpen(true) }}>
              Edit
            </Button>
          }
        >
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-800">{account.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ACME Server</dt>
              <dd className="font-medium text-gray-800 break-all">{account.server || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Registered</dt>
              <dd className={`font-medium ${account.registered ? 'text-green-600' : 'text-gray-400'}`}>
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
        subtitle="TLS certificates issued via the ACME protocol"
        actions={
          <Button size="sm" onClick={() => setIssueOpen(true)}>
            + Issue Certificate
          </Button>
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
            value={accountForm.server ?? ''}
            onChange={(e) => setAccountForm({ ...accountForm, server: e.target.value })}
          />
          <p className="text-xs text-gray-500">
            Use <code className="font-mono">https://acme-staging-v02.api.letsencrypt.org/directory</code> for
            testing to avoid Let&apos;s Encrypt rate limits.
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

      {/* Delete Certificate Modal */}
      <Modal
        open={deleteId !== null}
        title="Delete Certificate"
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this certificate? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
