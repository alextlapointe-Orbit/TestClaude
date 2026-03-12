import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portsApi, weatherApi, congestionApi } from '@/services/api'
import { ArrowLeft, Printer, Plus, Cloud, Anchor, AlertTriangle } from 'lucide-react'
import CongestionBadge from '@/components/common/CongestionBadge'
import WeatherCard from '@/components/Ports/WeatherCard'
import BerthAvailabilityCard from '@/components/Ports/BerthAvailabilityCard'
import PortCardExport from '@/components/Ports/PortCardExport'
import toast from 'react-hot-toast'

export default function PortDetailPage() {
  const { id } = useParams<{ id: string }>()
  const portId = Number(id)
  const qc = useQueryClient()
  const [showAddInfo, setShowAddInfo] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'terminals' | 'supplementary' | 'weather' | 'congestion'>('overview')
  const [newInfo, setNewInfo] = useState({ category: 'operational', title: '', content: '', source: '' })

  const { data: port } = useQuery({
    queryKey: ['port', portId],
    queryFn: () => portsApi.get(portId).then((r) => r.data),
  })

  const { data: terminals = [] } = useQuery({
    queryKey: ['port-terminals', portId],
    queryFn: () => portsApi.getTerminals(portId).then((r) => r.data),
  })

  const { data: supplementary = [] } = useQuery({
    queryKey: ['port-supplementary', portId],
    queryFn: () => portsApi.getSupplementary(portId).then((r) => r.data),
  })

  const { data: weather } = useQuery({
    queryKey: ['port-weather', portId],
    queryFn: () => weatherApi.getPortWeather(portId).then((r) => r.data),
    staleTime: 300_000,
  })

  const { data: congestion } = useQuery({
    queryKey: ['port-congestion', portId],
    queryFn: () => congestionApi.getBerthAvailability(portId).then((r) => r.data),
    staleTime: 60_000,
  })

  const addMutation = useMutation({
    mutationFn: () => portsApi.addSupplementary(portId, newInfo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['port-supplementary', portId] })
      setShowAddInfo(false)
      setNewInfo({ category: 'operational', title: '', content: '', source: '' })
      toast.success('Information added')
    },
    onError: () => toast.error('Failed to add information'),
  })

  if (!port) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cyan-maritime border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const TABS = ['overview', 'terminals', 'supplementary', 'weather', 'congestion'] as const

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/ports" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-100">{port.name}</h1>
          <div className="text-sm text-slate-400">{port.unlocode} · {port.country}</div>
        </div>
        <CongestionBadge level={port.congestion_level} size="md" />
        <button
          onClick={() => setShowExport(true)}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Printer className="w-4 h-4" />
          Port Card
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 p-1 rounded-lg border border-navy-500 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-cyan-maritime/15 text-cyan-maritime border border-cyan-maritime/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard label="Terminals" value={port.num_terminals} />
            <StatCard label="Quay Length" value={port.quay_length_m ? `${(port.quay_length_m / 1000).toFixed(1)} km` : '—'} />
            <StatCard label="Max Draft" value={port.max_draft_m ? `${port.max_draft_m}m` : '—'} />
            <StatCard label="Tidal Range" value={port.tidal_range_m ? `${port.tidal_range_m}m` : '—'} />
            <StatCard label="Water Density" value={`${port.water_density} t/m³`} />
            <StatCard label="Anchorage Cap." value={port.anchorage_capacity ?? '—'} />
            <StatCard label="Vessels Waiting" value={port.vessels_waiting} highlight={port.vessels_waiting > 3} />
            <StatCard label="At Berth" value={port.vessels_at_berth} />
            <StatCard label="Avg Wait" value={`${port.avg_waiting_hours.toFixed(1)}h`} />
            <StatCard label="Berth Util." value={`${port.berth_utilization_pct.toFixed(0)}%`} />
            <StatCard label="Yard Util." value={`${port.yard_utilization_pct.toFixed(0)}%`} />
            <StatCard label="Max LOA" value={port.max_vessel_loa_m ? `${port.max_vessel_loa_m}m` : '—'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Location</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinates</span>
                  <span className="font-mono">{port.latitude.toFixed(4)}°, {port.longitude.toFixed(4)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timezone</span>
                  <span>{port.timezone}</span>
                </div>
              </div>
            </div>

            {weather && (
              <div className="card p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" /> Current Weather
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-slate-100">{weather.weather_description}</div>
                    <div className="text-sm text-slate-400 mt-0.5">
                      {weather.temperature_c != null ? `${weather.temperature_c.toFixed(0)}°C` : ''} · Wind {weather.wind_speed_kmh?.toFixed(0) || '?'} km/h
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    {weather.wave_height_m != null && <div>Waves: {weather.wave_height_m.toFixed(1)}m</div>}
                    <div>Vis: {weather.visibility_km?.toFixed(0) || '?'} km</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Terminals tab */}
      {activeTab === 'terminals' && (
        <div className="space-y-3">
          {terminals.map((t) => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-100">{t.name}</div>
                  {t.operator && <div className="text-xs text-slate-400 mt-0.5">{t.operator}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  t.berth_configuration === 'shared'
                    ? 'text-blue-400 bg-blue-900/30 border-blue-700/50'
                    : 'text-slate-400 bg-navy-700 border-navy-500'
                }`}>
                  {t.berth_configuration === 'shared' ? 'Shared Quay' : 'Independent Berths'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <StatCard label="Quay Length" value={t.total_quay_length_m ? `${t.total_quay_length_m}m` : '—'} />
                <StatCard label="Max Draft" value={t.max_draft_m ? `${t.max_draft_m}m` : '—'} />
                <StatCard label="Cranes" value={t.crane_count ?? '—'} />
                <StatCard label="TEU Capacity" value={t.yard_capacity_teu?.toLocaleString() ?? '—'} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <UtilBar label="Berth Utilization" pct={t.berth_utilization_pct} />
                <UtilBar label="Yard Utilization" pct={t.yard_utilization_pct} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplementary tab */}
      {activeTab === 'supplementary' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddInfo(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Add Information
            </button>
          </div>

          {showAddInfo && (
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-200 mb-3">Add Supplementary Information</div>
              <div className="space-y-3">
                <select className="input w-full" value={newInfo.category} onChange={(e) => setNewInfo({...newInfo, category: e.target.value})}>
                  <option value="operational">Operational</option>
                  <option value="approach">Approach</option>
                  <option value="environmental">Environmental</option>
                  <option value="lookout">Lookout</option>
                </select>
                <input className="input w-full" placeholder="Title" value={newInfo.title} onChange={(e) => setNewInfo({...newInfo, title: e.target.value})} />
                <textarea className="input w-full h-24 resize-none" placeholder="Content..." value={newInfo.content} onChange={(e) => setNewInfo({...newInfo, content: e.target.value})} />
                <input className="input w-full" placeholder="Source (optional)" value={newInfo.source} onChange={(e) => setNewInfo({...newInfo, source: e.target.value})} />
                <div className="flex gap-2">
                  <button className="btn-primary text-sm" onClick={() => addMutation.mutate()}>Save</button>
                  <button className="btn-secondary text-sm" onClick={() => setShowAddInfo(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {(['operational', 'approach', 'environmental', 'lookout'] as const).map((cat) => {
            const items = supplementary.filter((s) => s.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat} className="card">
                <div className="card-header">
                  <span className="text-sm font-medium text-slate-200 capitalize">{cat}</span>
                </div>
                <div className="divide-y divide-navy-600">
                  {items.map((info) => (
                    <div key={info.id} className="p-4">
                      <div className="font-medium text-slate-200 text-sm">{info.title}</div>
                      <div className="text-sm text-slate-400 mt-1">{info.content}</div>
                      {info.source && <div className="text-xs text-slate-500 mt-1">Source: {info.source}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Weather tab */}
      {activeTab === 'weather' && weather && <WeatherCard weather={weather} />}

      {/* Congestion tab */}
      {activeTab === 'congestion' && congestion && (
        <BerthAvailabilityCard congestion={congestion} portId={portId} />
      )}

      {/* Port Card Export Modal */}
      {showExport && (
        <PortCardExport portId={portId} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="card p-3">
      <div className={`text-lg font-bold ${highlight ? 'text-orange-400' : 'text-cyan-maritime'}`}>{value}</div>
      <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

function UtilBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 85 ? '#ff4757' : pct >= 65 ? '#ffb800' : '#00c48c'
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
