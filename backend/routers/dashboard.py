from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from typing import Optional
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from database import get_db
import models
from services.ais_service import get_live_positions as _ais_positions, get_status as _ais_status

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/overview")
async def get_dashboard_overview(db: AsyncSession = Depends(get_db)):
    """Company-level overview metrics — all from real DB + AIS data."""
    # Port stats
    port_result = await db.execute(
        select(
            func.count(models.Port.id).label("total_ports"),
            func.sum(models.Port.vessels_waiting).label("total_waiting"),
            func.sum(models.Port.vessels_at_berth).label("total_at_berth"),
            func.avg(models.Port.berth_utilization_pct).label("avg_utilization"),
            func.avg(models.Port.avg_waiting_hours).label("avg_wait"),
        )
    )
    stats = port_result.one()

    congested_result = await db.execute(
        select(func.count(models.Port.id)).where(
            models.Port.congestion_level.in_(["high", "critical"])
        )
    )
    congested_ports = congested_result.scalar() or 0

    # PIL vessel count from DB (seeded fleet)
    pil_result = await db.execute(
        select(func.count(models.Vessel.mmsi)).where(models.Vessel.is_pil_vessel == True)
    )
    pil_total = pil_result.scalar() or 0

    # Determine current status per PIL vessel using VesselCall records.
    # Each vessel has multiple calls (one per port in the service rotation).
    # We find the "current" call per vessel: the one whose window covers now,
    # or if none is active, the call closest in time to now.
    pil_mmsi_subq = select(models.Vessel.mmsi).where(models.Vessel.is_pil_vessel == True)

    all_calls_result = await db.execute(
        select(
            models.VesselCall.mmsi,
            models.VesselCall.status,
            models.VesselCall.eta,
            models.VesselCall.etd,
        ).where(models.VesselCall.mmsi.in_(pil_mmsi_subq))
    )
    all_calls = all_calls_result.all()
    now = datetime.now(timezone.utc)

    # Group calls by MMSI
    vessel_calls: dict = defaultdict(list)
    for call in all_calls:
        vessel_calls[call.mmsi].append(call)

    at_berth_count = 0
    waiting_count = 0
    at_sea_count = 0

    for mmsi, calls in vessel_calls.items():
        # Priority 1: call currently active (eta <= now AND (etd is null OR etd >= now))
        active = [
            c for c in calls
            if c.eta and c.eta <= now and (not c.etd or c.etd >= now)
        ]
        if active:
            current = min(active, key=lambda c: abs((c.eta - now).total_seconds()))
        else:
            # Priority 2: most recent past call
            past = [c for c in calls if c.eta and c.eta <= now]
            if past:
                current = max(past, key=lambda c: c.eta)
            else:
                # All future — vessel is underway toward first port
                current = min(calls, key=lambda c: c.eta or now + timedelta(days=999))

        s = current.status if current else "underway"
        if s in ("at_berth", "moored"):
            at_berth_count += 1
        elif s in ("waiting", "anchored"):
            waiting_count += 1
        else:
            at_sea_count += 1

    # Vessels with no calls at all → assumed at sea
    pil_with_calls = set(vessel_calls.keys())
    all_pil_result = await db.execute(pil_mmsi_subq)
    all_pil_mmsis = {r[0] for r in all_pil_result.all()}
    at_sea_count += len(all_pil_mmsis - pil_with_calls)

    # Clamp: ensure sum = total (rounding/edge cases)
    subtotal = at_berth_count + waiting_count + at_sea_count
    if subtotal > pil_total:
        # Scale down proportionally
        factor = pil_total / subtotal
        at_berth_count = round(at_berth_count * factor)
        waiting_count = round(waiting_count * factor)
        at_sea_count = pil_total - at_berth_count - waiting_count
    elif subtotal < pil_total:
        at_sea_count += (pil_total - subtotal)

    # AIS live data — separate count (all container ships tracked, not just PIL)
    live_pos = _ais_positions()
    ais_info = _ais_status()

    return {
        "total_pil_vessels": pil_total,
        "vessels_at_sea": at_sea_count,
        "vessels_in_port": at_berth_count,
        "vessels_waiting": waiting_count,
        "congested_ports": congested_ports,
        "ports_monitored": int(stats.total_ports or 0),
        "avg_port_waiting_hours": round(float(stats.avg_wait or 0), 1),
        "total_vessels_tracked": len(live_pos),
        "avg_berth_utilization_pct": round(float(stats.avg_utilization or 0), 1),
        "ais_connected": ais_info.get("connected", False),
        "ais_vessels_live": len(live_pos),
    }


