import { useState } from 'react'
import { sendTestEmail } from '../../api/notifications'
import Button from '../../components/Button'
import FormField from '../../components/FormField'

interface TestEmailButtonProps {
  defaultRecipient: string
  disabled: boolean
  onResult: (success: boolean, message: string) => void
}

export default function TestEmailButton({ defaultRecipient, disabled, onResult }: TestEmailButtonProps) {
  const [recipient, setRecipient] = useState(defaultRecipient || '')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handle = () => {
    const email = recipient.trim()
    if (!email) return
    setSending(true)
    setResult(null)
    sendTestEmail({ recipient: email })
      .then((res) => {
        const r = { success: res.data.success, message: res.data.message }
        setResult(r)
        onResult(r.success, r.message)
      })
      .catch((err: Error) => {
        const r = { success: false, message: err.message }
        setResult(r)
        onResult(false, err.message)
      })
      .finally(() => setSending(false))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-start max-w-sm">
        <FormField
          id="test-recipient"
          label="Send test to"
          type="email"
          placeholder="someone@example.com"
          value={recipient}
          disabled={disabled || sending}
          className="flex-1"
          onChange={(e) => setRecipient(e.target.value)}
        />
        <Button
          variant="secondary"
          loading={sending}
          disabled={disabled || !recipient.trim()}
          onClick={handle}
          className="mt-6"
        >
          Send
        </Button>
      </div>

      {result && (
        <div
          className={[
            'flex items-start gap-2 rounded-md border px-4 py-3 text-sm',
            result.success
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700',
          ].join(' ')}
        >
          {result.success ? (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0V7zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  )
}
