import { useQuery } from '@tanstack/react-query'
import { congestionApi } from '@/services/api'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import CongestionBadge from '@/components/common/CongestionBadge'
import type { CongestionMetric, CongestionLevel } from '@/types'

const LEVEL_COLOR: Record<CongestionLevel, string> = {
  low: '#00c48c',
  medium: '#ffb800',
  high: '#ff6b35',
  critical: '#ff4757',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-700 border border-navy-500 rounded-lg p-2 text-xs">
      <div className="text-slate-200 font-medium mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

export default function CongestionPage() {
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['congestion-all'],
    queryFn: () => congestionApi.getAll().then((r) => r.data as CongestionMetric[]),
    refetchInterval: 60_000,
  })

  const critical = metrics.filter((m) => m.congestion_level === 'critical')
  const high = metrics.filter((m) => m.congestion_level === 'high')
  const totalWaiting = metrics.reduce((acc, m) => acc + m.vessels_waiting, 0)
  const avgUtilization = metrics.length
    ? metrics.reduce((acc, m) => acc + m.berth_utilization_pct, 0) / metrics.length
    : 0

  const topCongested = [...metrics]
    .sort((a, b) => b.vessels_waiting - a.vessels_waiting)
    .slice(0, 10)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Critical Ports', value: critical.length, color: critical.length > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'High Congestion', value: high.length, color: high.length > 3 ? 'text-orange-400' : 'text-amber-400' },
          { label: 'Total Waiting', value: totalWaiting, color: 'text-amber-400' },
          { label: 'Avg Berth Util.', value: `${avgUtilization.toFixed(0)}%`, color: 'text-cyan-maritime' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="stat-label mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Alert banner for critical ports */}
      {critical.length > 0 && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
          <div className="text-sm text-red-300">
            <strong>Critical congestion</strong> at{' '}
            {critical.map((p) => p.port_name).join(', ')}. Immediate attention required.
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card p-4">
        <div className="text-sm font-semibold text-slate-200 mb-4">Vessels Waiting — Top 10 Congested Ports</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={topCongested} layout="vertical">
            <CartesianGrid stroke="#152840" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="port_name"
              width={140}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 20) + '…' : v}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="vessels_waiting" name="Waiting" radius={[0, 3, 3, 0]}>
              {topCongested.map((m, i) => (
                <Cell key={i} fill={LEVEL_COLOR[m.congestion_level]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-maritime border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="text-sm font-semibold text-slate-200">All Ports — Congestion Status</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-navy-600">
                  <th className="text-left px-4 py-3">Port</th>
                  <th className="text-center px-4 py-3">Level</th>
                  <th className="text-right px-4 py-3">Waiting</th>
                  <th className="text-right px-4 py-3">At Berth</th>
                  <th className="text-right px-4 py-3">Avg Wait</th>
                  <th className="text-right px-4 py-3">Berth Util.</th>
                  <th className="text-right px-4 py-3">Yard Util.</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.port_id} className="border-b border-navy-700 hover:bg-navy-700/50">
                    <td className="px-4 py-2.5 text-slate-200 font-medium">{m.port_name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <CongestionBadge level={m.congestion_level} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={m.vessels_waiting >= 5 ? 'text-red-400 font-bold' : m.vessels_waiting >= 3 ? 'text-amber-400' : 'text-slate-200'}>
                        {m.vessels_waiting}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-200">{m.vessels_at_berth}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{m.avg_waiting_hours.toFixed(1)}h</td>
                    <td className="px-4 py-2.5 text-right">
                      <UtilBar pct={m.berth_utilization_pct} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <UtilBar pct={m.yard_utilization_pct} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/ports/${m.port_id}`}
                        className="text-cyan-maritime hover:underline"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? '#ff4757' : pct >= 65 ? '#ffb800' : '#00c48c'
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span style={{ color }} className="text-xs w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}
