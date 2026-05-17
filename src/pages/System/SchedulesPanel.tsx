import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import FormField from '../../components/FormField'
import {
  getSystemSchedules,
  runSystemScheduleJob,
  updateSystemSchedules,
} from '../../api/system'
import type { ScheduleJobType, SystemScheduleJob, SystemSchedules } from '../../types'

const JOB_LABELS: Record<ScheduleJobType, string> = {
  dynamic_dns_update: 'Dynamic DNS Update',
  acme_renew: 'ACME Renewal',
  suricata_rulesets_update: 'Suricata Rulesets Update',
}

const JOB_DESCRIPTIONS: Record<ScheduleJobType, string> = {
  dynamic_dns_update: 'Runs configured Dynamic DNS provider updates.',
  acme_renew: 'Checks certificate expiry and renews ACME certificates when needed.',
  suricata_rulesets_update: 'Checks managed Suricata rulesets for updates and applies available updates.',
}

interface Props {
  onError: (message: string | null) => void
}

function formatDate(value?: string | null): string {
  if (!value) return 'Never'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function normalizeSchedules(data: SystemSchedules): SystemSchedules {
  const required: ScheduleJobType[] = ['dynamic_dns_update', 'acme_renew', 'suricata_rulesets_update']
  const byJob = new Map(data.jobs.map((job) => [job.job, job]))

  const jobs: SystemScheduleJob[] = required.map((job) => {
    const existing = byJob.get(job)
    if (existing) return existing

    return {
      job,
      enabled: false,
      intervalMinutes: job === 'dynamic_dns_update' ? 10 : job === 'acme_renew' ? 360 : 240,
      lastRunAt: null,
      lastSuccess: null,
      lastMessage: null,
    }
  })

  return { jobs }
}

export default function SchedulesPanel({ onError }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runningJob, setRunningJob] = useState<ScheduleJobType | null>(null)
  const [schedules, setSchedules] = useState<SystemSchedules>({ jobs: [] })

  const busy = loading || saving

  const sortedJobs = useMemo(
    () => [...schedules.jobs],
    [schedules.jobs],
  )

  const load = useCallback(() => {
    setLoading(true)
    getSystemSchedules()
      .then((res) => {
        setSchedules(normalizeSchedules(res.data))
        onError(null)
      })
      .catch((err: Error) => onError(err.message))
      .finally(() => setLoading(false))
  }, [onError])

  useEffect(load, [load])

  const updateJob = (job: ScheduleJobType, patch: Partial<SystemScheduleJob>) => {
    setSchedules((prev) => ({
      jobs: prev.jobs.map((item) => (item.job === job ? { ...item, ...patch } : item)),
    }))
  }

  const handleSave = () => {
    setSaving(true)
    updateSystemSchedules(schedules)
      .then((res) => {
        setSchedules(normalizeSchedules(res.data))
        onError(null)
      })
      .catch((err: Error) => onError(err.message))
      .finally(() => setSaving(false))
  }

  const handleRunNow = (job: ScheduleJobType) => {
    setRunningJob(job)
    runSystemScheduleJob(job)
      .then((res) => {
        setSchedules(normalizeSchedules(res.data))
        onError(null)
      })
      .catch((err: Error) => onError(err.message))
      .finally(() => setRunningJob(null))
  }

  return (
    <Card
      title="Schedules"
      subtitle="Cron-like interval schedules for system jobs."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={load}>
            Refresh
          </Button>
          <Button size="sm" disabled={busy} loading={saving} onClick={handleSave}>
            Save
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading schedules…</p>
      ) : (
        <div className="space-y-4">
          {sortedJobs.map((job) => (
            <div key={job.job} className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">{JOB_LABELS[job.job]}</h4>
                  <p className="text-xs text-gray-500">{JOB_DESCRIPTIONS[job.job]}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={runningJob === job.job}
                  disabled={busy || !job.enabled}
                  onClick={() => handleRunNow(job.job)}
                >
                  Run Now
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={job.enabled}
                    disabled={busy}
                    onChange={(e) => updateJob(job.job, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>

                <FormField
                  id={`schedule-interval-${job.job}`}
                  label="Interval (minutes)"
                  type="number"
                  min={1}
                  max={10080}
                  value={String(job.intervalMinutes)}
                  disabled={busy}
                  onChange={(e) =>
                    updateJob(job.job, {
                      intervalMinutes: Math.max(1, Math.min(10080, Number(e.target.value) || 1)),
                    })
                  }
                />
              </div>

              <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
                <p>
                  Last run: <span className="font-medium text-gray-800">{formatDate(job.lastRunAt)}</span>
                </p>
                <p>
                  Last result:{' '}
                  <span className={`font-medium ${job.lastSuccess === false ? 'text-red-700' : 'text-gray-800'}`}>
                    {job.lastSuccess == null ? 'Not yet run' : job.lastSuccess ? 'Success' : 'Failed'}
                  </span>
                </p>
                {job.lastMessage && <p className="text-gray-700">{job.lastMessage}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
