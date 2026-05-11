import { useEffect, useRef, useState } from 'react'
import { getAuthToken } from '../api/client'
import { normalizeMetricsSnapshot } from '../api/metrics'
import type { MetricsSnapshot } from '../types'

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host || 'localhost:8443'
  const token = getAuthToken()
  const suffix = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${proto}//${host}/metrics/ws${suffix}`
}

export function useMetricsStream() {
  const [data, setData] = useState<MetricsSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    function connect() {
      if (unmountedRef.current) return

      const ws = new WebSocket(getWsUrl())
      wsRef.current = ws

      ws.onopen = () => {
        if (!unmountedRef.current) {
          setConnected(true)
          setError(null)
        }
      }

      ws.onmessage = (event) => {
        if (unmountedRef.current) return
        try {
          const snapshot: MetricsSnapshot = normalizeMetricsSnapshot(
            JSON.parse(event.data as string),
          )
          setData(snapshot)
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        if (unmountedRef.current) return
        setConnected(false)
        // reconnect after 3 seconds
        retryTimerRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        if (!unmountedRef.current) {
          setError('Metrics stream connection failed. Retrying…')
        }
        ws.close()
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [])

  return { data, connected, error }
}
