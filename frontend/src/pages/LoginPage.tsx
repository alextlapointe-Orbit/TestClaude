import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Gauge, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  // Declarative redirect — fires after state update is committed
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      // No navigate() here — the isAuthenticated check above handles it
      // after React re-renders with the new auth state
    } catch (err: any) {
      const detail = err.response?.data?.detail; toast.error(Array.isArray(detail) ? 'Login failed. Check your credentials.' : (detail || 'Login failed. Check your credentials.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-maritime/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-glow/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-navy-700/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md px-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-maritime to-cyan-glow rounded-2xl mb-4 shadow-lg shadow-cyan-maritime/20">
            <Gauge className="w-8 h-8 text-navy-900" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Traffic Management Module</h1>
          <p className="text-sm text-slate-400 mt-1">Container Liner Operations Platform</p>
        </div>

        {/* Login card */}
        <div className="bg-navy-800 border border-navy-500 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-slate-100 mb-6">Sign in to TMM</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-navy-600">
            <p className="text-xs text-slate-500 text-center">
              Demo credentials:&nbsp;
              <button
                onClick={() => { setEmail('admin@tmm.local'); setPassword('Admin@2024!') }}
                className="text-cyan-maritime hover:underline"
              >
                Admin
              </button>
              &nbsp;/&nbsp;
              <button
                onClick={() => { setEmail('operator@tmm.local'); setPassword('Operator@2024!') }}
                className="text-cyan-maritime hover:underline"
              >
                Operator
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Pacific International Lines &bull; OrbitMI Integration
        </p>
      </div>
    </div>
  )
}
