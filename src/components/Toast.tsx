import { useToast, type Toast } from '../context/ToastContext'

const variantStyles: Record<Toast['variant'], string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-blue-600 text-white',
}

const variantIcons: Record<Toast['variant'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast()
  return (
    <div
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={[
        'flex items-start gap-2 px-4 py-3 rounded-md shadow-lg text-sm max-w-xs w-full',
        variantStyles[toast.variant],
      ].join(' ')}
    >
      <span className="font-bold shrink-0">{variantIcons[toast.variant]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-2 shrink-0 opacity-80 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
