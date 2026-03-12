from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional, List
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/vessels", tags=["vessels"])

# In-memory store of latest vessel positions (populated by AIS service)
# mmsi -> VesselPositionResponse dict
_live_positions: dict = {}


def get_live_positions() -> dict:
    return _live_positions


def update_position(position_data: dict):
    mmsi = position_data.get("mmsi")
    if mmsi:
        _live_positions[mmsi] = position_data


@router.get("", response_model=List[schemas.VesselPositionResponse])
async def list_vessels(
    vessel_type: Optional[str] = Query(None),
    operator: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    pil_only: bool = Query(False),
    near_port: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Return latest vessel positions from the live in-memory store."""
    positions = list(_live_positions.values())

    if pil_only:
        positions = [p for p in positions if p.get("is_pil_vessel")]
    if vessel_type:
        positions = [p for p in positions if vessel_type.lower() in p.get("vessel_type", "").lower()]
    if operator:
        positions = [p for p in positions if operator.lower() in (p.get("operator") or "").lower()]
    if name:
        positions = [p for p in positions if name.lower() in p.get("name", "").lower()]

    if near_port and near_port > 0:
        port = await db.get(models.Port, near_port)
        if port:
            import math
            def dist(p):
                lat1, lon1 = math.radians(port.latitude), math.radians(port.longitude)
                lat2, lon2 = math.radians(p.get("latitude", 0)), math.radians(p.get("longitude", 0))
                dlat, dlon = lat2 - lat1, lon2 - lon1
                a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
                return 2*math.asin(math.sqrt(a))*6371  # km
            positions = [p for p in positions if dist(p) < 100]

    return positions


@router.get("/{mmsi}", response_model=schemas.VesselResponse)
async def get_vessel(mmsi: str, db: AsyncSession = Depends(get_db)):
    vessel = await db.get(models.Vessel, mmsi)
    if not vessel:
        # Try live store
        live = _live_positions.get(mmsi)
        if not live:
            raise HTTPException(status_code=404, detail="Vessel not found")
        return live
    return vessel


@router.get("/{mmsi}/track")
async def get_vessel_track(
    mmsi: str,
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Return the last N hours of position history for a vessel."""
    from datetime import datetime, timedelta, timezone
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    result = await db.execute(
        select(models.VesselPosition)
        .where(
            models.VesselPosition.mmsi == mmsi,
            models.VesselPosition.timestamp >= since,
        )
        .order_by(models.VesselPosition.timestamp)
    )
    positions = result.scalars().all()
    return [
        {
            "lat": p.latitude,
            "lng": p.longitude,
            "speed": p.speed_knots,
            "course": p.course,
            "timestamp": p.timestamp.isoformat(),
        }
        for p in positions
    ]


@router.get("/{mmsi}/calls", response_model=List[schemas.VesselCallResponse])
async def get_vessel_calls(
    mmsi: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.VesselCall, models.Port.name, models.Terminal.name)
        .join(models.Port, models.VesselCall.port_id == models.Port.id, isouter=True)
        .join(models.Terminal, models.VesselCall.terminal_id == models.Terminal.id, isouter=True)
        .where(models.VesselCall.mmsi == mmsi)
        .order_by(desc(models.VesselCall.eta))
    )
    rows = result.all()
    results = []
    for row in rows:
        call = row[0]
        port_name = row[1]
        terminal_name = row[2]
        d = {
            "id": call.id,
            "mmsi": call.mmsi,
            "vessel_name": None,
            "port_id": call.port_id,
            "port_name": port_name,
            "terminal_id": call.terminal_id,
            "terminal_name": terminal_name,
            "berth_id": call.berth_id,
            "berth_number": None,
            "voyage_number": call.voyage_number,
            "proforma_eta": call.proforma_eta,
            "proforma_etb": call.proforma_etb,
            "proforma_etd": call.proforma_etd,
            "proforma_moves": call.proforma_moves,
            "eta": call.eta,
            "etb": call.etb,
            "etd": call.etd,
            "actual_arrival": call.actual_arrival,
            "actual_berthing": call.actual_berthing,
            "actual_departure": call.actual_departure,
            "actual_moves": call.actual_moves,
            "status": call.status,
            "delay_reason": call.delay_reason,
        }
        results.append(d)
    return results
