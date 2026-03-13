import { X, Navigation, Anchor, Ship, Clock, MapPin, ChevronRight, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { vesselsApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import { format, parseISO, isAfter } from 'date-fns'

interface Props {
  mmsi: string
  onClose: () => void
  onPortSelect?: (portId: number, portName: string) => void
}

const NAV_STATUS: Record<number, { label: string; color: string }> = {
  0:  { label: 'Underway (Engine)',  color: '#00d4ff' },
  1:  { label: 'At Anchor',          color: '#f59e0b' },
  2:  { label: 'Not Under Command',  color: '#ef4444' },
  3:  { label: 'Restricted Maneuv.', color: '#f97316' },
  4:  { label: 'Constrained Draft',  color: '#f97316' },
  5:  { label: 'Moored',             color: '#3b82f6' },
  6:  { label: 'Aground',            color: '#ef4444' },
  8:  { label: 'Underway (Sailing)', color: '#00d4ff' },
  15: { label: 'Unknown',            color: '#475569' },
}

export default function VesselDetailPanel({ mmsi, onClose, onPortSelect }: Props) {
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

  const navInfo = live.nav_status != null ? (NAV_STATUS[live.nav_status] || NAV_STATUS[15]) : NAV_STATUS[15]
  const now = new Date()

  const sortedCalls = calls
    ? [...calls].sort((a: any, b: any) =>
        (a.eta ? new Date(a.eta).getTime() : 0) - (b.eta ? new Date(b.eta).getTime() : 0)
      )
    : []

  const upcomingCalls = sortedCalls.filter((c: any) => c.eta && isAfter(parseISO(c.eta), now))
  const nextCall = upcomingCalls[0] || sortedCalls[0]

  const distanceCovered = track && track.length > 1
    ? track.reduce((acc: number, pt: any, i: number) => {
        if (i === 0) return 0
        const prev = track[i - 1]
        const dlat = (pt.lat - prev.lat) * 111
        const dlon = (pt.lng - prev.lng) * 111 * Math.cos(prev.lat * Math.PI / 180)
        return acc + Math.sqrt(dlat * dlat + dlon * dlon)
      }, 0)
    : null

  const loa = live.loa_m || vesselDb?.loa_m
  const speed = live.speed_knots

  return (
    <div
      className="panel animate-slide-in flex flex-col"
      style={{ maxHeight: 'calc(100vh - 100px)', minWidth: 280 }}
    >
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              background: live.is_pil_vessel ? '#00d4ff' : '#3b82f6',
              boxShadow: live.is_pil_vessel ? '0 0 8px rgba(0,212,255,0.7)' : 'none',
              animation: 'pulse 2s infinite',
            }}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100 truncate">{live.name || 'Unknown Vessel'}</div>
            {live.is_pil_vessel && (
              <div className="text-[10px] font-bold tracking-wider" style={{ color: '#00d4ff' }}>
                ◆ PIL FLEET
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-100 transition-colors shrink-0 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        <div className="p-4 space-y-4">

          {/* Status + speed strip */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: `${navInfo.color}15`, color: navInfo.color, border: `1px solid ${navInfo.color}30` }}
            >
              {navInfo.label}
            </span>
            {speed != null && speed > 0.5 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Zap className="w-3 h-3" />
                {speed.toFixed(1)} kn
                {live.course != null && <span className="text-slate-600">· {live.course.toFixed(0)}°</span>}
              </span>
            )}
          </div>

          {/* Heading To — deep drill */}
          {(live.destination || nextCall) && (
            <div
              className="rounded-lg p-3"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}
            >
              <div className="section-title mb-2">
                <Navigation className="w-3 h-3" style={{ color: '#00d4ff' }} />
                <span style={{ color: '#00d4ff' }}>Heading To</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold" style={{ color: '#00d4ff' }}>
                  {nextCall?.port_name || live.destination || '—'}
                </div>
                {/* Deep drill button */}
                {nextCall?.port_id && onPortSelect && (
                  <button
                    onClick={() => onPortSelect(nextCall.port_id, nextCall.port_name)}
                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-all shrink-0"
                    style={{
                      background: 'rgba(0,212,255,0.12)',
                      color: '#00d4ff',
                      border: '1px solid rgba(0,212,255,0.25)',
                    }}
                    title="View port details"
                  >
                    View Port <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="mt-1.5 space-y-1 text-xs text-slate-400">
                {nextCall?.eta && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-600" />
                    ETA: <span className="text-slate-300">{format(parseISO(nextCall.eta), 'dd MMM HH:mm')}</span>
                  </div>
                )}
                {nextCall?.terminal_name && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-600" />
                    <span>{nextCall.terminal_name}{nextCall.berth_number ? ` · Berth ${nextCall.berth_number}` : ''}</span>
                  </div>
                )}
                {nextCall?.voyage_number && (
                  <div className="text-slate-600 font-mono">VOY {nextCall.voyage_number}</div>
                )}
                {!nextCall && live.eta && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-600" />ETA: {live.eta}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vessel characteristics */}
          <section>
            <div className="section-title mb-2"><Ship className="w-3 h-3" /> Vessel Characteristics</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <InfoRow label="MMSI"     value={live.mmsi} mono />
              <InfoRow label="IMO"      value={vesselDb?.imo || '—'} mono />
              <InfoRow label="Flag"     value={live.flag || '—'} />
              <InfoRow label="Operator" value={live.operator || vesselDb?.operator || '—'} />
              <InfoRow label="Service"  value={vesselDb?.service || '—'} />
              {vesselDb?.teu_capacity && <InfoRow label="TEU" value={vesselDb.teu_capacity.toLocaleString()} mono />}
              {loa && <InfoRow label="LOA" value={`${loa}m`} mono />}
              {live.draught && <InfoRow label="Draft" value={`${live.draught}m`} mono />}
              {vesselDb?.dwt && <InfoRow label="DWT" value={vesselDb.dwt.toLocaleString()} mono />}
            </div>
          </section>

          {/* Position */}
          <section>
            <div className="section-title mb-2"><Anchor className="w-3 h-3" /> Position</div>
            <div
              className="rounded-lg p-2.5 text-xs space-y-1"
              style={{ background: 'rgba(12,30,53,0.5)' }}
            >
              <div className="font-mono text-slate-200">
                {live.latitude.toFixed(5)}°N, {live.longitude.toFixed(5)}°E
              </div>
              {live.timestamp && (
                <div className="text-slate-600">
                  Updated {format(new Date(live.timestamp), 'HH:mm:ss')} UTC
                </div>
              )}
              {distanceCovered != null && (
                <div className="text-slate-500">
                  ~{distanceCovered.toFixed(0)} km tracked · {track?.length} pts (48h)
                </div>
              )}
            </div>
          </section>

          {/* Port calls timeline */}
          {sortedCalls.length > 0 && (
            <section>
              <div className="section-title mb-2">
                <MapPin className="w-3 h-3" /> Port Calls ({sortedCalls.length})
              </div>
              <div className="space-y-1">
                {sortedCalls.slice(0, 8).map((call: any) => {
                  const isNext = call === nextCall
                  const isPast = call.eta && !isAfter(parseISO(call.eta), now)
                  return (
                    <div
                      key={call.id}
                      className="flex items-start gap-2 p-2 rounded-lg text-xs cursor-pointer transition-all"
                      style={
                        isNext
                          ? { background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)' }
                          : { background: 'rgba(12,30,53,0.4)', border: '1px solid transparent' }
                      }
                      onClick={() => {
                        if (call.port_id && onPortSelect) onPortSelect(call.port_id, call.port_name)
                      }}
                    >
                      <div className="flex flex-col items-center shrink-0 mt-0.5 gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: isNext ? '#00d4ff' : isPast ? '#163354' : '#3b82f6',
                            boxShadow: isNext ? '0 0 6px rgba(0,212,255,0.6)' : 'none',
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-medium truncate flex items-center gap-1.5"
                          style={{ color: isNext ? '#00d4ff' : isPast ? '#475569' : '#cbd5e1' }}
                        >
                          {call.port_name || '—'}
                          {isNext && (
                            <span
                              className="text-[9px] px-1 rounded font-bold"
                              style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}
                            >
                              NEXT
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          {call.eta && <span>ETA {format(parseISO(call.eta), 'dd MMM HH:mm')}</span>}
                          {call.terminal_name && <span className="ml-2">{call.terminal_name}</span>}
                        </div>
                      </div>
                      {call.port_id && onPortSelect && (
                        <ChevronRight className="w-3 h-3 text-slate-700 shrink-0 mt-0.5" />
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {calls !== undefined && calls.length === 0 && (
            <div className="text-xs text-slate-600 text-center py-3">No scheduled port calls</div>
          )}

        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <div className="uppercase tracking-wider text-slate-600" style={{ fontSize: '9px' }}>{label}</div>
      <div className={`text-slate-300 truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  )
}
