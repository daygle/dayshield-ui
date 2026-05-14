import { useEffect, useState, useCallback } from 'react'
import {
  getSuricataRulesetRules,
  updateSuricataRulesetDisabledRules,
  type RulesetRule,
} from '../../api/suricata'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import FormField from '../../components/FormField'

interface ManageRulesModalProps {
  open: boolean
  rulesetId: string | null
  rulesetName: string | null
  onClose: () => void
  onSaved: () => void
}

export function ManageRulesModal({ open, rulesetId, rulesetName, onClose, onSaved }: ManageRulesModalProps) {
  const [rules, setRules] = useState<RulesetRule[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [disabledRuleIds, setDisabledRuleIds] = useState<Set<string>>(new Set())

  // Load rules when modal opens
  useEffect(() => {
    if (!open || !rulesetId) {
      return
    }

    setLoading(true)
    setError(null)

    getSuricataRulesetRules(rulesetId)
      .then((res) => {
        const ruleList = res.data ?? []
        setRules(ruleList)
        // Initialize disabled set based on enabled flag
        const disabled = new Set<string>()
        ruleList.forEach((rule) => {
          if (!rule.enabled) {
            disabled.add(rule.id)
          }
        })
        setDisabledRuleIds(disabled)
      })
      .catch((err: Error) => {
        setError(`Failed to load rules: ${err.message}`)
      })
      .finally(() => setLoading(false))
  }, [open, rulesetId])

  const toggleRule = useCallback((ruleId: string) => {
    setDisabledRuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(ruleId)) {
        next.delete(ruleId)
      } else {
        next.add(ruleId)
      }
      return next
    })
  }, [])

  const handleSave = async () => {
    if (!rulesetId) return

    setSaving(true)
    setError(null)

    try {
      await updateSuricataRulesetDisabledRules(rulesetId, Array.from(disabledRuleIds))
      onSaved()
      onClose()
    } catch (err) {
      setError(`Failed to save rules: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const filteredRules = rules.filter((rule) => {
    const term = searchTerm.toLowerCase()
    return (
      rule.id.toLowerCase().includes(term) ||
      rule.signature.toLowerCase().includes(term) ||
      rule.action.toLowerCase().includes(term)
    )
  })

  const disabledCount = disabledRuleIds.size
  const enabledCount = rules.length - disabledCount

  return (
    <Modal open={open} title={`Manage Rules - ${rulesetName || rulesetId}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="font-medium">{rules.length}</span> total rules
          </div>
          <div>
            <span className="font-medium text-green-600">{enabledCount}</span> enabled
          </div>
          <div>
            <span className="font-medium text-red-600">{disabledCount}</span> disabled
          </div>
        </div>

        {/* Search */}
        <FormField label="Search" type="text" placeholder="Search by rule ID or signature..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />

        {/* Error message */}
        {error && <div className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        {/* Rules table */}
        <div className="max-h-96 overflow-y-auto rounded border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <span className="text-gray-500">Loading rules...</span>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <span className="text-gray-500">{searchTerm ? 'No matching rules found.' : 'No rules available.'}</span>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Enabled</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">ID</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Signature</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => {
                  const isDisabled = disabledRuleIds.has(rule.id)
                  return (
                    <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={!isDisabled}
                            onChange={() => toggleRule(rule.id)}
                            className="rounded"
                          />
                          <span className="ml-2 text-xs text-gray-500">{!isDisabled ? 'On' : 'Off'}</span>
                        </label>
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-gray-700">{rule.id}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          rule.action === 'drop' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {rule.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600 break-words max-w-xs">{rule.signature}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}
