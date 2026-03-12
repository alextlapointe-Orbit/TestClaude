import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ScatterChart, Scatter, ZAxis,
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

export default function PortPerformancePage() {
  const { data: portMetrics = [] } = useQuery({
    queryKey: ['dashboard-port-metrics'],
    queryFn: () => dashboardApi.portMetrics().then((r) => r.data),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const { data: terminalSlas = [] } = useQuery({
    queryKey: ['dashboard-terminal-slas'],
    queryFn: () => dashboardApi.terminalSlas().then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.overview().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const topCongested = [...portMetrics]
    .sort((a: any, b: any) => b.vessels_waiting - a.vessels_waiting)
    .slice(0, 10)

  const utilizationData = [...portMetrics]
    .sort((a: any, b: any) => b.berth_utilization_pct - a.berth_utilization_pct)
    .slice(0, 10)

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100">Port Performance</h2>
        <p className="text-sm text-slate-400 mt-0.5">Berth utilisation, congestion &amp; terminal SLAs across {portMetrics.length} ports</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {overview && [
          { label: 'Ports Monitored', value: overview.ports_monitored, color: 'text-slate-200' },
          { label: 'Congested Ports', value: overview.congested_ports, color: overview.congested_ports > 5 ? 'text-red-400' : 'text-amber-400' },
          { label: 'Vessels Waiting', value: overview.vessels_waiting, color: 'text-amber-400' },
          { label: 'Avg Wait (hrs)', value: overview.avg_port_waiting_hours.toFixed(1), color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="stat-label mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vessels waiting by port */}
        <div className="card p-4">
          <div className="text-sm font-semibold text-slate-200 mb-4">Vessels Waiting by Port (Top 10)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topCongested} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid stroke="#152840" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="port_name"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                width={130}
                tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 20) + '…' : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="vessels_waiting" name="Waiting" fill="#ffb800" radius={[0, 3, 3, 0]} />
              <Bar dataKey="vessels_at_berth" name="At Berth" fill="#00d4ff" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Berth utilisation by port */}
        <div className="card p-4">
          <div className="text-sm font-semibold text-slate-200 mb-4">Berth Utilisation by Port (Top 10)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={utilizationData} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid stroke="#152840" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} unit="%" />
              <YAxis
                type="category"
                dataKey="port_name"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                width={130}
                tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 20) + '…' : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="berth_utilization_pct" name="Berth Util %" fill="#00c48c" radius={[0, 3, 3, 0]}
                label={false}
              />
              <Bar dataKey="yard_utilization_pct" name="Yard Util %" fill="#7c3aed" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Port metrics table */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-semibold text-slate-200">Port Performance Metrics</span>
          <span className="text-xs text-slate-400">{portMetrics.length} ports</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-navy-600">
                <th className="text-left px-4 py-3">Port</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Turnaround (h)</th>
                <th className="text-right px-4 py-3">Berth on Arrival</th>
                <th className="text-right px-4 py-3">Congestion +hrs</th>
                <th className="text-right px-4 py-3">Berth Util.</th>
                <th className="text-right px-4 py-3">Yard Util.</th>
                <th className="text-right px-4 py-3">CO₂ (t)</th>
              </tr>
            </thead>
            <tbody>
              {portMetrics.map((p: any) => (
                <tr key={p.port_id} className="border-b border-navy-700 hover:bg-navy-700/50">
                  <td className="px-4 py-2.5">
                    <div className="text-slate-200 font-medium">{p.port_name}</div>
                    <div className="text-slate-500">{p.unlocode}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <CongestionBadge level={p.congestion_level as CongestionLevel} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-200">{p.vessel_turnaround_hours}h</td>
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
                  <td className="px-4 py-2.5 text-right text-slate-400">{p.emissions_co2_tonnes}</td>
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
                <th className="text-right px-4 py-3">Yard Util.</th>
              </tr>
            </thead>
            <tbody>
              {terminalSlas.map((t: any) => (
                <tr key={t.terminal_id} className="border-b border-navy-700 hover:bg-navy-700/50">
                  <td className="px-4 py-2.5 text-slate-200 font-medium">{t.terminal_name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{t.port_name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-200">{t.crane_productivity} mv/hr</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={t.sla_compliance_pct >= 85 ? 'text-emerald-400' : t.sla_compliance_pct >= 70 ? 'text-amber-400' : 'text-red-400'}>
                      {t.sla_compliance_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right"><UtilPill pct={t.berth_utilization_pct} /></td>
                  <td className="px-4 py-2.5 text-right"><UtilPill pct={t.yard_utilization_pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UtilPill({ pct }: { pct: number }) {
  const color = pct >= 85 ? 'text-red-400' : pct >= 65 ? 'text-amber-400' : 'text-emerald-400'
  return <span className={color}>{pct.toFixed(0)}%</span>
}
