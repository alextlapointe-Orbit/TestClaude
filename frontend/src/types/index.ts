export type CongestionLevel = 'low' | 'medium' | 'high' | 'critical'
export type BerthConfig = 'shared' | 'independent'
export type VesselStatus = 'underway' | 'anchored' | 'moored' | 'at_berth' | 'waiting' | 'unknown'
export type UserRole = 'admin' | 'operator' | 'viewer'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Port {
  id: number
  unlocode: string
  name: string
  country: string
  country_code: string
  latitude: number
  longitude: number
  timezone: string
  num_terminals: number
  quay_length_m: number | null
  max_vessel_loa_m: number | null
  max_draft_m: number | null
  tidal_range_m: number | null
  water_density: number
  anchorage_capacity: number | null
  status: string
  congestion_level: CongestionLevel
  vessels_waiting: number
  vessels_at_berth: number
  avg_waiting_hours: number
  berth_utilization_pct: number
  yard_utilization_pct: number
  updated_at: string
}

export interface PortListItem {
  id: number
  unlocode: string
  name: string
  country: string
  latitude: number
  longitude: number
  congestion_level: CongestionLevel
  vessels_waiting: number
  vessels_at_berth: number
  berth_utilization_pct: number
  status: string
}

export interface Terminal {
  id: number
  port_id: number
  name: string
  operator: string | null
  total_quay_length_m: number | null
  berth_configuration: BerthConfig
  max_draft_m: number | null
  max_vessel_loa_m: number | null
  crane_count: number | null
  yard_capacity_teu: number | null
  annual_capacity_teu?: number | null
  yard_utilization_pct: number
  berth_utilization_pct: number
}

export interface Berth {
  id: number
  terminal_id: number
  berth_number: string
  name: string | null
  length_m: number
  max_draft_m: number | null
  max_loa_m: number | null
  is_active: boolean
  notes: string | null
}

export interface VesselPosition {
  mmsi: string
  name: string
  vessel_type: string
  flag: string | null
  operator: string | null
  is_pil_vessel: boolean
  latitude: number
  longitude: number
  speed_knots: number | null
  course: number | null
  heading: number | null
  nav_status: number | null
  destination: string | null
  eta: string | null
  draught: number | null
  loa_m: number | null
  timestamp: string | null
}

export interface VesselCall {
  id: number
  mmsi: string
  vessel_name: string | null
  port_id: number | null
  port_name: string | null
  terminal_id: number | null
  terminal_name: string | null
  berth_id: number | null
  berth_number: string | null
  voyage_number: string | null
  proforma_eta: string | null
  proforma_etb: string | null
  proforma_etd: string | null
  proforma_moves: number | null
  eta: string | null
  etb: string | null
  etd: string | null
  actual_arrival: string | null
  actual_berthing: string | null
  actual_departure: string | null
  actual_moves: number | null
  status: VesselStatus
  delay_reason: string | null
}

export interface WeatherData {
  port_id: number
  port_name: string
  latitude: number
  longitude: number
  timestamp: string
  temperature_c: number | null
  wind_speed_kmh: number | null
  wind_direction_deg: number | null
  wave_height_m: number | null
  visibility_km: number | null
  weather_code: number | null
  weather_description: string
  forecast: WeatherForecastItem[]
}

export interface WeatherForecastItem {
  time: string
  wave_height_m: number | null
  wind_speed_kmh: number | null
  wind_direction_deg: number | null
  weather_code: number | null
  description: string
  visibility_km: number | null
}

export interface CongestionMetric {
  port_id: number
  port_name: string
  congestion_level: CongestionLevel
  vessels_waiting: number
  vessels_at_berth: number
  vessels_at_anchorage: number
  avg_waiting_hours: number
  berth_utilization_pct: number
  yard_utilization_pct: number
  timestamp: string
}

export interface DashboardOverview {
  total_pil_vessels: number
  vessels_at_sea: number
  vessels_in_port: number
  vessels_waiting: number
  congested_ports: number
  ports_monitored: number
  avg_port_waiting_hours: number
  total_vessels_tracked: number
  avg_berth_utilization_pct: number
  ais_connected: boolean
  ais_vessels_live: number
}

export interface TerminalLineup {
  call_id: number
  mmsi: string
  vessel_name: string
  vessel_type: string
  loa_m: number | null
  teu_capacity: number | null
  is_pil_vessel: boolean
  terminal_name: string | null
  berth_number: string | null
  voyage_number: string | null
  proforma_eta: string | null
  proforma_etb: string | null
  proforma_etd: string | null
  proforma_moves: number | null
  eta: string | null
  etb: string | null
  etd: string | null
  actual_moves: number | null
  status: VesselStatus
  delay_hours: number
}

export interface SupplementaryInfo {
  id: number
  port_id: number
  category: string
  title: string
  content: string
  source: string | null
  created_at: string
  updated_at: string
}

export interface AppConfig {
  mapbox_token: string
  app_name: string
}
