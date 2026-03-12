import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useConfigStore } from '@/store/configStore'
import { configApi } from '@/services/api'
import AppLayout from '@/components/Layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import MapPage from '@/pages/MapPage'
import PortsPage from '@/pages/PortsPage'
import PortDetailPage from '@/pages/PortDetailPage'
import DashboardPage from '@/pages/DashboardPage'
import PortPerformancePage from '@/pages/PortPerformancePage'
import VesselsPage from '@/pages/VesselsPage'
import TerminalLineupPage from '@/pages/TerminalLineupPage'
import CongestionPage from '@/pages/CongestionPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-navy-900">
        <div className="flex items-center gap-3 text-cyan-maritime">
          <div className="w-6 h-6 border-2 border-cyan-maritime border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading TMM...</span>
        </div>
      </div>
    )
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { setConfig } = useConfigStore()

  useEffect(() => {
    let cancelled = false
    function fetchConfig() {
      configApi.get()
        .then((r) => { if (!cancelled) setConfig(r.data) })
        .catch(() => { if (!cancelled) setTimeout(fetchConfig, 4000) })
    }
    fetchConfig()
    return () => { cancelled = true }
  }, [setConfig])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="map" element={<MapPage />} />
        <Route path="ports" element={<PortsPage />} />
        <Route path="ports/:id" element={<PortDetailPage />} />
        <Route path="vessels" element={<VesselsPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="port-performance" element={<PortPerformancePage />} />
        <Route path="terminal-lineup" element={<TerminalLineupPage />} />
        <Route path="congestion" element={<CongestionPage />} />
      </Route>
    </Routes>
  )
}
