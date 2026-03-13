import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useQuery } from '@tanstack/react-query'
import { portsApi, vesselsApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import { useConfigStore } from '@/store/configStore'
import type { PortListItem } from '@/types'
import VesselFilterPanel from '@/components/Map/VesselFilterPanel'
import VesselDetailPanel from '@/components/Map/VesselDetailPanel'
import PortPanel from '@/components/Map/PortPanel'
import { Filter, Cloud, CloudOff } from 'lucide-react'
import clsx from 'clsx'

const CONGESTION_COLORS: Record<string, string> = {
  low: '#00c48c',
  medium: '#ffb800',
  high: '#ff6b35',
  critical: '#ff4757',
}

// Boat icons — larger SVG, pointing north, rotated by vessel course
const BOAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <polygon points="16,2 26,28 16,21 6,28" fill="#93c5fd" stroke="#1e3a5f" stroke-width="1.5"/>
</svg>`

const PIL_BOAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <polygon points="20,2 32,36 20,27 8,36" fill="#00d4ff" stroke="#003d5c" stroke-width="2"/>
  <text x="20" y="22" text-anchor="middle" font-size="8" font-weight="bold" fill="#001f33" font-family="sans-serif">PIL</text>
</svg>`

const SELECTED_BOAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 2" opacity="0.7"/>
  <polygon points="16,2 26,28 16,21 6,28" fill="#ffffff" stroke="#1e3a5f" stroke-width="1.5"/>
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

// Fetch latest RainViewer radar timestamp
async function getRainViewerUrl(): Promise<string | null> {
  try {
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json')
    const d = await r.json()
    const path = d?.radar?.past?.at(-1)?.path
    if (!path) return null
    return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`
  } catch {
    return null
  }
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const rafPending = useRef(false)

  const [mapReady, setMapReady] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [weatherOn, setWeatherOn] = useState(false)
  const [selectedPort, setSelectedPort] = useState<PortListItem | null>(null)

  const { config } = useConfigStore()
  const { getFilteredVessels, selectedMmsi, selectVessel, vessels } = useVesselStore()

  const { data: ports } = useQuery({
    queryKey: ['ports'],
    queryFn: () => portsApi.list().then((r) => r.data as PortListItem[]),
    staleTime: 60_000,
  })

  const { data: track } = useQuery({
    queryKey: ['vessel-track', selectedMmsi],
    queryFn: () => vesselsApi.getTrack(selectedMmsi!, 72).then((r) => r.data),
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
      try { m.setPaintProperty('water-shadow', 'fill-color', '#061525') } catch {}

      // Load boat icons
      try {
        const [boatData, pilData, selData] = await Promise.all([
          svgToImageData(BOAT_SVG, 32),
          svgToImageData(PIL_BOAT_SVG, 40),
          svgToImageData(SELECTED_BOAT_SVG, 32),
        ])
        m.addImage('boat', boatData)
        m.addImage('boat-pil', pilData)
        m.addImage('boat-selected', selData)
      } catch {}

      // ── PORT LAYERS (GeoJSON — moves perfectly with map) ─────────────────
      m.addSource('ports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Glow halo behind ports
      m.addLayer({
        id: 'ports-glow',
        type: 'circle',
        source: 'ports',
        paint: {
          'circle-radius': 14,
          'circle-color': [
            'match', ['get', 'congestion'],
            'critical', '#ff4757', 'high', '#ff6b35', 'medium', '#ffb800', '#00c48c',
          ],
          'circle-opacity': 0.15,
          'circle-blur': 1,
        },
      })

      // Main port circle
      m.addLayer({
        id: 'ports-circles',
        type: 'circle',
        source: 'ports',
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 12, 8],
          'circle-color': [
            'match', ['get', 'congestion'],
            'critical', '#ff4757', 'high', '#ff6b35', 'medium', '#ffb800', '#00c48c',
          ],
          'circle-stroke-width': ['case', ['get', 'selected'], 2.5, 1.5],
          'circle-stroke-color': ['case', ['get', 'selected'], '#ffffff', 'rgba(255,255,255,0.3)'],
          'circle-opacity': ['case', ['get', 'selected'], 1.0, 0.9],
        },
      })

      // Port name labels
      m.addLayer({
        id: 'ports-labels',
        type: 'symbol',
        source: 'ports',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#94a3b8',
          'text-halo-color': '#0a1628',
          'text-halo-width': 1.5,
        },
      })

      // ── WEATHER LAYER (RainViewer precipitation tiles) ───────────────────
      const radarUrl = await getRainViewerUrl()
      if (radarUrl) {
        m.addSource('weather-radar', {
          type: 'raster',
          tiles: [radarUrl],
          tileSize: 256,
          attribution: '© RainViewer',
        })
        m.addLayer({
          id: 'weather-radar-layer',
          type: 'raster',
          source: 'weather-radar',
          paint: { 'raster-opacity': 0.55 },
          layout: { visibility: 'none' },
        })
      }

      // ── VESSEL SOURCES ───────────────────────────────────────────────────
      m.addSource('vessels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Regular (non-PIL, non-selected) vessels
      m.addLayer({
        id: 'vessels-layer',
        type: 'symbol',
        source: 'vessels',
        filter: ['all', ['!', ['get', 'pil']], ['!', ['get', 'selected']]],
        layout: {
          'icon-image': 'boat',
          'icon-size': 0.9,
          'icon-rotate': ['get', 'course'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': 0.85 },
      })

      // PIL vessels (larger, cyan, always on top)
      m.addLayer({
        id: 'vessels-pil-layer',
        type: 'symbol',
        source: 'vessels',
        filter: ['all', ['get', 'pil'], ['!', ['get', 'selected']]],
        layout: {
          'icon-image': 'boat-pil',
          'icon-size': 0.85,
          'icon-rotate': ['get', 'course'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': 0.95 },
      })

      // PIL vessel name labels (always visible on world map)
      m.addLayer({
        id: 'vessels-pil-labels',
        type: 'symbol',
        source: 'vessels',
        filter: ['get', 'pil'],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 9,
          'text-offset': [0, 2.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-optional': true,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#00d4ff',
          'text-halo-color': '#061525',
          'text-halo-width': 1.5,
        },
      })

      // Selected vessel (white, ring, largest)
      m.addLayer({
        id: 'vessels-selected-layer',
        type: 'symbol',
        source: 'vessels',
        filter: ['get', 'selected'],
        layout: {
          'icon-image': ['case', ['get', 'pil'], 'boat-pil', 'boat-selected'],
          'icon-size': ['case', ['get', 'pil'], 1.4, 1.6],
          'icon-rotate': ['get', 'course'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': 1.0 },
      })

      // ── VESSEL TRACK ─────────────────────────────────────────────────────
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
          'line-width': 2,
          'line-opacity': 0.5,
          'line-dasharray': [4, 2],
        },
      })

      m.addSource('vessel-track-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      m.addLayer({
        id: 'vessel-track-points-halo',
        type: 'circle',
        source: 'vessel-track-points',
        filter: ['==', ['get', 'is_latest'], true],
        paint: {
          'circle-radius': 12,
          'circle-color': '#00d4ff',
          'circle-opacity': 0.2,
          'circle-stroke-width': 0,
        },
      })

      m.addLayer({
        id: 'vessel-track-points-layer',
        type: 'circle',
        source: 'vessel-track-points',
        paint: {
          'circle-radius': [
            'case', ['==', ['get', 'is_latest'], true], 6,
            ['>', ['get', 'age_frac'], 0.8], 4, 3,
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'age_frac'],
            0, '#1a3a5c', 0.5, '#0077aa', 1, '#00d4ff',
          ],
          'circle-opacity': [
            'interpolate', ['linear'], ['get', 'age_frac'], 0, 0.3, 1, 0.95,
          ],
          'circle-stroke-width': ['case', ['==', ['get', 'is_latest'], true], 2, 0.5],
          'circle-stroke-color': ['case', ['==', ['get', 'is_latest'], true], '#ffffff', '#00d4ff'],
          'circle-stroke-opacity': 0.7,
        },
      })

      // ── INTERACTIONS ─────────────────────────────────────────────────────

      // Vessel click (all vessel layers)
      const handleVesselClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        const f = e.features?.[0]
        if (f?.properties?.mmsi) {
          selectVessel(f.properties.mmsi)
          setSelectedPort(null)
        }
      }
      m.on('click', 'vessels-layer', handleVesselClick)
      m.on('click', 'vessels-pil-layer', handleVesselClick)
      m.on('click', 'vessels-selected-layer', handleVesselClick)

      m.on('mouseenter', 'vessels-layer', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseenter', 'vessels-pil-layer', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'vessels-layer', () => { m.getCanvas().style.cursor = '' })
      m.on('mouseleave', 'vessels-pil-layer', () => { m.getCanvas().style.cursor = '' })

      // Port click
      m.on('click', 'ports-circles', (e) => {
        const props = e.features?.[0]?.properties
        if (!props) return
        selectVessel(null)
        // Find port from id stored in feature
        setSelectedPort((prev) =>
          prev?.id === props.port_id ? null : ({ id: props.port_id, name: props.name, unlocode: props.unlocode, country: props.country, latitude: props.lat, longitude: props.lon, congestion_level: props.congestion, vessels_waiting: props.vessels_waiting, vessels_at_berth: props.vessels_at_berth, berth_utilization_pct: props.berth_util, status: 'operational' } as any)
        )
        e.preventDefault()
      })
      m.on('mouseenter', 'ports-circles', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'ports-circles', () => { m.getCanvas().style.cursor = '' })

      // Click on empty map → deselect
      m.on('click', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['vessels-layer', 'vessels-pil-layer', 'ports-circles'] })
        if (!features.length) {
          selectVessel(null)
          setSelectedPort(null)
        }
      })

      // Track point hover popup
      const trackPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: 'tmm-popup', offset: 8 })
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

  // Update port GeoJSON source
  useEffect(() => {
    if (!mapReady || !map.current || !ports) return
    const source = map.current.getSource('ports') as mapboxgl.GeoJSONSource
    if (!source) return

    source.setData({
      type: 'FeatureCollection',
      features: ports.map((port) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [port.longitude, port.latitude] },
        properties: {
          port_id: port.id,
          name: port.name,
          unlocode: port.unlocode,
          country: port.country,
          congestion: port.congestion_level,
          vessels_waiting: port.vessels_waiting,
          vessels_at_berth: port.vessels_at_berth,
          berth_util: port.berth_utilization_pct,
          lat: port.latitude,
          lon: port.longitude,
          selected: selectedPort?.id === port.id,
        },
      })),
    })
  }, [mapReady, ports, selectedPort])

  // Update vessel GeoJSON — throttled via rAF
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

      const filtered = getFilteredVessels().filter((v) => {
        if (v.loa_m !== null && v.loa_m !== undefined && v.loa_m < 100) return false
        return true
      })

      source.setData({
        type: 'FeatureCollection',
        features: filtered.map((v) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
          properties: {
            mmsi: v.mmsi,
            name: v.name,
            pil: v.is_pil_vessel,
            selected: v.mmsi === selectedMmsi,
            course: v.course ?? 0,
          },
        })),
      })
    })
  }, [mapReady, vessels, selectedMmsi, getFilteredVessels])

  // Render vessel track (line + dots)
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

    const validPts = track.filter((p: any) => (p.lng ?? p.longitude) != null && (p.lat ?? p.latitude) != null)
    if (validPts.length === 0) { lineSource.setData(empty); pointSource.setData(empty); return }

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

    const tMin = Math.min(...validPts.map((p: any) => new Date(p.timestamp).getTime()))
    const tMax = Math.max(...validPts.map((p: any) => new Date(p.timestamp).getTime()))
    const tRange = tMax - tMin || 1

    pointSource.setData({
      type: 'FeatureCollection',
      features: validPts.map((p: any, i: number) => {
        const t = new Date(p.timestamp).getTime()
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng ?? p.longitude, p.lat ?? p.latitude] },
          properties: {
            timestamp: p.timestamp,
            speed: p.speed,
            course: p.course,
            age_frac: (t - tMin) / tRange,
            is_latest: i === validPts.length - 1,
          },
        }
      }),
    })
  }, [mapReady, selectedMmsi, track])

  // Fly to selected vessel
  useEffect(() => {
    if (!mapReady || !map.current || !selectedMmsi) return
    const vessel = vessels.get(selectedMmsi)
    if (vessel) {
      map.current.flyTo({ center: [vessel.longitude, vessel.latitude], zoom: Math.max(map.current.getZoom(), 5), duration: 1000 })
    }
  }, [mapReady, selectedMmsi])

  // Weather layer toggle
  useEffect(() => {
    if (!mapReady || !map.current) return
    const m = map.current
    try {
      const layer = m.getLayer('weather-radar-layer')
      if (layer) {
        m.setLayoutProperty('weather-radar-layer', 'visibility', weatherOn ? 'visible' : 'none')
      }
    } catch {}
  }, [mapReady, weatherOn])

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

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={showFilters
            ? { background: '#00d4ff', color: '#020b18', boxShadow: '0 0 14px rgba(0,212,255,0.4)' }
            : { background: 'rgba(2,11,24,0.92)', border: '1px solid rgba(22,51,84,0.8)', color: '#94a3b8' }
          }
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {useVesselStore.getState().filters.pilOnly && (
            <span className="text-[10px] px-1.5 rounded font-bold"
              style={{ background: 'rgba(0,212,255,0.2)', color: '#00d4ff' }}>PIL</span>
          )}
        </button>

        <button
          onClick={() => setWeatherOn(!weatherOn)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={weatherOn
            ? { background: '#3b82f6', color: '#fff', boxShadow: '0 0 12px rgba(59,130,246,0.4)' }
            : { background: 'rgba(2,11,24,0.92)', border: '1px solid rgba(22,51,84,0.8)', color: '#94a3b8' }
          }
          title="Toggle precipitation radar"
        >
          {weatherOn ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
          <span className="hidden sm:inline">Weather</span>
        </button>
      </div>

      {showFilters && (
        <div className="absolute top-14 left-4 z-10 w-64">
          <VesselFilterPanel onClose={() => setShowFilters(false)} />
        </div>
      )}

      {/* Vessel detail panel */}
      {selectedMmsi && (
        <div className="absolute top-4 right-4 z-10 w-80">
          <VesselDetailPanel
            mmsi={selectedMmsi}
            onClose={() => { selectVessel(null); setSelectedPort(null) }}
            onPortSelect={(portId, portName) => {
              const port = ports?.find((p) => p.id === portId)
              if (port) {
                selectVessel(null)
                setSelectedPort(port)
              } else {
                // Port not in list — create a minimal entry to show panel
                setSelectedPort({ id: portId, name: portName, unlocode: '', country: '',
                  latitude: 0, longitude: 0, congestion_level: 'low' as const,
                  vessels_waiting: 0, vessels_at_berth: 0, berth_utilization_pct: 0, status: 'operational' } as any)
                selectVessel(null)
              }
            }}
          />
        </div>
      )}

      {/* Port detail panel */}
      {selectedPort && !selectedMmsi && (
        <div className="absolute top-4 right-4 z-10 w-80">
          <PortPanel port={selectedPort} onClose={() => setSelectedPort(null)} />
        </div>
      )}

      {/* Live stats bar */}
      <div className="absolute bottom-8 left-4 z-10">
        <div
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(2,11,24,0.9)', border: '1px solid rgba(22,51,84,0.8)' }}
        >
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 6px rgba(0,212,255,0.7)', animation: 'pulse 2s infinite' }} />
            <span className="font-mono text-slate-300">{vessels.size.toLocaleString()}</span>
            vessels
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-400">{ports?.length ?? 0} ports</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 right-4 z-10">
        <div className="rounded-lg p-3 text-xs space-y-1.5"
          style={{ background: 'rgba(2,11,24,0.9)', border: '1px solid rgba(22,51,84,0.8)' }}
        >
          <div className="text-slate-400 font-medium uppercase tracking-wider mb-2">Vessels</div>
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 16, background: '#00d4ff', clipPath: 'polygon(50% 0%, 100% 100%, 50% 77%, 0% 100%)' }} />
            <span className="text-cyan-maritime font-medium">PIL Fleet</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 10, height: 14, background: '#93c5fd', clipPath: 'polygon(50% 0%, 100% 100%, 50% 77%, 0% 100%)' }} />
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
