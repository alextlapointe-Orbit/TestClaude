import { X, Anchor, Ship, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import { format, parseISO } from 'date-fns'
import type { PortListItem, TerminalLineup } from '@/types'
import clsx from 'clsx'

interface Props {
  port: PortListItem
  onClose: () => void
}

const CONGESTION_COLORS: Record<string, string> = {
  low: '#00c48c',
  medium: '#ffb800',
  high: '#ff6b35',
  critical: '#ff4757',
}

const STATUS_STYLE: Record<string, string> = {
  at_berth: 'text-emerald-400 bg-emerald-400/10',
  moored: 'text-emerald-400 bg-emerald-400/10',
  waiting: 'text-amber-400 bg-amber-400/10',
  anchored: 'text-amber-400 bg-amber-400/10',
  underway: 'text-cyan-400 bg-cyan-400/10',
  scheduled: 'text-blue-400 bg-blue-400/10',
  unknown: 'text-slate-400 bg-slate-400/10',
}

export default function PortPanel({ port, onClose }: Props) {
  const { data: lineup, isLoading } = useQuery({
    queryKey: ['terminal-lineup', port.id],
    queryFn: () => dashboardApi.terminalLineup(port.id).then((r) => r.data as TerminalLineup[]),
    staleTime: 60_000,
  })

  const congColor = CONGESTION_COLORS[port.congestion_level] || '#00c48c'

  const now = new Date()
  const arriving = lineup?.filter((l) => l.eta && new Date(l.eta) >= now) ?? []
  const atBerth = lineup?.filter((l) => l.status === 'at_berth' || l.status === 'moored') ?? []

  return (
    <div className="card shadow-xl animate-slide-in flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div className="card-header shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0 flex-none" style={{ background: congColor, boxShadow: `0 0 6px ${congColor}` }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100 truncate">{port.name}</div>
            <div className="text-[10px] text-slate-400">{port.unlocode} · {port.country}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100 shrink-0 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        <div className="card-body space-y-4">

          {/* Congestion badge */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium capitalize"
              style={{ color: congColor, background: `${congColor}18` }}
            >
              {port.congestion_level} congestion
            </span>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Waiting" value={port.vessels_waiting} color="text-amber-400" />
            <StatBox label="At Berth" value={port.vessels_at_berth} color="text-emerald-400" />
            <StatBox label="Berth Util" value={`${port.berth_utilization_pct.toFixed(0)}%`} color="text-blue-400" />
          </div>

          {/* At berth now */}
          {atBerth.length > 0 && (
            <section>
              <SectionTitle icon={<Anchor className="w-3 h-3" />} label={`At Berth (${atBerth.length})`} />
              <div className="mt-2 space-y-1.5">
                {atBerth.slice(0, 5).map((call) => (
                  <VesselCallRow key={call.call_id} call={call} highlight="berth" />
                ))}
              </div>
            </section>
          )}

          {/* Incoming vessels */}
          <section>
            <SectionTitle icon={<Ship className="w-3 h-3" />} label={`Incoming Vessels (${arriving.length})`} />
            {isLoading && (
              <div className="mt-2 text-xs text-slate-500 animate-pulse">Loading vessel lineup…</div>
            )}
            {!isLoading && arriving.length === 0 && (
              <div className="mt-2 text-xs text-slate-500">No scheduled arrivals in next 7 days</div>
            )}
            <div className="mt-2 space-y-1.5">
              {arriving.slice(0, 8).map((call) => (
                <VesselCallRow key={call.call_id} call={call} highlight="arrival" />
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

function VesselCallRow({ call, highlight }: { call: TerminalLineup; highlight: 'berth' | 'arrival' }) {
  const isDelayed = call.delay_hours > 2
  const isPil = call.is_pil_vessel
  return (
    <div className={clsx(
      'flex items-start gap-2 p-2 rounded-lg text-xs',
      isPil ? 'bg-cyan-maritime/10 border border-cyan-maritime/20' : 'bg-navy-700/40'
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isPil && <span className="text-[9px] font-bold text-cyan-maritime bg-cyan-maritime/20 px-1 rounded">PIL</span>}
          <span className={`font-medium truncate ${isPil ? 'text-cyan-maritime' : 'text-slate-200'}`}>
            {call.vessel_name}
          </span>
          {isDelayed && highlight === 'arrival' && (
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          )}
          {!isDelayed && highlight === 'arrival' && call.eta && (
            <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
          )}
        </div>
        <div className="text-slate-500 mt-0.5 space-y-0.5">
          {highlight === 'arrival' && call.eta && (
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              ETA {format(parseISO(call.eta), 'dd MMM HH:mm')}
              {isDelayed && (
                <span className="text-amber-400 ml-1">+{call.delay_hours.toFixed(0)}h delay</span>
              )}
            </div>
          )}
          {call.terminal_name && <div>{call.terminal_name}{call.berth_number ? ` · Berth ${call.berth_number}` : ''}</div>}
          {call.voyage_number && <div className="text-slate-600">Voy {call.voyage_number}</div>}
        </div>
      </div>
      <span className={clsx('shrink-0 text-[10px] px-1.5 py-0.5 rounded capitalize', STATUS_STYLE[call.status] ?? STATUS_STYLE.unknown)}>
        {call.status.replace('_', ' ')}
      </span>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-navy-700/60 rounded-lg p-2 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
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
