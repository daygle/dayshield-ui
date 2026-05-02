import type { BackupSchedule, BackupScheduleFrequency } from '../../types'
import FormField from '../../components/FormField'
import Button from '../../components/Button'

interface ScheduleFormProps {
  schedule: BackupSchedule
  saving: boolean
  onChange: (s: BackupSchedule) => void
  onSave: () => void
}

const FREQUENCIES: { value: BackupScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function ScheduleForm({
  schedule,
  saving,
  onChange,
  onSave,
}: ScheduleFormProps) {
  const set = <K extends keyof BackupSchedule>(key: K, value: BackupSchedule[K]) =>
    onChange({ ...schedule, [key]: value })

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={schedule.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          <div
            className={`w-10 h-5 rounded-full transition-colors ${
              schedule.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          />
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              schedule.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">Enable scheduled backups</span>
      </label>

      <fieldset disabled={!schedule.enabled} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Frequency */}
          <FormField
            id="schedule-freq"
            label="Frequency"
            as="select"
            value={schedule.frequency}
            onChange={(e) => set('frequency', e.target.value as BackupScheduleFrequency)}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </FormField>

          {/* Time */}
          <FormField
            id="schedule-time"
            label="Time (24h)"
            type="time"
            value={schedule.time}
            onChange={(e) => set('time', e.target.value)}
          />

          {/* Retain count */}
          <FormField
            id="schedule-retain"
            label="Keep last N backups"
            type="number"
            min={1}
            max={100}
            value={String(schedule.retainCount)}
            onChange={(e) => set('retainCount', Number(e.target.value))}
          />
        </div>

        {/* Encrypt toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.encrypt}
            onChange={(e) => set('encrypt', e.target.checked)}
            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Encrypt scheduled backups</span>
        </label>
      </fieldset>

      <div className="flex justify-end">
        <Button onClick={onSave} loading={saving}>
          Save Schedule
        </Button>
      </div>
    </div>
  )
}
