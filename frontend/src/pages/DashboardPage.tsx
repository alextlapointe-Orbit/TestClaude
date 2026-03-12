import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'

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

const PIL_SERVICES = ['AEX1', 'AEX2', 'PSW', 'IAX']

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

  const pilBreakdown = overview
    ? [
        { name: 'At Sea', value: overview.vessels_at_sea, color: '#00d4ff' },
        { name: 'In Port', value: overview.vessels_in_port, color: '#00c48c' },
        { name: 'Waiting', value: overview.vessels_waiting, color: '#ffb800' },
      ]
    : []

  // Service performance data (from liner-ops placeholder)
  const servicePerf = PIL_SERVICES.map((svc, i) => ({
    service: svc,
    onTime: linerOps ? Math.round(linerOps.schedule_performance.pct - i * 3 + i * 1.5) : 0,
    delayed: linerOps ? Math.round(100 - linerOps.schedule_performance.pct + i * 3 - i * 1.5) : 0,
  }))

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100">PIL Fleet &amp; Schedule Performance</h2>
        <p className="text-sm text-slate-400 mt-0.5">Pacific International Lines — Fleet Operations Dashboard</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {overview && [
          { label: 'PIL Fleet', value: overview.total_pil_vessels, color: 'text-cyan-maritime' },
          { label: 'At Sea', value: overview.vessels_at_sea, color: 'text-blue-400' },
          { label: 'In Port', value: overview.vessels_in_port, color: 'text-emerald-400' },
          { label: 'Waiting', value: overview.vessels_waiting, color: 'text-amber-400' },
          { label: 'Schedule', value: `${overview.schedule_performance_pct}%`, color: overview.schedule_performance_pct >= 80 ? 'text-emerald-400' : 'text-amber-400' },
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
            subtitle={`${linerOps.schedule_performance.voyages_on_time} on-time / ${linerOps.schedule_performance.voyages_delayed} delayed · avg delay ${linerOps.schedule_performance.avg_delay_days}d`}
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
            title="Bunker vs Plan"
            value={`${linerOps.operational_efficiency.bunker_consumption_pct_of_plan}%`}
            subtitle={`CII: ${linerOps.emissions.cii_rating} (${linerOps.emissions.cii_score}) · CO₂ MTD: ${linerOps.emissions.co2_tonnes_mtd.toLocaleString()}t`}
            pct={linerOps.operational_efficiency.bunker_consumption_pct_of_plan}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PIL fleet distribution */}
        {overview && (
          <div className="card p-4">
            <div className="text-sm font-semibold text-slate-200 mb-4">PIL Fleet Status Distribution</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pilBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {pilBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f1f38', border: '1px solid #244268', borderRadius: 8 }} />
                <Legend formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Schedule performance by service */}
        <div className="card p-4">
          <div className="text-sm font-semibold text-slate-200 mb-4">Schedule Performance by Service</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={servicePerf} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="#152840" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} unit="%" />
              <YAxis type="category" dataKey="service" tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="onTime" name="On Time %" fill="#00c48c" radius={[0, 3, 3, 0]} stackId="a" />
              <Bar dataKey="delayed" name="Delayed %" fill="#ff6b35" radius={[0, 3, 3, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vessel schedule table */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-semibold text-slate-200">Active PIL Services</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-navy-600">
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Trade</th>
                <th className="text-right px-4 py-3">Schedule %</th>
                <th className="text-right px-4 py-3">Reliability %</th>
                <th className="text-right px-4 py-3">Avg Delay</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { svc: 'AEX1', trade: 'Asia–Europe', sched: linerOps?.schedule_performance.pct ?? 0, rel: linerOps?.commercial_reliability.pct ?? 0, delay: '1.2d' },
                { svc: 'AEX2', trade: 'Asia–Europe', sched: (linerOps?.schedule_performance.pct ?? 0) - 3, rel: (linerOps?.commercial_reliability.pct ?? 0) + 2, delay: '2.1d' },
                { svc: 'PSW', trade: 'Asia–Pacific SW', sched: (linerOps?.schedule_performance.pct ?? 0) + 5, rel: (linerOps?.commercial_reliability.pct ?? 0) - 1, delay: '0.8d' },
                { svc: 'IAX', trade: 'Intra-Asia', sched: (linerOps?.schedule_performance.pct ?? 0) + 8, rel: (linerOps?.commercial_reliability.pct ?? 0) + 4, delay: '0.4d' },
              ].map((row) => (
                <tr key={row.svc} className="border-b border-navy-700 hover:bg-navy-700/50">
                  <td className="px-4 py-2.5 text-cyan-maritime font-semibold">{row.svc}</td>
                  <td className="px-4 py-2.5 text-slate-300">{row.trade}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={row.sched >= 80 ? 'text-emerald-400' : row.sched >= 65 ? 'text-amber-400' : 'text-red-400'}>
                      {row.sched.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={row.rel >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                      {row.rel.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{row.delay}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${row.sched >= 80 ? 'bg-emerald-400/15 text-emerald-400' : 'bg-amber-400/15 text-amber-400'}`}>
                      {row.sched >= 80 ? 'On Track' : 'Monitoring'}
                    </span>
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
