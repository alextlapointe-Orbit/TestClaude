import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import { useVesselStore } from '@/store/vesselStore'
import { format } from 'date-fns'
import { AlertTriangle, Radio } from 'lucide-react'
import { useState, useEffect } from 'react'

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/map':              { title: 'Live Map',           sub: 'Real-time AIS vessel tracking' },
  '/ports':            { title: 'Ports',              sub: 'Port operations & congestion' },
  '/vessels':          { title: 'Vessel Tracking',    sub: 'Live container ship positions' },
  '/terminal-lineup':  { title: 'Terminal Lineup',    sub: 'Vessel call schedule' },
  '/congestion':       { title: 'Congestion Intel',   sub: 'Port congestion analysis' },
  '/dashboard':        { title: 'Fleet Dashboard',    sub: 'PIL operations overview' },
  '/port-performance': { title: 'Port Performance',   sub: 'Metrics & utilization' },
}

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const basePath = '/' + pathname.split('/')[1]
  const page = PAGE_TITLES[basePath] || { title: 'TMM', sub: 'Traffic Management' }

  const [utcTime, setUtcTime] = useState(() => format(new Date(), 'HH:mm:ss'))
  useEffect(() => {
    const id = setInterval(() => setUtcTime(format(new Date(), 'HH:mm:ss')), 1000)
    return () => clearInterval(id)
  }, [])

  const { isConnected, vessels } = useVesselStore()

  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.overview().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const congested = overview?.congested_ports ?? 0

  return (
    <header
      className="h-14 flex items-center px-4 gap-3 shrink-0"
      style={{ background: 'rgba(2,11,24,0.98)', borderBottom: '1px solid rgba(22,51,84,0.7)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold text-slate-100">{page.title}</h1>
          <span className="hidden sm:block text-[10px] text-slate-600">{page.sub}</span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2">
        <button
          onClick={() => navigate('/vessels')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer"
          style={{
            background: isConnected ? 'rgba(16,185,129,0.08)' : 'rgba(71,85,105,0.1)',
            border: `1px solid ${isConnected ? 'rgba(16,185,129,0.2)' : 'rgba(71,85,105,0.2)'}`,
          }}
        >
          <Radio className="w-3 h-3" style={{ color: isConnected ? '#10b981' : '#475569' }} />
          <span className="text-xs font-mono font-medium" style={{ color: isConnected ? '#10b981' : '#475569' }}>
            {isConnected ? vessels.size.toLocaleString() : '—'}
          </span>
          <span className="text-xs text-slate-600 ml-0.5">vessels</span>
        </button>

        {congested > 0 && (
          <button
            onClick={() => navigate('/congestion')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: congested > 5 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${congested > 5 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            }}
          >
            <AlertTriangle className="w-3 h-3" style={{ color: congested > 5 ? '#ef4444' : '#f59e0b' }} />
            <span className="text-xs font-mono font-medium" style={{ color: congested > 5 ? '#ef4444' : '#f59e0b' }}>
              {congested}
            </span>
            <span className="text-xs text-slate-600 ml-0.5">congested</span>
          </button>
        )}

        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ background: 'rgba(12,30,53,0.5)', border: '1px solid rgba(22,51,84,0.6)' }}
        >
          <span className="text-xs font-mono text-slate-400">{utcTime}</span>
          <span className="text-xs text-slate-600">UTC</span>
        </div>
      </div>
    </header>
  )
}
