from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, JSON, func
)
from sqlalchemy.orm import relationship
from database import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    operator = "operator"
    viewer = "viewer"


class CongestionLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class BerthConfig(str, enum.Enum):
    shared = "shared"       # Scenario A - continuous quay
    independent = "independent"  # Scenario B - separate berths


class VesselStatus(str, enum.Enum):
    underway = "underway"
    anchored = "anchored"
    moored = "moored"
    at_berth = "at_berth"
    waiting = "waiting"
    unknown = "unknown"


# ─── Auth ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.viewer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)


# ─── Geography ────────────────────────────────────────────────────────────────

class Port(Base):
    __tablename__ = "ports"

    id = Column(Integer, primary_key=True, index=True)
    unlocode = Column(String(10), unique=True, index=True)
    name = Column(String(255), nullable=False)
    country = Column(String(100))
    country_code = Column(String(3))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timezone = Column(String(50), default="UTC")

    # Static info
    num_terminals = Column(Integer, default=1)
    quay_length_m = Column(Float, nullable=True)      # total quay length in meters
    max_vessel_loa_m = Column(Float, nullable=True)
    max_draft_m = Column(Float, nullable=True)
    tidal_range_m = Column(Float, nullable=True)
    water_density = Column(Float, default=1.025)       # sea water density
    anchorage_capacity = Column(Integer, nullable=True)

    # Dynamic (from LMS or updated manually)
    status = Column(String(50), default="operational")
    congestion_level = Column(SAEnum(CongestionLevel), default=CongestionLevel.low)
    vessels_waiting = Column(Integer, default=0)
    vessels_at_berth = Column(Integer, default=0)
    avg_waiting_hours = Column(Float, default=0.0)
    berth_utilization_pct = Column(Float, default=0.0)
    yard_utilization_pct = Column(Float, default=0.0)

    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    terminals = relationship("Terminal", back_populates="port", cascade="all, delete-orphan")
    supplementary_infos = relationship("PortSupplementaryInfo", back_populates="port", cascade="all, delete-orphan")
    congestion_history = relationship("PortCongestionMetric", back_populates="port", cascade="all, delete-orphan")


class Terminal(Base):
    __tablename__ = "terminals"

    id = Column(Integer, primary_key=True, index=True)
    port_id = Column(Integer, ForeignKey("ports.id"), nullable=False)
    name = Column(String(255), nullable=False)
    operator = Column(String(255), nullable=True)

    total_quay_length_m = Column(Float, nullable=True)
    berth_configuration = Column(SAEnum(BerthConfig), default=BerthConfig.independent)
    max_draft_m = Column(Float, nullable=True)      # terminal-wide depth limit
    max_vessel_loa_m = Column(Float, nullable=True)
    crane_count = Column(Integer, nullable=True)
    yard_capacity_teu = Column(Integer, nullable=True)
    annual_capacity_teu = Column(Integer, nullable=True)

    # Current status
    yard_utilization_pct = Column(Float, default=0.0)
    berth_utilization_pct = Column(Float, default=0.0)

    port = relationship("Port", back_populates="terminals")
    berths = relationship("Berth", back_populates="terminal", cascade="all, delete-orphan")
    vessel_calls = relationship("VesselCall", back_populates="terminal")


class Berth(Base):
    __tablename__ = "berths"

    id = Column(Integer, primary_key=True, index=True)
    terminal_id = Column(Integer, ForeignKey("terminals.id"), nullable=False)
    berth_number = Column(String(20), nullable=False)
    name = Column(String(255), nullable=True)

    length_m = Column(Float, nullable=False)
    max_draft_m = Column(Float, nullable=True)       # berth-specific depth limit
    max_loa_m = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    terminal = relationship("Terminal", back_populates="berths")
    vessel_calls = relationship("VesselCall", back_populates="berth")


# ─── Vessels ──────────────────────────────────────────────────────────────────

