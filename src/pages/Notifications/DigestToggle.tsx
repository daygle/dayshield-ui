interface DigestToggleProps {
  enabled: boolean
  disabled: boolean
  onChange: (enabled: boolean) => void
}

export default function DigestToggle({ enabled, disabled, onChange }: DigestToggleProps) {
  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-40',
          enabled ? 'bg-blue-600' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
            'transform transition duration-200 ease-in-out',
            enabled ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>

      <div>
        <p className="text-sm font-medium text-gray-700">Digest mode</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Batch multiple alerts into a single summary email instead of sending one per event.
        </p>
      </div>
    </div>
  )
}
