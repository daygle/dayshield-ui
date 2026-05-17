import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAiThreats,
  getAiThreatById,
  getAiBlockedEntries,
  unblockAiIp,
  submitAiFeedback,
  getAiEngineConfig,
  updateAiEngineConfig,
} from '../../api/ai'
import { getSuricataConfig, updateSuricataConfig } from '../../api/suricata'
import { getCrowdSecConfig, updateCrowdSecConfig } from '../../api/crowdsec'
import type { ThreatEvent, BlockedEntry, AiEngineConfig, SuricataConfig, CrowdSecStatus } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import Table, { type Column } from '../../components/Table'
import Modal from '../../components/Modal'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useToast } from '../../context/ToastContext'
import { useDisplayPreferences } from '../../context/DisplayPreferencesContext'

type ThreatRow = ThreatEvent & Record<string, unknown>
type BlockedRow = BlockedEntry & Record<string, unknown>

function unixSecondsToMs(unixSeconds: number): number {
  return unixSeconds * 1000
}

function formatRelativeFromUnix(unixSeconds: number | null): string {
  if (unixSeconds === null || !Number.isFinite(unixSeconds)) return 'Permanent'
  const now = Date.now()
  const target = unixSeconds * 1000
  const diffMs = target - now
  const absMs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const value =
    absMs >= day
      ? Math.round(absMs / day)
      : absMs >= hour
        ? Math.round(absMs / hour)
        : absMs >= minute
          ? Math.round(absMs / minute)
          : Math.max(1, Math.round(absMs / 1000))
  const unit =
    absMs >= day
      ? 'day'
      : absMs >= hour
        ? 'hour'
        : absMs >= minute
          ? 'minute'
          : 'second'
  const suffix = value === 1 ? unit : `${unit}s`
  return diffMs >= 0 ? `in ${value} ${suffix}` : `${value} ${suffix} ago`
}

function formatRelativeFromMs(timestampMs: number | null): string {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return '-'
  return formatRelativeFromUnix(Math.floor(timestampMs / 1000))
}

const DEFAULT_AI_SETTINGS: AiEngineConfig = {
  enabled: false,
  automatic_blocking: false,
  risk_score_block_threshold: 0.9,
  escalation_window_seconds: 300,
  block_duration_seconds: 3600,
  model_type: 'local',
  training_enabled: true,
  model_learning_rate: 0.25,
}

function riskBadge(score: number) {
  const pct = Math.round(score * 100)
  const color =
    score >= 0.9
      ? 'bg-red-100 text-red-700'
      : score >= 0.7
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700'
  const barColor =
    score >= 0.9
      ? 'bg-red-500'
      : score >= 0.7
        ? 'bg-amber-500'
        : 'bg-green-500'

  return (
    <div className="min-w-24">
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${color}`}>{pct}%</span>
      <div className="mt-1 h-1.5 w-20 rounded bg-gray-200">
        <div className={`h-1.5 rounded ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  )
}

