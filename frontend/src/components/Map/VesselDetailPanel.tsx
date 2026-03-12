import { X, Navigation, Anchor, Ship, Clock, MapPin, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { vesselsApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import { format, parseISO, isAfter } from 'date-fns'

interface Props {
  mmsi: string
  onClose: () => void
}

const NAV_STATUS: Record<number, string> = {
  0: 'Underway', 1: 'At Anchor', 2: 'Not Under Command',
  3: 'Restricted Manoeuvrability', 4: 'Constrained by Draught',
  5: 'Moored', 6: 'Aground', 8: 'Underway Sailing', 15: 'Unknown',
}

const STATUS_COLORS: Record<string, string> = {
  underway: 'text-cyan-400 bg-cyan-400/10',
  at_berth: 'text-emerald-400 bg-emerald-400/10',
  waiting: 'text-amber-400 bg-amber-400/10',
  anchored: 'text-amber-400 bg-amber-400/10',
  moored: 'text-blue-400 bg-blue-400/10',
  unknown: 'text-slate-400 bg-slate-400/10',
}

export default function VesselDetailPanel({ mmsi, onClose }: Props) {
  const { vessels } = useVesselStore()
  const live = vessels.get(mmsi)

  const { data: vesselDb } = useQuery({
    queryKey: ['vessel-db', mmsi],
    queryFn: () => vesselsApi.get(mmsi).then((r) => r.data),
    enabled: !!mmsi,
  })

  const { data: track } = useQuery({
    queryKey: ['vessel-track', mmsi],
    queryFn: () => vesselsApi.getTrack(mmsi, 48).then((r) => r.data),
    enabled: !!mmsi,
  })

  const { data: calls } = useQuery({
    queryKey: ['vessel-calls', mmsi],
    queryFn: () => vesselsApi.getCalls(mmsi).then((r) => r.data),
    enabled: !!mmsi,
  })

  if (!live) return null

  const status = live.nav_status != null ? NAV_STATUS[live.nav_status] || 'Unknown' : 'Unknown'
  const statusKey = status.toLowerCase().replace(' ', '_')

  // Sort calls: upcoming first, then past
  const now = new Date()
  const sortedCalls = calls
    ? [...calls].sort((a: any, b: any) => {
        const aEta = a.eta ? new Date(a.eta).getTime() : 0
        const bEta = b.eta ? new Date(b.eta).getTime() : 0
        return bEta - aEta
      })
    : []

  const upcomingCalls = sortedCalls.filter((c: any) => c.eta && isAfter(parseISO(c.eta), now))
  const pastCalls = sortedCalls.filter((c: any) => !c.eta || !isAfter(parseISO(c.eta), now))
  const nextCall = upcomingCalls[upcomingCalls.length - 1] || sortedCalls[0]

  // Track stats
  const trackPts = track?.length ?? 0
  const distanceCovered = track && track.length > 1
    ? track.reduce((acc: number, pt: any, i: number) => {
        if (i === 0) return 0
        const prev = track[i - 1]
        const dlat = (pt.lat - prev.lat) * 111
        const dlon = (pt.lng - prev.lng) * 111 * Math.cos(prev.lat * Math.PI / 180)
        return acc + Math.sqrt(dlat * dlat + dlon * dlon)
      }, 0)
    : null

  return (
    <div className="card shadow-xl animate-slide-in flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div className="card-header shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${live.is_pil_vessel ? 'bg-cyan-maritime animate-pulse' : 'bg-blue-400'}`} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100 truncate">{live.name}</div>
            {live.is_pil_vessel && (
              <div className="text-[10px] text-cyan-maritime font-medium">PIL Fleet</div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100 shrink-0 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        <div className="card-body space-y-4">

          {/* Nav status badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[statusKey] ?? STATUS_COLORS.unknown}`}>
              {status}
            </span>
            {live.speed_knots != null && live.speed_knots > 0.5 && (
              <span className="text-xs text-slate-400">{live.speed_knots.toFixed(1)} kn · {live.course?.toFixed(0) ?? '—'}°</span>
            )}
          </div>

          {/* ── Vessel Characteristics ── */}
          <section>
            <SectionTitle icon={<Ship className="w-3 h-3" />} label="Vessel Characteristics" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-2">
              <InfoItem label="MMSI" value={live.mmsi} />
              <InfoItem label="IMO" value={vesselDb?.imo || '—'} />
              <InfoItem label="Flag" value={live.flag || '—'} />
              <InfoItem label="Operator" value={live.operator || vesselDb?.operator || '—'} />
              <InfoItem label="Type" value={live.vessel_type} />
              <InfoItem label="Service" value={vesselDb?.service || '—'} />
              <InfoItem label="LOA" value={live.loa_m ? `${live.loa_m}m` : vesselDb?.loa_m ? `${vesselDb.loa_m}m` : '—'} />
              <InfoItem label="Beam" value={vesselDb?.beam_m ? `${vesselDb.beam_m}m` : '—'} />
              <InfoItem label="Draft" value={live.draught ? `${live.draught}m` : '—'} />
              <InfoItem label="Max Draft" value={vesselDb?.max_draft_m ? `${vesselDb.max_draft_m}m` : '—'} />
              {vesselDb?.teu_capacity && <InfoItem label="TEU" value={vesselDb.teu_capacity.toLocaleString()} />}
              {vesselDb?.dwt && <InfoItem label="DWT" value={vesselDb.dwt.toLocaleString()} />}
              {vesselDb?.gt && <InfoItem label="GT" value={vesselDb.gt.toLocaleString()} />}
            </div>
          </section>

          {/* ── Current Position ── */}
          <section>
            <SectionTitle icon={<Anchor className="w-3 h-3" />} label="Current Position" />
            <div className="mt-2 bg-navy-700/60 rounded-lg p-2.5 text-xs space-y-1">
              <div className="font-mono text-slate-200">
                {live.latitude.toFixed(5)}°, {live.longitude.toFixed(5)}°
              </div>
              {live.timestamp && (
                <div className="text-slate-500">Updated {format(new Date(live.timestamp), 'HH:mm:ss')}</div>
              )}
              {distanceCovered != null && (
                <div className="text-slate-400">
                  ~{distanceCovered.toFixed(0)} km covered · {trackPts} positions (48h)
                </div>
              )}
            </div>
          </section>

          {/* ── Heading To ── */}
          {(live.destination || nextCall) && (
            <section>
              <SectionTitle icon={<Navigation className="w-3 h-3" />} label="Heading To" />
              <div className="mt-2 bg-cyan-maritime/10 border border-cyan-maritime/30 rounded-lg p-2.5 text-xs">
                <div className="font-semibold text-cyan-maritime text-sm">
                  {nextCall?.port_name || live.destination || '—'}
                </div>
                {nextCall && (
                  <div className="mt-1 space-y-0.5 text-slate-300">
                    {nextCall.eta && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        ETA: {format(parseISO(nextCall.eta), 'dd MMM HH:mm')}
                      </div>
                    )}
                    {nextCall.terminal_name && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {nextCall.terminal_name}
                        {nextCall.berth_number ? ` · Berth ${nextCall.berth_number}` : ''}
                      </div>
                    )}
                    {nextCall.voyage_number && (
                      <div className="text-slate-400">Voyage: {nextCall.voyage_number}</div>
                    )}
                    {nextCall.proforma_moves && (
                      <div className="text-slate-400">Planned moves: {nextCall.proforma_moves.toLocaleString()}</div>
                    )}
                  </div>
                )}
                {!nextCall && live.eta && (
                  <div className="text-slate-400 mt-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> ETA: {live.eta}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Route / Port Call History ── */}
          {sortedCalls.length > 0 && (
            <section>
              <SectionTitle icon={<MapPin className="w-3 h-3" />} label={`Port Calls (${sortedCalls.length})`} />
              <div className="mt-2 space-y-1">
                {sortedCalls.slice(0, 8).map((call: any, i: number) => {
                  const isNext = call === nextCall
                  const isPast = !isNext && call.eta && !isAfter(parseISO(call.eta), now)
                  const callStatus = call.status as string
                  return (
                    <div
                      key={call.id}
                      className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isNext ? 'bg-cyan-maritime/10 border border-cyan-maritime/30' : 'bg-navy-700/40'}`}
                    >
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${isNext ? 'bg-cyan-maritime' : isPast ? 'bg-slate-600' : 'bg-blue-400'}`} />
                        {i < sortedCalls.slice(0, 8).length - 1 && (
                          <div className="w-px flex-1 bg-navy-600 mt-0.5 min-h-[10px]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${isNext ? 'text-cyan-maritime' : isPast ? 'text-slate-500' : 'text-slate-200'}`}>
                          {call.port_name || '—'}
                          {isNext && <span className="ml-1.5 text-[10px] bg-cyan-maritime/20 text-cyan-maritime px-1.5 rounded">NEXT</span>}
                        </div>
                        <div className="text-slate-500 mt-0.5 space-y-0.5">
                          {call.eta && (
                            <div>ETA {format(parseISO(call.eta), 'dd MMM HH:mm')}</div>
                          )}
                          {call.etd && (
                            <div>ETD {format(parseISO(call.etd), 'dd MMM HH:mm')}</div>
                          )}
                          {call.terminal_name && <div>{call.terminal_name}</div>}
                          {call.voyage_number && <div className="text-slate-600">Voy {call.voyage_number}</div>}
                        </div>
                      </div>
                      <div className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded capitalize ${STATUS_COLORS[callStatus] ?? STATUS_COLORS.unknown}`}>
                        {callStatus}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* No calls fallback */}
          {calls !== undefined && calls.length === 0 && (
            <div className="text-xs text-slate-500 text-center py-2">No scheduled port calls</div>
          )}

        </div>
      </div>
    </div>
  )
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-medium uppercase tracking-wider">
      {icon}
      {label}
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
