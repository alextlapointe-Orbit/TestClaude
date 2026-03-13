import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Wifi, WifiOff, Clock } from 'lucide-react'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-700 border border-navy-500 rounded-lg p-2 text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</div>
      ))}
    </div>
  )
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

  const pilBreakdown = overview
    ? [
        { name: 'At Sea', value: overview.vessels_at_sea ?? 0, color: '#00d4ff' },
        { name: 'In Port', value: overview.vessels_in_port ?? 0, color: '#00c48c' },
        { name: 'Waiting', value: overview.vessels_waiting ?? 0, color: '#ffb800' },
      ]
    : []

  const schedPerf = linerOps?.schedule_performance
  const upcomingCalls = linerOps?.upcoming_calls
  const topCongested = ((portMetrics ?? []) as any[]).filter((p: any) => p.congestion_level !== 'low').slice(0, 6)
  const aisConnected = overview?.ais_connected ?? false

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">PIL Fleet Dashboard</h2>
          <p className="text-sm text-slate-400 mt-0.5">Pacific International Lines — Real-time Operations</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${aisConnected ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-400/10 text-slate-400'}`}>
          {aisConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {aisConnected ? 'AIS Live' : 'AIS Offline'}
        </div>
      </div>

      {/* KPI cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'PIL Fleet', value: overview.total_pil_vessels, color: 'text-cyan-maritime', sub: 'total vessels' },
            { label: 'At Sea', value: overview.vessels_at_sea, color: 'text-blue-400', sub: 'underway' },
            { label: 'In Port', value: overview.vessels_in_port, color: 'text-emerald-400', sub: 'berthed/moored' },
            { label: 'Waiting', value: overview.vessels_waiting, color: 'text-amber-400', sub: 'at anchor' },
            { label: 'AIS Tracked', value: overview.ais_vessels_live ?? vessels.size, color: 'text-purple-400', sub: 'live positions' },
            { label: 'Congested', value: overview.congested_ports, color: overview.congested_ports > 5 ? 'text-red-400' : 'text-amber-400', sub: 'high+critical ports' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="card p-4">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="stat-label mt-1">{label}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule + upcoming + network */}
      {linerOps && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Schedule Performance</div>
            {schedPerf?.pct !== null && schedPerf?.pct !== undefined ? (
              <>
                <div className="text-3xl font-bold" style={{ color: schedPerf.pct >= 80 ? '#00c48c' : schedPerf.pct >= 60 ? '#ffb800' : '#ff4757' }}>
                  {schedPerf.pct}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {schedPerf.voyages_on_time} on-time · {schedPerf.voyages_delayed} delayed
                </div>
                <div className="text-xs text-slate-600 mt-0.5">avg delay {schedPerf.avg_delay_hours.toFixed(1)}h · {schedPerf.period_days}d window</div>
                <div className="mt-3 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, schedPerf.pct)}%`, background: schedPerf.pct >= 80 ? '#00c48c' : '#ffb800' }} />
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-sm mt-2">No completed voyages in last 30 days</div>
            )}
          </div>

          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Upcoming Calls (7d)
            </div>
            {upcomingCalls && (
              <>
                <div className="text-3xl font-bold text-cyan-maritime">{upcomingCalls.total_7d}</div>
                <div className="text-xs text-slate-500 mt-1">PIL: {upcomingCalls.pil_7d} scheduled</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-400/10 rounded p-2 text-center">
                    <div className="text-emerald-400 font-bold text-lg">{upcomingCalls.on_time_7d}</div>
                    <div className="text-slate-500">On Time</div>
                  </div>
                  <div className="bg-amber-400/10 rounded p-2 text-center">
                    <div className="text-amber-400 font-bold text-lg">{upcomingCalls.delayed_7d}</div>
                    <div className="text-slate-500">Delayed</div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Port Network</div>
            <div className="text-3xl font-bold text-slate-200">{overview?.ports_monitored ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1">Ports monitored</div>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Avg berth util</span>
                <span className="text-slate-200">{overview?.avg_berth_utilization_pct?.toFixed(0) ?? '—'}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg wait time</span>
                <span className="text-slate-200">{overview?.avg_port_waiting_hours?.toFixed(1) ?? '—'}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Congested ports</span>
                <span className={overview?.congested_ports > 5 ? 'text-red-400' : 'text-amber-400'}>{overview?.congested_ports ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {overview && pilBreakdown.some((d) => d.value > 0) && (
          <div className="card p-4">
            <div className="text-sm font-semibold text-slate-200 mb-4">PIL Fleet Status</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pilBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {pilBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f1f38', border: '1px solid #244268', borderRadius: 8 }} />
                <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {topCongested.length > 0 && (
          <div className="card p-4">
            <div className="text-sm font-semibold text-slate-200 mb-4">Port Congestion</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCongested} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke="#152840" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis type="category" dataKey="port_name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="vessels_waiting" name="Waiting" fill="#ffb800" radius={[0, 3, 3, 0]} />
                <Bar dataKey="vessels_at_berth" name="At Berth" fill="#00c48c" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Port performance table */}
      {portMetrics && (portMetrics as any[]).length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold text-slate-200">Port Performance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-navy-600">
                  <th className="text-left px-4 py-3">Port</th>
                  <th className="text-right px-4 py-3">Waiting</th>
                  <th className="text-right px-4 py-3">At Berth</th>
                  <th className="text-right px-4 py-3">Berth Util</th>
                  <th className="text-right px-4 py-3">Avg Wait</th>
                  <th className="text-left px-4 py-3">Congestion</th>
                </tr>
              </thead>
              <tbody>
                {(portMetrics as any[]).slice(0, 12).map((p: any) => {
                  const bg = { critical: '#ff475715', high: '#ff6b3515', medium: '#ffb80015', low: '#00c48c15' }[p.congestion_level as string] ?? '#00c48c15'
                  const fg = { critical: '#ff4757', high: '#ff6b35', medium: '#ffb800', low: '#00c48c' }[p.congestion_level as string] ?? '#00c48c'
                  return (
                    <tr key={p.port_id} className="border-b border-navy-700 hover:bg-navy-700/50">
                      <td className="px-4 py-2.5 text-slate-200 font-medium">{p.port_name}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400">{p.vessels_waiting}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">{p.vessels_at_berth}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{p.berth_utilization_pct?.toFixed(0)}%</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{p.congestion_impact_hours?.toFixed(1)}h</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium capitalize" style={{ background: bg, color: fg }}>
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
