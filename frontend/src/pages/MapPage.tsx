import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useQuery } from '@tanstack/react-query'
import { portsApi, vesselsApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import { useConfigStore } from '@/store/configStore'
import type { PortListItem } from '@/types'
import VesselFilterPanel from '@/components/Map/VesselFilterPanel'
import VesselDetailPanel from '@/components/Map/VesselDetailPanel'
import { Filter } from 'lucide-react'
import clsx from 'clsx'

const CONGESTION_COLORS: Record<string, string> = {
  low: '#00c48c',
  medium: '#ffb800',
  high: '#ff6b35',
  critical: '#ff4757',
}

// Boat SVG icons — pointing north, rotated by vessel course via Mapbox
const BOAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <polygon points="10,1 16,17 10,13 4,17" fill="#93c5fd" stroke="#1e3a5f" stroke-width="1"/>
</svg>`

const PIL_BOAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <polygon points="10,1 16,17 10,13 4,17" fill="#00d4ff" stroke="#003d5c" stroke-width="1"/>
  <text x="10" y="11" text-anchor="middle" font-size="5" font-weight="bold" fill="#003d5c" font-family="sans-serif">PIL</text>
</svg>`

function svgToImageData(svg: string, size: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image(size, size)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, size, size)
      resolve(ctx.getImageData(0, 0, size, size))
    }
    img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const portMarkers = useRef<Map<number, mapboxgl.Marker>>(new Map())
  const rafPending = useRef(false)

  const [mapReady, setMapReady] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const { config } = useConfigStore()
  const { getFilteredVessels, selectedMmsi, selectVessel, vessels } = useVesselStore()

  const { data: ports } = useQuery({
    queryKey: ['ports'],
    queryFn: () => portsApi.list().then((r) => r.data as PortListItem[]),
    staleTime: 60_000,
  })

  const { data: track } = useQuery({
    queryKey: ['vessel-track', selectedMmsi],
    queryFn: () => vesselsApi.getTrack(selectedMmsi!, 48).then((r) => r.data),
    enabled: !!selectedMmsi,
  })

  const { data: calls } = useQuery({
    queryKey: ['vessel-calls', selectedMmsi],
    queryFn: () => vesselsApi.getCalls(selectedMmsi!).then((r) => r.data),
    enabled: !!selectedMmsi,
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

    m.on('load', async () => {
      m.setPaintProperty('water', 'fill-color', '#061525')
      m.setPaintProperty('water-shadow', 'fill-color', '#061525')

      // Load boat icons into Mapbox
      try {
        const [boatData, pilData] = await Promise.all([
          svgToImageData(BOAT_SVG, 20),
          svgToImageData(PIL_BOAT_SVG, 20),
        ])
        m.addImage('boat', boatData)
        m.addImage('boat-pil', pilData)
      } catch {
        // fallback: no icon loaded, symbols will be invisible - acceptable
      }

      // Vessel GeoJSON source + symbol layer (WebGL — handles thousands of vessels)
      m.addSource('vessels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      m.addLayer({
        id: 'vessels-layer',
        type: 'symbol',
        source: 'vessels',
        layout: {
          'icon-image': ['case', ['get', 'pil'], 'boat-pil', 'boat'],
          'icon-size': ['case', ['get', 'selected'], 2.0, 1.2],
          'icon-rotate': ['get', 'course'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': ['case', ['get', 'selected'], 1.0, 0.85],
        },
      })

      // Vessel track line layer
      m.addSource('vessel-track', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      m.addLayer({
        id: 'vessel-track-layer',
        type: 'line',
        source: 'vessel-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#00d4ff',
          'line-width': 1.5,
          'line-opacity': 0.4,
          'line-dasharray': [3, 2],
        },
      })

      // Historical AIS position dots
      m.addSource('vessel-track-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Halo for most-recent point
      m.addLayer({
        id: 'vessel-track-points-halo',
        type: 'circle',
        source: 'vessel-track-points',
        filter: ['==', ['get', 'is_latest'], true],
        paint: {
          'circle-radius': 10,
          'circle-color': '#00d4ff',
          'circle-opacity': 0.15,
          'circle-stroke-width': 0,
        },
      })

      // All historical dots — color fades old→new (dark blue → cyan)
      m.addLayer({
        id: 'vessel-track-points-layer',
        type: 'circle',
        source: 'vessel-track-points',
        paint: {
          'circle-radius': [
            'case', ['==', ['get', 'is_latest'], true], 5,
            ['>', ['get', 'age_frac'], 0.8], 3.5,
            2.5,
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'age_frac'],
            0, '#1a3a5c',
            0.5, '#0077aa',
            1, '#00d4ff',
          ],
          'circle-opacity': [
            'interpolate', ['linear'], ['get', 'age_frac'],
            0, 0.3,
            1, 0.95,
          ],
          'circle-stroke-width': ['case', ['==', ['get', 'is_latest'], true], 1.5, 0.5],
          'circle-stroke-color': ['case', ['==', ['get', 'is_latest'], true], '#ffffff', '#00d4ff'],
          'circle-stroke-opacity': 0.6,
        },
      })

      // Click on vessel symbol
      m.on('click', 'vessels-layer', (e) => {
        const f = e.features?.[0]
        if (f?.properties?.mmsi) selectVessel(f.properties.mmsi)
      })

      m.on('mouseenter', 'vessels-layer', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'vessels-layer', () => { m.getCanvas().style.cursor = '' })

      // Hover popup on historical track dots
      const trackPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'tmm-popup',
        offset: 8,
      })

      m.on('mouseenter', 'vessel-track-points-layer', (e) => {
        m.getCanvas().style.cursor = 'crosshair'
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as any
        const coord = (f.geometry as any).coordinates as [number, number]
        const time = p.timestamp ? new Date(p.timestamp).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'
        trackPopup.setLngLat(coord).setHTML(`
          <div class="text-xs space-y-0.5">
            <div class="font-semibold text-white">${time}</div>
            ${p.speed != null ? `<div class="text-slate-300">Speed: ${Number(p.speed).toFixed(1)} kn</div>` : ''}
            ${p.course != null ? `<div class="text-slate-300">Course: ${Number(p.course).toFixed(0)}°</div>` : ''}
            <div class="text-slate-400">${Number(coord[1]).toFixed(4)}°, ${Number(coord[0]).toFixed(4)}°</div>
          </div>
        `).addTo(m)
      })

      m.on('mouseleave', 'vessel-track-points-layer', () => {
        m.getCanvas().style.cursor = ''
        trackPopup.remove()
      })

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
      portMarkers.current.get(port.id)?.remove()

      const el = document.createElement('div')
      el.style.cssText = `width:12px;height:12px;background:${color};border:2px solid rgba(255,255,255,0.3);border-radius:50%;cursor:pointer;box-shadow:0 0 8px ${color}80;transition:transform 0.2s,box-shadow 0.2s`
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.6)' })
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

      const popup = new mapboxgl.Popup({ offset: 15, closeButton: false })
        .setHTML(`<div class="text-xs">
          <div class="font-semibold text-white mb-1">${port.name}</div>
          <div class="text-slate-300">${port.unlocode} · ${port.country}</div>
          <div class="flex items-center gap-1 mt-2">
            <span class="w-2 h-2 rounded-full" style="background:${color}"></span>
            <span style="color:${color}">${port.congestion_level.toUpperCase()}</span>
          </div>
          <div class="mt-1 space-y-0.5 text-slate-300">
            <div>Waiting: ${port.vessels_waiting}</div>
            <div>At berth: ${port.vessels_at_berth}</div>
            <div>Berth util: ${port.berth_utilization_pct.toFixed(0)}%</div>
          </div>
        </div>`)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([port.longitude, port.latitude])
        .setPopup(popup)
        .addTo(m)

      portMarkers.current.set(port.id, marker)
    })
  }, [mapReady, ports])

  // Update vessel GeoJSON source — throttled via requestAnimationFrame
  useEffect(() => {
    if (!mapReady || !map.current) return
    if (rafPending.current) return
    rafPending.current = true

    requestAnimationFrame(() => {
      rafPending.current = false
      const m = map.current
      if (!m) return
      const source = m.getSource('vessels') as mapboxgl.GeoJSONSource
      if (!source) return

      // Filter: only large SOLAS-compliant container ships (LOA >= 100m or unknown)
      const filtered = getFilteredVessels().filter((v) => {
        if (v.loa_m !== null && v.loa_m !== undefined && v.loa_m < 100) return false
        return true
      })

      const features = filtered.map((v) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [v.longitude, v.latitude] },
        properties: {
          mmsi: v.mmsi,
          name: v.name,
          pil: v.is_pil_vessel,
          selected: v.mmsi === selectedMmsi,
          course: v.course ?? 0,
        },
      }))

      source.setData({ type: 'FeatureCollection', features })
    })
  }, [mapReady, vessels, selectedMmsi, getFilteredVessels])

  // Render vessel track (line + individual position dots) when selected
  useEffect(() => {
    if (!mapReady || !map.current) return
    const m = map.current
    const lineSource = m.getSource('vessel-track') as mapboxgl.GeoJSONSource
    const pointSource = m.getSource('vessel-track-points') as mapboxgl.GeoJSONSource
    if (!lineSource || !pointSource) return

    const empty = { type: 'FeatureCollection' as const, features: [] }

    if (!selectedMmsi || !track || track.length === 0) {
      lineSource.setData(empty)
      pointSource.setData(empty)
      return
    }

    const validPts = track.filter((p: any) => (p.lng ?? p.longitude) != null)

    // Line
    if (validPts.length >= 2) {
      lineSource.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: validPts.map((p: any) => [p.lng ?? p.longitude, p.lat ?? p.latitude]) },
          properties: {},
        }],
      })
    } else {
      lineSource.setData(empty)
    }

    // Individual position dots with age fraction (0=oldest, 1=newest)
    const tMin = Math.min(...validPts.map((p: any) => new Date(p.timestamp).getTime()))
    const tMax = Math.max(...validPts.map((p: any) => new Date(p.timestamp).getTime()))
    const tRange = tMax - tMin || 1

    const pointFeatures = validPts.map((p: any, i: number) => {
      const t = new Date(p.timestamp).getTime()
      const age_frac = (t - tMin) / tRange
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng ?? p.longitude, p.lat ?? p.latitude] },
        properties: {
          timestamp: p.timestamp,
          speed: p.speed,
          course: p.course,
          age_frac,
          is_latest: i === validPts.length - 1,
        },
      }
    })

    pointSource.setData({ type: 'FeatureCollection', features: pointFeatures })
  }, [mapReady, selectedMmsi, track])

  // Fly to selected vessel
  useEffect(() => {
    if (!mapReady || !map.current || !selectedMmsi) return
    const vessel = vessels.get(selectedMmsi)
    if (vessel) {
      map.current.flyTo({
        center: [vessel.longitude, vessel.latitude],
        zoom: Math.max(map.current.getZoom(), 5),
        duration: 1000,
      })
    }
  }, [mapReady, selectedMmsi])

  // Highlight current port when vessel calls are loaded
  useEffect(() => {
    if (!mapReady || !map.current) return

    // Reset all port highlights first
    portMarkers.current.forEach((marker) => {
      const el = marker.getElement()
      el.style.transform = ''
      el.style.boxShadow = ''
    })

    if (!calls || !selectedMmsi) return

    const currentCall = (calls as any[]).find((c) =>
      c.status === 'at_berth' || c.status === 'waiting' || c.status === 'anchored'
    ) || (calls as any[])[0]

    if (!currentCall?.port_id) return

    const portMarker = portMarkers.current.get(currentCall.port_id)
    if (portMarker) {
      const el = portMarker.getElement()
      el.style.transform = 'scale(2.2)'
      el.style.boxShadow = '0 0 16px #00d4ff, 0 0 6px #00d4ff'
      el.style.border = '2px solid #00d4ff'
    }
  }, [mapReady, calls, selectedMmsi])

  return (
    <div className="relative h-full">
      <div ref={mapContainer} className="absolute inset-0" />

      {config !== null && !config.mapbox_token && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900/90 z-10">
          <div className="text-center max-w-sm p-6 bg-navy-800 border border-navy-500 rounded-xl">
            <div className="text-amber-400 text-4xl mb-3">🗺️</div>
            <div className="text-slate-200 font-semibold mb-2">Mapbox API Key Required</div>
            <div className="text-sm text-slate-400">
              Set <code className="text-cyan-maritime">MAPBOX_TOKEN</code> in your environment variables.
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

      {showFilters && (
        <div className="absolute top-14 left-4 z-10 w-64">
          <VesselFilterPanel onClose={() => setShowFilters(false)} />
        </div>
      )}

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
          <div className="text-slate-400 font-medium uppercase tracking-wider mb-2">Vessels</div>
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 14, background: '#00d4ff', clipPath: 'polygon(50% 0%, 100% 100%, 50% 78%, 0% 100%)' }} />
            <span className="text-cyan-maritime font-medium">PIL Fleet</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 14, background: '#93c5fd', clipPath: 'polygon(50% 0%, 100% 100%, 50% 78%, 0% 100%)' }} />
            <span className="text-slate-300">Container Ship</span>
          </div>
          <div className="border-t border-navy-600 pt-1.5 mt-1.5">
            <div className="text-slate-400 font-medium uppercase tracking-wider mb-1.5">Port Status</div>
            {Object.entries(CONGESTION_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-slate-300 capitalize">{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