function yesNoBadge(flag: boolean, yesText = 'Yes', noText = 'No', yesClass = 'bg-green-100 text-green-700') {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
        flag ? yesClass : 'bg-gray-100 text-gray-600'
      }`}
    >
      {flag ? yesText : noText}
    </span>
  )
}

function AIThreatsContent() {
  const { addToast } = useToast()
  const { formatDateTime } = useDisplayPreferences()
  const [threats, setThreats] = useState<ThreatRow[]>([])
  const [blockedEntries, setBlockedEntries] = useState<BlockedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [selectedThreat, setSelectedThreat] = useState<ThreatEvent | null>(null)
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null)
  const [feedbackInProgress, setFeedbackInProgress] = useState<string | null>(null)
  const [aiSettings, setAiSettings] = useState<AiEngineConfig>(DEFAULT_AI_SETTINGS)
  const [aiForm, setAiForm] = useState<AiEngineConfig>(DEFAULT_AI_SETTINGS)
  const [aiLoading, setAiLoading] = useState(true)
  const [aiSaving, setAiSaving] = useState(false)
  const [suricataConfig, setSuricataConfig] = useState<SuricataConfig | null>(null)
  const [crowdSecConfig, setCrowdSecConfig] = useState<CrowdSecStatus | null>(null)
  const [sourceLoading, setSourceLoading] = useState(true)
  const [sourceSaving, setSourceSaving] = useState<'suricata' | 'crowdsec' | null>(null)
  const [sourceError, setSourceError] = useState<string | null>(null)

  const formatUnixDateTime = useCallback((unixSeconds: number | null): string => {
    if (unixSeconds === null || !Number.isFinite(unixSeconds)) return '-'
    return formatDateTime(new Date(unixSecondsToMs(unixSeconds)))
  }, [formatDateTime])

  const aiValidation = useMemo(() => {
    const threshold = Number(aiForm.risk_score_block_threshold)
    const windowSeconds = Number(aiForm.escalation_window_seconds)
    const durationSeconds = Number(aiForm.block_duration_seconds)
    const learningRate = Number(aiForm.model_learning_rate)

    const errors = {
      automatic_blocking: !aiForm.enabled && aiForm.automatic_blocking
        ? 'Automatic blocking requires AI engine to be enabled.'
        : '',
      risk_score_block_threshold:
        !Number.isFinite(threshold) || threshold < 0 || threshold > 1
          ? 'Risk score threshold must be between 0.00 and 1.00.'
          : '',
      escalation_window_seconds:
        !Number.isFinite(windowSeconds) || windowSeconds <= 0
          ? 'Escalation window must be greater than 0 seconds.'
          : '',
      block_duration_seconds:
        !Number.isFinite(durationSeconds) || durationSeconds < 0
          ? 'Block duration must be 0 or greater.'
          : '',
      model_learning_rate:
        !Number.isFinite(learningRate) || learningRate <= 0
          ? 'Model learning rate must be greater than 0.'
          : '',
    }

    return {
      ...errors,
      isValid: Object.values(errors).every((e) => !e),
    }
  }, [aiForm])

  const loadAiSettings = useCallback(async () => {
    setAiLoading(true)
    try {
      const res = await getAiEngineConfig()
      setAiSettings(res.data)
      setAiForm(res.data)
    } catch {
      addToast('Failed to load AI Threat Engine settings', 'error')
    } finally {
      setAiLoading(false)
    }
  }, [addToast])

  const handleSaveAiSettings = async () => {
    if (!aiValidation.isValid) {
      const firstError = [
        aiValidation.automatic_blocking,
        aiValidation.risk_score_block_threshold,
        aiValidation.escalation_window_seconds,
        aiValidation.block_duration_seconds,
        aiValidation.model_learning_rate,
      ].find(Boolean)
      addToast(firstError || 'Please correct AI Threat Engine settings.', 'error')
      return
    }

    setAiSaving(true)
    try {
      const res = await updateAiEngineConfig(aiForm)
      setAiSettings(res.data)
      setAiForm(res.data)
      addToast('AI Threat Engine settings updated', 'success')
    } catch {
      addToast('Failed to save AI Threat Engine settings', 'error')
    } finally {
      setAiSaving(false)
    }
  }

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([getAiThreats(100), getAiBlockedEntries()])
      .then(([threatRes, blockedRes]) => {
        setThreats(threatRes.data as ThreatRow[])
        setBlockedEntries(blockedRes.data as BlockedRow[])
        setError(null)
        setLastUpdatedAt(Date.now())
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const loadCorrelationSources = useCallback(() => {
    setSourceLoading(true)
    Promise.all([getSuricataConfig(), getCrowdSecConfig()])
      .then(([suricataRes, crowdSecRes]) => {
        setSuricataConfig(suricataRes.data)
        setCrowdSecConfig(crowdSecRes.data)
        setSourceError(null)
      })
      .catch((err: Error) => setSourceError(err.message))
      .finally(() => setSourceLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
    const timer = window.setInterval(loadAll, 30_000)
    return () => window.clearInterval(timer)
  }, [loadAll])

  useEffect(() => {
    void loadAiSettings()
  }, [loadAiSettings])

  useEffect(() => {
    loadCorrelationSources()
  }, [loadCorrelationSources])

  const handleToggleSuricataEnabled = async () => {
    if (!suricataConfig) return
    setSourceSaving('suricata')
    try {
      const res = await updateSuricataConfig({ enabled: !suricataConfig.enabled })
      setSuricataConfig(res.data)
      setSourceError(null)
      addToast(`Suricata ${res.data.enabled ? 'enabled' : 'disabled'} for AI correlation sources.`, 'success')
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Failed to update Suricata settings')
    } finally {
      setSourceSaving(null)
    }
  }

  const handleToggleSuricataMode = async () => {
    if (!suricataConfig) return
    setSourceSaving('suricata')
    try {
      const nextMode = suricataConfig.mode === 'ids' ? 'ips' : 'ids'
      const res = await updateSuricataConfig({ mode: nextMode })
      setSuricataConfig(res.data)
      setSourceError(null)
      addToast(`Suricata mode updated to ${res.data.mode.toUpperCase()}.`, 'success')
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Failed to update Suricata mode')
    } finally {
      setSourceSaving(null)
    }
  }

  const handleToggleCrowdSecEnabled = async () => {
    if (!crowdSecConfig) return
    setSourceSaving('crowdsec')
    try {
      const res = await updateCrowdSecConfig({ enabled: !crowdSecConfig.enabled })
      setCrowdSecConfig(res.data)
      setSourceError(null)
      addToast(`CrowdSec ${res.data.enabled ? 'enabled' : 'disabled'} for AI correlation sources.`, 'success')
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Failed to update CrowdSec settings')
    } finally {
      setSourceSaving(null)
    }
  }

  const handleOpenThreat = (row: ThreatRow) => {
    const id = String(row.id)
    setSelectedThreat(row as ThreatEvent)
    getAiThreatById(id)
      .then((res) => setSelectedThreat(res.data))
      .catch(() => undefined)
  }

  const handleUnblock = useCallback(async (ip: string) => {
    setUnblockingIp(ip)
    try {
      const res = await unblockAiIp(ip)
      if (res.data.unblocked) {
        addToast(`Unblocked ${res.data.ip}`, 'success')
      } else {
        addToast(`No active block found for ${res.data.ip}`, 'warning')
      }
      loadAll()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to unblock IP', 'error')
    } finally {
      setUnblockingIp(null)
    }
  }, [addToast, loadAll])

  const handleFeedback = useCallback(async (id: string, feedback: 'false_positive' | 'confirmed_malicious') => {
    setFeedbackInProgress(`${id}:${feedback}`)
    try {
      const res = await submitAiFeedback(id, feedback)
      setSelectedThreat(res.data)
      addToast('Thank you - AI model feedback recorded.', 'success')
      loadAll()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to submit feedback', 'error')
    } finally {
      setFeedbackInProgress(null)
    }
  }, [addToast, loadAll])

  const threatColumns: Column<ThreatRow>[] = useMemo(
    () => [
      {
        key: 'timestamp',
        header: 'Timestamp',
        render: (row) => (
          <span title={formatUnixDateTime(row.timestamp as number)}>
            {formatUnixDateTime(row.timestamp as number)}
          </span>
        ),
      },
      { key: 'src_ip', header: 'Src IP', render: (row) => <span className="font-mono">{String(row.src_ip)}</span> },
      { key: 'dst_ip', header: 'Dst IP', render: (row) => <span className="font-mono">{String(row.dst_ip)}</span> },
      { key: 'protocol', header: 'Protocol', render: (row) => <span className="uppercase">{String(row.protocol)}</span> },
      { key: 'risk_score', header: 'Risk Score', render: (row) => riskBadge(Number(row.risk_score)) },
      {
        key: 'blocked',
        header: 'Blocked',
        render: (row) => yesNoBadge(Boolean(row.blocked), 'Blocked', 'No', 'bg-red-100 text-red-700'),
      },
      {
        key: 'escalated',
        header: 'Escalated',
        render: (row) => yesNoBadge(Boolean(row.escalated), 'Escalated', 'No', 'bg-amber-100 text-amber-700'),
      },
      {
        key: 'quarantine',
        header: 'Quarantine',
        render: (row) => yesNoBadge(Boolean(row.quarantine), 'Quarantine', 'No', 'bg-purple-100 text-purple-700'),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) =>
          row.blocked && !row.manually_unblocked ? (
            <Button
              size="sm"
              variant="secondary"
              loading={unblockingIp === String(row.src_ip)}
              onClick={(e) => {
                e.stopPropagation()
                void handleUnblock(String(row.src_ip))
              }}
            >
              Unblock
            </Button>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          ),
      },
    ],
    [formatUnixDateTime, handleUnblock, unblockingIp],
  )

  const blockedColumns: Column<BlockedRow>[] = useMemo(
    () => [
      { key: 'ip', header: 'IP', render: (row) => <span className="font-mono">{String(row.ip)}</span> },
      {
        key: 'added_at',
        header: 'Added',
        render: (row) => (
          <span title={formatUnixDateTime(Number(row.added_at))}>
            {formatRelativeFromUnix(Number(row.added_at))}
          </span>
        ),
      },
      {
        key: 'expires_at',
        header: 'Expires',
        render: (row) =>
          row.expires_at === null ? (
            <span className="text-gray-600">Permanent</span>
          ) : (
            <span title={formatUnixDateTime(Number(row.expires_at))}>
              {formatRelativeFromUnix(Number(row.expires_at))}
            </span>
          ),
      },
      {
        key: 'quarantine',
        header: 'Quarantine',
        render: (row) => yesNoBadge(Boolean(row.quarantine), 'Quarantine', 'No', 'bg-purple-100 text-purple-700'),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <Button
            size="sm"
            variant="secondary"
            loading={unblockingIp === String(row.ip)}
            onClick={(e) => {
              e.stopPropagation()
              void handleUnblock(String(row.ip))
            }}
          >
            Unblock
          </Button>
        ),
      },
    ],
    [formatUnixDateTime, handleUnblock, unblockingIp],
  )

  return (
    <div className="space-y-6">
      <Modal
        open={Boolean(selectedThreat)}
        title="Threat Event Details"
        onClose={() => setSelectedThreat(null)}
        size="lg"
      >
        {selectedThreat && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Detail label="ID" value={<span className="font-mono break-all">{selectedThreat.id}</span>} />
              <Detail label="Timestamp" value={formatUnixDateTime(selectedThreat.timestamp)} />
              <Detail label="Source IP" value={<span className="font-mono">{selectedThreat.src_ip}</span>} />
              <Detail label="Destination IP" value={<span className="font-mono">{selectedThreat.dst_ip}</span>} />
              <Detail label="Source Port" value={selectedThreat.src_port === null ? '-' : String(selectedThreat.src_port)} />
              <Detail label="Destination Port" value={selectedThreat.dst_port === null ? '-' : String(selectedThreat.dst_port)} />
              <Detail label="Protocol" value={selectedThreat.protocol} />
              <Detail label="Source" value={selectedThreat.event_source} />
              <Detail label="Action" value={selectedThreat.action ?? '-'} />
              <Detail label="Signature" value={selectedThreat.signature ?? '-'} />
              <Detail label="Alert Severity" value={selectedThreat.alert_severity === undefined ? '-' : String(selectedThreat.alert_severity)} />
              <Detail label="Model Label" value={selectedThreat.label === undefined ? '-' : String(selectedThreat.label)} />
              <Detail label="Risk Score" value={`${Math.round(selectedThreat.risk_score * 100)}%`} />
              <Detail label="Blocked" value={selectedThreat.blocked ? 'Yes' : 'No'} />
              <Detail label="Block Expires" value={selectedThreat.block_expires_at === null ? 'Permanent' : formatUnixDateTime(selectedThreat.block_expires_at)} />
              <Detail label="Escalated" value={selectedThreat.escalated ? 'Yes' : 'No'} />
              <Detail label="Quarantine" value={selectedThreat.quarantine ? 'Yes' : 'No'} />
              <Detail label="Manually Unblocked" value={selectedThreat.manually_unblocked ? 'Yes' : 'No'} />
              <Detail label="Feedback" value={selectedThreat.feedback ?? 'None'} />
            </dl>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Reasons</p>
              {selectedThreat.reasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-gray-700">
                  {selectedThreat.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No reasons provided.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3 pt-4">
              <Button
                size="sm"
                variant="secondary"
                loading={feedbackInProgress === `${selectedThreat.id}:false_positive`}
                onClick={() => void handleFeedback(selectedThreat.id, 'false_positive')}
              >
                Mark false positive
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={feedbackInProgress === `${selectedThreat.id}:confirmed_malicious`}
                onClick={() => void handleFeedback(selectedThreat.id, 'confirmed_malicious')}
              >
                Confirm malicious
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AI Threat Engine</h1>
          <p className="mt-1 text-sm text-slate-500">
            On-device, self-reliant AI threat detection - no third-party services required.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Auto-refresh: 30s</p>
          <p className="text-xs text-gray-500">
            Last updated:{' '}
            <span className="font-medium text-gray-700">{formatRelativeFromMs(lastUpdatedAt)}</span>
          </p>
        </div>
      </div>

      <Card title="AI Threat Engine Settings" subtitle="Configure the local AI scoring engine, automatic blocking, and on-device training">
        {aiLoading ? (
          <p className="text-sm text-slate-500">Loading AI settings…</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={aiForm.enabled}
                onChange={(e) =>
                  setAiForm((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                    automatic_blocking: e.target.checked ? prev.automatic_blocking : false,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Enable AI Threat Engine
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={aiForm.automatic_blocking}
                disabled={!aiForm.enabled}
                onChange={(e) => setAiForm((prev) => ({ ...prev, automatic_blocking: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              Enable Automatic Blocking
            </label>
            {aiValidation.automatic_blocking && (
              <p className="text-xs text-red-600">{aiValidation.automatic_blocking}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                id="ai-risk-threshold"
                label="Risk Score Block Threshold"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={aiForm.risk_score_block_threshold}
                error={aiValidation.risk_score_block_threshold || undefined}
                onChange={(e) => {
                  const parsed = Number(e.target.value)
                  setAiForm((prev) => ({
                    ...prev,
                    risk_score_block_threshold: Number.isFinite(parsed) ? parsed : prev.risk_score_block_threshold,
                  }))
                }}
              />
              <FormField
                id="ai-escalation-window"
                label="Escalation Window (seconds)"
                type="number"
                min={1}
                value={aiForm.escalation_window_seconds}
                hint="e.g. 300 = 5 min"
                error={aiValidation.escalation_window_seconds || undefined}
                onChange={(e) => {
                  const parsed = Number(e.target.value)
                  setAiForm((prev) => ({
                    ...prev,
                    escalation_window_seconds: Number.isFinite(parsed) ? parsed : prev.escalation_window_seconds,
                  }))
                }}
              />
              <FormField
                id="ai-block-duration"
                label="Block Duration (seconds)"
                type="number"
                min={0}
                value={aiForm.block_duration_seconds}
                hint="0 = permanent block"
                error={aiValidation.block_duration_seconds || undefined}
                onChange={(e) => {
                  const parsed = Number(e.target.value)
                  setAiForm((prev) => ({
                    ...prev,
                    block_duration_seconds: Number.isFinite(parsed) ? parsed : prev.block_duration_seconds,
                  }))
                }}
              />
              <FormField
                id="ai-learning-rate"
                label="Model Learning Rate"
                type="number"
                min={0.01}
                step={0.01}
                value={aiForm.model_learning_rate}
                hint="Controls how quickly the local AI model adapts from feedback."
                error={aiValidation.model_learning_rate || undefined}
                onChange={(e) => {
                  const parsed = Number(e.target.value)
                  setAiForm((prev) => ({
                    ...prev,
                    model_learning_rate: Number.isFinite(parsed) ? parsed : prev.model_learning_rate,
                  }))
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Current: {aiSettings.enabled ? 'Enabled' : 'Disabled'} · Threshold {Math.round(aiSettings.risk_score_block_threshold * 100)}%
              </p>
              <Button variant="primary" onClick={handleSaveAiSettings} loading={aiSaving}>
                Save AI Settings
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Correlation Source Settings"
        subtitle="Control the Suricata and CrowdSec sources that feed AI threat correlation"
        actions={
          <Button size="sm" variant="secondary" onClick={loadCorrelationSources} loading={sourceLoading}>
            Refresh Sources
          </Button>
        }
      >
        {sourceError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {sourceError}
          </div>
        )}

        {sourceLoading ? (
          <p className="text-sm text-slate-500">Loading Suricata and CrowdSec source settings…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
                <p className="text-sm text-gray-500 mb-1">Suricata Status</p>
                <p className={`text-base font-semibold ${suricataConfig?.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {suricataConfig?.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
                <p className="text-sm text-gray-500 mb-1">Suricata Mode</p>
                <p className="text-base font-semibold text-gray-900 uppercase">{suricataConfig?.mode ?? '-'}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
                <p className="text-sm text-gray-500 mb-1">CrowdSec Status</p>
                <p className={`text-base font-semibold ${crowdSecConfig?.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {crowdSecConfig?.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-5">
                <p className="text-sm text-gray-500 mb-1">CrowdSec Poll</p>
                <p className="text-base font-semibold text-gray-900">{crowdSecConfig ? `${crowdSecConfig.update_interval}s` : '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Suricata Source</h3>
                  <p className="mt-1 text-sm text-gray-600">Primary IDS/IPS source for AI threat scoring.</p>
                </div>
                <Link
                  to="/suricata"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                  title="Open Suricata settings"
                  aria-label="Open Suricata settings"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-1-9h3m0 0v3m0-3L10 15" />
                  </svg>
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd className={`font-semibold ${suricataConfig?.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {suricataConfig?.enabled ? 'Enabled' : 'Disabled'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Mode</dt>
                  <dd className="font-semibold uppercase text-gray-900">{suricataConfig?.mode ?? '-'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">Monitored Interfaces</dt>
                  <dd className="font-semibold text-gray-900">{suricataConfig?.interfaces.length ?? 0}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={suricataConfig?.enabled ? 'secondary' : 'primary'}
                  loading={sourceSaving === 'suricata'}
                  onClick={handleToggleSuricataEnabled}
                >
                  {suricataConfig?.enabled ? 'Disable Suricata' : 'Enable Suricata'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={sourceSaving === 'suricata'}
                  onClick={handleToggleSuricataMode}
                  disabled={!suricataConfig?.enabled}
                >
                  Toggle IDS/IPS
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">CrowdSec Source</h3>
                  <p className="mt-1 text-sm text-gray-600">External reputation decisions used as AI context signals.</p>
                </div>
                <Link
                  to="/crowdsec"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white shadow-sm transition-colors hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                  title="Open CrowdSec settings"
                  aria-label="Open CrowdSec settings"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-1-9h3m0 0v3m0-3L10 15" />
                  </svg>
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd className={`font-semibold ${crowdSecConfig?.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {crowdSecConfig?.enabled ? 'Enabled' : 'Disabled'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Poll Interval</dt>
                  <dd className="font-semibold text-gray-900">{crowdSecConfig ? `${crowdSecConfig.update_interval}s` : '-'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">LAPI</dt>
                  <dd className="font-semibold text-gray-900 break-all">{crowdSecConfig?.lapi_url || 'Not configured'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={crowdSecConfig?.enabled ? 'secondary' : 'primary'}
                  loading={sourceSaving === 'crowdsec'}
                  onClick={handleToggleCrowdSecEnabled}
                >
                  {crowdSecConfig?.enabled ? 'Disable CrowdSec' : 'Enable CrowdSec'}
                </Button>
              </div>
            </div>
          </div>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500">
          Suricata and CrowdSec still have their full dedicated settings pages. This section is for AI source correlation controls and quick operational toggles.
        </p>
      </Card>

      <Card
        title="AI Threats"
        subtitle="Latest 100 threat events (newest first)"
        actions={
          <Button size="sm" variant="secondary" onClick={loadAll}>
            Refresh
          </Button>
        }
      >
        {!loading && threats.length === 0 && (
          <div className="mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            <div className="mb-1 flex justify-center">
              <svg className="h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v5c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V6l8-3z" />
              </svg>
            </div>
            No AI threat events detected yet.
          </div>
        )}
        <Table
          columns={threatColumns}
          data={threats}
          keyField="id"
          loading={loading}
          emptyMessage="No AI threat events."
          onRowClick={handleOpenThreat}
        />
      </Card>

      <Card title="Active Blocks" subtitle="IPs currently blocked by the AI threat engine">
        {!loading && blockedEntries.length === 0 && (
          <div className="mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            <div className="mb-1 flex justify-center">
              <svg className="h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
            No active AI blocks right now.
          </div>
        )}
        <Table
          columns={blockedColumns}
          data={blockedEntries}
          keyField="ip"
          loading={loading}
          emptyMessage="No active blocks."
        />
      </Card>

    </div>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  )
}

export default function AIThreats() {
  return (
    <ErrorBoundary fallbackMessage="The AI Threats page failed to render. Please refresh and try again.">
      <AIThreatsContent />
    </ErrorBoundary>
  )
}
