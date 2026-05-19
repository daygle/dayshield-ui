import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import FormField from '../../components/FormField';
import { getSystemSchedules, runSystemScheduleJob, updateSystemSchedules } from '../../api/system';
import type { ScheduleJobType, SystemScheduleJob, SystemSchedules } from '../../types';

interface SchedulesPanelProps {
  onError: (message: string | null) => void;
}

const JOB_ORDER: ScheduleJobType[] = [
  'dynamic_dns_update',
  'acme_renew',
  'suricata_rulesets_update',
];

const JOB_LABELS: Record<ScheduleJobType, string> = {
  dynamic_dns_update: 'Dynamic DNS Update',
  acme_renew: 'ACME Renewal',
  suricata_rulesets_update: 'Suricata Rulesets Update',
};

const JOB_DESCRIPTIONS: Record<ScheduleJobType, string> = {
  dynamic_dns_update: 'Refresh dynamic DNS providers on a fixed interval.',
  acme_renew: 'Check and renew ACME certificates before expiration.',
  suricata_rulesets_update: 'Download and apply the latest Suricata rulesets.',
};

const DEFAULT_INTERVALS: Record<ScheduleJobType, number> = {
  dynamic_dns_update: 10,
  acme_renew: 1440,
  suricata_rulesets_update: 360,
};

function normalizeSchedules(input: SystemSchedules | null | undefined): SystemSchedules {
  const jobsByType = new Map<ScheduleJobType, SystemScheduleJob>();

  for (const raw of input?.jobs ?? []) {
    if (!JOB_ORDER.includes(raw.job)) continue;
    jobsByType.set(raw.job, {
      ...raw,
      enabled: Boolean(raw.enabled),
      intervalMinutes: Math.max(
        1,
        Math.min(10080, Number(raw.intervalMinutes) || DEFAULT_INTERVALS[raw.job])
      ),
      lastRunAt: raw.lastRunAt ?? null,
      lastSuccess: raw.lastSuccess ?? null,
      lastMessage: raw.lastMessage ?? null,
    });
  }

  const jobs = JOB_ORDER.map((job) => {
    const existing = jobsByType.get(job);
    if (existing) return existing;
    return {
      job,
      enabled: true,
      intervalMinutes: DEFAULT_INTERVALS[job],
      lastRunAt: null,
      lastSuccess: null,
      lastMessage: null,
    };
  });

  return { jobs };
}

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString();
}

export default function SchedulesPanel({ onError }: SchedulesPanelProps) {
  const [schedules, setSchedules] = useState<SystemSchedules>(normalizeSchedules(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningJob, setRunningJob] = useState<ScheduleJobType | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getSystemSchedules()
      .then((res) => {
        setSchedules(normalizeSchedules(res.data));
        onError(null);
      })
      .catch((err: Error) => onError(err.message))
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const busy = saving || runningJob !== null;

  const sortedJobs = useMemo(() => {
    const order = new Map(JOB_ORDER.map((job, index) => [job, index]));
    return [...schedules.jobs].sort((a, b) => (order.get(a.job) ?? 999) - (order.get(b.job) ?? 999));
  }, [schedules.jobs]);

  const updateJob = (job: ScheduleJobType, patch: Partial<SystemScheduleJob>) => {
    setSchedules((prev) => ({
      jobs: prev.jobs.map((item) => (item.job === job ? { ...item, ...patch } : item)),
    }));
  };

  const handleSave = () => {
    setSaving(true);
    updateSystemSchedules(schedules)
      .then((res) => {
        setSchedules(normalizeSchedules(res.data));
        onError(null);
      })
      .catch((err: Error) => onError(err.message))
      .finally(() => setSaving(false));
  };

  const handleRunNow = (job: ScheduleJobType) => {
    setRunningJob(job);
    runSystemScheduleJob(job)
      .then((res) => {
        setSchedules(normalizeSchedules(res.data));
        onError(null);
      })
      .catch((err: Error) => onError(err.message))
      .finally(() => setRunningJob(null));
  };

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
        <p className="text-sm text-gray-500">Loading schedules...</p>
      ) : (
        <div className="space-y-4">
          {sortedJobs.map((job) => (
            <div key={job.job} className="rounded-lg border border-gray-200 bg-white p-3 md:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">{JOB_LABELS[job.job]}</h4>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${job.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {job.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{JOB_DESCRIPTIONS[job.job]}</p>
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

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={job.enabled}
                      disabled={busy}
                      onChange={(e) => updateJob(job.job, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                  <div className="h-5 w-px bg-gray-200" />
                  <FormField
                    id={`schedule-interval-${job.job}`}
                    label="Interval"
                    type="number"
                    min={1}
                    max={10080}
                    value={String(job.intervalMinutes)}
                    disabled={busy}
                    onChange={(e) =>
                      updateJob(job.job, {
                        intervalMinutes: Math.max(
                          1,
                          Math.min(10080, Number(e.target.value) || 1)
                        ),
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Last Run</div>
                    <div className="mt-1 text-sm font-medium text-gray-800">
                      {formatDate(job.lastRunAt)}
                    </div>
                  </div>
                  <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Result</div>
                    <div
                      className={`mt-1 text-sm font-medium ${job.lastSuccess === false ? 'text-red-700' : 'text-gray-800'}`}
                    >
                      {job.lastSuccess == null ? 'Not yet run' : job.lastSuccess ? 'Success' : 'Failed'}
                    </div>
                  </div>
                  <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Message</div>
                    <div className="mt-1 text-sm text-gray-700 line-clamp-2">
                      {job.lastMessage || 'No message'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
