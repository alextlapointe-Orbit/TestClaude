from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from database import get_db
import models
import schemas
from services.congestion_service import (
    calc_shared_quay_capacity,
    calc_independent_berths_capacity,
    can_vessel_berth_shared,
    find_available_berth,
    predict_congestion,
    _congestion_from_utilization,
)
import auth as auth_utils

router = APIRouter(prefix="/api/congestion", tags=["congestion"])


@router.get("", response_model=List[schemas.CongestionMetricResponse])
async def get_all_congestion(db: AsyncSession = Depends(get_db)):
    """Latest congestion snapshot for all ports."""
    result = await db.execute(
        select(models.Port).order_by(
            models.Port.congestion_level.desc(), models.Port.vessels_waiting.desc()
        )
    )
    ports = result.scalars().all()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    return [
        {
            "port_id": p.id,
            "port_name": p.name,
            "congestion_level": p.congestion_level,
            "vessels_waiting": p.vessels_waiting,
            "vessels_at_berth": p.vessels_at_berth,
            "vessels_at_anchorage": p.vessels_waiting,
            "avg_waiting_hours": p.avg_waiting_hours,
            "berth_utilization_pct": p.berth_utilization_pct,
            "yard_utilization_pct": p.yard_utilization_pct,
            "timestamp": p.updated_at or now,
        }
        for p in ports
    ]


@router.get("/{port_id}/berth-availability")
async def get_berth_availability(
    port_id: int,
    vessel_loa_m: Optional[float] = Query(None),
    vessel_draft_m: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate real-time berth availability for a port,
    applying draft restrictions and berth configuration (Scenario A or B).
    """
    port = await db.get(models.Port, port_id)
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")

    terminals_result = await db.execute(
        select(models.Terminal).where(models.Terminal.port_id == port_id)
    )
    terminals = terminals_result.scalars().all()

    result = []
    for terminal in terminals:
        # Get berths for this terminal
        berths_result = await db.execute(
            select(models.Berth).where(
                models.Berth.terminal_id == terminal.id,
                models.Berth.is_active == True,
            )
        )
        berths = berths_result.scalars().all()

        # Get currently occupied vessel calls
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        calls_result = await db.execute(
            select(models.VesselCall, models.Vessel).join(
                models.Vessel, models.VesselCall.mmsi == models.Vessel.mmsi, isouter=True
            ).where(
                models.VesselCall.terminal_id == terminal.id,
                models.VesselCall.status.in_(["at_berth", "moored"]),
            )
        )
        occupied_calls = calls_result.all()
        occupied_vessels = [
            {
                "mmsi": call.mmsi,
                "loa_m": vessel.loa_m if vessel else None,
                "draft_m": vessel.current_draft_m if vessel else None,
            }
            for call, vessel in occupied_calls
        ]

        if terminal.berth_configuration == models.BerthConfig.shared:
            quay_len = terminal.total_quay_length_m or sum(b.length_m for b in berths)
            capacity = calc_shared_quay_capacity(
                quay_len, occupied_vessels, terminal.max_draft_m
            )
            berth_check = None
            if vessel_loa_m:
                can, reason = can_vessel_berth_shared(
                    vessel_loa_m, vessel_draft_m,
                    capacity["available_length_m"],
                    terminal.max_draft_m,
                )
                berth_check = {"can_berth": can, "reason": reason}
            result.append({
                "terminal_id": terminal.id,
                "terminal_name": terminal.name,
                **capacity,
                "vessel_check": berth_check,
            })
        else:
            # Scenario B: independent berths
            # Build berth occupancy dict
            occupied_berth_ids = {call.berth_id for call, _ in occupied_calls if call.berth_id}
            berth_dicts = [
                {
                    "id": b.id,
                    "berth_number": b.berth_number,
                    "length_m": b.length_m,
                    "max_draft_m": b.max_draft_m,
                    "occupied": b.id in occupied_berth_ids,
                    "vessel": next(
                        ({"mmsi": call.mmsi} for call, _ in occupied_calls if call.berth_id == b.id),
                        None,
                    ),
                }
                for b in berths
            ]
            capacity = calc_independent_berths_capacity(berth_dicts, terminal.max_draft_m)
            berth_check = None
            if vessel_loa_m:
                best_berth, reason = find_available_berth(
                    vessel_loa_m, vessel_draft_m, berth_dicts, terminal.max_draft_m
                )
                berth_check = {
                    "can_berth": best_berth is not None,
                    "reason": reason,
                    "recommended_berth": best_berth.get("berth_number") if best_berth else None,
                }
            result.append({
                "terminal_id": terminal.id,
                "terminal_name": terminal.name,
                **capacity,
                "vessel_check": berth_check,
            })

    return result


@router.get("/{port_id}/history")
async def get_congestion_history(
    port_id: int,
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Historical congestion metrics for a port."""
    from datetime import datetime, timedelta, timezone
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(models.PortCongestionMetric)
        .where(
            models.PortCongestionMetric.port_id == port_id,
            models.PortCongestionMetric.timestamp >= since,
        )
        .order_by(models.PortCongestionMetric.timestamp)
    )
    metrics = result.scalars().all()
    return [
        {
            "timestamp": m.timestamp.isoformat(),
            "vessels_waiting": m.vessels_waiting,
            "vessels_at_berth": m.vessels_at_berth,
            "berth_utilization_pct": m.berth_utilization_pct,
            "yard_utilization_pct": m.yard_utilization_pct,
            "congestion_level": m.congestion_level,
            "avg_waiting_hours": m.avg_waiting_hours,
        }
        for m in metrics
    ]


@router.get("/{port_id}/predict")
async def predict_port_congestion(
    port_id: int,
    arrivals_next_6h: int = Query(0),
    arrivals_next_24h: int = Query(2),
    db: AsyncSession = Depends(get_db),
):
    """Predict future congestion for a port."""
    port = await db.get(models.Port, port_id)
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")

    prediction = predict_congestion(
        current_waiting=port.vessels_waiting,
        current_utilization=port.berth_utilization_pct,
        arrivals_next_6h=arrivals_next_6h,
        arrivals_next_24h=arrivals_next_24h,
        avg_port_stay_hours=port.avg_waiting_hours + 20,  # estimated total port stay
    )
    return {
        "port_id": port_id,
        "port_name": port.name,
        **prediction,
    }
