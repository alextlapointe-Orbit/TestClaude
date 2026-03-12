import { useRef, useEffect, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { useQuery } from '@tanstack/react-query'
import { portsApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import { useConfigStore } from '@/store/configStore'
import type { VesselPosition, PortListItem } from '@/types'
import VesselFilterPanel from '@/components/Map/VesselFilterPanel'
import VesselDetailPanel from '@/components/Map/VesselDetailPanel'
import { Search, Layers, X, Filter } from 'lucide-react'
import clsx from 'clsx'

const CONGESTION_COLORS: Record<string, string> = {
  low: '#00c48c',
  medium: '#ffb800',
  high: '#ff6b35',
  critical: '#ff4757',
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const portMarkers = useRef<Map<number, mapboxgl.Marker>>(new Map())

  const [mapReady, setMapReady] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showPilOnly, setShowPilOnly] = useState(false)

  const { config } = useConfigStore()
  const { getFilteredVessels, selectedMmsi, selectVessel, vessels } = useVesselStore()

  const { data: ports } = useQuery({
    queryKey: ['ports'],
    queryFn: () => portsApi.list().then((r) => r.data as PortListItem[]),
    staleTime: 60_000,
  })

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !config?.mapbox_token || map.current) return

    mapboxgl.accessToken = config.mapbox_token
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [20, 20],
      zoom: 2.5,
      attributionControl: false,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    m.addControl(new mapboxgl.ScaleControl({ unit: 'nautical' }), 'bottom-right')

    m.on('load', () => {
      // Add sea route layer appearance
      m.setPaintProperty('water', 'fill-color', '#061525')
      m.setPaintProperty('water-shadow', 'fill-color', '#061525')
      setMapReady(true)
    })

    map.current = m
    return () => { m.remove(); map.current = null }
  }, [config?.mapbox_token])

  // Update port markers
  useEffect(() => {
    if (!mapReady || !map.current || !ports) return
    const m = map.current

    ports.forEach((port) => {
      const color = CONGESTION_COLORS[port.congestion_level] || '#00c48c'
      const existing = portMarkers.current.get(port.id)

      const el = document.createElement('div')
      el.className = 'port-marker'
      el.style.cssText = `
        width: 12px; height: 12px;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.2s;
        box-shadow: 0 0 8px ${color}80;
      `
      el.title = port.name

      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.6)' })
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

      if (existing) {
        existing.remove()
        portMarkers.current.delete(port.id)
      }

      const popup = new mapboxgl.Popup({ offset: 15, closeButton: false, className: 'tmm-popup' })
        .setHTML(`
          <div class="text-xs">
            <div class="font-semibold text-white mb-1">${port.name}</div>
            <div class="text-slate-300">${port.unlocode} · ${port.country}</div>
            <div class="flex items-center gap-1 mt-2">
              <span class="w-2 h-2 rounded-full" style="background:${color}"></span>
              <span style="color:${color}">${port.congestion_level.toUpperCase()}</span>
            </div>
            <div class="mt-1 space-y-0.5 text-slate-300">
              <div>Waiting: ${port.vessels_waiting} vessels</div>
              <div>At berth: ${port.vessels_at_berth} vessels</div>
              <div>Berth util: ${port.berth_utilization_pct.toFixed(0)}%</div>
            </div>
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([port.longitude, port.latitude])
        .setPopup(popup)
        .addTo(m)

      portMarkers.current.set(port.id, marker)
    })
  }, [mapReady, ports])

  // Update vessel markers from live store
  useEffect(() => {
    if (!mapReady || !map.current) return
    const m = map.current
    const filtered = getFilteredVessels()
    const filteredIds = new Set(filtered.map((v) => v.mmsi))

    // Remove markers for vessels no longer in filter
    markers.current.forEach((marker, mmsi) => {
      if (!filteredIds.has(mmsi)) {
        marker.remove()
        markers.current.delete(mmsi)
      }
    })

    // Add/update vessel markers
    filtered.forEach((vessel) => {
      const isSelected = vessel.mmsi === selectedMmsi
      const isPil = vessel.is_pil_vessel
      const existing = markers.current.get(vessel.mmsi)

      if (!existing) {
        const el = createVesselMarker(vessel, isPil, isSelected)
        el.addEventListener('click', () => selectVessel(vessel.mmsi))

        const popup = new mapboxgl.Popup({ offset: 15, closeButton: false })
          .setHTML(vesselPopupHtml(vessel))

        const marker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map' })
          .setLngLat([vessel.longitude, vessel.latitude])
          .setPopup(popup)
          .addTo(m)

        markers.current.set(vessel.mmsi, marker)
      } else {
        existing.setLngLat([vessel.longitude, vessel.latitude])
      }
    })
  }, [mapReady, vessels, selectedMmsi, getFilteredVessels, selectVessel])

  return (
    <div className="relative h-full">
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* No mapbox token message */}
      {config !== null && !config.mapbox_token && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900/90 z-10">
          <div className="text-center max-w-sm p-6 bg-navy-800 border border-navy-500 rounded-xl">
            <div className="text-amber-400 text-4xl mb-3">🗺️</div>
            <div className="text-slate-200 font-semibold mb-2">Mapbox API Key Required</div>
            <div className="text-sm text-slate-400">
              Set <code className="text-cyan-maritime">MAPBOX_TOKEN</code> in your environment variables to enable the interactive map.
            </div>
          </div>
        </div>
      )}

      {/* Filter toggle */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all',
            showFilters
              ? 'bg-cyan-maritime text-navy-900'
              : 'bg-navy-800/90 border border-navy-500 text-slate-300 hover:text-slate-100'
          )}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {useVesselStore.getState().filters.pilOnly && (
            <span className="bg-cyan-maritime/20 text-cyan-maritime text-xs px-1.5 rounded">PIL</span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute top-14 left-4 z-10 w-64">
          <VesselFilterPanel onClose={() => setShowFilters(false)} />
        </div>
      )}

      {/* Vessel detail panel */}
      {selectedMmsi && (
        <div className="absolute top-4 right-4 z-10 w-80">
          <VesselDetailPanel mmsi={selectedMmsi} onClose={() => selectVessel(null)} />
        </div>
      )}

      {/* Live stats bar */}
      <div className="absolute bottom-8 left-4 z-10">
        <div className="flex items-center gap-3 bg-navy-800/90 border border-navy-500 rounded-lg px-3 py-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-cyan-maritime rounded-full animate-pulse" />
            {vessels.size.toLocaleString()} vessels tracked
          </span>
          <span>·</span>
          <span>{ports?.length ?? 0} ports monitored</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 right-4 z-10">
        <div className="bg-navy-800/90 border border-navy-500 rounded-lg p-3 text-xs space-y-1.5">
          <div className="text-slate-400 font-medium uppercase tracking-wider mb-2">Port Status</div>
          {Object.entries(CONGESTION_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-slate-300 capitalize">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function createVesselMarker(vessel: VesselPosition, isPil: boolean, isSelected: boolean): HTMLElement {
  const el = document.createElement('div')
  const size = isSelected ? 14 : 8
  const color = isPil ? '#00d4ff' : vessel.vessel_type?.includes('Container') ? '#60a5fa' : '#94a3b8'
  el.style.cssText = `
    width: ${size}px; height: ${size}px;
    background: ${color};
    border: 1px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.3)'};
    border-radius: 2px;
    cursor: pointer;
    transform: rotate(${vessel.course ?? 0}deg);
    transition: all 0.3s;
    opacity: 0.9;
  `
  return el
}

function vesselPopupHtml(v: VesselPosition): string {
  return `
    <div class="text-xs min-w-[160px]">
      <div class="font-semibold text-white mb-1">${v.name || 'Unknown'}</div>
      <div class="text-slate-400">${v.mmsi} ${v.flag ? '· ' + v.flag : ''}</div>
      ${v.is_pil_vessel ? '<div class="text-cyan-400 font-medium mt-1">PIL Vessel</div>' : ''}
      <div class="mt-2 space-y-0.5 text-slate-300">
        <div>Type: ${v.vessel_type || 'Unknown'}</div>
        ${v.speed_knots != null ? `<div>Speed: ${v.speed_knots.toFixed(1)} kn</div>` : ''}
        ${v.destination ? `<div>Dest: ${v.destination}</div>` : ''}
        ${v.draught ? `<div>Draft: ${v.draught}m</div>` : ''}
      </div>
    </div>
  `
}
