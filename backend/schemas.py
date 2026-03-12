from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import UserRole, CongestionLevel, BerthConfig, VesselStatus


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.viewer


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Ports ────────────────────────────────────────────────────────────────────

class PortBase(BaseModel):
    unlocode: str
    name: str
    country: str
    country_code: str
    latitude: float
    longitude: float
    timezone: str = "UTC"
    num_terminals: int = 1
    quay_length_m: Optional[float] = None
    max_vessel_loa_m: Optional[float] = None
    max_draft_m: Optional[float] = None
    tidal_range_m: Optional[float] = None
    water_density: float = 1.025
    anchorage_capacity: Optional[int] = None


class PortResponse(PortBase):
    id: int
    status: str
    congestion_level: CongestionLevel
    vessels_waiting: int
    vessels_at_berth: int
    avg_waiting_hours: float
    berth_utilization_pct: float
    yard_utilization_pct: float
    updated_at: datetime

    class Config:
        from_attributes = True


class PortListItem(BaseModel):
    id: int
    unlocode: str
    name: str
    country: str
    latitude: float
    longitude: float
    congestion_level: CongestionLevel
    vessels_waiting: int
    vessels_at_berth: int
    berth_utilization_pct: float
    status: str

    class Config:
        from_attributes = True


# ─── Terminals ────────────────────────────────────────────────────────────────

class TerminalResponse(BaseModel):
    id: int
    port_id: int
    name: str
    operator: Optional[str]
    total_quay_length_m: Optional[float]
    berth_configuration: BerthConfig
    max_draft_m: Optional[float]
    max_vessel_loa_m: Optional[float]
    crane_count: Optional[int]
    yard_capacity_teu: Optional[int]
    yard_utilization_pct: float
    berth_utilization_pct: float

    class Config:
        from_attributes = True


class BerthResponse(BaseModel):
    id: int
    terminal_id: int
    berth_number: str
    name: Optional[str]
    length_m: float
    max_draft_m: Optional[float]
    max_loa_m: Optional[float]
    is_active: bool
    notes: Optional[str]

    class Config:
        from_attributes = True


# ─── Vessels ──────────────────────────────────────────────────────────────────

class VesselResponse(BaseModel):
    mmsi: str
    imo: Optional[str]
    name: str
    vessel_type: str
    flag: Optional[str]
    operator: Optional[str]
    loa_m: Optional[float]
    beam_m: Optional[float]
    max_draft_m: Optional[float]
    current_draft_m: Optional[float]
    gt: Optional[int]
    dwt: Optional[int]
    teu_capacity: Optional[int]
    is_pil_vessel: bool
    service: Optional[str]
    trade: Optional[str]

    class Config:
        from_attributes = True


class VesselPositionResponse(BaseModel):
    mmsi: str
    name: str
    vessel_type: str
    flag: Optional[str]
    operator: Optional[str]
    is_pil_vessel: bool
    latitude: float
    longitude: float
    speed_knots: Optional[float]
    course: Optional[float]
    heading: Optional[float]
    nav_status: Optional[int]
    destination: Optional[str]
    eta: Optional[str]
    draught: Optional[float]
    loa_m: Optional[float]
    timestamp: Optional[str]


class VesselCallResponse(BaseModel):
    id: int
    mmsi: str
    vessel_name: Optional[str]
    port_id: Optional[int]
    port_name: Optional[str]
    terminal_id: Optional[int]
    terminal_name: Optional[str]
    berth_id: Optional[int]
    berth_number: Optional[str]
    voyage_number: Optional[str]
    proforma_eta: Optional[datetime]
    proforma_etb: Optional[datetime]
    proforma_etd: Optional[datetime]
    proforma_moves: Optional[int]
    eta: Optional[datetime]
    etb: Optional[datetime]
    etd: Optional[datetime]
    actual_arrival: Optional[datetime]
    actual_berthing: Optional[datetime]
    actual_departure: Optional[datetime]
    actual_moves: Optional[int]
    status: VesselStatus
    delay_reason: Optional[str]

    class Config:
        from_attributes = True


# ─── Port Supplementary Info ──────────────────────────────────────────────────

class SupplementaryInfoCreate(BaseModel):
    category: str
    title: str
    content: str
    source: Optional[str] = None


class SupplementaryInfoResponse(SupplementaryInfoCreate):
    id: int
    port_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Congestion ───────────────────────────────────────────────────────────────

class CongestionMetricResponse(BaseModel):
    port_id: int
    port_name: str
    congestion_level: CongestionLevel
    vessels_waiting: int
    vessels_at_berth: int
    vessels_at_anchorage: int
    avg_waiting_hours: float
    berth_utilization_pct: float
    yard_utilization_pct: float
    timestamp: datetime

    class Config:
        from_attributes = True


class BerthAvailabilityResponse(BaseModel):
    terminal_id: int
    terminal_name: str
    berth_configuration: BerthConfig
    total_quay_length_m: Optional[float]
    available_length_m: Optional[float]
    utilization_pct: float
    berths: Optional[List[dict]] = None


class CongestionPrediction(BaseModel):
    port_id: int
    port_name: str
    current_level: CongestionLevel
    predicted_level_6h: CongestionLevel
    predicted_level_24h: CongestionLevel
    confidence: float
    factors: List[str]


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardOverview(BaseModel):
    total_pil_vessels: int
    vessels_at_sea: int
    vessels_in_port: int
    vessels_waiting: int
    congested_ports: int
    ports_monitored: int
    schedule_performance_pct: float
    avg_port_waiting_hours: float
    total_vessels_tracked: int


class WeatherData(BaseModel):
    port_id: int
    port_name: str
    timestamp: str
    temperature_c: Optional[float]
    wind_speed_kmh: Optional[float]
    wind_direction_deg: Optional[float]
    wave_height_m: Optional[float]
    visibility_km: Optional[float]
    weather_code: Optional[int]
    weather_description: str
    forecast: Optional[List[dict]] = None
