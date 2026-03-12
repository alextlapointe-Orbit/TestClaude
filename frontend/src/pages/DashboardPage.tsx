import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import CongestionBadge from '@/components/common/CongestionBadge'
import type { CongestionLevel } from '@/types'

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
  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.overview().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: linerOps } = useQuery({
    queryKey: ['dashboard-liner-ops'],
    queryFn: () => dashboardApi.linerOps().then((r) => r.data),
    staleTime: 300_000,
  })

  const { data: portMetrics = [] } = useQuery({
    queryKey: ['dashboard-port-metrics'],
    queryFn: () => dashboardApi.portMetrics().then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: terminalSlas = [] } = useQuery({
    queryKey: ['dashboard-terminal-slas'],
    queryFn: () => dashboardApi.terminalSlas().then((r) => r.data),
    staleTime: 60_000,
  })

  const pilBreakdown = overview
    ? [
        { name: 'At Sea', value: overview.vessels_at_sea, color: '#00d4ff' },
        { name: 'In Port', value: overview.vessels_in_port, color: '#00c48c' },
        { name: 'Waiting', value: overview.vessels_waiting, color: '#ffb800' },
      ]
    : []

  const topCongestedPorts = portMetrics
    .sort((a: any, b: any) => b.vessels_waiting - a.vessels_waiting)
    .slice(0, 8)

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {overview && [
          { label: 'Vessels Tracked', value: overview.total_vessels_tracked.toLocaleString(), color: 'text-cyan-maritime' },
          { label: 'PIL Fleet', value: overview.total_pil_vessels, color: 'text-blue-400' },
          { label: 'Ports Monitored', value: overview.ports_monitored, color: 'text-slate-200' },
          { label: 'Congested Ports', value: overview.congested_ports, color: overview.congested_ports > 5 ? 'text-red-400' : 'text-amber-400' },
          { label: 'Avg Wait (hrs)', value: overview.avg_port_waiting_hours.toFixed(1), color: 'text-orange-400' },
          { label: 'CII Rating', value: overview.cii_rating, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="stat-label mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Schedule & ops metrics */}
      {linerOps && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard
            title="Schedule Performance"
            value={`${linerOps.schedule_performance.pct}%`}
            subtitle={`${linerOps.schedule_performance.voyages_on_time} on-time / ${linerOps.schedule_performance.voyages_delayed} delayed`}
            trend={linerOps.schedule_performance.trend}
            pct={linerOps.schedule_performance.pct}
          />
          <MetricCard
            title="Commercial Reliability"
            value={`${linerOps.commercial_reliability.pct}%`}
            subtitle={`Transit days adherence: ${linerOps.commercial_reliability.transit_days_adherence}%`}
            trend={linerOps.commercial_reliability.trend}
            pct={linerOps.commercial_reliability.pct}
          />
          <MetricCard
            title="Operational Efficiency"
            value={`${linerOps.operational_efficiency.bunker_consumption_pct_of_plan}%`}
            subtitle="Bunker vs plan"
            pct={linerOps.operational_efficiency.bunker_consumption_pct_of_plan}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* PIL fleet distribution */}
        {overview && (
          <div className="card p-4">
            <div className="text-sm font-semibold text-slate-200 mb-4">PIL Fleet Status</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pilBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                  {pilBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f1f38', border: '1px solid #244268', borderRadius: 8 }} />
                <Legend
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Port congestion chart */}
        <div className="card p-4 lg:col-span-2">
          <div className="text-sm font-semibold text-slate-200 mb-4">Vessels Waiting by Port</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topCongestedPorts} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid stroke="#152840" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="port_name"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                width={120}
                tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="vessels_waiting" name="Waiting" fill="#ffb800" radius={[0, 3, 3, 0]} />
              <Bar dataKey="vessels_at_berth" name="At Berth" fill="#00d4ff" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Port metrics table */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-semibold text-slate-200">Port Performance Metrics</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-navy-600">
                <th className="text-left px-4 py-3">Port</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Turnaround (h)</th>
                <th className="text-right px-4 py-3">Berth on Arrival</th>
                <th className="text-right px-4 py-3">Congestion Impact</th>
                <th className="text-right px-4 py-3">Berth Util.</th>
                <th className="text-right px-4 py-3">Yard Util.</th>
              </tr>
            </thead>
            <tbody>
              {portMetrics.slice(0, 15).map((p: any) => (
                <tr key={p.port_id} className="border-b border-navy-700 hover:bg-navy-700/50">
                  <td className="px-4 py-2.5">
                    <div className="text-slate-200 font-medium">{p.port_name}</div>
                    <div className="text-slate-500">{p.unlocode}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <CongestionBadge level={p.congestion_level as CongestionLevel} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-200">{p.vessel_turnaround_hours}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={p.berth_on_arrival_pct >= 80 ? 'text-emerald-400' : p.berth_on_arrival_pct >= 60 ? 'text-amber-400' : 'text-red-400'}>
                      {p.berth_on_arrival_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{p.congestion_impact_hours}h</td>
                  <td className="px-4 py-2.5 text-right">
                    <UtilPill pct={p.berth_utilization_pct} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <UtilPill pct={p.yard_utilization_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminal SLAs */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-semibold text-slate-200">Terminal SLAs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-navy-600">
                <th className="text-left px-4 py-3">Terminal</th>
                <th className="text-left px-4 py-3">Port</th>
                <th className="text-right px-4 py-3">Crane Productivity</th>
                <th className="text-right px-4 py-3">SLA Compliance</th>
                <th className="text-right px-4 py-3">Berth Util.</th>
              </tr>
            </thead>
            <tbody>
              {terminalSlas.slice(0, 10).map((t: any) => (
                <tr key={t.terminal_id} className="border-b border-navy-700 hover:bg-navy-700/50">
                  <td className="px-4 py-2.5 text-slate-200 font-medium">{t.terminal_name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{t.port_name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-200">{t.crane_productivity} mv/hr</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={t.sla_compliance_pct >= 85 ? 'text-emerald-400' : 'text-amber-400'}>
                      {t.sla_compliance_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <UtilPill pct={t.berth_utilization_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, subtitle, trend, pct }: { title: string; value: string; subtitle: string; trend?: string; pct: number }) {
  const color = pct >= 85 ? '#00c48c' : pct >= 70 ? '#ffb800' : '#ff4757'
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">{title}</div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
      {trend && (
        <div className={`text-xs mt-2 ${trend === 'improving' ? 'text-emerald-400' : trend === 'declining' ? 'text-red-400' : 'text-slate-400'}`}>
          {trend === 'improving' ? '↑ Improving' : trend === 'declining' ? '↓ Declining' : '→ Stable'}
        </div>
      )}
      <div className="mt-3 h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  )
}

function UtilPill({ pct }: { pct: number }) {
  const color = pct >= 85 ? 'text-red-400' : pct >= 65 ? 'text-amber-400' : 'text-emerald-400'
  return <span className={color}>{pct.toFixed(0)}%</span>
}
