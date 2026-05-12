import { useCallback, useEffect, useState } from 'react'
import { getAdminSecurity, updateAdminSecurity } from '../../api/admin'
import type { AdminSecuritySettings } from '../../types'
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSecurity() {
  const [settings, setSettings] = useState<AdminSecuritySettings>(DEFAULT_SETTINGS)
  const [form, setForm] = useState<AdminSecuritySettings>(DEFAULT_SETTINGS)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  const pushToast = useCallback((kind: ToastKind, text: string) => {
    const id = ++toastSeq
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((m) => m.id !== id)), 4000)
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await getAdminSecurity()
      setSettings(data)
      setForm(data)
    } catch {
      pushToast('error', 'Failed to load admin security settings')
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
