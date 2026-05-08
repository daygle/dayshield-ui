import { useEffect, useState } from 'react'
import { getFirewallRules, createFirewallRule, updateFirewallRule, deleteFirewallRule } from '../../api/firewall'
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
    accept: 'bg-green-100 text-green-700',
    drop: 'bg-red-100 text-red-700',
    reject: 'bg-orange-100 text-orange-700',
    jump: 'bg-purple-100 text-purple-700',
    log: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${map[action]}`}>
      {action}
    </span>
  )
}

const defaultRuleForm: Partial<FirewallRule> = {
  description: '',
  action: 'accept',
  protocol: 'tcp',
  source: null,
  source_port: null,
  destination: null,
  destination_port: null,
  log: false,
  priority: 100,
}

const defaultAliasForm: Alias = {
  name: '',
  alias_type: 'host',
  description: null,
  values: [],
  ttl: null,
  enabled: true,
}

export default function Firewall() {
  // ── Rules ──────────────────────────────────────────────────────────────────
  const [rules, setRules] = useState<RuleRow[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState<Partial<FirewallRule>>(defaultRuleForm)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)
  const [editRule, setEditRule] = useState<FirewallRule | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // ── Aliases ──────────────────────────────────────────────────────────────────────
  const [aliases, setAliases] = useState<AliasRow[]>([])
  const [aliasesLoading, setAliasesLoading] = useState(true)
  const [aliasesError, setAliasesError] = useState<string | null>(null)
  const [aliasModalOpen, setAliasModalOpen] = useState(false)
  const [aliasForm, setAliasForm] = useState<Alias>(defaultAliasForm)
  const [aliasSaving, setAliasSaving] = useState(false)
  const [deleteAliasName, setDeleteAliasName] = useState<string | null>(null)
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

  const handleUpdateRule = () => {
    if (!editRule) return
    setEditSaving(true)
    updateFirewallRule(editRule.id, editRule)
      .then(() => {
        setEditRule(null)
        loadRules()
      })
      .catch((err: Error) => setRulesError(err.message))
      .finally(() => setEditSaving(false))
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
    if (deleteAliasName === null) return
    setDeletingAlias(true)
    deleteAlias(deleteAliasName)
      .then(() => {
        setDeleteAliasName(null)
        loadAliases()
      })
      .catch((err: Error) => setAliasesError(err.message))
      .finally(() => setDeletingAlias(false))
  }

  const ruleColumns: Column<RuleRow>[] = [
    { key: 'priority', header: '#', className: 'w-10' },
    { key: 'description', header: 'Description' },
    { key: 'action', header: 'Action', render: (row) => actionBadge(row.action as FirewallRule['action']) },
    { key: 'protocol', header: 'Protocol', render: (row) => (row.protocol as string) ?? 'any' },
    { key: 'source', header: 'Source', render: (row) => (row.source as string) ?? 'any' },
    { key: 'destination', header: 'Destination', render: (row) => (row.destination as string) ?? 'any' },
    { key: 'interface', header: 'Interface', render: (row) => (row.interface as string) ?? 'any' },
    {
      key: 'actions',
      header: '',
      className: 'w-36 text-right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditRule(row as unknown as FirewallRule)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteRuleId(row.id as string)}
          >
            Delete
          </Button>
        </div>
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
          onClick={() => setDeleteAliasName(row.name)}
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
          keyField="name"
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
            onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value || null })}
          />
          <FormField
            id="rule-priority"
            label="Priority"
            type="number"
            placeholder="100 (lower number = higher priority)"
            value={String(ruleForm.priority ?? 100)}
            onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value, 10) || 100 })}
          />
          <FormField
            id="rule-action"
            label="Action"
            as="select"
            value={ruleForm.action ?? 'accept'}
            onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value as FirewallRule['action'] })}
          >
            <option value="accept">Accept</option>
            <option value="drop">Drop</option>
            <option value="reject">Reject</option>
            <option value="log">Log only (then accept)</option>
          </FormField>
            label="Protocol"
            as="select"
            value={ruleForm.protocol ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, protocol: (e.target.value || null) as FirewallRule['protocol'] | null })}
          >
            <option value="">Any</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
            <option value="icmpv6">ICMPv6</option>
          </FormField>
          <FormField
            id="rule-iface"
            label="Interface"
            placeholder="Leave blank for any (e.g. eth0)"
            value={ruleForm.interface ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, interface: e.target.value || null })}
          />
          <FormField
            id="rule-src"
            label="Source CIDR"
            placeholder="Leave blank for any (e.g. 192.168.1.0/24)"
            value={ruleForm.source ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, source: e.target.value || null })}
          />
          <FormField
            id="rule-src-port"
            label="Source Port"
            type="number"
            placeholder="Leave blank for any (1–65535)"
            value={ruleForm.source_port != null ? String(ruleForm.source_port) : ''}
            onChange={(e) => setRuleForm({ ...ruleForm, source_port: e.target.value ? parseInt(e.target.value, 10) : null })}
          />
          <FormField
            id="rule-dst"
            label="Destination CIDR"
            placeholder="Leave blank for any (e.g. 10.0.0.0/8)"
            value={ruleForm.destination ?? ''}
            onChange={(e) => setRuleForm({ ...ruleForm, destination: e.target.value || null })}
          />
          <FormField
            id="rule-dst-port"
            label="Destination Port"
            type="number"
            placeholder="Leave blank for any (1–65535)"
            value={ruleForm.destination_port != null ? String(ruleForm.destination_port) : ''}
            onChange={(e) => setRuleForm({ ...ruleForm, destination_port: e.target.value ? parseInt(e.target.value, 10) : null })}
          />
        </div>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        open={editRule !== null}
        title="Edit Firewall Rule"
        onClose={() => setEditRule(null)}
        onConfirm={handleUpdateRule}
        confirmLabel="Save Changes"
        loading={editSaving}
        size="xl"
      >
        {editRule && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="edit-rule-desc"
              label="Description"
              className="col-span-2"
              placeholder="Brief rule description"
              value={editRule.description ?? ''}
              onChange={(e) => setEditRule({ ...editRule, description: e.target.value || null })}
            />
            <FormField
              id="edit-rule-priority"
              label="Priority"
              type="number"
              placeholder="100"
              value={String(editRule.priority)}
              onChange={(e) => setEditRule({ ...editRule, priority: parseInt(e.target.value, 10) || 100 })}
            />
            <FormField
              id="edit-rule-action"
              label="Action"
              as="select"
              value={editRule.action}
              onChange={(e) => setEditRule({ ...editRule, action: e.target.value as FirewallRule['action'] })}
            >
              <option value="accept">Accept</option>
              <option value="drop">Drop</option>
              <option value="reject">Reject</option>
              <option value="log">Log only (then accept)</option>
            </FormField>
            <FormField
              id="edit-rule-protocol"
              label="Protocol"
              as="select"
              value={editRule.protocol ?? ''}
              onChange={(e) => setEditRule({ ...editRule, protocol: (e.target.value || null) as FirewallRule['protocol'] | null })}
            >
              <option value="">Any</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
              <option value="icmpv6">ICMPv6</option>
            </FormField>
            <FormField
              id="edit-rule-iface"
              label="Interface"
              placeholder="Leave blank for any"
              value={editRule.interface ?? ''}
              onChange={(e) => setEditRule({ ...editRule, interface: e.target.value || null })}
            />
            <FormField
              id="edit-rule-src"
              label="Source CIDR"
              placeholder="Leave blank for any"
              value={editRule.source ?? ''}
              onChange={(e) => setEditRule({ ...editRule, source: e.target.value || null })}
            />
            <FormField
              id="edit-rule-src-port"
              label="Source Port"
              type="number"
              placeholder="Leave blank for any"
              value={editRule.source_port != null ? String(editRule.source_port) : ''}
              onChange={(e) => setEditRule({ ...editRule, source_port: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
            <FormField
              id="edit-rule-dst"
              label="Destination CIDR"
              placeholder="Leave blank for any"
              value={editRule.destination ?? ''}
              onChange={(e) => setEditRule({ ...editRule, destination: e.target.value || null })}
            />
            <FormField
              id="edit-rule-dst-port"
              label="Destination Port"
              type="number"
              placeholder="Leave blank for any"
              value={editRule.destination_port != null ? String(editRule.destination_port) : ''}
              onChange={(e) => setEditRule({ ...editRule, destination_port: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
          </div>
        )}
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
            value={aliasForm.alias_type}
            onChange={(e) => setAliasForm({ ...aliasForm, alias_type: e.target.value as AliasType })}
          >
            <option value="host">Host (IP addresses)</option>
            <option value="network">Network (CIDR prefixes)</option>
            <option value="port">Port (numbers / ranges)</option>
            <option value="urltable">URL Table (remote IP list)</option>
          </FormField>
          <FormField
            id="alias-desc"
            label="Description"
            placeholder="Optional description"
            value={aliasForm.description ?? ''}
            onChange={(e) => setAliasForm({ ...aliasForm, description: e.target.value || null })}
          />
          <FormField
            id="alias-values"
            label="Entries"
            as="textarea"
            rows={4}
            hint="One IP, CIDR, port, or URL per line"
            value={aliasForm.values.join('\n')}
            onChange={(e) =>
              setAliasForm({
                ...aliasForm,
                values: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      </Modal>

      {/* Delete Alias Modal */}
      <Modal
        open={deleteAliasName !== null}
        title="Delete Alias"
        onClose={() => setDeleteAliasName(null)}
        onConfirm={handleDeleteAlias}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingAlias}
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Deleting this alias will cause any firewall rules that reference it by name to fail
          validation. This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
