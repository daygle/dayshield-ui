import { useState } from 'react'
import FormField from './FormField'
import Button from './Button'

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <FormField
        id="username"
        label="Username"
        required
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername((e.target as HTMLInputElement).value)}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
      />

      <Button
        type="submit"
        loading={submitting}
        disabled={!username || !password}
        className="w-full justify-center"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
