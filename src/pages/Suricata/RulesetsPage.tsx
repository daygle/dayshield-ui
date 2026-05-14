import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getSuricataRulesets,
  getSuricataRulesetRules,
  installSuricataRuleset,
  updateSuricataRuleset,
  updateSuricataRulesetDisabledRules,
  type RulesetRule,
} from '../../api/suricata'
import type { SuricataRuleset } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import ErrorBoundary from '../../components/ErrorBoundary'

type RulesetGroup = {
  label: string
  rulesets: SuricataRuleset[]
}

const rulesetKey = (id: string | number) => String(id)

const groupLabelFor = (ruleset: SuricataRuleset): string => {
  if (ruleset.installed) return ruleset.vendor ?? 'Installed'
  return ruleset.vendor ?? 'Available'
}

const groupSort = (a: string, b: string): number => {
  if (a === 'Installed') return -1
  if (b === 'Installed') return 1
  if (a === 'Available') return -1
  if (b === 'Available') return 1
  return a.localeCompare(b)
}

function RulesetsPageContent() {
  const [rulesets, setRulesets] = useState<SuricataRuleset[]>([])
  const [loading, setLoading] = useState(true)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>('')
  const [rules, setRules] = useState<RulesetRule[]>([])
  const [disabledRuleIds, setDisabledRuleIds] = useState<Set<string>>(new Set())
  const [rulesSearch, setRulesSearch] = useState('')

  const loadRulesets = useCallback(() => {
    setLoading(true)
    return getSuricataRulesets()
      .then((res) => {
        const nextRulesets = res.data ?? []
        setRulesets(nextRulesets)
        setError(null)

        if (nextRulesets.length === 0) {
          setSelectedGroup('')
          setSelectedRulesetId('')
          return
        }

        const groups = new Map<string, SuricataRuleset[]>()
        for (const ruleset of nextRulesets) {
          const label = groupLabelFor(ruleset)
          const current = groups.get(label) ?? []
          current.push(ruleset)
          groups.set(label, current)
        }

        const orderedGroups = Array.from(groups.keys()).sort(groupSort)
        const defaultGroup = orderedGroups[0] ?? ''
        const defaultRuleset = groups.get(defaultGroup)?.[0]

        setSelectedGroup((prev) => (prev && groups.has(prev) ? prev : defaultGroup))
        setSelectedRulesetId((prev) => {
          const prevExists = nextRulesets.some((ruleset) => rulesetKey(ruleset.id) === prev)
          return prevExists ? prev : rulesetKey(defaultRuleset?.id ?? '')
        })
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadRulesets()
  }, [loadRulesets])

  const groupedRulesets = useMemo(() => {
    const groups = new Map<string, SuricataRuleset[]>()
    for (const ruleset of rulesets) {
      const label = groupLabelFor(ruleset)
      const current = groups.get(label) ?? []
      current.push(ruleset)
      groups.set(label, current)
    }

    return Array.from(groups.entries())
      .map(([label, groupRulesets]): RulesetGroup => ({
        label,
        rulesets: groupRulesets.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => groupSort(a.label, b.label))
  }, [rulesets])

  const visibleGroups = useMemo(
    () => groupedRulesets.filter((group) => group.label.toLowerCase().includes(searchTerm.toLowerCase()) || group.rulesets.some((ruleset) => ruleset.name.toLowerCase().includes(searchTerm.toLowerCase()))),
    [groupedRulesets, searchTerm],
  )

  const selectedGroupRulesets = useMemo(
    () => groupedRulesets.find((group) => group.label === selectedGroup)?.rulesets ?? [],
    [groupedRulesets, selectedGroup],
  )

  const selectedRuleset = useMemo(
    () => rulesets.find((ruleset) => rulesetKey(ruleset.id) === selectedRulesetId) ?? null,
    [rulesets, selectedRulesetId],
  )

  const loadSelectedRules = useCallback((rulesetId: string) => {
    if (!rulesetId) return
    setRulesLoading(true)
    getSuricataRulesetRules(rulesetId)
      .then((res) => {
        const nextRules = res.data ?? []
        setRules(nextRules)
        const disabled = new Set<string>()
        nextRules.forEach((rule) => {
          if (!rule.enabled) disabled.add(rule.id)
        })
        setDisabledRuleIds(disabled)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setRulesLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedRulesetId) return
    loadSelectedRules(selectedRulesetId)
  }, [selectedRulesetId, loadSelectedRules])

  const handleSelectGroup = (label: string) => {
    setSelectedGroup(label)
    const nextRuleset = groupedRulesets.find((group) => group.label === label)?.rulesets[0]
    setSelectedRulesetId(nextRuleset ? rulesetKey(nextRuleset.id) : '')
  }

  const handleSelectRuleset = (ruleset: SuricataRuleset) => {
    setSelectedGroup(groupLabelFor(ruleset))
    setSelectedRulesetId(rulesetKey(ruleset.id))
  }

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

  const saveRules = async () => {
    if (!selectedRulesetId) return
    setSaving(true)
    setSuccess(null)
    setError(null)
    try {
      await updateSuricataRulesetDisabledRules(selectedRulesetId, Array.from(disabledRuleIds))
      setSuccess(`Saved rules for ${selectedRuleset?.name ?? selectedRulesetId}.`)
      await loadRulesets()
      loadSelectedRules(selectedRulesetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const filteredRules = rules.filter((rule) => {
    const term = rulesSearch.toLowerCase()
    return rule.id.toLowerCase().includes(term) || rule.signature.toLowerCase().includes(term) || rule.action.toLowerCase().includes(term)
  })

  const installedCount = rulesets.filter((ruleset) => ruleset.installed).length
  const availableCount = rulesets.length - installedCount
  const disabledCount = disabledRuleIds.size

  return (
    <div className="space-y-6">
      <Card
        title="Suricata Rulesets"
        subtitle="Browse bundled ruleset groups, drill into a ruleset, and enable or disable individual rules"
        actions={
          <Button variant="secondary" size="sm" onClick={loadRulesets} loading={loading}>
            Refresh
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Total Rulesets</div>
            <div className="text-lg font-semibold text-gray-900">{rulesets.length}</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Installed</div>
            <div className="text-lg font-semibold text-green-700">{installedCount}</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Available</div>
            <div className="text-lg font-semibold text-amber-700">{availableCount}</div>
          </div>
        </div>
      </Card>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-[280px_360px_1fr]">
        <Card title="Categories" subtitle="Grouped by source vendor">
          <FormField
            label="Search categories"
            type="text"
            placeholder="Filter categories or rulesets"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="mt-4 space-y-2">
            {visibleGroups.map((group) => (
              <button
                key={group.label}
                type="button"
                onClick={() => handleSelectGroup(group.label)}
                className={`w-full rounded border px-4 py-3 text-left transition-colors ${
                  selectedGroup === group.label
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900">{group.label}</div>
                    <div className="text-xs text-gray-500">{group.rulesets.length} ruleset{group.rulesets.length === 1 ? '' : 's'}</div>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {group.rulesets.reduce((count, ruleset) => count + (ruleset.installed ? 1 : 0), 0)} installed
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Ruleset List" subtitle={selectedGroup || 'Select a category'}>
          <div className="space-y-2">
            {selectedGroupRulesets.map((ruleset) => (
              <button
                key={rulesetKey(ruleset.id)}
                type="button"
                onClick={() => handleSelectRuleset(ruleset)}
                className={`w-full rounded border px-4 py-3 text-left transition-colors ${
                  selectedRulesetId === rulesetKey(ruleset.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{ruleset.name}</div>
                    <div className="mt-1 text-xs text-gray-500 break-all">{ruleset.source}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${ruleset.installed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {ruleset.installed ? 'Installed' : 'Available'}
                    </span>
                    {ruleset.updateAvailable && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Update available</span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!ruleset.installed ? (
                    <Button size="sm" variant="primary" onClick={(event) => { event.stopPropagation(); installSuricataRuleset(ruleset.id).then(() => loadRulesets()) }}>
                      Install
                    </Button>
                  ) : (
                    <Button size="sm" variant={ruleset.enabled ? 'secondary' : 'primary'} onClick={(event) => { event.stopPropagation(); updateSuricataRuleset(ruleset.id, { enabled: !ruleset.enabled }).then(() => loadRulesets()) }}>
                      {ruleset.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </div>
              </button>
            ))}
            {selectedGroupRulesets.length === 0 && (
              <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                No rulesets in this category.
              </div>
            )}
          </div>
        </Card>

        <Card
          title={selectedRuleset ? selectedRuleset.name : 'Rule Details'}
          subtitle={selectedRuleset ? `${rules.length} rules in this ruleset` : 'Select a ruleset to drill into its rules'}
          actions={selectedRuleset ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{disabledCount} disabled</span> : undefined}
        >
          {!selectedRuleset ? (
            <div className="text-sm text-gray-500">Choose a ruleset on the left to inspect and toggle individual rules.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-gray-500">Category</div>
                  <div className="font-medium text-gray-900">{groupLabelFor(selectedRuleset)}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-gray-500">Status</div>
                  <div className="font-medium text-gray-900">{selectedRuleset.installed ? (selectedRuleset.enabled ? 'Enabled' : 'Disabled') : 'Available'}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-gray-500">Version</div>
                  <div className="font-medium text-gray-900">{selectedRuleset.installedVersion ?? selectedRuleset.latestVersion ?? '-'}</div>
                </div>
              </div>

              <FormField
                label="Search rules"
                type="text"
                placeholder="Search by rule ID, action, or signature"
                value={rulesSearch}
                onChange={(e) => setRulesSearch(e.target.value)}
              />

              {rulesLoading ? (
                <div className="rounded border border-gray-200 px-4 py-6 text-sm text-gray-500">Loading rules…</div>
              ) : (
                <div className="max-h-[36rem] overflow-auto rounded border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        <th className="px-4 py-3">Enabled</th>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRules.map((rule) => {
                        const isDisabled = disabledRuleIds.has(rule.id)
                        return (
                          <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={!isDisabled} onChange={() => toggleRule(rule.id)} />
                                <span className="text-xs text-gray-500">{isDisabled ? 'Off' : 'On'}</span>
                              </label>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{rule.id}</td>
                            <td className="px-4 py-3 text-xs uppercase text-gray-600">{rule.action}</td>
                            <td className="px-4 py-3 text-xs text-gray-700">{rule.signature}</td>
                          </tr>
                        )
                      })}
                      {filteredRules.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-sm text-gray-500" colSpan={4}>
                            No matching rules.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
                <div className="text-xs text-gray-500">
                  {disabledCount} disabled, {rules.length - disabledCount} enabled
                </div>
                <div className="flex gap-2">
                  <Link to="/suricata" className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Back to Suricata
                  </Link>
                  <Button variant="primary" onClick={saveRules} loading={saving}>
                    Save Rules
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function SuricataRulesetsPage() {
  return (
    <ErrorBoundary fallbackMessage="The Suricata rulesets page failed to render. Please refresh and try again.">
      <RulesetsPageContent />
    </ErrorBoundary>
  )
}