class Vessel(Base):
    __tablename__ = "vessels"

    mmsi = Column(String(20), primary_key=True, index=True)
    imo = Column(String(20), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    vessel_type = Column(String(100), default="Container Ship")
    vessel_type_code = Column(Integer, nullable=True)

    flag = Column(String(10), nullable=True)
    operator = Column(String(255), nullable=True)
    call_sign = Column(String(20), nullable=True)

    # Physical dimensions
    loa_m = Column(Float, nullable=True)          # Length Overall
    beam_m = Column(Float, nullable=True)
    max_draft_m = Column(Float, nullable=True)
    current_draft_m = Column(Float, nullable=True)  # from AIS
    gt = Column(Integer, nullable=True)             # Gross Tonnage
    dwt = Column(Integer, nullable=True)            # Deadweight Tonnage
    teu_capacity = Column(Integer, nullable=True)

    # PIL-specific
    is_pil_vessel = Column(Boolean, default=False)
    service = Column(String(100), nullable=True)
    trade = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    positions = relationship("VesselPosition", back_populates="vessel", cascade="all, delete-orphan")
    calls = relationship("VesselCall", back_populates="vessel")


class VesselPosition(Base):
    __tablename__ = "vessel_positions"

    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String(20), ForeignKey("vessels.mmsi"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed_knots = Column(Float, nullable=True)
    course = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    nav_status = Column(Integer, nullable=True)     # AIS navigational status code
    destination = Column(String(255), nullable=True)
    eta = Column(String(50), nullable=True)
    draught = Column(Float, nullable=True)

    vessel = relationship("Vessel", back_populates="positions")


class VesselCall(Base):
    __tablename__ = "vessel_calls"

    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String(20), ForeignKey("vessels.mmsi"), nullable=False, index=True)
    port_id = Column(Integer, ForeignKey("ports.id"), nullable=True)
    terminal_id = Column(Integer, ForeignKey("terminals.id"), nullable=True)
    berth_id = Column(Integer, ForeignKey("berths.id"), nullable=True)
    voyage_number = Column(String(50), nullable=True)

    # Proforma (planned)
    proforma_eta = Column(DateTime(timezone=True), nullable=True)
    proforma_etb = Column(DateTime(timezone=True), nullable=True)
    proforma_etd = Column(DateTime(timezone=True), nullable=True)
    proforma_moves = Column(Integer, nullable=True)

    # Actual / Updated
    eta = Column(DateTime(timezone=True), nullable=True)
    etb = Column(DateTime(timezone=True), nullable=True)
    etd = Column(DateTime(timezone=True), nullable=True)
    actual_arrival = Column(DateTime(timezone=True), nullable=True)
    actual_berthing = Column(DateTime(timezone=True), nullable=True)
    actual_departure = Column(DateTime(timezone=True), nullable=True)
    actual_moves = Column(Integer, nullable=True)

    status = Column(SAEnum(VesselStatus), default=VesselStatus.unknown)
    delay_reason = Column(Text, nullable=True)

    vessel = relationship("Vessel", back_populates="calls")
    terminal = relationship("Terminal", back_populates="vessel_calls")
    berth = relationship("Berth", back_populates="vessel_calls")


# ─── Port Intelligence ────────────────────────────────────────────────────────

class PortSupplementaryInfo(Base):
    __tablename__ = "port_supplementary_info"

    id = Column(Integer, primary_key=True, index=True)
    port_id = Column(Integer, ForeignKey("ports.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # operational|approach|environmental|lookout
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(100), nullable=True)    # CME, vessel_master, operator
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    port = relationship("Port", back_populates="supplementary_infos")


class PortCongestionMetric(Base):
    __tablename__ = "port_congestion_metrics"

    id = Column(Integer, primary_key=True, index=True)
    port_id = Column(Integer, ForeignKey("ports.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    vessels_waiting = Column(Integer, default=0)
    vessels_at_berth = Column(Integer, default=0)
    vessels_at_anchorage = Column(Integer, default=0)
    avg_waiting_hours = Column(Float, default=0.0)
    berth_utilization_pct = Column(Float, default=0.0)
    yard_utilization_pct = Column(Float, default=0.0)
    congestion_level = Column(SAEnum(CongestionLevel), default=CongestionLevel.low)
    prediction_confidence = Column(Float, nullable=True)

    port = relationship("Port", back_populates="congestion_history")
