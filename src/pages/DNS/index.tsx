import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getDnsConfig,
  updateDnsConfig,
  getDnsOverrides,
  createDnsHostOverride,
  deleteDnsHostOverride,
  createDnsDomainOverride,
  deleteDnsDomainOverride,
} from '../../api/dns'
import type { DnsConfig, DnsHostOverride, DnsDomainOverride } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type HostRow = DnsHostOverride & Record<string, unknown>
type DomainRow = DnsDomainOverride & Record<string, unknown>

const hostColumns: Column<HostRow>[] = [
  { key: 'hostname', header: 'Hostname (FQDN)' },
  { key: 'address', header: 'IP Address' },
]

const domainColumns: Column<DomainRow>[] = [
  { key: 'domain', header: 'Domain' },
  { key: 'forward_to', header: 'Forward To (DNS IP)' },
]

const defaultConfigForm = (): Partial<DnsConfig> => ({
  enabled: true,
  listen_addresses: [],
  port: 53,
  forwarders: [],
  dnssec: false,
  local_records: [],
})

export default function DNS() {
  const [searchParams] = useSearchParams()
  const [config, setConfig] = useState<DnsConfig | null>(null)
  const [hostOverrides, setHostOverrides] = useState<HostRow[]>([])
  const [domainOverrides, setDomainOverrides] = useState<DomainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Config edit
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configForm, setConfigForm] = useState<Partial<DnsConfig>>(defaultConfigForm())
  const [listenInput, setListenInput] = useState('')
  const [forwardersInput, setForwardersInput] = useState('')
  const [configSaving, setConfigSaving] = useState(false)

  // Host overrides
  const [hostModalOpen, setHostModalOpen] = useState(false)
  const [hostForm, setHostForm] = useState({ hostname: '', address: '' })
  const [hostSaving, setHostSaving] = useState(false)
  const [hostDeleteName, setHostDeleteName] = useState<string | null>(null)
  const [hostDeleting, setHostDeleting] = useState(false)

  // Domain overrides
  const [domainModalOpen, setDomainModalOpen] = useState(false)
  const [domainForm, setDomainForm] = useState({ domain: '', forward_to: '' })
  const [domainSaving, setDomainSaving] = useState(false)
  const [domainDeleteName, setDomainDeleteName] = useState<string | null>(null)
  const [domainDeleting, setDomainDeleting] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([getDnsConfig(), getDnsOverrides()])
      .then(([cfg, overrides]) => {
        setConfig(cfg.data)
        setHostOverrides(overrides.data.host_overrides as HostRow[])
        setDomainOverrides(overrides.data.domain_overrides as DomainRow[])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  const openConfigModal = () => {
    if (config) {
      setConfigForm({ ...config })
      setListenInput((config.listen_addresses ?? []).join(', '))
      setForwardersInput((config.forwarders ?? []).join(', '))
    } else {
      setConfigForm(defaultConfigForm())
      setListenInput('')
      setForwardersInput('')
    }
    setConfigModalOpen(true)
  }

  const handleSaveConfig = () => {
    const parseList = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean)
    const payload: DnsConfig = {
      enabled: configForm.enabled ?? true,
      listen_addresses: parseList(listenInput),
      port: configForm.port ?? 53,
      forwarders: parseList(forwardersInput),
      dnssec: configForm.dnssec ?? false,
      // Preserve existing local_records — they're managed via the overrides API
      local_records: config?.local_records ?? [],
    }
    setConfigSaving(true)
    updateDnsConfig(payload)
      .then((r) => {
        setConfig(r.data)
        setConfigModalOpen(false)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setConfigSaving(false))
  }

  const handleAddHost = () => {
    setHostSaving(true)
    createDnsHostOverride(hostForm.hostname, hostForm.address)
      .then(() => {
        setHostModalOpen(false)
        setHostForm({ hostname: '', address: '' })
        getDnsOverrides().then((r) => setHostOverrides(r.data.host_overrides as HostRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setHostSaving(false))
  }

  const handleDeleteHost = () => {
    if (!hostDeleteName) return
    setHostDeleting(true)
    deleteDnsHostOverride(hostDeleteName)
      .then(() => {
        setHostDeleteName(null)
        getDnsOverrides().then((r) => setHostOverrides(r.data.host_overrides as HostRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setHostDeleting(false))
  }

  const handleAddDomain = () => {
    setDomainSaving(true)
    createDnsDomainOverride(domainForm.domain, domainForm.forward_to)
      .then(() => {
        setDomainModalOpen(false)
        setDomainForm({ domain: '', forward_to: '' })
        getDnsOverrides().then((r) => setDomainOverrides(r.data.domain_overrides as DomainRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDomainSaving(false))
  }

  const handleDeleteDomain = () => {
    if (!domainDeleteName) return
    setDomainDeleting(true)
    deleteDnsDomainOverride(domainDeleteName)
      .then(() => {
        setDomainDeleteName(null)
        getDnsOverrides().then((r) => setDomainOverrides(r.data.domain_overrides as DomainRow[]))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setDomainDeleting(false))
  }

  const hostColumnsWithActions: Column<HostRow>[] = [
    ...hostColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button variant="danger" size="sm" onClick={() => setHostDeleteName(row.hostname as string)}>
          Delete
        </Button>
      ),
    },
  ]

  const domainColumnsWithActions: Column<DomainRow>[] = [
    ...domainColumns,
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button variant="danger" size="sm" onClick={() => setDomainDeleteName(row.domain as string)}>
          Delete
        </Button>
      ),
    },
  ]

  const activeSection = searchParams.get('section') === 'overrides' ? 'overrides' : 'settings'

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-3 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {activeSection === 'settings' && (
        <Card
          title="DNS Resolver (Unbound)"
          subtitle="Recursive resolver / forwarder configuration"
          actions={
            <Button size="sm" variant="secondary" onClick={openConfigModal}>
              Edit Settings
            </Button>
          }
        >
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : config ? (
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Status</dt>
                <dd className={`mt-1 font-semibold ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Mode</dt>
                <dd className="mt-1 font-medium text-gray-800">
                  {config.forwarders?.length ? 'Forwarder' : 'Full Recursion'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Port</dt>
                <dd className="mt-1 font-medium text-gray-800 font-mono">{config.port ?? 53}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Listen Addresses</dt>
                <dd className="mt-1 font-medium text-gray-800 font-mono">
                  {config.listen_addresses?.length ? config.listen_addresses.join(', ') : 'All interfaces'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">Upstream Forwarders</dt>
                <dd className="mt-1 font-medium text-gray-800 font-mono">
                  {config.forwarders?.length ? config.forwarders.join(', ') : '— (recursive)'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium uppercase tracking-wide">DNSSEC</dt>
                <dd className={`mt-1 font-semibold ${config.dnssec ? 'text-green-600' : 'text-gray-400'}`}>
                  {config.dnssec ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No DNS configuration found.</p>
          )}
        </Card>
      )}

      {activeSection === 'overrides' && (
        <>
          <Card
            title="Host Overrides"
            subtitle="Map fully-qualified hostnames to specific IP addresses (local A/AAAA records)"
            actions={
              <Button size="sm" onClick={() => setHostModalOpen(true)}>
                + Add Host
              </Button>
            }
          >
            <Table
              columns={hostColumnsWithActions}
              data={hostOverrides}
              keyField="hostname"
              loading={loading}
              emptyMessage="No host overrides configured."
            />
          </Card>

          <Card
            title="Domain Overrides"
            subtitle="Forward all DNS queries for a domain to a specific resolver"
            actions={
              <Button size="sm" onClick={() => setDomainModalOpen(true)}>
                + Add Domain
              </Button>
            }
          >
            <Table
              columns={domainColumnsWithActions}
              data={domainOverrides}
              keyField="domain"
              loading={loading}
              emptyMessage="No domain overrides configured."
            />
          </Card>
        </>
      )}

      {/* Edit DNS Settings Modal */}
      <Modal
        open={configModalOpen}
        title="Edit DNS Settings"
        onClose={() => setConfigModalOpen(false)}
        onConfirm={handleSaveConfig}
        confirmLabel="Save"
        loading={configSaving}
        size="lg"
      >
        <div className="space-y-5">
          {/* Enable toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={!!configForm.enabled}
              onChange={(e) => setConfigForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-700">Enable DNS resolver</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            {/* Port */}
            <FormField
              id="dns-port"
              label="Listen Port"
              type="number"
              min={1}
              max={65535}
              placeholder="53"
              value={String(configForm.port ?? 53)}
              onChange={(e) =>
                setConfigForm((f) => ({ ...f, port: parseInt(e.target.value, 10) || 53 }))
              }
            />

            {/* DNSSEC toggle */}
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={!!configForm.dnssec}
                  onChange={(e) => setConfigForm((f) => ({ ...f, dnssec: e.target.checked }))}
                />
                <span className="text-sm font-medium text-gray-700">Enable DNSSEC validation</span>
              </label>
            </div>

            {/* Listen addresses */}
            <FormField
              id="dns-listen"
              label="Listen Addresses"
              className="col-span-2"
              placeholder="e.g. 192.168.1.1, 127.0.0.1  (leave blank to listen on all interfaces)"
              value={listenInput}
              onChange={(e) => setListenInput(e.target.value)}
            />

            {/* Upstream forwarders */}
            <FormField
              id="dns-fwd"
              label="Upstream Forwarders"
              className="col-span-2"
              placeholder="e.g. 1.1.1.1, 8.8.8.8  (leave blank for full recursion)"
              value={forwardersInput}
              onChange={(e) => setForwardersInput(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-500">
            Enter multiple addresses as comma-separated values.
            When <strong>upstream forwarders</strong> are set Unbound operates in forwarder mode;
            otherwise it performs full recursive resolution.
            Use <strong>Host Overrides</strong> and <strong>Domain Overrides</strong> to add
            local DNS entries and per-domain forwarding.
          </p>
        </div>
      </Modal>

      {/* Add Host Override Modal */}
      <Modal
        open={hostModalOpen}
        title="Add Host Override"
        onClose={() => setHostModalOpen(false)}
        onConfirm={handleAddHost}
        confirmLabel="Add"
        loading={hostSaving}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="host-fqdn"
            label="Hostname (FQDN)"
            required
            className="col-span-2"
            placeholder="e.g. myserver.home.lan"
            value={hostForm.hostname}
            onChange={(e) => setHostForm({ ...hostForm, hostname: e.target.value })}
          />
          <FormField
            id="host-addr"
            label="IP Address"
            required
            className="col-span-2"
            placeholder="192.168.1.50"
            value={hostForm.address}
            onChange={(e) => setHostForm({ ...hostForm, address: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Host Confirmation */}
      <Modal
        open={hostDeleteName !== null}
        title="Remove Host Override"
        onClose={() => setHostDeleteName(null)}
        onConfirm={handleDeleteHost}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={hostDeleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Remove override for <strong className="font-mono">{hostDeleteName}</strong>?
        </p>
      </Modal>

      {/* Add Domain Override Modal */}
      <Modal
        open={domainModalOpen}
        title="Add Domain Override"
        onClose={() => setDomainModalOpen(false)}
        onConfirm={handleAddDomain}
        confirmLabel="Add"
        loading={domainSaving}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="dom-name"
            label="Domain"
            required
            className="col-span-2"
            placeholder="e.g. internal.corp"
            value={domainForm.domain}
            onChange={(e) => setDomainForm({ ...domainForm, domain: e.target.value })}
          />
          <FormField
            id="dom-fwd"
            label="Forward To (DNS Server IP)"
            required
            className="col-span-2"
            placeholder="e.g. 10.0.0.53"
            value={domainForm.forward_to}
            onChange={(e) => setDomainForm({ ...domainForm, forward_to: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Domain Confirmation */}
      <Modal
        open={domainDeleteName !== null}
        title="Remove Domain Override"
        onClose={() => setDomainDeleteName(null)}
        onConfirm={handleDeleteDomain}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={domainDeleting}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Remove override for domain <strong className="font-mono">{domainDeleteName}</strong>?
        </p>
      </Modal>
    </div>
  )
}

