import { useEffect, useState } from 'react'
import { getFirewallRules, createFirewallRule, deleteFirewallRule } from '../../api/firewall'
import { getAliases, createAlias, deleteAlias } from '../../api/aliases'
import type { FirewallRule, Alias, AliasType } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

type RuleRow = FirewallRule & Record<string, unknown>
type AliasRow = Alias & Record<string, unknown>

const actionBadge = (action: FirewallRule['action']) => {
  const map: Record<FirewallRule['action'], string> = {
    allow: 'bg-green-100 text-green-700',
    deny: 'bg-red-100 text-red-700',
    reject: 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${map[action]}`}>
      {action}
    </span>
  )
}

const defaultRuleForm: Partial<FirewallRule> = {
  enabled: true,
  description: '',
  action: 'allow',
  direction: 'in',
  protocol: 'tcp',
  source: 'any',
  sourcePort: '',
  destination: 'any',
  destinationPort: '',
  log: false,
  order: 100,
}

const defaultAliasForm: Omit<Alias, 'id'> = {
  name: '',
  type: 'host',
  description: '',
  content: [],
}

export default function Firewall() {
  // ── Rules ──────────────────────────────────────────────────────────────────
  const [rules, setRules] = useState<RuleRow[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState<Partial<FirewallRule>>(defaultRuleForm)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)

  // ── Aliases ────────────────────────────────────────────────────────────────
  const [aliases, setAliases] = useState<AliasRow[]>([])
  const [aliasesLoading, setAliasesLoading] = useState(true)
  const [aliasesError, setAliasesError] = useState<string | null>(null)
  const [aliasModalOpen, setAliasModalOpen] = useState(false)
  const [aliasForm, setAliasForm] = useState<Omit<Alias, 'id'>>(defaultAliasForm)
  const [aliasSaving, setAliasSaving] = useState(false)
  const [deleteAliasId, setDeleteAliasId] = useState<number | null>(null)
  const [deletingAlias, setDeletingAlias] = useState(false)

  const loadRules = () => {
    setRulesLoading(true)
    getFirewallRules()
      .then((res) => setRules(res.data as RuleRow[]))
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setRulesLoading(false))
  }

  const loadAliases = () => {
    setAliasesLoading(true)
    getAliases()
      .then((res) => setAliases(res.data as AliasRow[]))
      .catch((err: Error) => setAliasesError(err.message))
      .finally(() => setAliasesLoading(false))
  }

  useEffect(() => {
    loadRules()
    loadAliases()
  }, [])

  const handleSaveRule = () => {
    setRuleSaving(true)
    createFirewallRule(ruleForm as Omit<FirewallRule, 'id'>)
      .then(() => {
        setRuleModalOpen(false)
        setRuleForm(defaultRuleForm)
        loadRules()
      })
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setRuleSaving(false))
  }

  const handleDeleteRule = () => {
    if (deleteRuleId === null) return
    setDeletingRule(true)
    deleteFirewallRule(deleteRuleId)
      .then(() => {
        setDeleteRuleId(null)
        loadRules()
      })
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setDeletingRule(false))
  }

  const handleSaveAlias = () => {
    setAliasSaving(true)
    createAlias(aliasForm)
      .then(() => {
        setAliasModalOpen(false)
        setAliasForm(defaultAliasForm)
        loadAliases()
      })
      .catch((err: Error) => setAliasesError(err.message))
      .finally(() => setAliasSaving(false))
  }

  const handleDeleteAlias = () => {
    if (deleteAliasId === null) return
    setDeletingAlias(true)
    deleteAlias(deleteAliasId)
      .then(() => {
        setDeleteAliasId(null)
        loadAliases()
      })
      .catch((err: Error) => setAliasesError(err.message))
      .finally(() => setDeletingAlias(false))
  }

  const ruleColumns: Column<RuleRow>[] = [
    { key: 'order', header: '#', className: 'w-10' },
    {
      key: 'enabled',
      header: 'Enabled',
      render: (row) => (
        <span className={row.enabled ? 'text-green-600' : 'text-gray-400'}>
          {row.enabled ? '✓' : '✗'}
        </span>
      ),
    },
    { key: 'description', header: 'Description' },
    { key: 'action', header: 'Action', render: (row) => actionBadge(row.action as FirewallRule['action']) },
    { key: 'direction', header: 'Direction' },
    { key: 'protocol', header: 'Protocol' },
    { key: 'source', header: 'Source' },
    { key: 'destination', header: 'Destination' },
    { key: 'interface', header: 'Interface', render: (row) => (row.interface as string) ?? 'any' },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setDeleteRuleId(row.id as number)}
        >
          Delete
        </Button>
      ),
    },
  ]

  const aliasColumns: Column<AliasRow>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 capitalize">
          {row.type as string}
        </span>
      ),
    },
    { key: 'description', header: 'Description' },
    {
      key: 'content',
      header: 'Entries',
      render: (row) => {
        const entries = row.content as string[]
        return (
          <span className="text-xs text-gray-600">
            {entries.slice(0, 3).join(', ')}
            {entries.length > 3 && ` +${entries.length - 3} more`}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setDeleteAliasId(row.id as number)}
        >
          Delete
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Firewall Rules */}
      <Card
        title="Firewall Rules"
        subtitle="Define allow / deny rules evaluated top-to-bottom"
        actions={
          <Button size="sm" onClick={() => setRuleModalOpen(true)}>
            + Add Rule
          </Button>
        }
      >
        {rulesError && <p className="text-sm text-red-600 mb-3">{rulesError}</p>}
        <Table
          columns={ruleColumns}
          data={rules}
          keyField="id"
          loading={rulesLoading}
          emptyMessage="No firewall rules defined."
        />
      </Card>

      {/* Aliases */}
      <Card
        title="Aliases"
        subtitle="Named sets of hosts, networks, or ports reusable in firewall rules"
        actions={
          <Button size="sm" onClick={() => setAliasModalOpen(true)}>
            + Add Alias
          </Button>
        }
      >
        {aliasesError && <p className="text-sm text-red-600 mb-3">{aliasesError}</p>}
        <Table
          columns={aliasColumns}
          data={aliases}
          keyField="id"
          loading={aliasesLoading}
          emptyMessage="No aliases defined."
        />
      </Card>

      {/* Add Rule Modal */}
      <Modal
        open={ruleModalOpen}
        title="Add Firewall Rule"
        onClose={() => setRuleModalOpen(false)}
        onConfirm={handleSaveRule}
        confirmLabel="Create Rule"
        loading={ruleSaving}
        size="xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="rule-desc"
            label="Description"
            className="col-span-2"
            placeholder="Brief rule description"
            value={ruleForm.description ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
          />
          <FormField
            id="rule-action"
            label="Action"
            as="select"
            value={ruleForm.action ?? 'allow'}
            onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value as FirewallRule['action'] })}
          >
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
            <option value="reject">Reject</option>
          </FormField>
          <FormField
            id="rule-direction"
            label="Direction"
            as="select"
            value={ruleForm.direction ?? 'in'}
            onChange={(e) => setRuleForm({ ...ruleForm, direction: e.target.value as FirewallRule['direction'] })}
          >
            <option value="in">Inbound</option>
            <option value="out">Outbound</option>
            <option value="both">Both</option>
          </FormField>
          <FormField
            id="rule-protocol"
            label="Protocol"
            as="select"
            value={ruleForm.protocol ?? 'tcp'}
            onChange={(e) => setRuleForm({ ...ruleForm, protocol: e.target.value as FirewallRule['protocol'] })}
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
            <option value="any">Any</option>
          </FormField>
          <FormField
            id="rule-iface"
            label="Interface"
            placeholder="e.g. eth0 (leave blank for any)"
            value={ruleForm.interface ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, interface: e.target.value })}
          />
          <FormField
            id="rule-src"
            label="Source"
            placeholder="any / 192.168.1.0/24"
            value={ruleForm.source ?? 'any'}
            onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value })}
          />
          <FormField
            id="rule-src-port"
            label="Source Port"
            placeholder="any / 80 / 1024:65535"
            value={ruleForm.sourcePort ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, sourcePort: e.target.value })}
          />
          <FormField
            id="rule-dst"
            label="Destination"
            placeholder="any / 10.0.0.1"
            value={ruleForm.destination ?? 'any'}
            onChange={(e) => setRuleForm({ ...ruleForm, destination: e.target.value })}
          />
          <FormField
            id="rule-dst-port"
            label="Destination Port"
            placeholder="any / 443"
            value={ruleForm.destinationPort ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, destinationPort: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Rule Modal */}
      <Modal
        open={deleteRuleId !== null}
        title="Delete Firewall Rule"
        onClose={() => setDeleteRuleId(null)}
        onConfirm={handleDeleteRule}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingRule}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this firewall rule? This action cannot be undone.
        </p>
      </Modal>

      {/* Add Alias Modal */}
      <Modal
        open={aliasModalOpen}
        title="Add Alias"
        onClose={() => setAliasModalOpen(false)}
        onConfirm={handleSaveAlias}
        confirmLabel="Create Alias"
        loading={aliasSaving}
        size="lg"
      >
        <div className="space-y-4">
          <FormField
            id="alias-name"
            label="Name"
            required
            placeholder="e.g. RFC1918_NETWORKS"
            value={aliasForm.name}
            onChange={(e) => setAliasForm({ ...aliasForm, name: e.target.value })}
          />
          <FormField
            id="alias-type"
            label="Type"
            as="select"
            value={aliasForm.type}
            onChange={(e) => setAliasForm({ ...aliasForm, type: e.target.value as AliasType })}
          >
            <option value="host">Host</option>
            <option value="network">Network</option>
            <option value="port">Port</option>
            <option value="url">URL</option>
          </FormField>
          <FormField
            id="alias-desc"
            label="Description"
            placeholder="Optional description"
            value={aliasForm.description}
            onChange={(e) => setAliasForm({ ...aliasForm, description: e.target.value })}
          />
          <FormField
            id="alias-content"
            label="Entries"
            as="textarea"
            rows={4}
            hint="One IP, CIDR, port, or URL per line"
            value={aliasForm.content.join('\n')}
            onChange={(e) =>
              setAliasForm({
                ...aliasForm,
                content: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      </Modal>

      {/* Delete Alias Modal */}
      <Modal
        open={deleteAliasId !== null}
        title="Delete Alias"
        onClose={() => setDeleteAliasId(null)}
        onConfirm={handleDeleteAlias}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingAlias}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this alias? Firewall rules referencing it may break.
        </p>
      </Modal>
    </div>
  )
}
