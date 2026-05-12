import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAdminSecurity, updateAdminSecurity } from '../../api/admin'
import { getAiEngineConfig, updateAiEngineConfig } from '../../api/ai'
import type { AdminSecuritySettings, AiEngineConfig } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import FormField from '../../components/FormField'

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error'
interface ToastMsg { id: number; kind: ToastKind; text: string }
let toastSeq = 0

function Toast({ messages }: { messages: ToastMsg[] }) {
  if (!messages.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
      {messages.map((m) => (
        <div key={m.id} role="alert"
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg text-white ${m.kind === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {m.text}
        </div>
      ))}
    </div>
  )
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AdminSecuritySettings = {
  session_timeout_minutes: 480,
  max_login_attempts: 5,
  lockout_duration_minutes: 15,
  min_password_length: 8,
  require_uppercase: false,
  require_number: false,
  require_special: false,
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
  remote_inference_url: '',
  remote_api_key: '',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSecurity() {
  const [settings, setSettings] = useState<AdminSecuritySettings>(DEFAULT_SETTINGS)
  const [form, setForm] = useState<AdminSecuritySettings>(DEFAULT_SETTINGS)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [aiSettings, setAiSettings] = useState<AiEngineConfig>(DEFAULT_AI_SETTINGS)
  const [aiForm, setAiForm] = useState<AiEngineConfig>(DEFAULT_AI_SETTINGS)
  const [aiLoading, setAiLoading] = useState(true)
  const [aiSaving, setAiSaving] = useState(false)

  const pushToast = useCallback((kind: ToastKind, text: string) => {
    const id = ++toastSeq
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((m) => m.id !== id)), 4000)
  }, [])

  const load = useCallback(async () => {
    setAiLoading(true)
    try {
      const data = await getAdminSecurity()
      setSettings(data)
      setForm(data)
    } catch {
      pushToast('error', 'Failed to load admin security settings')
    }

    try {
      const ai = await getAiEngineConfig()
      setAiSettings(ai.data)
      setAiForm(ai.data)
    } catch {
      pushToast('error', 'Failed to load AI Threat Engine settings')
    } finally {
      setAiLoading(false)
    }
  }, [pushToast])

  useEffect(() => { load() }, [load])

  const openEdit = () => { setForm(settings); setEditing(true) }
  const closeEdit = () => setEditing(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAdminSecurity(form)
      setSettings(form)
      setEditing(false)
      pushToast('success', 'Admin security settings updated')
    } catch {
      pushToast('error', 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

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
      remote_inference_url:
        aiForm.model_type === 'remote' && !aiForm.remote_inference_url?.trim()
          ? 'Remote inference URL is required when using remote model type.'
          : '',
    }

    return {
      ...errors,
      isValid: Object.values(errors).every((e) => !e),
    }
  }, [aiForm])

  const handleSaveAiSettings = async () => {
    if (!aiValidation.isValid) {
      const firstError = [
        aiValidation.automatic_blocking,
        aiValidation.risk_score_block_threshold,
        aiValidation.escalation_window_seconds,
        aiValidation.block_duration_seconds,
      ].find(Boolean)
      pushToast('error', firstError || 'Please correct AI Threat Engine settings.')
      return
    }

    setAiSaving(true)
    try {
      const res = await updateAiEngineConfig(aiForm)
      setAiSettings(res.data)
      setAiForm(res.data)
      pushToast('success', 'AI Threat Engine settings updated')
    } catch {
      pushToast('error', 'Failed to save AI Threat Engine settings')
    } finally {
      setAiSaving(false)
    }
  }

  const numField = (
    label: string,
    key: keyof AdminSecuritySettings,
    min: number,
    help?: string,
  ) => (
    <FormField label={label} hint={help}>
      <input
        type="number"
        min={min}
        value={form[key] as number}
        onChange={(e) => {
          const parsed = Number(e.target.value)
          setForm({ ...form, [key]: Number.isFinite(parsed) ? Math.max(min, parsed) : min })
        }}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
      />
    </FormField>
  )

  const boolField = (label: string, key: keyof AdminSecuritySettings) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
      <input
        type="checkbox"
        checked={form[key] as boolean}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Admin Security</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Session policy, login lockout, and password complexity requirements.
          </p>
        </div>
        <Button variant="primary" onClick={openEdit}>Edit Settings</Button>
      </div>

      {/* Read-only summary card */}
      <Card>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          <Row label="Session timeout" value={`${settings.session_timeout_minutes} minutes`} />
          <Row label="Max login attempts" value={settings.max_login_attempts === 0 ? 'Unlimited' : `${settings.max_login_attempts} attempts`} />
          <Row label="Lockout duration" value={`${settings.lockout_duration_minutes} minutes`} />
          <Row label="Min password length" value={`${settings.min_password_length} characters`} />
          <Row label="Require uppercase" value={settings.require_uppercase ? 'Yes' : 'No'} />
          <Row label="Require number" value={settings.require_number ? 'Yes' : 'No'} />
          <Row label="Require special character" value={settings.require_special ? 'Yes' : 'No'} />
        </div>
      </Card>

      <Card title="AI Threat Engine Settings" subtitle="Configure AI-driven threat detection and automatic blocking">
        {aiLoading ? (
          <p className="text-sm text-slate-500">Loading AI settings…</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
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

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
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
              <FormField label="AI Model Runtime" hint="Choose local scoring or remote inference endpoint.">
                <select
                  id="ai-model-type"
                  value={aiForm.model_type}
                  onChange={(e) => setAiForm((prev) => ({ ...prev, model_type: e.target.value as 'local' | 'remote' }))}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  <option value="local">Local model</option>
                  <option value="remote">Remote inference</option>
                </select>
              </FormField>
              <FormField
                id="ai-learning-rate"
                label="Model Learning Rate"
                type="number"
                min={0.01}
                step={0.01}
                value={aiForm.model_learning_rate}
                hint="Only used by the local AI model training path."
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
            <div className="grid grid-cols-1 gap-4">
              <FormField
                id="ai-remote-url"
                label="Remote Inference URL"
                hint="HTTP endpoint that receives AI feature payloads."
                error={aiValidation.remote_inference_url || undefined}
              >
                <input
                  type="url"
                  value={aiForm.remote_inference_url ?? ''}
                  onChange={(e) => setAiForm((prev) => ({ ...prev, remote_inference_url: e.target.value }))}
                  disabled={aiForm.model_type !== 'remote'}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </FormField>
              <FormField
                id="ai-remote-api-key"
                label="Remote Inference API Key"
                hint="Optional bearer token for remote inference requests."
              >
                <input
                  type="text"
                  value={aiForm.remote_api_key ?? ''}
                  onChange={(e) => setAiForm((prev) => ({ ...prev, remote_api_key: e.target.value }))}
                  disabled={aiForm.model_type !== 'remote'}
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </FormField>
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

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Admin Security Settings</h2>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Session Policy</p>
              {numField('Session Timeout (minutes)', 'session_timeout_minutes', 1, 'How long before an idle session is expired')}
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-2">Login Lockout</p>
              {numField('Max Login Attempts', 'max_login_attempts', 0, 'Set to 0 to disable lockout')}
              {numField('Lockout Duration (minutes)', 'lockout_duration_minutes', 1)}
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-2">Password Complexity</p>
              {numField('Minimum Password Length', 'min_password_length', 4)}
              <div className="space-y-2 mt-1">
                {boolField('Require uppercase letter', 'require_uppercase')}
                {boolField('Require number', 'require_number')}
                {boolField('Require special character', 'require_special')}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <Button variant="secondary" onClick={closeEdit} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <Toast messages={toasts} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 px-4">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  )
}
