import { useState } from 'react'
import { useVesselStore } from '@/store/vesselStore'
import { Search, Ship, Filter } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

const NAV_STATUS: Record<number, string> = {
  0: 'Underway', 1: 'Anchored', 5: 'Moored', 8: 'Underway Sailing',
}

const VESSEL_TYPES = ['Container Ship', 'Tanker', 'Bulk Carrier', 'Passenger', 'Fishing', 'Other']

export default function VesselsPage() {
  const { vessels, getFilteredVessels, filters, setFilter, selectVessel } = useVesselStore()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const filtered = getFilteredVessels()
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const pilCount = Array.from(vessels.values()).filter((v) => v.is_pil_vessel).length
  const containerCount = Array.from(vessels.values()).filter((v) => v.vessel_type?.includes('Container')).length

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Tracked', value: vessels.size.toLocaleString() },
          { label: 'PIL Vessels', value: pilCount },
          { label: 'Container Ships', value: containerCount },
          { label: 'Filtered', value: filtered.length.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <div className="stat-value">{value}</div>
            <div className="stat-label mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input w-full pl-9"
              placeholder="Search vessel name or MMSI..."
              value={filters.name}
              onChange={(e) => { setFilter('name', e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="input"
            value={filters.vesselType}
            onChange={(e) => { setFilter('vesselType', e.target.value); setPage(1) }}
          >
            <option value="">All Types</option>
            {VESSEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className="input"
            placeholder="Operator..."
            value={filters.operator}
            onChange={(e) => { setFilter('operator', e.target.value); setPage(1) }}
          />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.pilOnly}
              onChange={(e) => { setFilter('pilOnly', e.target.checked); setPage(1) }}
              className="w-4 h-4 accent-cyan-500"
            />
            PIL only
          </label>
        </div>
      </div>

      {/* Vessel table */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-medium text-slate-200">
            {filtered.length.toLocaleString()} vessels
          </span>
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-navy-600">
                <th className="text-left px-4 py-3">Vessel</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Flag</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Speed</th>
                <th className="text-left px-4 py-3">Destination</th>
                <th className="text-right px-4 py-3">Draft</th>
                <th className="text-right px-4 py-3">LOA</th>
                <th className="text-right px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((vessel) => (
                <tr
                  key={vessel.mmsi}
                  className="border-b border-navy-700 hover:bg-navy-700/50 cursor-pointer"
                  onClick={() => selectVessel(vessel.mmsi)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {vessel.is_pil_vessel && (
                        <span className="w-1.5 h-1.5 bg-cyan-maritime rounded-full" />
                      )}
                      <div>
                        <div className={clsx('font-medium', vessel.is_pil_vessel ? 'text-cyan-maritime' : 'text-slate-200')}>
                          {vessel.name || 'Unknown'}
                        </div>
                        <div className="text-slate-500">{vessel.mmsi}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{vessel.vessel_type?.split(' ')[0] || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-300">{vessel.flag || '—'}</td>
                  <td className="px-4 py-2.5">
                    <NavStatusBadge code={vessel.nav_status} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-200">
                    {vessel.speed_knots != null ? `${vessel.speed_knots.toFixed(1)} kn` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300 max-w-[120px] truncate">{vessel.destination || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{vessel.draught ? `${vessel.draught}m` : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{vessel.loa_m ? `${vessel.loa_m}m` : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {vessel.timestamp ? format(new Date(vessel.timestamp), 'HH:mm:ss') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-navy-600">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-ghost text-sm disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs text-slate-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn-ghost text-sm disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Ship className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>{vessels.size === 0 ? 'Waiting for AIS data...' : 'No vessels match your filters'}</p>
        </div>
      )}
    </div>
  )
}

function NavStatusBadge({ code }: { code: number | null | undefined }) {
  const label = code != null ? (NAV_STATUS[code] || 'Unknown') : '—'
  const color = code === 0 || code === 8 ? 'text-emerald-400' : code === 1 || code === 5 ? 'text-blue-400' : 'text-slate-400'
  return <span className={clsx('text-xs', color)}>{label}</span>
}
