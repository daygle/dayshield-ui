import { useCallback, useEffect, useState } from 'react'
import { getNotifyConfig, saveNotifyConfig } from '../../api/notifications'
import type { NotifyConfig, NotifyCategory, SmtpConfig } from '../../types'
import Card from '../../components/Card'
import Button from '../../components/Button'
import SmtpForm from './SmtpForm'
import RecipientList from './RecipientList'
import CategorySelector from './CategorySelector'
import RateLimitInput from './RateLimitInput'
import DigestToggle from './DigestToggle'
import TestEmailButton from './TestEmailButton'

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error'

interface ToastMessage {
  id: number
  kind: ToastKind
  text: string
}

let toastSeq = 0

function Toast({ messages }: { messages: ToastMessage[] }) {
  if (messages.length === 0) return null
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
      {messages.map((m) => (
        <div
          key={m.id}
          role="alert"
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg text-white ${
            m.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {m.kind === 'success' ? (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          )}
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SMTP: SmtpConfig = {
  host: '',
  port: 587,
  username: '',
  password: '',
  tls: true,
  fromAddress: '',
  fromName: 'DayShield Alerts',
}

const DEFAULT_CONFIG: NotifyConfig = {
  enabled: false,
  smtp: DEFAULT_SMTP,
  recipients: [],
  categories: [],
  rateLimitMinutes: 15,
  digestMode: false,
}

// ── SMTP validation ───────────────────────────────────────────────────────────

interface SmtpErrors {
  host?: string
  port?: string
  fromAddress?: string
}

function validateSmtp(smtp: SmtpConfig): SmtpErrors {
  const errors: SmtpErrors = {}
  if (!smtp.host.trim()) errors.host = 'Host is required.'
  if (!smtp.port || smtp.port < 1 || smtp.port > 65535) errors.port = 'Enter a valid port (1–65535).'
  if (!smtp.fromAddress.trim()) {
    errors.fromAddress = 'From address is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtp.fromAddress)) {
    errors.fromAddress = 'Enter a valid email address.'
  }
  return errors
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [config, setConfig] = useState<NotifyConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [smtpErrors, setSmtpErrors] = useState<SmtpErrors>({})
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((kind: ToastKind, text: string) => {
    const id = toastSeq++
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    getNotifyConfig()
      .then((res) => setConfig(res.data))
      .catch(() => {
        // Backend may not have config yet; use defaults silently
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = () => {
    const errors = validateSmtp(config.smtp)
    if (Object.keys(errors).length > 0) {
      setSmtpErrors(errors)
      addToast('error', 'Please fix the SMTP validation errors before saving.')
      return
    }
    setSmtpErrors({})
    setSaving(true)
    saveNotifyConfig(config)
      .then((res) => {
        setConfig(res.data)
        addToast('success', 'Notification settings saved.')
      })
      .catch((err: Error) => addToast('error', `Save failed: ${err.message}`))
      .finally(() => setSaving(false))
  }

  const busy = loading || saving

  return (
    <div className="space-y-6">

      {/* Enable / disable banner */}
      <Card
        title="Notifications"
        subtitle="Send email alerts when security or system events occur."
        actions={
          <Button
            variant={config.enabled ? 'danger' : 'primary'}
            disabled={busy}
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
          >
            {config.enabled ? 'Disable notifications' : 'Enable notifications'}
          </Button>
        }
      >
        {config.lastStatus && (
          <LastStatusBanner status={config.lastStatus} />
        )}
        {!config.lastStatus && (
          <p className="text-sm text-gray-500">
            No notification has been sent yet.
          </p>
        )}
      </Card>

      {/* SMTP Settings */}
      <Card
        title="SMTP Settings"
        subtitle="Configure the outbound mail server used to send notifications."
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <SmtpForm
            smtp={config.smtp}
            errors={smtpErrors}
            disabled={busy || !config.enabled}
            onChange={(smtp) => setConfig((c) => ({ ...c, smtp }))}
          />
        )}
      </Card>

      {/* Recipients */}
      <Card
        title="Recipients"
        subtitle="Email addresses that will receive alert notifications."
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <RecipientList
            recipients={config.recipients}
            disabled={busy || !config.enabled}
            onChange={(recipients) => setConfig((c) => ({ ...c, recipients }))}
          />
        )}
      </Card>

      {/* Categories */}
      <Card
        title="Alert Categories"
        subtitle="Choose which event categories trigger a notification."
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <CategorySelector
            selected={config.categories as NotifyCategory[]}
            disabled={busy || !config.enabled}
            onChange={(categories) => setConfig((c) => ({ ...c, categories }))}
          />
        )}
      </Card>

      {/* Rate Limit & Digest */}
      <Card title="Delivery Options">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-6">
            <RateLimitInput
              minutes={config.rateLimitMinutes}
              disabled={busy || !config.enabled}
              onChange={(rateLimitMinutes) => setConfig((c) => ({ ...c, rateLimitMinutes }))}
            />
            <DigestToggle
              enabled={config.digestMode}
              disabled={busy || !config.enabled}
              onChange={(digestMode) => setConfig((c) => ({ ...c, digestMode }))}
            />
          </div>
        )}
      </Card>

      {/* Test Email */}
      <Card
        title="Test Email"
        subtitle="Send a test message to verify your SMTP configuration is working."
      >
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <TestEmailButton
            defaultRecipient={config.recipients[0] ?? ''}
            disabled={busy || !config.enabled}
            onResult={(success, message) =>
              addToast(success ? 'success' : 'error', message)
            }
          />
        )}
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button loading={saving} disabled={busy} onClick={handleSave}>
          Save settings
        </Button>
      </div>

      <Toast messages={toasts} />
    </div>
  )
}

// ── Last Status Banner ────────────────────────────────────────────────────────

interface LastStatusBannerProps {
  status: NonNullable<NotifyConfig['lastStatus']>
}

function LastStatusBanner({ status }: LastStatusBannerProps) {
  const sentAt = new Date(status.sentAt).toLocaleString()
  return (
    <div
      className={[
        'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
        status.success
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-red-50 border-red-200 text-red-700',
      ].join(' ')}
    >
      {status.success ? (
        <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      )}
      <span>
        Last notification {status.success ? 'sent successfully' : 'failed'} at {sentAt}.
        {status.message && ` ${status.message}`}
      </span>
    </div>
  )
}
