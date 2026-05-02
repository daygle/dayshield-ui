import { useRef } from 'react'

interface LogSearchProps {
  value: string
  onChange: (value: string) => void
}

export default function LogSearch({ value, onChange }: LogSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative flex items-center">
      <svg
        className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search logs…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-48 rounded border border-slate-600 bg-slate-800 pl-7 pr-7 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); inputRef.current?.focus() }}
          className="absolute right-2 text-slate-500 hover:text-slate-300"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  )
}
