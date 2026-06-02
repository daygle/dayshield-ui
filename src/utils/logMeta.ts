import type { LogLevel, LogSource } from '../types/logs';

/**
 * Single source of truth for log taxonomy (sources and levels).
 *
 * Every piece of the Logs / Live Logs UI — the source tabs, the filter
 * dropdowns, the per-line badges, and the tab counters — derives from the
 * registries below. Keeping one ordered list prevents the groups from drifting
 * apart (e.g. a source showing in the tabs but missing from the filter).
 */

export interface LogSourceMeta {
  value: LogSource;
  /** Human-readable label shown in tabs, filters and line badges. */
  label: string;
  /** Tailwind classes for the source badge rendered on each log line. */
  badge: string;
}

/** Canonical, display-ordered list of every log source. */
export const LOG_SOURCES: LogSourceMeta[] = [
  { value: 'suricata', label: 'Suricata', badge: 'bg-purple-900/60 text-purple-300' },
  { value: 'ui', label: 'UI', badge: 'bg-slate-800/60 text-slate-300' },
  { value: 'ai', label: 'AI Threat Engine', badge: 'bg-cyan-900/60 text-cyan-300' },
  { value: 'firewall', label: 'Firewall', badge: 'bg-blue-900/60 text-blue-300' },
  { value: 'interfaces', label: 'Interfaces', badge: 'bg-emerald-900/60 text-emerald-300' },
  { value: 'gateways', label: 'Gateways', badge: 'bg-violet-900/60 text-violet-300' },
  { value: 'dns', label: 'DNS', badge: 'bg-lime-900/60 text-lime-300' },
  { value: 'ntp', label: 'NTP', badge: 'bg-sky-900/60 text-sky-300' },
  { value: 'crowdsec', label: 'CrowdSec', badge: 'bg-orange-900/60 text-orange-300' },
  { value: 'pppoe', label: 'PPPoE', badge: 'bg-fuchsia-900/60 text-fuchsia-300' },
  { value: 'backup_restore', label: 'Backup/Restore', badge: 'bg-rose-900/60 text-rose-300' },
  { value: 'updates', label: 'Updates', badge: 'bg-teal-900/60 text-teal-300' },
  { value: 'honeypot', label: 'Honeypot', badge: 'bg-red-900/60 text-red-300' },
  { value: 'captive_portal', label: 'Captive Portal', badge: 'bg-yellow-900/60 text-yellow-300' },
  { value: 'system', label: 'System', badge: 'bg-slate-700/70 text-slate-300' },
  { value: 'dhcp', label: 'DHCP', badge: 'bg-green-900/60 text-green-300' },
  { value: 'vpn', label: 'VPN', badge: 'bg-indigo-900/60 text-indigo-300' },
  { value: 'cloudflared', label: 'Cloudflared', badge: 'bg-pink-900/60 text-pink-300' },
  { value: 'acme', label: 'ACME', badge: 'bg-amber-900/60 text-amber-300' },
];

// Compile-time guard: every `LogSource` must appear in `LOG_SOURCES`. If a new
// source is added to the type but not here, this line fails to type-check.
type MissingSources = Exclude<LogSource, (typeof LOG_SOURCES)[number]['value']>;
const _ensureAllSourcesRegistered: MissingSources extends never ? true : never = true;
void _ensureAllSourcesRegistered;

export const LOG_SOURCE_VALUES: LogSource[] = LOG_SOURCES.map((s) => s.value);

export const LOG_SOURCE_LABELS = Object.fromEntries(
  LOG_SOURCES.map((s) => [s.value, s.label])
) as Record<LogSource, string>;

export const LOG_SOURCE_BADGES = Object.fromEntries(
  LOG_SOURCES.map((s) => [s.value, s.badge])
) as Record<LogSource, string>;

export interface LogLevelMeta {
  value: LogLevel;
  /** Human-readable label shown in the level filter. */
  label: string;
  /** Tailwind text colour applied to the whole log line. */
  text: string;
  /** Tailwind classes for the level badge rendered on each log line. */
  badge: string;
}

/** Canonical, severity-ordered list of every log level. */
export const LOG_LEVELS: LogLevelMeta[] = [
  { value: 'debug', label: 'Debug', text: 'text-slate-400', badge: 'bg-slate-700 text-slate-400' },
  { value: 'info', label: 'Info', text: 'text-slate-200', badge: 'bg-slate-700 text-slate-300' },
  {
    value: 'warning',
    label: 'Warning',
    text: 'text-yellow-400',
    badge: 'bg-yellow-900/60 text-yellow-300',
  },
  { value: 'error', label: 'Error', text: 'text-red-400', badge: 'bg-red-900/60 text-red-300' },
  {
    value: 'critical',
    label: 'Critical',
    text: 'text-red-300 font-bold',
    badge: 'bg-red-700 text-red-100',
  },
];

export const LOG_LEVEL_VALUES: LogLevel[] = LOG_LEVELS.map((l) => l.value);

export const LOG_LEVEL_TEXT = Object.fromEntries(
  LOG_LEVELS.map((l) => [l.value, l.text])
) as Record<LogLevel, string>;

export const LOG_LEVEL_BADGES = Object.fromEntries(
  LOG_LEVELS.map((l) => [l.value, l.badge])
) as Record<LogLevel, string>;
