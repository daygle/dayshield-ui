import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../api/client';
import { searchLogs } from '../api/logs';
import type { LiveLogsFilter, LogEntry, LogLevel, LogSource, WsStatus } from '../types/logs';

const MAX_BUFFER = 2000;

/**
 * Normalise a raw event from the log stream (live WebSocket or historical
 * search) into a {@link LogEntry}.
 *
 * The backend already classifies every event and emits a flat record carrying
 * string `source`, `level` and `message` fields (see
 * `LogEvent::to_client_payload` in dayshield-core). The UI trusts that
 * classification rather than re-deriving it, so this function only validates
 * the shape and fills in defaults.
 */
function normalizeWsEvent(raw: unknown, seq: number): LogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw as Record<string, unknown>;

  if (
    typeof event.source !== 'string' ||
    typeof event.level !== 'string' ||
    typeof event.message !== 'string'
  ) {
    return null;
  }

  const timestamp =
    typeof event.timestamp === 'string' && event.timestamp
      ? event.timestamp
      : new Date().toISOString();
  const id = typeof event.id === 'string' && event.id ? event.id : `${timestamp}-${seq}`;
  return {
    id,
    timestamp,
    source: event.source as LogSource,
    level: event.level as LogLevel,
    message: event.message,
    raw: JSON.stringify(event),
    meta: event.meta as Record<string, unknown> | undefined,
  };
}

function buildWsUrl(): string {
  const base = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  let root: string;
  if (base && base.trim()) {
    const url = new URL(base, window.location.origin);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    root = url.origin;
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    root = `${proto}//${window.location.host}`;
  }
  const token = getAuthToken();
  const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${root}/logs/ws${suffix}`;
}

export function useLiveLogs(options?: { autoConnect?: boolean }) {
  const autoConnect = options?.autoConnect ?? true;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [filter, setFilter] = useState<LiveLogsFilter>({
    source: 'all',
    level: 'all',
    search: '',
  });
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const pausedRef = useRef(paused);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const sequenceRef = useRef(0);

  // keep paused ref in sync so the WS message handler always sees latest value
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) return;

    setStatus('connecting');
    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      setStatus('connected');
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current || pausedRef.current) return;
      try {
        const parsed = JSON.parse(event.data as string) as unknown;
        sequenceRef.current += 1;
        const entry = normalizeWsEvent(parsed, sequenceRef.current);
        if (!entry) return;
        setLogs((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_BUFFER ? next.slice(next.length - MAX_BUFFER) : next;
        });
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      if (unmountedRef.current) return;
      setStatus('error');
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setStatus('disconnected');
      // fixed 3-second delay before reconnect
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (autoConnect) {
      connect();
    }
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [autoConnect, connect]);

  const clearLogs = useCallback(() => setLogs([]), []);

  const loadHistoricalRange = useCallback(async (from: string, to: string) => {
    const res = await searchLogs({ from, to, limit: MAX_BUFFER });
    const raw = Array.isArray(res.data) ? res.data : [];
    const normalized: LogEntry[] = [];
    let localSeq = 0;
    for (const item of raw) {
      localSeq += 1;
      const entry = normalizeWsEvent(item, localSeq);
      if (entry) normalized.push(entry);
    }

    setLogs(normalized);
    setPaused(true);
    setAutoScroll(true);
    return normalized.length;
  }, []);

  const filteredLogs = logs.filter((entry) => {
    if (filter.source !== 'all' && entry.source !== filter.source) return false;
    if (filter.level !== 'all' && entry.level !== filter.level) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!entry.message.toLowerCase().includes(q) && !entry.raw?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return {
    logs: filteredLogs,
    allLogs: logs,
    totalCount: logs.length,
    status,
    filter,
    setFilter,
    paused,
    setPaused,
    autoScroll,
    setAutoScroll,
    clearLogs,
    reconnect: connect,
    loadHistoricalRange,
  };
}
