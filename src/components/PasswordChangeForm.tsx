import { useState } from 'react'
import FormField from './FormField'
import Button from './Button'

interface PasswordChangeFormProps {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
}

export default function PasswordChangeForm({ onSubmit }: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <FormField
        id="currentPassword"
        label="Current Password"
        type="password"
        required
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) =>
          setCurrentPassword((e.target as HTMLInputElement).value)
        }
      />

      <FormField
        id="newPassword"
        label="New Password"
        type="password"
        required
        autoComplete="new-password"
        hint="Minimum 8 characters."
        value={newPassword}
        onChange={(e) => setNewPassword((e.target as HTMLInputElement).value)}
      />

      <FormField
        id="confirmPassword"
        label="Confirm New Password"
        type="password"
        required
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) =>
          setConfirmPassword((e.target as HTMLInputElement).value)
        }
      />

      <Button
        type="submit"
        loading={submitting}
        disabled={!isValid}
        className="w-full justify-center"
      >
        {submitting ? 'Updating…' : 'Update Password'}
      </Button>
    </form>
  )
}