@router.get("/liner-ops")
async def get_liner_ops_metrics(
    trade: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Schedule performance computed from VesselCall records — real data."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ahead = now + timedelta(days=7)

    # Completed calls in last 30 days (have actual_arrival)
    completed_result = await db.execute(
        select(models.VesselCall).where(
            models.VesselCall.proforma_eta != None,
            models.VesselCall.actual_arrival != None,
            models.VesselCall.proforma_eta >= thirty_days_ago,
        )
    )
    completed = completed_result.scalars().all()

    total_completed = len(completed)
    on_time = sum(
        1 for c in completed
        if c.actual_arrival <= c.proforma_eta + timedelta(hours=24)
    )
    delayed = total_completed - on_time

    delay_hours_list = [
        max(0.0, (c.actual_arrival - c.proforma_eta).total_seconds() / 3600)
        for c in completed
    ]
    avg_delay_hours = sum(delay_hours_list) / len(delay_hours_list) if delay_hours_list else 0.0
    schedule_pct = round(on_time / total_completed * 100, 1) if total_completed > 0 else None

    # Upcoming calls in next 7 days
    upcoming_result = await db.execute(
        select(models.VesselCall).where(
            models.VesselCall.proforma_eta != None,
            models.VesselCall.eta != None,
            models.VesselCall.eta >= now,
            models.VesselCall.eta <= seven_days_ahead,
        )
    )
    upcoming = upcoming_result.scalars().all()
    upcoming_on_time = sum(
        1 for c in upcoming
        if c.eta <= c.proforma_eta + timedelta(hours=24)
    )
    upcoming_delayed = len(upcoming) - upcoming_on_time

    # PIL upcoming calls
    pil_mmsi_subq = select(models.Vessel.mmsi).where(models.Vessel.is_pil_vessel == True)
    pil_upcoming_result = await db.execute(
        select(func.count(models.VesselCall.id)).where(
            models.VesselCall.eta >= now,
            models.VesselCall.eta <= seven_days_ahead,
            models.VesselCall.mmsi.in_(pil_mmsi_subq),
        )
    )
    pil_upcoming = pil_upcoming_result.scalar() or 0

    return {
        "schedule_performance": {
            "pct": schedule_pct,
            "voyages_on_time": on_time,
            "voyages_delayed": delayed,
            "voyages_total": total_completed,
            "avg_delay_hours": round(avg_delay_hours, 1),
            "period_days": 30,
        },
        "upcoming_calls": {
            "total_7d": len(upcoming),
            "pil_7d": pil_upcoming,
            "on_time_7d": upcoming_on_time,
            "delayed_7d": upcoming_delayed,
        },
    }


@router.get("/port-metrics")
async def get_port_metrics(
    port_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Port-level performance metrics from real DB data."""
    query = select(models.Port)
    if port_id:
        query = query.where(models.Port.id == port_id)
    result = await db.execute(query.order_by(models.Port.vessels_waiting.desc()))
    ports = result.scalars().all()

    return [
        {
            "port_id": p.id,
            "port_name": p.name,
            "unlocode": p.unlocode,
            "congestion_impact_hours": round(p.avg_waiting_hours, 1),
            "berth_utilization_pct": p.berth_utilization_pct,
            "yard_utilization_pct": p.yard_utilization_pct,
            "congestion_level": p.congestion_level,
            "vessels_waiting": p.vessels_waiting,
            "vessels_at_berth": p.vessels_at_berth,
        }
        for p in ports
    ]


@router.get("/terminal-slas")
async def get_terminal_slas(db: AsyncSession = Depends(get_db)):
    """Terminal utilization metrics from real DB data."""
    result = await db.execute(
        select(models.Terminal, models.Port.name)
        .join(models.Port, models.Terminal.port_id == models.Port.id)
        .order_by(models.Terminal.berth_utilization_pct.desc())
    )
    rows = result.all()
    return [
        {
            "terminal_id": t.id,
            "terminal_name": t.name,
            "port_name": port_name,
            "berth_utilization_pct": t.berth_utilization_pct,
            "yard_utilization_pct": t.yard_utilization_pct,
            "crane_count": t.crane_count,
            "yard_capacity_teu": t.yard_capacity_teu,
            "annual_capacity_teu": t.annual_capacity_teu,
        }
        for t, port_name in rows
    ]


@router.get("/terminal-lineup/{port_id}")
async def get_terminal_lineup(port_id: int, db: AsyncSession = Depends(get_db)):
    """Terminal line-up: all vessel calls for a port sorted by ETA."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=2)
    window_end = now + timedelta(days=7)

    result = await db.execute(
        select(models.VesselCall, models.Vessel, models.Terminal, models.Berth)
        .join(models.Vessel, models.VesselCall.mmsi == models.Vessel.mmsi, isouter=True)
        .join(models.Terminal, models.VesselCall.terminal_id == models.Terminal.id, isouter=True)
        .join(models.Berth, models.VesselCall.berth_id == models.Berth.id, isouter=True)
        .where(
            models.VesselCall.port_id == port_id,
            models.VesselCall.eta >= window_start,
            models.VesselCall.eta <= window_end,
        )
        .order_by(models.VesselCall.eta)
    )
    rows = result.all()

    return [
        {
            "call_id": call.id,
            "mmsi": call.mmsi,
            "vessel_name": vessel.name if vessel else "Unknown",
            "vessel_type": vessel.vessel_type if vessel else "Unknown",
            "loa_m": vessel.loa_m if vessel else None,
            "teu_capacity": vessel.teu_capacity if vessel else None,
            "is_pil_vessel": vessel.is_pil_vessel if vessel else False,
            "terminal_name": terminal.name if terminal else None,
            "berth_number": berth.berth_number if berth else None,
            "voyage_number": call.voyage_number,
            "proforma_eta": call.proforma_eta.isoformat() if call.proforma_eta else None,
            "proforma_etb": call.proforma_etb.isoformat() if call.proforma_etb else None,
            "proforma_etd": call.proforma_etd.isoformat() if call.proforma_etd else None,
            "proforma_moves": call.proforma_moves,
            "eta": call.eta.isoformat() if call.eta else None,
            "etb": call.etb.isoformat() if call.etb else None,
            "etd": call.etd.isoformat() if call.etd else None,
            "actual_moves": call.actual_moves,
            "status": call.status,
            "delay_hours": (
                (call.eta - call.proforma_eta).total_seconds() / 3600
                if call.eta and call.proforma_eta else 0
            ),
        }
        for call, vessel, terminal, berth in rows
    ]
