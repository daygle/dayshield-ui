import { useEffect, useRef, useState } from 'react'
import type { MetricsSnapshot } from '../types'

const WS_URL = 'ws://localhost:8080/api/metrics/ws'

export function useMetricsStream() {
  const [data, setData] = useState<MetricsSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    function connect() {
      if (unmountedRef.current) return

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!unmountedRef.current) setConnected(true)
      }

      ws.onmessage = (event) => {
        if (unmountedRef.current) return
        try {
          const snapshot: MetricsSnapshot = JSON.parse(event.data as string)
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

  return { data, connected }
}
