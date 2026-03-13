import { NavLink } from 'react-router-dom'
import {
  Map, Anchor, BarChart3, Ship, Grid3X3, AlertTriangle, LogOut,
  TrendingUp, Radio, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useVesselStore } from '@/store/vesselStore'
import clsx from 'clsx'

const NAV = [
  { to: '/map',              icon: Map,           label: 'Live Map',          desc: 'Real-time AIS tracking' },
  { to: '/vessels',          icon: Ship,          label: 'Vessels',           desc: 'Fleet & container ships' },
  { to: '/ports',            icon: Anchor,        label: 'Ports',             desc: 'Port operations' },
  { to: '/terminal-lineup',  icon: Grid3X3,       label: 'Terminal Lineup',   desc: 'Vessel schedules' },
  { to: '/congestion',       icon: AlertTriangle, label: 'Congestion',        desc: 'Port congestion intel' },
  { to: '/dashboard',        icon: BarChart3,     label: 'Fleet Dashboard',   desc: 'PIL fleet overview' },
  { to: '/port-performance', icon: TrendingUp,    label: 'Performance',       desc: 'Port metrics' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { isConnected, vessels } = useVesselStore()

  return (
    <aside
      className="w-14 xl:w-52 flex flex-col shrink-0"
      style={{
        background: 'rgba(1, 8, 16, 0.98)',
        borderRight: '1px solid rgba(22, 51, 84, 0.8)',
      }}
    >
      {/* Logo / Brand */}
      <div
        className="h-14 flex items-center px-3 xl:px-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(22, 51, 84, 0.6)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* PIL-style wave logo */}
          <div
            className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #00d4ff 0%, #0090b8 100%)',
              boxShadow: '0 0 14px rgba(0,212,255,0.4)',
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none" style={{ color: '#010810' }}>
              <path d="M3 17c2-2 4-3 6-3s4 2 6 0 4-3 6-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 3v10M8 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="hidden xl:block min-w-0">
            <div
              className="text-xs font-bold tracking-widest"
              style={{ color: '#00d4ff', letterSpacing: '0.15em' }}
            >
              PIL TMM
            </div>
            <div className="text-[9px] text-slate-500 truncate mt-0.5">
              Traffic Management
            </div>
          </div>
        </div>
      </div>

      {/* AIS Live indicator */}
      <div
        className="hidden xl:flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(22, 51, 84, 0.5)' }}
      >
        <div className={clsx(
          'w-2 h-2 rounded-full shrink-0',
          isConnected
            ? 'bg-emerald-400'
            : 'bg-slate-600',
        )}
          style={isConnected ? { boxShadow: '0 0 6px rgba(16,185,129,0.8)', animation: 'pulse 2s infinite' } : {}}
        />
        <div className="text-[10px] leading-tight min-w-0">
          {isConnected ? (
            <>
              <span className="text-emerald-400 font-medium">AIS Live</span>
              <span className="text-slate-500 ml-1.5">{vessels.size.toLocaleString()} vessels</span>
            </>
          ) : (
            <span className="text-slate-500">AIS Connecting…</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all relative',
                isActive
                  ? 'text-cyan-maritime'
                  : 'text-slate-500 hover:text-slate-200',
              )
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'rgba(0,212,255,0.08)',
                    border: '1px solid rgba(0,212,255,0.2)',
                    boxShadow: '0 0 12px rgba(0,212,255,0.1)',
                  }
                : {
                    border: '1px solid transparent',
                  }
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-cyan-maritime' : '')} />
                <span className="hidden xl:block text-sm font-medium truncate">{label}</span>
                {isActive && (
                  <ChevronRight className="hidden xl:block w-3 h-3 ml-auto text-cyan-maritime/60" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* AIS Radio indicator (mobile) */}
      <div
        className="xl:hidden flex justify-center py-2"
        style={{ borderTop: '1px solid rgba(22, 51, 84, 0.5)' }}
      >
        <Radio className={clsx('w-4 h-4', isConnected ? 'text-emerald-400' : 'text-slate-600')} />
      </div>

      {/* User / Logout */}
      <div
        className="p-2"
        style={{ borderTop: '1px solid rgba(22, 51, 84, 0.6)' }}
      >
        <div className="hidden xl:block px-2 py-1.5 mb-1 rounded-lg" style={{ background: 'rgba(12,30,53,0.5)' }}>
          <div className="text-xs font-medium text-slate-300 truncate">{user?.full_name}</div>
          <div className="text-[10px] text-slate-600 capitalize mt-0.5">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-slate-500 hover:text-red-400 transition-all"
          style={{ border: '1px solid transparent' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.15)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden xl:block text-sm">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
