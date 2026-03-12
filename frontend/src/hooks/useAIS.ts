import { useEffect, useRef, useCallback } from 'react'
import { useVesselStore } from '@/store/vesselStore'

type AISMessage =
  | { type: 'snapshot'; data: any[] }
  | { type: 'position'; data: any }
  | { type: 'ping' }

export function useAIS() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setVessels, updateVessel, isConnected, setConnected } = useVesselStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/ais`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: AISMessage = JSON.parse(event.data)
        if (msg.type === 'snapshot') {
          setVessels(msg.data)
        } else if (msg.type === 'position') {
          updateVessel(msg.data)
        }
        // 'ping' is a heartbeat - no action needed
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setConnected(false)
      // Reconnect after 5 seconds
      reconnectTimer.current = setTimeout(connect, 5000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [setVessels, updateVessel, setConnected])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  return { isConnected }
}
