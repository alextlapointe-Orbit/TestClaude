import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/api'
import { format } from 'date-fns'

const PAGE_TITLES: Record<string, string> = {
  '/map': 'Live Map',
  '/ports': 'Port Management',
  '/vessels': 'Vessel Tracking',
  '/terminal-lineup': 'Terminal Line-Up',
  '/congestion': 'Congestion Intelligence',
  '/dashboard': 'Operations Dashboard',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const basePath = '/' + pathname.split('/')[1]
  const title = PAGE_TITLES[basePath] || 'TMM'

  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.overview().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const congested = overview?.congested_ports ?? 0

  return (
    <header className="h-14 bg-navy-800 border-b border-navy-500 flex items-center px-4 gap-4 shrink-0">
      <h1 className="text-base font-semibold text-slate-100 flex-1">{title}</h1>

      {/* Quick stats */}
      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
        {overview && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              {overview.total_vessels_tracked.toLocaleString()} vessels
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${congested > 5 ? 'bg-red-400' : congested > 2 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {congested} congested ports
            </span>
            <span>{format(new Date(), "HH:mm 'UTC'")}</span>
          </>
        )}
      </div>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-navy-700 transition-colors">
        <Bell className="w-4 h-4" />
        {congested > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>
    </header>
  )
}
