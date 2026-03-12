from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from database import get_db
import models
import auth as auth_utils
from routers.vessels import _live_positions

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/overview")
async def get_dashboard_overview(db: AsyncSession = Depends(get_db)):
    """Company-level overview metrics."""
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

    pil_result = await db.execute(
        select(func.count(models.Vessel.mmsi)).where(models.Vessel.is_pil_vessel == True)
    )
    pil_vessels = pil_result.scalar() or 0

    live_count = len(_live_positions)

    # Mock LMS-dependent metrics (TODO: replace with real LMS API)
    return {
        "total_pil_vessels": pil_vessels,
        "vessels_at_sea": max(0, pil_vessels - int(stats.total_at_berth or 0)),
        "vessels_in_port": int(stats.total_at_berth or 0),
        "vessels_waiting": int(stats.total_waiting or 0),
        "congested_ports": congested_ports,
        "ports_monitored": int(stats.total_ports or 0),
        "schedule_performance_pct": 78.4,      # LMS data placeholder
        "commercial_reliability_pct": 82.1,    # LMS data placeholder
        "avg_port_waiting_hours": round(float(stats.avg_wait or 0), 1),
        "total_vessels_tracked": live_count,
        "avg_berth_utilization_pct": round(float(stats.avg_utilization or 0), 1),
        # CII / Emissions placeholder
        "cii_rating": "B",
        "avg_bunker_efficiency": 94.2,
    }


@router.get("/liner-ops")
async def get_liner_ops_metrics(
    trade: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Liner operations monitoring dashboard metrics."""
    # These would come from LMS in production
    return {
        "schedule_performance": {
            "pct": 78.4,
            "trend": "improving",
            "voyages_on_time": 42,
            "voyages_delayed": 12,
            "avg_delay_days": 1.8,
        },
        "commercial_reliability": {
            "pct": 82.1,
            "transit_days_adherence": 84.3,
            "trend": "stable",
        },
        "operational_efficiency": {
            "bunker_consumption_pct_of_plan": 97.2,
            "port_calls_vs_plan": 1.02,
            "voyage_days_vs_plan": 1.04,
        },
        "emissions": {
            "cii_rating": "B",
            "cii_score": 3.82,
            "co2_tonnes_mtd": 12450,
            "eexi_compliance": True,
        },
    }


@router.get("/port-metrics")
async def get_port_metrics(
    port_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Port-level performance metrics."""
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
            "vessel_turnaround_hours": round(p.avg_waiting_hours + 20, 1),
            "berth_on_arrival_pct": round(max(0, 100 - p.vessels_waiting * 8), 1),
            "congestion_impact_hours": round(p.avg_waiting_hours, 1),
            "berth_utilization_pct": p.berth_utilization_pct,
            "yard_utilization_pct": p.yard_utilization_pct,
            "congestion_level": p.congestion_level,
            "vessels_waiting": p.vessels_waiting,
            "vessels_at_berth": p.vessels_at_berth,
            # Emission at port placeholder
            "emissions_co2_tonnes": round(p.vessels_at_berth * 2.3, 1),
        }
        for p in ports
    ]


@router.get("/terminal-slas")
async def get_terminal_slas(db: AsyncSession = Depends(get_db)):
    """Terminal SLA metrics."""
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
            "crane_productivity": round(25 - t.berth_utilization_pct * 0.05, 1),  # moves/hr placeholder
            "sla_compliance_pct": round(max(60, 100 - t.berth_utilization_pct * 0.3), 1),
        }
        for t, port_name in rows
    ]


@router.get("/terminal-lineup/{port_id}")
async def get_terminal_lineup(port_id: int, db: AsyncSession = Depends(get_db)):
    """Terminal line-up: all vessel calls for a port sorted by ETA."""
    from datetime import datetime, timedelta, timezone
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
