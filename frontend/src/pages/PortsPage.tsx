import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { portsApi } from '@/services/api'
import { Search, Download, Anchor, ChevronRight } from 'lucide-react'
import type { PortListItem } from '@/types'
import CongestionBadge from '@/components/common/CongestionBadge'
import toast from 'react-hot-toast'

export default function PortsPage() {
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [congestion, setCongestion] = useState('')

  const { data: ports = [], isLoading } = useQuery({
    queryKey: ['ports', country, congestion, search],
    queryFn: () => portsApi.list({ country: country || undefined, congestion: congestion || undefined, search: search || undefined }).then((r) => r.data as PortListItem[]),
    staleTime: 30_000,
  })

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const resp = await portsApi.exportAll(format)
      if (format === 'csv') {
        const blob = new Blob([resp.data], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ports.csv'
        a.click()
      } else {
        const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ports.json'
        a.click()
      }
    } catch {
      toast.error('Export failed')
    }
  }

  const congested = ports.filter((p) => p.congestion_level === 'high' || p.congestion_level === 'critical').length
  const waiting = ports.reduce((acc, p) => acc + p.vessels_waiting, 0)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ports Monitored', value: ports.length },
          { label: 'Congested Ports', value: congested, danger: congested > 5 },
          { label: 'Vessels Waiting', value: waiting },
          { label: 'Countries', value: new Set(ports.map((p) => p.country)).size },
        ].map(({ label, value, danger }) => (
          <div key={label} className="card p-4">
            <div className={`stat-value ${danger ? 'text-red-400' : ''}`}>{value}</div>
            <div className="stat-label mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters & actions */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input w-full pl-9"
              placeholder="Search port name or UNLOCODE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={congestion}
            onChange={(e) => setCongestion(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button onClick={() => handleExport('json')} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Port grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-maritime border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ports.map((port) => (
            <PortCard key={port.id} port={port} />
          ))}
        </div>
      )}

      {!isLoading && ports.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Anchor className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No ports found matching your filters</p>
        </div>
      )}
    </div>
  )
}

function PortCard({ port }: { port: PortListItem }) {
  return (
    <Link
      to={`/ports/${port.id}`}
      className="card hover:border-cyan-maritime/40 hover:bg-navy-700 transition-all group"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-semibold text-slate-100 group-hover:text-cyan-maritime transition-colors">
              {port.name}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{port.unlocode} · {port.country}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-maritime transition-colors shrink-0 mt-1" />
        </div>

        <div className="flex items-center justify-between mb-3">
          <CongestionBadge level={port.congestion_level} />
          <span className="text-xs text-slate-400">{port.status}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <StatMini label="Waiting" value={port.vessels_waiting} />
          <StatMini label="At Berth" value={port.vessels_at_berth} />
          <StatMini label="Util %" value={`${port.berth_utilization_pct.toFixed(0)}%`} />
        </div>
      </div>
    </Link>
  )
}

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-navy-900/50 rounded-md py-1.5">
      <div className="text-sm font-semibold text-slate-200">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
