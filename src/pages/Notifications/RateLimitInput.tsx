interface RateLimitInputProps {
  minutes: number
  disabled: boolean
  onChange: (minutes: number) => void
}

export default function RateLimitInput({ minutes, disabled, onChange }: RateLimitInputProps) {
  return (
    <div className="flex flex-col gap-1 max-w-xs">
      <label htmlFor="rate-limit" className="text-sm font-medium text-gray-700">
        Minimum interval between alerts
      </label>
      <div className="flex items-center gap-2">
        <input
          id="rate-limit"
          type="number"
          min={1}
          max={1440}
          disabled={disabled}
          value={minutes}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v) && v >= 1 && v <= 1440) onChange(v)
          }}
          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
            disabled:bg-gray-100 disabled:text-gray-500"
        />
        <span className="text-sm text-gray-500">minutes</span>
      </div>
      <p className="text-xs text-gray-400">
        Alerts of the same category will not be sent more than once per this interval.
      </p>
    </div>
  )
}
