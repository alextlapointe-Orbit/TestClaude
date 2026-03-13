import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tmm_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem('tmm_token')
      localStorage.removeItem('tmm_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; full_name: string; password: string; role?: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  users: () => api.get('/auth/users'),
}

// ─── Config ────────────────────────────────────────────────────────────────

export const configApi = {
  get: () => api.get('/config'),
}

// ─── Ports ─────────────────────────────────────────────────────────────────

export const portsApi = {
  list: (params?: { country?: string; congestion?: string; search?: string }) =>
    api.get('/ports', { params }),
  get: (id: number) => api.get(`/ports/${id}`),
  getTerminals: (id: number) => api.get(`/ports/${id}/terminals`),
  getBerths: (portId: number, terminalId: number) =>
    api.get(`/ports/${portId}/terminals/${terminalId}/berths`),
  getSupplementary: (id: number, category?: string) =>
    api.get(`/ports/${id}/supplementary`, { params: { category } }),
  addSupplementary: (id: number, data: { category: string; title: string; content: string; source?: string }) =>
    api.post(`/ports/${id}/supplementary`, data),
  getCard: (id: number) => api.get(`/ports/${id}/card`),
  exportAll: (format: 'json' | 'csv' = 'json') =>
    api.get('/ports/export/all', { params: { format } }),
}

// ─── Vessels ───────────────────────────────────────────────────────────────

export const vesselsApi = {
  list: (params?: {
    vessel_type?: string
    operator?: string
    name?: string
    pil_only?: boolean
    near_port?: number
  }) => api.get('/vessels', { params }),
  get: (mmsi: string) => api.get(`/vessels/${mmsi}`),
  getTrack: (mmsi: string, hours?: number) =>
    api.get(`/vessels/${mmsi}/track`, { params: { hours } }),
  getCalls: (mmsi: string) => api.get(`/vessels/${mmsi}/calls`),
}

// ─── Weather ───────────────────────────────────────────────────────────────

export const weatherApi = {
  getPortWeather: (portId: number) => api.get(`/weather/${portId}`),
  getAllPorts: () => api.get('/weather/all-ports'),
}

// ─── Congestion ────────────────────────────────────────────────────────────

export const congestionApi = {
  getAll: () => api.get('/congestion'),
  getBerthAvailability: (portId: number, vesselLoa?: number, vesselDraft?: number) =>
    api.get(`/congestion/${portId}/berth-availability`, {
      params: { vessel_loa_m: vesselLoa, vessel_draft_m: vesselDraft },
    }),
  getHistory: (portId: number, days?: number) =>
    api.get(`/congestion/${portId}/history`, { params: { days } }),
  predict: (portId: number, arrivals6h?: number, arrivals24h?: number) =>
    api.get(`/congestion/${portId}/predict`, {
      params: { arrivals_next_6h: arrivals6h, arrivals_next_24h: arrivals24h },
    }),
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export const dashboardApi = {
  overview: () => api.get('/dashboard/overview'),
  linerOps: (params?: { trade?: string; service?: string }) =>
    api.get('/dashboard/liner-ops', { params }),
  portMetrics: (portId?: number) =>
    api.get('/dashboard/port-metrics', { params: { port_id: portId } }),
  terminalSlas: () => api.get('/dashboard/terminal-slas'),
  terminalLineup: (portId: number) => api.get(`/dashboard/terminal-lineup/${portId}`),
}
