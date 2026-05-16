import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

type RulesetSubgroup = {
  label: string
  rulesets: SuricataRuleset[]
}

type RulesetSubgroupSummary = RulesetSubgroup & {
  familyLabel: string
}

type GroupAction = 'install' | 'enable' | 'disable'

const rulesetKey = (id: string | number) => String(id)

const labelFromSlug = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (trimmed === 'et-open') return 'ET open'
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const familyLabelFor = (ruleset: SuricataRuleset): string => {
  const id = String(ruleset.id)
  const vendor = ruleset.vendor?.trim() ?? ''

  if (id.includes('/')) {
    return labelFromSlug(id.split('/')[0] ?? id)
  }

  if (vendor.toLowerCase().includes('emerging threats') || id.startsWith('et-')) {
    return 'ET open'
  }

  return vendor || 'Available'
}

const rulesetPathLabelFor = (ruleset: SuricataRuleset): string => {
  const id = String(ruleset.id)
  const parts = id.split('/').filter(Boolean)
  if (parts.length > 1) {
    return parts.map(labelFromSlug).join(' / ')
  }

  return ruleset.name
}

const sourceFileBasename = (source: string): string | null => {
  const trimmed = source.trim()
  if (!trimmed) return null

  const path = (() => {
    try {
      return new URL(trimmed).pathname
    } catch {
      return trimmed.split('?')[0]?.split('#')[0] ?? trimmed
    }
  })()

  const file = path.split('/').filter(Boolean).pop()
  if (!file) return null

  if (file.endsWith('.rules')) return file.slice(0, -6)
  if (file.endsWith('.rules.gz')) return file.slice(0, -9)
  return file
}

const subgroupLabelFor = (ruleset: SuricataRuleset): string => {
  const family = familyLabelFor(ruleset)
  if (family !== 'ET open') return 'General'

  const normalizeEtGroupLabel = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return 'et-open.rules'
    return trimmed.endsWith('.rules') ? trimmed : `${trimmed}.rules`
  }

  const idParts = String(ruleset.id).split('/').filter(Boolean)
  if (idParts.length > 1 && idParts[1]) {
    return normalizeEtGroupLabel(idParts[1])
  }

  const basename = sourceFileBasename(ruleset.source)
  if (basename && basename.startsWith('emerging-')) {
    return normalizeEtGroupLabel(basename)
  }

  return 'et-open.rules'
}

const subgroupSort = (a: string, b: string): number => {
  if (a === 'General') return -1
  if (b === 'General') return 1
  return a.localeCompare(b)
}

const groupSort = (a: string, b: string): number => {
  if (a === 'Installed') return -1
  if (b === 'Installed') return 1
  if (a === 'ET open') return -1
  if (b === 'ET open') return 1
  if (a === 'Available') return -1
  if (b === 'Available') return 1
  return a.localeCompare(b)
}

