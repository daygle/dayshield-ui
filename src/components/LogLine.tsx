import type { LogEntry } from '../types/logs';
import {
  LOG_LEVEL_BADGES,
  LOG_LEVEL_TEXT,
  LOG_SOURCE_BADGES,
  LOG_SOURCE_LABELS,
} from '../utils/logMeta';

interface LogLineProps {
  entry: LogEntry;
  highlight?: string;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300/30 text-yellow-200 rounded-sm">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function LogLine({ entry, highlight = '' }: LogLineProps) {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const ms = new Date(entry.timestamp).getMilliseconds().toString().padStart(3, '0');

  return (
    <div
      className={`flex items-start gap-2 px-3 py-0.5 text-xs font-mono hover:bg-white/5 leading-5 ${LOG_LEVEL_TEXT[entry.level]}`}
    >
      {/* Timestamp */}
      <span className="shrink-0 text-slate-500 w-28">
        {time}.{ms}
      </span>

      {/* Source badge */}
      <span
        className={`shrink-0 inline-block px-1.5 rounded text-[10px] font-semibold uppercase leading-4 mt-0.5 ${LOG_SOURCE_BADGES[entry.source]}`}
      >
        {LOG_SOURCE_LABELS[entry.source]}
      </span>

      {/* Level badge */}
      <span
        className={`shrink-0 inline-block px-1.5 rounded text-[10px] font-semibold uppercase leading-4 mt-0.5 w-14 text-center ${LOG_LEVEL_BADGES[entry.level]}`}
      >
        {entry.level}
      </span>

      {/* Message */}
      <span className="break-all">{highlightText(entry.message, highlight)}</span>
    </div>
  );
}
