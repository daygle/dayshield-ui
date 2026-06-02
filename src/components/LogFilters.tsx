import type { LiveLogsFilter, LogLevel, LogSource } from '../types/logs';
import { LOG_LEVELS, LOG_SOURCES } from '../utils/logMeta';

const SOURCES: { value: LogSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  ...LOG_SOURCES.map((s) => ({ value: s.value, label: s.label })),
];

const LEVELS: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  ...LOG_LEVELS.map((l) => ({ value: l.value, label: l.label })),
];

interface LogFiltersProps {
  filter: LiveLogsFilter;
  onChange: (next: Partial<LiveLogsFilter>) => void;
}

export default function LogFilters({ filter, onChange }: LogFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Source filter */}
      <select
        className="h-7 rounded border border-slate-600 bg-slate-800 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={filter.source}
        onChange={(e) => onChange({ source: e.target.value as LogSource | 'all' })}
      >
        {SOURCES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Level filter */}
      <select
        className="h-7 rounded border border-slate-600 bg-slate-800 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={filter.level}
        onChange={(e) => onChange({ level: e.target.value as LogLevel | 'all' })}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
