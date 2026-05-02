import type { NotifyCategory } from '../../types'

const ALL_CATEGORIES: { value: NotifyCategory; label: string; color: string }[] = [
  { value: 'firewall', label: 'Firewall',  color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'ids',      label: 'IDS/IPS',   color: 'bg-red-100 text-red-700 border-red-200'           },
  { value: 'vpn',      label: 'VPN',       color: 'bg-indigo-100 text-indigo-700 border-indigo-200'  },
  { value: 'system',   label: 'System',    color: 'bg-gray-100 text-gray-700 border-gray-200'        },
  { value: 'crowdsec', label: 'CrowdSec',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'acme',     label: 'ACME/TLS',  color: 'bg-green-100 text-green-700 border-green-200'    },
  { value: 'dhcp',     label: 'DHCP',      color: 'bg-teal-100 text-teal-700 border-teal-200'       },
  { value: 'backup',   label: 'Backup',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
]

interface CategorySelectorProps {
  selected: NotifyCategory[]
  disabled: boolean
  onChange: (categories: NotifyCategory[]) => void
}

export default function CategorySelector({ selected, disabled, onChange }: CategorySelectorProps) {
  const toggle = (cat: NotifyCategory) => {
    if (selected.includes(cat)) {
      onChange(selected.filter((c) => c !== cat))
    } else {
      onChange([...selected, cat])
    }
  }

  const selectAll = () => onChange(ALL_CATEGORIES.map((c) => c.value))
  const clearAll  = () => onChange([])

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={selectAll}
          className="text-xs text-blue-600 hover:underline disabled:opacity-40"
        >
          Select all
        </button>
        <span className="text-xs text-gray-300">|</span>
        <button
          type="button"
          disabled={disabled}
          onClick={clearAll}
          className="text-xs text-blue-600 hover:underline disabled:opacity-40"
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map(({ value, label, color }) => {
          const active = selected.includes(value)
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(value)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                'disabled:opacity-40',
                active ? color : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400',
              ].join(' ')}
            >
              {active && (
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
