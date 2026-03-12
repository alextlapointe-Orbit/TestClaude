"""
Congestion Service - Berth availability & congestion calculations.

Supports:
  Scenario A: Shared continuous quay (vessels can span nominal berth boundaries)
  Scenario B: Independent berths (vessel must fit within a single berth)

Draft restrictions:
  - Terminal-wide max_draft_m
  - Per-berth max_draft_m
  - Interaction with tidal window (tidal_offset parameter)
"""

from typing import Optional
from models import BerthConfig, CongestionLevel


SAFETY_GAP_M = 25.0  # minimum gap between vessels (meters)


def _congestion_from_utilization(utilization_pct: float, waiting: int) -> CongestionLevel:
    if utilization_pct >= 90 or waiting >= 6:
        return CongestionLevel.critical
    if utilization_pct >= 75 or waiting >= 4:
        return CongestionLevel.high
    if utilization_pct >= 50 or waiting >= 2:
        return CongestionLevel.medium
    return CongestionLevel.low


# ─── Scenario A: Shared Quay ──────────────────────────────────────────────────

def calc_shared_quay_capacity(
    total_quay_length_m: float,
    occupied_vessels: list[dict],   # list of {loa_m, draft_m}
    terminal_max_draft_m: Optional[float] = None,
) -> dict:
    """
    Calculate available berth capacity on a shared continuous quay.

    occupied_vessels: vessels currently at berth with their LOA and draft.
    Returns dict with available_length_m, utilization_pct, congestion_level.
    """
    used_length = 0.0
    for v in occupied_vessels:
        loa = v.get("loa_m") or 200.0  # default if unknown
        used_length += loa + SAFETY_GAP_M

    available_length = max(0.0, total_quay_length_m - used_length)
    utilization = min(100.0, (used_length / total_quay_length_m) * 100) if total_quay_length_m > 0 else 0.0

    return {
        "configuration": "shared",
        "total_quay_length_m": total_quay_length_m,
        "used_length_m": used_length,
        "available_length_m": available_length,
        "utilization_pct": round(utilization, 1),
        "vessels_at_berth": len(occupied_vessels),
    }


def can_vessel_berth_shared(
    vessel_loa_m: float,
    vessel_draft_m: Optional[float],
    available_length_m: float,
    terminal_max_draft_m: Optional[float] = None,
    tidal_offset_m: float = 0.0,
) -> tuple[bool, str]:
    """
    Check if a vessel can berth on a shared quay.
    tidal_offset_m: extra depth available due to tidal window (positive = more depth).
    Returns (can_berth: bool, reason: str).
    """
    if vessel_loa_m + SAFETY_GAP_M > available_length_m:
        return False, f"Insufficient quay length ({available_length_m:.0f}m available, {vessel_loa_m + SAFETY_GAP_M:.0f}m needed)"

    if vessel_draft_m and terminal_max_draft_m:
        effective_depth = terminal_max_draft_m + tidal_offset_m
        if vessel_draft_m > effective_depth:
            return False, f"Draft exceeds terminal limit ({vessel_draft_m:.1f}m vs {effective_depth:.1f}m available)"

    return True, "Berth available"


# ─── Scenario B: Independent Berths ──────────────────────────────────────────

def calc_independent_berths_capacity(
    berths: list[dict],             # list of {id, length_m, max_draft_m, occupied, vessel}
    terminal_max_draft_m: Optional[float] = None,
) -> dict:
    """
    Calculate berth availability for independent berths.

    berths: list of berth dicts with occupied status.
    Returns dict with per-berth status and aggregate utilization.
    """
    total = len(berths)
    occupied_count = sum(1 for b in berths if b.get("occupied"))
    berth_statuses = []

    for b in berths:
        is_occupied = b.get("occupied", False)
        # Effective draft limit: berth-specific overrides terminal default
        draft_limit = b.get("max_draft_m") or terminal_max_draft_m
        berth_statuses.append({
            "id": b.get("id"),
            "berth_number": b.get("berth_number"),
            "length_m": b.get("length_m"),
            "max_draft_m": draft_limit,
            "occupied": is_occupied,
            "vessel": b.get("vessel"),
        })

    utilization = (occupied_count / total * 100) if total > 0 else 0.0

    return {
        "configuration": "independent",
        "total_berths": total,
        "occupied_berths": occupied_count,
        "available_berths": total - occupied_count,
        "utilization_pct": round(utilization, 1),
        "berths": berth_statuses,
    }


def find_available_berth(
    vessel_loa_m: float,
    vessel_draft_m: Optional[float],
    berths: list[dict],
    terminal_max_draft_m: Optional[float] = None,
    tidal_offset_m: float = 0.0,
) -> tuple[Optional[dict], str]:
    """
    Find the most suitable available berth for a vessel.
    Returns (berth_dict | None, reason).
    """
    candidates = []
    for b in berths:
        if b.get("occupied"):
            continue
        berth_len = b.get("length_m", 0)
        if vessel_loa_m + SAFETY_GAP_M > berth_len:
            continue
        # Effective draft limit
        draft_limit = b.get("max_draft_m") or terminal_max_draft_m
        if vessel_draft_m and draft_limit:
            effective_depth = draft_limit + tidal_offset_m
            if vessel_draft_m > effective_depth:
                continue
        # Score: prefer tightest fit to maximize utilization
        slack = berth_len - vessel_loa_m
        candidates.append((slack, b))

    if not candidates:
        return None, "No suitable berth available (check LOA and draft constraints)"

    candidates.sort(key=lambda x: x[0])
    return candidates[0][1], "Berth assigned"


# ─── Congestion Prediction ────────────────────────────────────────────────────

def predict_congestion(
    current_waiting: int,
    current_utilization: float,
    arrivals_next_6h: int = 0,
    arrivals_next_24h: int = 0,
    avg_port_stay_hours: float = 24.0,
) -> dict:
    """
    Simple rule-based congestion prediction.
    In production this would use an ML model trained on historical data.
    """
    # Estimate how many vessels will be serviced in 6h
    service_rate_6h = max(1, int(6 / avg_port_stay_hours))
    projected_waiting_6h = max(0, current_waiting - service_rate_6h + arrivals_next_6h)
    projected_util_6h = min(100, current_utilization + (arrivals_next_6h - service_rate_6h) * 5)

    service_rate_24h = max(1, int(24 / avg_port_stay_hours))
    projected_waiting_24h = max(0, current_waiting - service_rate_24h + arrivals_next_24h)
    projected_util_24h = min(100, current_utilization + (arrivals_next_24h - service_rate_24h) * 5)

    factors = []
    if current_waiting > 3:
        factors.append(f"High current anchorage queue ({current_waiting} vessels)")
    if current_utilization > 75:
        factors.append(f"High berth utilization ({current_utilization:.0f}%)")
    if arrivals_next_24h > service_rate_24h:
        factors.append(f"More arrivals ({arrivals_next_24h}) than capacity in 24h")

    return {
        "current_level": _congestion_from_utilization(current_utilization, current_waiting),
        "predicted_6h": _congestion_from_utilization(projected_util_6h, projected_waiting_6h),
        "predicted_24h": _congestion_from_utilization(projected_util_24h, projected_waiting_24h),
        "confidence": 0.65,  # Fixed for rule-based; ML would provide calibrated probability
        "factors": factors if factors else ["Port operating normally"],
    }
