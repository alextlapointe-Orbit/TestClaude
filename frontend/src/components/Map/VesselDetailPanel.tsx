import { X, Navigation, Anchor } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { vesselsApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import { format } from 'date-fns'

interface Props {
  mmsi: string
  onClose: () => void
}

const NAV_STATUS: Record<number, string> = {
  0: 'Underway', 1: 'At Anchor', 2: 'Not Under Command',
  3: 'Restricted Manoeuvrability', 4: 'Constrained by Draught',
  5: 'Moored', 6: 'Aground', 8: 'Underway Sailing', 15: 'Unknown',
}

export default function VesselDetailPanel({ mmsi, onClose }: Props) {
  const { vessels } = useVesselStore()
  const liveVessel = vessels.get(mmsi)

  const { data: track } = useQuery({
    queryKey: ['vessel-track', mmsi],
    queryFn: () => vesselsApi.getTrack(mmsi, 24).then((r) => r.data),
    enabled: !!mmsi,
  })

  if (!liveVessel) return null

  const status = liveVessel.nav_status != null ? NAV_STATUS[liveVessel.nav_status] || 'Unknown' : 'Unknown'

  return (
    <div className="card shadow-xl animate-slide-in max-h-[calc(100vh-120px)] overflow-y-auto">
      <div className="card-header">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${liveVessel.is_pil_vessel ? 'bg-cyan-maritime' : 'bg-blue-400'}`} />
          <span className="text-sm font-semibold text-slate-100 truncate">{liveVessel.name}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="card-body space-y-4">
        {liveVessel.is_pil_vessel && (
          <div className="flex items-center gap-1.5 text-xs text-cyan-maritime bg-cyan-maritime/10 border border-cyan-maritime/30 rounded-md px-2 py-1">
            <span className="font-medium">PIL Fleet Vessel</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <InfoItem label="MMSI" value={liveVessel.mmsi} />
          <InfoItem label="Type" value={liveVessel.vessel_type} />
          <InfoItem label="Flag" value={liveVessel.flag || '—'} />
          <InfoItem label="Operator" value={liveVessel.operator || '—'} />
          <InfoItem label="Status" value={status} />
          <InfoItem label="Speed" value={liveVessel.speed_knots != null ? `${liveVessel.speed_knots.toFixed(1)} kn` : '—'} />
          <InfoItem label="Course" value={liveVessel.course != null ? `${liveVessel.course.toFixed(0)}°` : '—'} />
          <InfoItem label="Draft" value={liveVessel.draught ? `${liveVessel.draught}m` : '—'} />
          {liveVessel.loa_m && <InfoItem label="LOA" value={`${liveVessel.loa_m}m`} />}
        </div>

        {liveVessel.destination && (
          <div className="flex items-center gap-2 bg-navy-700 rounded-lg p-2">
            <Navigation className="w-3.5 h-3.5 text-cyan-maritime shrink-0" />
            <div className="text-xs">
              <div className="text-slate-400">Destination</div>
              <div className="text-slate-200 font-medium">{liveVessel.destination}</div>
              {liveVessel.eta && <div className="text-slate-400 mt-0.5">ETA: {liveVessel.eta}</div>}
            </div>
          </div>
        )}

        <div className="text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
            <Anchor className="w-3 h-3" />
            <span>Position</span>
          </div>
          <div className="text-slate-300 font-mono">
            {liveVessel.latitude.toFixed(4)}°, {liveVessel.longitude.toFixed(4)}°
          </div>
          {liveVessel.timestamp && (
            <div className="text-slate-500 mt-0.5">
              Updated: {format(new Date(liveVessel.timestamp), 'HH:mm:ss')}
            </div>
          )}
        </div>

        {track && track.length > 0 && (
          <div className="text-xs">
            <div className="text-slate-400 mb-1">Track (last 24h): {track.length} positions</div>
            <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-maritime rounded-full"
                style={{ width: `${Math.min(100, track.length / 2)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-slate-500 uppercase tracking-wider" style={{ fontSize: '10px' }}>{label}</div>
      <div className="text-slate-200 truncate">{value || '—'}</div>
    </div>
  )
}
