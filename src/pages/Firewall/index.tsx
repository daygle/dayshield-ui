import { useEffect, useState } from 'react'
import { getFirewallRules, createFirewallRule } from '../../api/client'
import type { FirewallRule } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Table, { Column } from '../../components/Table'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

// TODO: Implement edit rule functionality (PUT /firewall/rules/:id)
// TODO: Implement delete rule functionality (DELETE /firewall/rules/:id)
// TODO: Implement drag-and-drop rule reordering
// TODO: Add rule groups / categories
// TODO: Add rule hit counters (packet/byte counts)
// TODO: Add bulk enable/disable rules

type RuleRow = FirewallRule & Record<string, unknown>

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

const columns: Column<RuleRow>[] = [
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
  { key: 'interface', header: 'Interface', render: (row) => row.interface ?? 'any' },
]

const defaultForm: Partial<FirewallRule> = {
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

export default function Firewall() {
  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<FirewallRule>>(defaultForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    getFirewallRules()
      .then((res) => setRules(res.data as RuleRow[]))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = () => {
    setSaving(true)
    createFirewallRule(form as Omit<FirewallRule, 'id'>)
      .then(() => {
        setModalOpen(false)
        setForm(defaultForm)
        load()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-4">
      <Card
        title="Firewall Rules"
        subtitle="Define allow / deny rules evaluated top-to-bottom"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            + Add Rule
          </Button>
        }
      >
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <Table
          columns={columns}
          data={rules}
          keyField="id"
          loading={loading}
          emptyMessage="No firewall rules defined."
        />
      </Card>

      {/* Add Rule Modal */}
      <Modal
        open={modalOpen}
        title="Add Firewall Rule"
        onClose={() => setModalOpen(false)}
        onConfirm={handleSave}
        confirmLabel="Create Rule"
        loading={saving}
        size="xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="rule-desc"
            label="Description"
            className="col-span-2"
            placeholder="Brief rule description"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <FormField
            id="rule-action"
            label="Action"
            as="select"
            value={form.action ?? 'allow'}
            onChange={(e) => setForm({ ...form, action: e.target.value as FirewallRule['action'] })}
          >
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
            <option value="reject">Reject</option>
          </FormField>
          <FormField
            id="rule-direction"
            label="Direction"
            as="select"
            value={form.direction ?? 'in'}
            onChange={(e) => setForm({ ...form, direction: e.target.value as FirewallRule['direction'] })}
          >
            <option value="in">Inbound</option>
            <option value="out">Outbound</option>
            <option value="both">Both</option>
          </FormField>
          <FormField
            id="rule-protocol"
            label="Protocol"
            as="select"
            value={form.protocol ?? 'tcp'}
            onChange={(e) => setForm({ ...form, protocol: e.target.value as FirewallRule['protocol'] })}
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
            value={form.interface ?? ''}
            onChange={(e) => setForm({ ...form, interface: e.target.value })}
          />
          <FormField
            id="rule-src"
            label="Source"
            placeholder="any / 192.168.1.0/24"
            value={form.source ?? 'any'}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          />
          <FormField
            id="rule-src-port"
            label="Source Port"
            placeholder="any / 80 / 1024:65535"
            value={form.sourcePort ?? ''}
            onChange={(e) => setForm({ ...form, sourcePort: e.target.value })}
          />
          <FormField
            id="rule-dst"
            label="Destination"
            placeholder="any / 10.0.0.1"
            value={form.destination ?? 'any'}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
          />
          <FormField
            id="rule-dst-port"
            label="Destination Port"
            placeholder="any / 443"
            value={form.destinationPort ?? ''}
            onChange={(e) => setForm({ ...form, destinationPort: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  )
}
