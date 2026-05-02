interface AutoScrollToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export default function AutoScrollToggle({ enabled, onToggle }: AutoScrollToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      title={enabled ? 'Auto-scroll on — click to disable' : 'Auto-scroll off — click to enable'}
      className={[
        'flex items-center gap-1.5 h-7 rounded px-2 text-xs transition-colors border',
        enabled
          ? 'bg-blue-900/50 border-blue-500/50 text-blue-300 hover:bg-blue-900/70'
          : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200',
      ].join(' ')}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
      Auto-scroll
    </button>
  )
}
