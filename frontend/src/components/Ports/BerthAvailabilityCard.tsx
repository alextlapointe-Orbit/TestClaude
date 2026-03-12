import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { congestionApi } from '@/services/api'

interface Props {
  congestion: any[]
  portId: number
}

export default function BerthAvailabilityCard({ congestion, portId }: Props) {
  const [vesselLoa, setVesselLoa] = useState('')
  const [vesselDraft, setVesselDraft] = useState('')

  const { data: availabilityCheck, refetch } = useQuery({
    queryKey: ['berth-check', portId, vesselLoa, vesselDraft],
    queryFn: () =>
      congestionApi.getBerthAvailability(portId, vesselLoa ? Number(vesselLoa) : undefined, vesselDraft ? Number(vesselDraft) : undefined).then((r) => r.data),
    enabled: false,
  })

  const { data: prediction } = useQuery({
    queryKey: ['congestion-predict', portId],
    queryFn: () => congestionApi.predict(portId).then((r) => r.data),
    staleTime: 300_000,
  })

  return (
    <div className="space-y-4">
      {/* Berth checker */}
      <div className="card p-4">
        <div className="text-sm font-semibold text-slate-200 mb-3">Berth Compatibility Check</div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Vessel LOA (m)</label>
            <input
              className="input w-28"
              type="number"
              placeholder="e.g. 320"
              value={vesselLoa}
              onChange={(e) => setVesselLoa(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Draft (m)</label>
            <input
              className="input w-24"
              type="number"
              placeholder="e.g. 14.5"
              value={vesselDraft}
              onChange={(e) => setVesselDraft(e.target.value)}
            />
          </div>
          <button className="btn-primary text-sm" onClick={() => refetch()}>Check</button>
        </div>
      </div>

      {/* Terminal berth status */}
      {congestion.map((terminal: any) => (
        <div key={terminal.terminal_id} className="card">
          <div className="card-header">
            <div>
              <span className="text-sm font-semibold text-slate-100">{terminal.terminal_name}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                terminal.configuration === 'shared'
                  ? 'text-blue-400 bg-blue-900/30'
                  : 'text-slate-400 bg-navy-700'
              }`}>
                {terminal.configuration === 'shared' ? 'Shared Quay' : 'Independent Berths'}
              </span>
            </div>
            <div className="text-sm font-bold text-cyan-maritime">{terminal.utilization_pct?.toFixed(0)}% util.</div>
          </div>
          <div className="card-body space-y-3">
            {terminal.configuration === 'shared' ? (
              <div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div className="card p-2 text-center">
                    <div className="font-bold text-cyan-maritime">{terminal.total_quay_length_m?.toFixed(0)}m</div>
                    <div className="text-[10px] text-slate-400">Total Quay</div>
                  </div>
                  <div className="card p-2 text-center">
                    <div className="font-bold text-emerald-400">{terminal.available_length_m?.toFixed(0)}m</div>
                    <div className="text-[10px] text-slate-400">Available</div>
                  </div>
                  <div className="card p-2 text-center">
                    <div className="font-bold text-slate-200">{terminal.vessels_at_berth}</div>
                    <div className="text-[10px] text-slate-400">At Berth</div>
                  </div>
                </div>
                <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${terminal.utilization_pct}%`,
                      background: terminal.utilization_pct >= 85 ? '#ff4757' : terminal.utilization_pct >= 65 ? '#ffb800' : '#00c48c',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {terminal.berths?.map((berth: any) => (
                  <div
                    key={berth.id}
                    className={`p-2 rounded-lg border text-center text-xs ${
                      berth.occupied
                        ? 'bg-orange-900/30 border-orange-700/50 text-orange-300'
                        : 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
                    }`}
                  >
                    <div className="font-semibold">{berth.berth_number}</div>
                    <div>{berth.length_m}m</div>
                    {berth.max_draft_m && <div>Draft: {berth.max_draft_m}m</div>}
                    <div className="mt-1 font-medium">{berth.occupied ? '● Occupied' : '○ Free'}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Vessel check result */}
            {terminal.vessel_check && (
              <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                terminal.vessel_check.can_berth
                  ? 'bg-emerald-900/30 border border-emerald-700/50 text-emerald-300'
                  : 'bg-red-900/30 border border-red-700/50 text-red-300'
              }`}>
                <span>{terminal.vessel_check.can_berth ? '✓' : '✗'}</span>
                <span>{terminal.vessel_check.reason}</span>
                {terminal.vessel_check.recommended_berth && (
                  <span className="ml-auto font-semibold">→ {terminal.vessel_check.recommended_berth}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Congestion prediction */}
      {prediction && (
        <div className="card p-4">
          <div className="text-sm font-semibold text-slate-200 mb-3">Congestion Prediction</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className={`text-lg font-bold congestion-${prediction.current_level}`}>{prediction.current_level?.toUpperCase()}</div>
              <div className="text-xs text-slate-400">Current</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-200">{prediction.predicted_6h?.toUpperCase()}</div>
              <div className="text-xs text-slate-400">In 6h</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-200">{prediction.predicted_24h?.toUpperCase()}</div>
              <div className="text-xs text-slate-400">In 24h</div>
            </div>
          </div>
          {prediction.factors?.length > 0 && (
            <div className="mt-3 space-y-1">
              {prediction.factors.map((f: string, i: number) => (
                <div key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="text-amber-400">•</span> {f}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
