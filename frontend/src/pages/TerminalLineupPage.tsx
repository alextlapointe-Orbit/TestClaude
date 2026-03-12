import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { portsApi, dashboardApi } from '@/services/api'
import { format, differenceInHours } from 'date-fns'
import clsx from 'clsx'
import type { PortListItem, TerminalLineup } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  at_berth: 'text-emerald-400',
  moored: 'text-emerald-400',
  waiting: 'text-amber-400',
  anchored: 'text-blue-400',
  underway: 'text-cyan-400',
  unknown: 'text-slate-400',
}

export default function TerminalLineupPage() {
  const [selectedPort, setSelectedPort] = useState<number | null>(null)
  const [view, setView] = useState<'gantt' | 'table'>('table')

  const { data: ports = [] } = useQuery({
    queryKey: ['ports'],
    queryFn: () => portsApi.list().then((r) => r.data as PortListItem[]),
  })

  const { data: lineup = [], isLoading } = useQuery({
    queryKey: ['terminal-lineup', selectedPort],
    queryFn: () => dashboardApi.terminalLineup(selectedPort!).then((r) => r.data as TerminalLineup[]),
    enabled: !!selectedPort,
  })

  const topPorts = ports.slice(0, 20)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="input flex-1 min-w-[200px]"
          value={selectedPort ?? ''}
          onChange={(e) => setSelectedPort(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Select a port to view lineup...</option>
          {topPorts.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.unlocode})</option>
          ))}
        </select>
        <div className="flex bg-navy-800 border border-navy-500 rounded-lg p-1 gap-1">
          {(['table', 'gantt'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                'px-3 py-1 rounded-md text-sm font-medium capitalize transition-all',
                view === v ? 'bg-cyan-maritime/15 text-cyan-maritime border border-cyan-maritime/30' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {!selectedPort && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="text-lg font-medium text-slate-300">Select a Port</p>
          <p className="text-sm mt-1">Choose a port above to view the terminal line-up</p>
        </div>
      )}

      {selectedPort && isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-maritime border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {selectedPort && !isLoading && lineup.length === 0 && (
        <div className="text-center py-12 text-slate-400">No scheduled vessel calls in the next 7 days</div>
      )}

      {/* Summary stats */}
      {lineup.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Calls', value: lineup.length },
            { label: 'PIL Vessels', value: lineup.filter((l) => l.is_pil_vessel).length },
            { label: 'At Berth', value: lineup.filter((l) => l.status === 'at_berth' || l.status === 'moored').length },
            { label: 'Waiting', value: lineup.filter((l) => l.status === 'waiting' || l.status === 'anchored').length },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4">
              <div className="stat-value">{value}</div>
              <div className="stat-label mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Gantt view */}
      {view === 'gantt' && lineup.length > 0 && (
        <GanttView lineup={lineup} />
      )}

      {/* Table view */}
      {view === 'table' && lineup.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold text-slate-200">Terminal Line-Up</span>
            <span className="text-xs text-slate-500">Showing ±2 days / +7 days</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-navy-600">
                  <th className="text-left px-4 py-3">Vessel</th>
                  <th className="text-left px-4 py-3">Terminal / Berth</th>
                  <th className="text-right px-4 py-3">Proforma ETB</th>
                  <th className="text-right px-4 py-3">ETA</th>
                  <th className="text-right px-4 py-3">ETB</th>
                  <th className="text-right px-4 py-3">ETD</th>
                  <th className="text-right px-4 py-3">Moves</th>
                  <th className="text-center px-4 py-3">Delay</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map((call) => {
                  const delay = call.delay_hours
                  return (
                    <tr key={call.call_id} className="border-b border-navy-700 hover:bg-navy-700/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {call.is_pil_vessel && <span className="w-1.5 h-1.5 bg-cyan-maritime rounded-full" />}
                          <div>
                            <div className={clsx('font-medium', call.is_pil_vessel ? 'text-cyan-maritime' : 'text-slate-200')}>
                              {call.vessel_name}
                            </div>
                            {call.loa_m && <div className="text-slate-500">{call.loa_m}m LOA</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-slate-300">{call.terminal_name || '—'}</div>
                        {call.berth_number && <div className="text-slate-500">Berth {call.berth_number}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400">
                        {call.proforma_etb ? format(new Date(call.proforma_etb), 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-200">
                        {call.eta ? format(new Date(call.eta), 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-200">
                        {call.etb ? format(new Date(call.etb), 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-200">
                        {call.etd ? format(new Date(call.etd), 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {call.actual_moves != null ? (
                          <div>
                            <span className="text-slate-200">{call.actual_moves}</span>
                            {call.proforma_moves && (
                              <span className="text-slate-500"> / {call.proforma_moves}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">{call.proforma_moves ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {delay > 0 ? (
                          <span className={clsx(
                            'text-xs px-1.5 py-0.5 rounded',
                            delay > 12 ? 'text-red-400 bg-red-900/30' : delay > 4 ? 'text-amber-400 bg-amber-900/30' : 'text-yellow-400 bg-yellow-900/30'
                          )}>
                            +{delay.toFixed(0)}h
                          </span>
                        ) : delay < -0.5 ? (
                          <span className="text-xs text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">
                            {delay.toFixed(0)}h
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">On time</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={clsx('capitalize', STATUS_COLORS[call.status] || 'text-slate-400')}>
                          {call.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function GanttView({ lineup }: { lineup: TerminalLineup[] }) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 2 * 24 * 3600_000)
  const windowEnd = new Date(now.getTime() + 7 * 24 * 3600_000)
  const totalMs = windowEnd.getTime() - windowStart.getTime()

  const pct = (d: Date | null) => {
    if (!d) return null
    return ((d.getTime() - windowStart.getTime()) / totalMs) * 100
  }

  const terminals = [...new Set(lineup.map((l) => l.terminal_name || 'Unassigned'))]

  return (
    <div className="card p-4 overflow-x-auto">
      <div className="text-sm font-semibold text-slate-200 mb-4">Terminal Gantt (±2d / +7d)</div>

      {/* Timeline header */}
      <div className="relative h-6 mb-2 ml-32">
        {[-48, -24, 0, 24, 48, 72, 96, 120, 144, 168].map((h) => {
          const d = new Date(now.getTime() + h * 3600_000)
          const p = pct(d)
          if (p === null || p < 0 || p > 100) return null
          return (
            <div key={h} className="absolute text-[10px] text-slate-500" style={{ left: `${p}%`, transform: 'translateX(-50%)' }}>
              {h === 0 ? 'NOW' : format(d, 'dd/MM')}
            </div>
          )
        })}
        {/* Now line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-cyan-maritime opacity-60"
          style={{ left: `${pct(now)}%` }}
        />
      </div>

      {/* Rows per terminal */}
      {terminals.map((terminal) => (
        <div key={terminal} className="mb-4">
          <div className="text-xs font-medium text-slate-400 mb-2">{terminal}</div>
          <div className="space-y-1">
            {lineup.filter((l) => (l.terminal_name || 'Unassigned') === terminal).map((call) => {
              const startPct = pct(call.etb ? new Date(call.etb) : (call.eta ? new Date(call.eta) : null))
              const endPct = pct(call.etd ? new Date(call.etd) : null)
              if (startPct === null || endPct === null) return null
              const width = Math.max(0.5, endPct - startPct)
              const isDelayed = call.delay_hours > 4

              return (
                <div key={call.call_id} className="relative h-7 bg-navy-700 rounded overflow-hidden">
                  <div
                    className={clsx(
                      'absolute top-0 bottom-0 rounded flex items-center px-2 overflow-hidden',
                      call.is_pil_vessel ? 'bg-cyan-maritime/30 border border-cyan-maritime/50' : 'bg-blue-900/50 border border-blue-700/50',
                      isDelayed && 'border-amber-700/70'
                    )}
                    style={{ left: `${Math.max(0, startPct)}%`, width: `${Math.min(100 - startPct, width)}%` }}
                    title={`${call.vessel_name} - ${call.status}`}
                  >
                    <span className={clsx('text-[10px] font-medium truncate', call.is_pil_vessel ? 'text-cyan-300' : 'text-blue-300')}>
                      {call.vessel_name}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
