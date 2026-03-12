import { X } from 'lucide-react'
import { useVesselStore } from '@/store/vesselStore'

interface Props {
  onClose: () => void
}

const VESSEL_TYPES = ['Container Ship', 'Tanker', 'Bulk Carrier', 'Passenger', 'Other']

export default function VesselFilterPanel({ onClose }: Props) {
  const { filters, setFilter } = useVesselStore()

  return (
    <div className="card shadow-xl animate-fade-in">
      <div className="card-header">
        <span className="text-sm font-medium text-slate-200">Vessel Filters</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="card-body space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Vessel Name</label>
          <input
            className="input w-full text-sm"
            placeholder="Search by name..."
            value={filters.name}
            onChange={(e) => setFilter('name', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Vessel Type</label>
          <select
            className="input w-full text-sm"
            value={filters.vesselType}
            onChange={(e) => setFilter('vesselType', e.target.value)}
          >
            <option value="">All Types</option>
            {VESSEL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Operator</label>
          <input
            className="input w-full text-sm"
            placeholder="e.g. PIL, COSCO..."
            value={filters.operator}
            onChange={(e) => setFilter('operator', e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pil-only"
            checked={filters.pilOnly}
            onChange={(e) => setFilter('pilOnly', e.target.checked)}
            className="w-4 h-4 accent-cyan-500"
          />
          <label htmlFor="pil-only" className="text-sm text-slate-300">PIL vessels only</label>
        </div>
        <button
          onClick={() => {
            setFilter('name', '')
            setFilter('vesselType', '')
            setFilter('operator', '')
            setFilter('pilOnly', false)
          }}
          className="btn-ghost w-full text-sm text-center"
        >
          Clear Filters
        </button>
      </div>
    </div>
  )
}
