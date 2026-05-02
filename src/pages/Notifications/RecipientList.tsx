import { useState } from 'react'
import Button from '../../components/Button'
import FormField from '../../components/FormField'

interface RecipientListProps {
  recipients: string[]
  disabled: boolean
  onChange: (recipients: string[]) => void
}

export default function RecipientList({ recipients, disabled, onChange }: RecipientListProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const add = () => {
    const email = draft.trim()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (recipients.includes(email)) {
      setError('This address is already in the list.')
      return
    }
    onChange([...recipients, email])
    setDraft('')
    setError('')
  }

  const remove = (email: string) => onChange(recipients.filter((r) => r !== email))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-start">
        <FormField
          id="recipient-input"
          label=""
          type="email"
          placeholder="someone@example.com"
          value={draft}
          error={error}
          disabled={disabled}
          className="flex-1"
          onChange={(e) => { setDraft(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !draft.trim()}
          onClick={add}
          className="mt-0.5"
        >
          Add
        </Button>
      </div>

      {recipients.length === 0 ? (
        <p className="text-sm text-gray-400">No recipients configured.</p>
      ) : (
        <ul className="space-y-1">
          {recipients.map((email) => (
            <li
              key={email}
              className="flex items-center justify-between rounded-md bg-gray-50 border border-gray-200 px-3 py-1.5 text-sm"
            >
              <span className="text-gray-700">{email}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(email)}
                className="text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                aria-label={`Remove ${email}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
