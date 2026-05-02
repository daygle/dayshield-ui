import type { SmtpConfig } from '../../types'
import FormField from '../../components/FormField'

interface SmtpErrors {
  host?: string
  port?: string
  fromAddress?: string
}

interface SmtpFormProps {
  smtp: SmtpConfig
  errors: SmtpErrors
  disabled: boolean
  onChange: (smtp: SmtpConfig) => void
}

export default function SmtpForm({ smtp, errors, disabled, onChange }: SmtpFormProps) {
  const set = <K extends keyof SmtpConfig>(key: K, value: SmtpConfig[K]) =>
    onChange({ ...smtp, [key]: value })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField
        id="smtp-host"
        label="SMTP Host"
        required
        placeholder="smtp.example.com"
        value={smtp.host}
        error={errors.host}
        disabled={disabled}
        onChange={(e) => set('host', e.target.value)}
      />

      <FormField
        id="smtp-port"
        label="SMTP Port"
        required
        type="number"
        min={1}
        max={65535}
        placeholder="587"
        value={smtp.port}
        error={errors.port}
        disabled={disabled}
        onChange={(e) => set('port', parseInt(e.target.value, 10) || 587)}
      />

      <FormField
        id="smtp-username"
        label="Username"
        placeholder="user@example.com"
        value={smtp.username}
        disabled={disabled}
        onChange={(e) => set('username', e.target.value)}
      />

      <FormField
        id="smtp-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        value={smtp.password}
        disabled={disabled}
        onChange={(e) => set('password', e.target.value)}
      />

      <FormField
        id="smtp-from-address"
        label="From Address"
        required
        type="email"
        placeholder="dayshield@example.com"
        value={smtp.fromAddress}
        error={errors.fromAddress}
        disabled={disabled}
        onChange={(e) => set('fromAddress', e.target.value)}
      />

      <FormField
        id="smtp-from-name"
        label="From Name"
        placeholder="DayShield Alerts"
        value={smtp.fromName}
        disabled={disabled}
        onChange={(e) => set('fromName', e.target.value)}
      />

      <div className="flex items-center gap-3 sm:col-span-2">
        <input
          id="smtp-tls"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={smtp.tls}
          disabled={disabled}
          onChange={(e) => set('tls', e.target.checked)}
        />
        <label htmlFor="smtp-tls" className="text-sm font-medium text-gray-700">
          Use TLS / STARTTLS
        </label>
      </div>
    </div>
  )
}
