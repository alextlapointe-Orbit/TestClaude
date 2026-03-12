import { NavLink } from 'react-router-dom'
import {
  Map, Anchor, BarChart3, Ship, Grid3X3, AlertTriangle, LogOut, Gauge, TrendingUp
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useVesselStore } from '@/store/vesselStore'
import clsx from 'clsx'

const NAV = [
  { to: '/map', icon: Map, label: 'Live Map' },
  { to: '/ports', icon: Anchor, label: 'Ports' },
  { to: '/vessels', icon: Ship, label: 'Vessels' },
  { to: '/terminal-lineup', icon: Grid3X3, label: 'Terminal Lineup' },
  { to: '/congestion', icon: AlertTriangle, label: 'Congestion' },
  { to: '/dashboard', icon: BarChart3, label: 'Fleet & Schedule' },
  { to: '/port-performance', icon: TrendingUp, label: 'Port Performance' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { isConnected, vessels } = useVesselStore()

  return (
    <aside className="w-16 xl:w-56 bg-navy-800 border-r border-navy-500 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-3 xl:px-4 border-b border-navy-500">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-maritime to-cyan-glow rounded-lg flex items-center justify-center shrink-0">
            <Gauge className="w-4 h-4 text-navy-900" />
          </div>
          <div className="hidden xl:block min-w-0">
            <div className="text-xs font-bold text-cyan-maritime tracking-wider truncate">TMM</div>
            <div className="text-[10px] text-slate-400 truncate">Traffic Management</div>
          </div>
        </div>
      </div>

      {/* AIS Status */}
      <div className="hidden xl:flex items-center gap-2 px-4 py-2 border-b border-navy-500">
        <div className={clsx('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
        <span className="text-xs text-slate-400">
          {isConnected ? `${vessels.size.toLocaleString()} vessels live` : 'AIS connecting...'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all',
                isActive
                  ? 'bg-cyan-maritime/15 text-cyan-maritime border border-cyan-maritime/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-navy-700'
              )
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden xl:block text-sm font-medium truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-navy-500 p-2">
        <div className="hidden xl:block px-2 py-1 mb-1">
          <div className="text-xs font-medium text-slate-200 truncate">{user?.full_name}</div>
          <div className="text-[10px] text-slate-500 capitalize">{user?.role}</div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden xl:block text-sm">Logout</span>
        </button>
      </div>
    </aside>
  )
}
