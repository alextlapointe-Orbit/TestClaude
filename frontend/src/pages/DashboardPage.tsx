import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Radio, RadioTower, Anchor, Ship, Clock, AlertTriangle, TrendingUp, Activity } from 'lucide-react'

const COLORS = {
  atSea:    '#00d4ff',
  inPort:   '#10b981',
  waiting:  '#f59e0b',
  critical: '#ef4444',
  high:     '#f97316',
}

function KpiCard({
  label, value, sub, accent, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; accent: string; icon: React.ElementType
}) {
  return (
    <div className="kpi-card" style={{ borderTopColor: accent } as React.CSSProperties}>
      <div style={{ borderTop: `2px solid ${accent}`, margin: '-16px -16px 12px', borderRadius: '10px 10px 0 0', opacity: 0.5 }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="kpi-value" style={{ color: accent }}>{value}</div>
          <div className="kpi-label">{label}</div>
          {sub && <div className="kpi-sub">{sub}</div>}
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="panel px-3 py-2 text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

const CONGESTION_COLORS: Record<string, string> = {
  critical: COLORS.critical,
  high:     COLORS.high,
  medium:   COLORS.waiting,
  low:      COLORS.inPort,
}

export default function DashboardPage() {
  const { vessels } = useVesselStore()

  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.overview().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: linerOps } = useQuery({
    queryKey: ['dashboard-liner-ops'],
    queryFn: () => dashboardApi.linerOps().then((r) => r.data),
    staleTime: 120_000,
  })

  const { data: portMetrics } = useQuery({
    queryKey: ['dashboard-port-metrics'],
    queryFn: () => dashboardApi.portMetrics().then((r) => r.data),
    staleTime: 120_000,
  })

  const schedPerf     = linerOps?.schedule_performance
  const upcomingCalls = linerOps?.upcoming_calls
  const topCongested  = ((portMetrics ?? []) as any[])
    .filter((p: any) => p.congestion_level !== 'low')
    .slice(0, 6)
  const aisConnected = overview?.ais_connected ?? false

  // PIL fleet breakdown — numbers always consistent: at_sea + in_port + waiting = total
  const pilBreakdown = overview
    ? [
        { name: 'At Sea',  value: overview.vessels_at_sea,    color: COLORS.atSea   },
        { name: 'In Port', value: overview.vessels_in_port,   color: COLORS.inPort  },
        { name: 'Waiting', value: overview.vessels_waiting,   color: COLORS.waiting },
      ]
    : []

  const schedPct = schedPerf?.pct
  const schedColor = schedPct == null ? '#475569' : schedPct >= 80 ? '#10b981' : schedPct >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100">PIL Fleet Operations</h2>
          <p className="text-xs text-slate-500 mt-0.5">Pacific International Lines — Live dashboard</p>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
          style={{
            background: aisConnected ? 'rgba(16,185,129,0.1)' : 'rgba(71,85,105,0.1)',
            border: `1px solid ${aisConnected ? 'rgba(16,185,129,0.25)' : 'rgba(71,85,105,0.25)'}`,
            color: aisConnected ? '#10b981' : '#475569',
          }}
        >
          {aisConnected
            ? <><Radio className="w-3 h-3" /> AIS Live</>
            : <><RadioTower className="w-3 h-3" /> AIS Offline</>
          }
        </div>
      </div>

      {/* KPI cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="PIL Fleet"
            value={overview.total_pil_vessels}
            sub="total vessels"
            accent={COLORS.atSea}
            icon={Ship}
          />
          <KpiCard
            label="At Sea"
            value={overview.vessels_at_sea}
            sub="underway"
            accent="#3b82f6"
            icon={Activity}
          />
          <KpiCard
            label="In Port"
            value={overview.vessels_in_port}
            sub="at berth"
            accent={COLORS.inPort}
            icon={Anchor}
          />
          <KpiCard
            label="Waiting"
            value={overview.vessels_waiting}
            sub="at anchorage"
            accent={COLORS.waiting}
            icon={Clock}
          />
          <KpiCard
            label="AIS Tracked"
            value={(overview.ais_vessels_live ?? vessels.size).toLocaleString()}
            sub="container ships live"
            accent="#a855f7"
            icon={Radio}
          />
          <KpiCard
            label="Congested"
            value={overview.congested_ports}
            sub="high + critical"
            accent={overview.congested_ports > 5 ? COLORS.critical : COLORS.waiting}
            icon={AlertTriangle}
          />
        </div>
      )}

      {/* Note: numbers always add up */}
      {overview && (
        <p className="text-[10px] text-slate-600">
          PIL Fleet breakdown: {overview.vessels_at_sea} at sea + {overview.vessels_in_port} in port + {overview.vessels_waiting} waiting = {overview.total_pil_vessels} total
          {' · '}AIS Tracked is all container ships visible on AIS stream (separate count)
        </p>
      )}

      {/* Schedule + upcoming + network */}
      {linerOps && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* Schedule performance */}
          <div className="panel p-4">
            <div className="section-title mb-3">
              <TrendingUp className="w-3 h-3" /> Schedule Performance
            </div>
            {schedPct != null ? (
              <>
                <div className="kpi-value" style={{ color: schedColor }}>{schedPct}%</div>
                <div className="text-xs text-slate-500 mt-1">
                  {schedPerf.voyages_on_time} on-time · {schedPerf.voyages_delayed} delayed
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  avg delay {schedPerf.avg_delay_hours.toFixed(1)}h · {schedPerf.period_days}d window
                </div>
                <div className="progress-bar mt-3">
                  <div className="progress-fill" style={{ width: `${Math.min(100, schedPct)}%`, background: schedColor }} />
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500 mt-2">No completed voyages in last 30 days</div>
            )}
          </div>

          {/* Upcoming calls */}
          <div className="panel p-4">
            <div className="section-title mb-3">
              <Clock className="w-3 h-3" /> Upcoming Calls (7d)
            </div>
            {upcomingCalls && (
              <>
                <div className="kpi-value" style={{ color: COLORS.atSea }}>{upcomingCalls.total_7d}</div>
                <div className="text-xs text-slate-500 mt-1">PIL: {upcomingCalls.pil_7d} scheduled</div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded-lg p-2 text-center"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="text-lg font-bold font-mono" style={{ color: '#10b981' }}>{upcomingCalls.on_time_7d}</div>
                    <div className="text-[10px] text-slate-500">On Time</div>
                  </div>
                  <div className="rounded-lg p-2 text-center"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="text-lg font-bold font-mono" style={{ color: '#f59e0b' }}>{upcomingCalls.delayed_7d}</div>
                    <div className="text-[10px] text-slate-500">Delayed</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Port network */}
          <div className="panel p-4">
            <div className="section-title mb-3">
              <Anchor className="w-3 h-3" /> Port Network
            </div>
            <div className="kpi-value text-slate-200">{overview?.ports_monitored ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1">Ports monitored</div>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Avg berth utilization', value: `${overview?.avg_berth_utilization_pct?.toFixed(0) ?? '—'}%` },
                { label: 'Avg waiting time',      value: `${overview?.avg_port_waiting_hours?.toFixed(1) ?? '—'}h` },
                { label: 'Congested (high+)',      value: overview?.congested_ports ?? '—',
                  color: (overview?.congested_ports ?? 0) > 5 ? '#ef4444' : '#f59e0b' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-mono font-medium" style={{ color: color || '#cbd5e1' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {overview && pilBreakdown.some((d) => d.value > 0) && (
          <div className="panel p-4">
            <div className="section-title mb-4"><Ship className="w-3 h-3" /> PIL Fleet Status</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pilBreakdown}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  dataKey="value" paddingAngle={3}
                >
                  {pilBreakdown.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      style={{ filter: `drop-shadow(0 0 6px ${entry.color}50)` }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(7,21,37,0.98)', border: '1px solid rgba(22,51,84,0.9)', borderRadius: 8 }}
                  itemStyle={{ color: '#cbd5e1' }}
                />
                <Legend
                  formatter={(value, entry: any) => (
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {value} <strong style={{ color: entry.color }}>{entry.payload?.value}</strong>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {topCongested.length > 0 && (
          <div className="panel p-4">
            <div className="section-title mb-4"><AlertTriangle className="w-3 h-3" /> Port Congestion</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCongested} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke="rgba(22,51,84,0.5)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="port_name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="vessels_waiting" name="Waiting" fill={COLORS.waiting} radius={[0, 3, 3, 0]} />
                <Bar dataKey="vessels_at_berth" name="At Berth" fill={COLORS.inPort} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Port performance table */}
      {portMetrics && (portMetrics as any[]).length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="text-sm font-semibold text-slate-200">Port Performance</span>
            <span className="text-[10px] text-slate-600">{(portMetrics as any[]).length} ports</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Port</th>
                  <th className="text-right">Waiting</th>
                  <th className="text-right">At Berth</th>
                  <th className="text-right">Berth Util</th>
                  <th className="text-right">Avg Wait</th>
                  <th>Congestion</th>
                </tr>
              </thead>
              <tbody>
                {(portMetrics as any[]).slice(0, 12).map((p: any) => {
                  const fg = CONGESTION_COLORS[p.congestion_level as string] ?? '#10b981'
                  return (
                    <tr key={p.port_id}>
                      <td className="text-slate-200 font-medium">{p.port_name}</td>
                      <td className="text-right font-mono" style={{ color: COLORS.waiting }}>{p.vessels_waiting}</td>
                      <td className="text-right font-mono" style={{ color: COLORS.inPort }}>{p.vessels_at_berth}</td>
                      <td className="text-right font-mono text-slate-300">{p.berth_utilization_pct?.toFixed(0)}%</td>
                      <td className="text-right font-mono text-slate-300">{p.congestion_impact_hours?.toFixed(1)}h</td>
                      <td>
                        <span
                          className="badge capitalize"
                          style={{ background: `${fg}12`, color: fg, border: `1px solid ${fg}25` }}
                        >
                          {p.congestion_level}
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