const buildRulesetGroups = (rulesets: SuricataRuleset[]): RulesetGroup[] => {
  const groups = new Map<string, SuricataRuleset[]>()
  for (const ruleset of rulesets) {
    const label = familyLabelFor(ruleset)
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
}

const buildRulesetSubgroups = (rulesets: SuricataRuleset[]): RulesetSubgroup[] => {
  const groups = new Map<string, SuricataRuleset[]>()
  for (const ruleset of rulesets) {
    const label = subgroupLabelFor(ruleset)
    const current = groups.get(label) ?? []
    current.push(ruleset)
    groups.set(label, current)
  }

  return Array.from(groups.entries())
    .map(([label, subgroupRulesets]): RulesetSubgroup => ({
      label,
      rulesets: subgroupRulesets.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => subgroupSort(a.label, b.label))
}

const getGroupAction = (rulesets: SuricataRuleset[]): GroupAction | null => {
  if (!rulesets.length) return null
  if (rulesets.some((ruleset) => !ruleset.installed)) return 'install'
  if (rulesets.some((ruleset) => !ruleset.enabled)) return 'enable'
  if (rulesets.some((ruleset) => ruleset.enabled)) return 'disable'
  return null
}

const groupActionLabel: Record<GroupAction, string> = {
  install: 'Install',
  enable: 'Enable',
  disable: 'Disable',
}

const runGroupAction = async (rulesets: SuricataRuleset[], action: GroupAction) => {
  if (action === 'install') {
    await Promise.all(
      rulesets
        .filter((ruleset) => !ruleset.installed)
        .map((ruleset) => installSuricataRuleset(ruleset.id)),
    )
    return
  }

  const enabled = action === 'enable'
  await Promise.all(
    rulesets
      .filter((ruleset) => Boolean(ruleset.installed) && ruleset.enabled !== enabled)
      .map((ruleset) => updateSuricataRuleset(ruleset.id, { enabled })),
  )
}

function RulesetsPageContent({ embedded = false }: { embedded?: boolean }) {
  const [searchParams] = useSearchParams()
  const scopedFamily = embedded ? '' : searchParams.get('group') ?? ''
  const scopedSubgroup = embedded ? '' : searchParams.get('subgroup') ?? ''
  const scopedToSubgroup = Boolean(scopedFamily && scopedSubgroup)

  const [rulesets, setRulesets] = useState<SuricataRuleset[]>([])
  const [loading, setLoading] = useState(true)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>('')
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>('')
  const [rules, setRules] = useState<RulesetRule[]>([])
  const [rulesHint, setRulesHint] = useState<string | null>(null)
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
          setSelectedSubgroup('')
          setSelectedRulesetId('')
          return
        }

        const groups = buildRulesetGroups(nextRulesets)
        const defaultGroup = groups[0]?.label ?? ''
        const defaultGroupRulesets = groups[0]?.rulesets ?? []
        const defaultSubgroup = buildRulesetSubgroups(defaultGroupRulesets)[0]?.label ?? ''
        const defaultRuleset =
          defaultGroupRulesets.find((ruleset) => subgroupLabelFor(ruleset) === defaultSubgroup) ??
          defaultGroupRulesets[0]

        setSelectedGroup((prev) =>
          prev && groups.some((group) => group.label === prev) ? prev : defaultGroup,
        )
        setSelectedSubgroup((prev) => {
          const prevExists = nextRulesets.some(
            (ruleset) =>
              familyLabelFor(ruleset) === defaultGroup && subgroupLabelFor(ruleset) === prev,
          )
          return prevExists ? prev : defaultSubgroup
        })
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

  const groupedRulesets = useMemo(() => buildRulesetGroups(rulesets), [rulesets])

  const visibleGroups = useMemo(
    () =>
      groupedRulesets.filter(
        (group) =>
          group.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.rulesets.some(
            (ruleset) =>
              ruleset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              subgroupLabelFor(ruleset).toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      ),
    [groupedRulesets, searchTerm],
  )

  const selectedGroupRulesets = useMemo(
    () => groupedRulesets.find((group) => group.label === selectedGroup)?.rulesets ?? [],
    [groupedRulesets, selectedGroup],
  )

  const selectedGroupSubgroups = useMemo(
    () => buildRulesetSubgroups(selectedGroupRulesets),
    [selectedGroupRulesets],
  )

  const selectedSubgroupRulesets = useMemo(
    () =>
      selectedGroupSubgroups.find((subgroup) => subgroup.label === selectedSubgroup)?.rulesets ??
      [],
    [selectedGroupSubgroups, selectedSubgroup],
  )

  const selectedRuleset = useMemo(
    () => rulesets.find((ruleset) => rulesetKey(ruleset.id) === selectedRulesetId) ?? null,
    [rulesets, selectedRulesetId],
  )

  useEffect(() => {
    if (!scopedToSubgroup) return

    const scopedGroupEntry = groupedRulesets.find((group) => group.label === scopedFamily)
    if (!scopedGroupEntry) return

    if (selectedGroup !== scopedFamily) {
      setSelectedGroup(scopedFamily)
      return
    }

    const scopedSubgroupEntry = buildRulesetSubgroups(scopedGroupEntry.rulesets).find(
      (subgroup) => subgroup.label === scopedSubgroup,
    )
    if (!scopedSubgroupEntry) return

    if (selectedSubgroup !== scopedSubgroup) {
      setSelectedSubgroup(scopedSubgroup)
      return
    }

    if (!scopedSubgroupEntry.rulesets.some((ruleset) => rulesetKey(ruleset.id) === selectedRulesetId)) {
      setSelectedRulesetId(rulesetKey(scopedSubgroupEntry.rulesets[0]?.id ?? ''))
    }
  }, [
    groupedRulesets,
    scopedFamily,
    scopedSubgroup,
    scopedToSubgroup,
    selectedGroup,
    selectedRulesetId,
    selectedSubgroup,
  ])

  useEffect(() => {
    if (selectedGroupSubgroups.length === 0) {
      setSelectedSubgroup('')
      return
    }

    const exists = selectedGroupSubgroups.some((subgroup) => subgroup.label === selectedSubgroup)
    if (!exists) {
      setSelectedSubgroup(selectedGroupSubgroups[0].label)
    }
  }, [selectedGroupSubgroups, selectedSubgroup])

  useEffect(() => {
    if (!selectedSubgroupRulesets.length) {
      setSelectedRulesetId('')
      return
    }

    const exists = selectedSubgroupRulesets.some(
      (ruleset) => rulesetKey(ruleset.id) === selectedRulesetId,
    )
    if (!exists) {
      setSelectedRulesetId(rulesetKey(selectedSubgroupRulesets[0].id))
    }
  }, [selectedSubgroupRulesets, selectedRulesetId])

  const loadSelectedRules = useCallback((rulesetId: string) => {
    if (!rulesetId) return
    setRulesLoading(true)
    setRulesHint(null)
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
      .catch((err: Error) => {
        const message = err.message ?? String(err)
        if (/rules file not found/i.test(message)) {
          setRules([])
          setDisabledRuleIds(new Set())
          setRulesHint(
            'No downloaded rules are available for this ruleset yet. Install and enable the ruleset to load rule contents.',
          )
          setError(null)
          return
        }
        setRulesHint(null)
        setError(message)
      })
      .finally(() => setRulesLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedRulesetId) return
    if (!selectedRuleset?.installed) {
      setRules([])
      setDisabledRuleIds(new Set())
      setRulesHint('This ruleset is not installed yet. Click Install to download its rules.')
      setError(null)
      return
    }
    loadSelectedRules(selectedRulesetId)
  }, [selectedRulesetId, selectedRuleset, loadSelectedRules])

  const handleSelectGroup = (label: string) => {
    setSelectedGroup(label)
    const nextGroupRulesets = groupedRulesets.find((group) => group.label === label)?.rulesets ?? []
    const subgroups = buildRulesetSubgroups(nextGroupRulesets)
    const nextSubgroup = subgroups[0]?.label ?? ''
    const nextRuleset =
      nextGroupRulesets.find((ruleset) => subgroupLabelFor(ruleset) === nextSubgroup) ??
      nextGroupRulesets[0]
    setSelectedSubgroup(nextSubgroup)
    setSelectedRulesetId(nextRuleset ? rulesetKey(nextRuleset.id) : '')
  }

  const handleSelectSubgroup = (label: string) => {
    setSelectedSubgroup(label)
    const nextRuleset = selectedGroupSubgroups.find((subgroup) => subgroup.label === label)?.rulesets[0]
    setSelectedRulesetId(nextRuleset ? rulesetKey(nextRuleset.id) : '')
  }

  const handleSelectRuleset = (ruleset: SuricataRuleset) => {
    setSelectedGroup(familyLabelFor(ruleset))
    setSelectedSubgroup(subgroupLabelFor(ruleset))
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
    return (
      rule.id.toLowerCase().includes(term) ||
      rule.signature.toLowerCase().includes(term) ||
      rule.action.toLowerCase().includes(term)
    )
  })

  const installedCount = rulesets.filter((ruleset) => ruleset.installed).length
  const disabledCount = disabledRuleIds.size

  return (
    <div className="space-y-6">
      <Card
        title="Suricata Rulesets"
        subtitle={
          scopedToSubgroup
            ? `Showing rulesets in ${scopedFamily} / ${scopedSubgroup}`
            : 'Browse ruleset families first, then drill into packages and individual rules'
        }
        actions={
          <div className="flex items-center gap-2">
            {!embedded && (
              <Link
                to="/suricata"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Suricata
              </Link>
            )}
            <Button variant="secondary" size="sm" onClick={loadRulesets} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Total Rulesets</div>
            <div className="text-lg font-semibold text-gray-900">{rulesets.length}</div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-gray-500">Installed</div>
            <div className="text-lg font-semibold text-green-700">{installedCount}</div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div
        className={
          scopedToSubgroup
            ? 'grid gap-6 lg:grid-cols-[360px_1fr]'
            : 'grid gap-6 lg:grid-cols-[280px_360px_1fr]'
        }
      >
        {!scopedToSubgroup && (
          <Card title="Rule Families" subtitle="Top-level groupings like ET open or OISF">
            <FormField
              label="Search families"
              type="text"
              placeholder="Filter families or packages"
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
                      <div className="text-xs text-gray-500">
                        {group.rulesets.length} ruleset{group.rulesets.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {
                        group.rulesets.reduce(
                          (count, ruleset) => count + (ruleset.installed ? 1 : 0),
                          0,
                        )
                      }{' '}
                      installed
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {!scopedToSubgroup && (
          <Card title="Ruleset Groups" subtitle={selectedGroup || 'Select a family'}>
            <div className="space-y-2">
              {selectedGroupSubgroups.map((subgroup) => (
                <button
                  key={subgroup.label}
                  type="button"
                  onClick={() => handleSelectSubgroup(subgroup.label)}
                  className={`w-full rounded border px-4 py-3 text-left transition-colors ${
                    selectedSubgroup === subgroup.label
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-gray-900">{subgroup.label}</div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {subgroup.rulesets.length}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {subgroup.rulesets.reduce(
                      (count, ruleset) => count + (ruleset.installed ? 1 : 0),
                      0,
                    )}{' '}
                    installed
                  </div>
                </button>
              ))}
              {selectedGroupSubgroups.length === 0 && (
                <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  No groups in this family.
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-gray-200 pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Packages in {selectedSubgroup || 'group'}
              </div>
              <div className="space-y-2">
                {selectedSubgroupRulesets.map((ruleset) => (
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
                        <div className="mt-1 text-xs text-gray-500">
                          {familyLabelFor(ruleset)}/{subgroupLabelFor(ruleset)}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 break-all">{ruleset.source}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            ruleset.installed
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {ruleset.installed ? 'Installed' : 'Available'}
                        </span>
                        {ruleset.updateAvailable && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                            Update available
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!ruleset.installed ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(event) => {
                            event.stopPropagation()
                            installSuricataRuleset(ruleset.id).then(() => loadRulesets())
                          }}
                        >
                          Install
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={ruleset.enabled ? 'secondary' : 'primary'}
                          onClick={(event) => {
                            event.stopPropagation()
                            updateSuricataRuleset(ruleset.id, {
                              enabled: !ruleset.enabled,
                            }).then(() => loadRulesets())
                          }}
                        >
                          {ruleset.enabled ? 'Disable' : 'Enable'}
                        </Button>
                      )}
                    </div>
                  </button>
                ))}
                {selectedSubgroupRulesets.length === 0 && (
                  <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                    No rulesets in this group.
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {scopedToSubgroup && (
          <Card
            title={selectedSubgroup || 'Ruleset Group'}
            subtitle={selectedGroup || 'Select a group'}
          >
            <div className="space-y-2">
              {selectedSubgroupRulesets.map((ruleset) => (
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
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          ruleset.installed
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ruleset.installed ? 'Installed' : 'Available'}
                      </span>
                      {ruleset.updateAvailable && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                          Update available
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!ruleset.installed ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(event) => {
                          event.stopPropagation()
                          installSuricataRuleset(ruleset.id).then(() => loadRulesets())
                        }}
                      >
                        Install
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={ruleset.enabled ? 'secondary' : 'primary'}
                        onClick={(event) => {
                          event.stopPropagation()
                          updateSuricataRuleset(ruleset.id, {
                            enabled: !ruleset.enabled,
                          }).then(() => loadRulesets())
                        }}
                      >
                        {ruleset.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </div>
                </button>
              ))}
              {selectedSubgroupRulesets.length === 0 && (
                <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  No rulesets in this group.
                </div>
              )}
            </div>
          </Card>
        )}

        <Card
          title={selectedRuleset ? rulesetPathLabelFor(selectedRuleset) : 'Rule Details'}
          subtitle={
            selectedRuleset
              ? `${rules.length} rules in this ruleset`
              : 'Select a ruleset to drill into its rules'
          }
          actions={
            selectedRuleset ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {disabledCount} disabled
              </span>
            ) : undefined
          }
        >
          {!selectedRuleset ? (
            <div className="text-sm text-gray-500">
              Choose a ruleset on the left to inspect and toggle individual rules.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-gray-500">Family</div>
                  <div className="font-medium text-gray-900">{familyLabelFor(selectedRuleset)}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-gray-500">Status</div>
                  <div className="font-medium text-gray-900">
                    {selectedRuleset.installed
                      ? selectedRuleset.enabled
                        ? 'Enabled'
                        : 'Disabled'
                      : 'Available'}
                  </div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-gray-500">Version</div>
                  <div className="font-medium text-gray-900">
                    {selectedRuleset.installedVersion ?? selectedRuleset.latestVersion ?? '-'}
                  </div>
                </div>
              </div>

              <FormField
                label="Search rules"
                type="text"
                placeholder="Search by rule ID, action, or signature"
                value={rulesSearch}
                onChange={(e) => setRulesSearch(e.target.value)}
                disabled={!selectedRuleset.installed || Boolean(rulesHint)}
              />

              {rulesHint ? (
                <div className="rounded border border-blue-200 bg-blue-50 px-4 py-6 text-sm text-blue-800">
                  {rulesHint}
                </div>
              ) : rulesLoading ? (
                <div className="rounded border border-gray-200 px-4 py-6 text-sm text-gray-500">
                  Loading rules…
                </div>
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
                                <input
                                  type="checkbox"
                                  checked={!isDisabled}
                                  onChange={() => toggleRule(rule.id)}
                                />
                                <span className="text-xs text-gray-500">
                                  {isDisabled ? 'Off' : 'On'}
                                </span>
                              </label>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">
                              {rule.id}
                            </td>
                            <td className="px-4 py-3 text-xs uppercase text-gray-600">
                              {rule.action}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              {rule.signature}
                            </td>
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
                  {!embedded && !scopedToSubgroup && (
                    <Link
                      to="/suricata"
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Back to Suricata
                    </Link>
                  )}
                  <Button
                    variant="primary"
                    onClick={saveRules}
                    loading={saving}
                    disabled={!selectedRuleset.installed || rules.length === 0 || Boolean(rulesHint)}
                  >
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

export function SuricataRulesetGroupsSection() {
  const [rulesets, setRulesets] = useState<SuricataRuleset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [actingGroupKey, setActingGroupKey] = useState<string | null>(null)

  const loadRulesets = useCallback(() => {
    setLoading(true)
    return getSuricataRulesets()
      .then((res) => {
        setRulesets(res.data ?? [])
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadRulesets()
  }, [loadRulesets])

  const subgroupCards = useMemo(() => {
    return buildRulesetGroups(rulesets).flatMap((group): RulesetSubgroupSummary[] =>
      buildRulesetSubgroups(group.rulesets).map((subgroup) => ({
        ...subgroup,
        familyLabel: group.label,
      })),
    )
  }, [rulesets])

  const visibleSubgroupCards = useMemo(
    () =>
      subgroupCards.filter(
        (subgroup) =>
          subgroup.familyLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
          subgroup.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          subgroup.rulesets.some((ruleset) =>
            ruleset.name.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      ),
    [searchTerm, subgroupCards],
  )

  const handleGroupAction = async (subgroup: RulesetSubgroupSummary) => {
    const action = getGroupAction(subgroup.rulesets)
    if (!action) return

    const groupKey = `${subgroup.familyLabel}:${subgroup.label}`
    setActingGroupKey(groupKey)
    setSuccess(null)
    setError(null)

    try {
      await runGroupAction(subgroup.rulesets, action)
      setSuccess(`${groupActionLabel[action]} completed for ${subgroup.label}.`)
      await loadRulesets()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActingGroupKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-sm">
          <FormField
            label="Search ruleset groups"
            type="text"
            placeholder="Filter by family, group, or package"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={loadRulesets} loading={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleSubgroupCards.map((subgroup) => {
          const groupKey = `${subgroup.familyLabel}:${subgroup.label}`
          const action = getGroupAction(subgroup.rulesets)
          const installedCount = subgroup.rulesets.filter((ruleset) => ruleset.installed).length
          const enabledCount = subgroup.rulesets.filter(
            (ruleset) => ruleset.installed && ruleset.enabled,
          ).length

          return (
            <div
              key={groupKey}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {subgroup.rulesets[0]?.name || subgroup.label}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    {subgroup.rulesets.length} ruleset{subgroup.rulesets.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    {enabledCount} enabled
                  </span>
                  <Button
                    size="sm"
                    variant={action === 'disable' ? 'secondary' : 'primary'}
                    onClick={() => handleGroupAction(subgroup)}
                    loading={actingGroupKey === groupKey}
                    disabled={!action}
                  >
                    {action ? groupActionLabel[action] : 'Ready'}
                  </Button>
                  <Link
                    to={`/suricata/rulesets?group=${encodeURIComponent(
                      subgroup.familyLabel,
                    )}&subgroup=${encodeURIComponent(subgroup.label)}`}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Rules
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!loading && visibleSubgroupCards.length === 0 && (
        <div className="rounded border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
          No ruleset groups match the current filter.
        </div>
      )}
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
