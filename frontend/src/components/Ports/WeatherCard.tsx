import type { WeatherData } from '@/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'

interface Props {
  weather: WeatherData
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-700 border border-navy-500 rounded-lg p-2 text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(1)}</div>
      ))}
    </div>
  )
}

export default function WeatherCard({ weather }: Props) {
  const chartData = weather.forecast.slice(0, 24).map((f) => ({
    time: format(new Date(f.time), 'HH:mm'),
    wind: f.wind_speed_kmh,
    wave: f.wave_height_m,
  }))

  return (
    <div className="space-y-4">
      {/* Current conditions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Conditions', value: weather.weather_description },
          { label: 'Temperature', value: weather.temperature_c != null ? `${weather.temperature_c.toFixed(0)}°C` : '—' },
          { label: 'Wind Speed', value: weather.wind_speed_kmh ? `${weather.wind_speed_kmh.toFixed(0)} km/h` : '—' },
          { label: 'Wind Direction', value: weather.wind_direction_deg != null ? `${weather.wind_direction_deg.toFixed(0)}°` : '—' },
          { label: 'Wave Height', value: weather.wave_height_m ? `${weather.wave_height_m.toFixed(1)}m` : '—' },
          { label: 'Visibility', value: weather.visibility_km ? `${weather.visibility_km.toFixed(0)} km` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3">
            <div className="text-lg font-bold text-cyan-maritime">{value}</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* 24h forecast chart */}
      {chartData.length > 0 && (
        <div className="card p-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-4">48-Hour Forecast</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#152840" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="wind" name="Wind (km/h)" stroke="#00d4ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="wave" name="Wave (m)" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hourly table */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-medium text-slate-200">Hourly Forecast</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-navy-600">
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-right px-4 py-2">Wind (km/h)</th>
                <th className="text-right px-4 py-2">Wave (m)</th>
                <th className="text-left px-4 py-2">Conditions</th>
              </tr>
            </thead>
            <tbody>
              {weather.forecast.slice(0, 12).map((f, i) => (
                <tr key={i} className="border-b border-navy-700 hover:bg-navy-700/50">
                  <td className="px-4 py-2 text-slate-300">{format(new Date(f.time), 'dd MMM HH:mm')}</td>
                  <td className="px-4 py-2 text-right text-slate-200">{f.wind_speed_kmh?.toFixed(0) ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-200">{f.wave_height_m?.toFixed(1) ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-400">{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
