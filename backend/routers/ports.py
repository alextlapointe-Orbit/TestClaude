from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from database import get_db
import models
import schemas
import auth as auth_utils
import json

router = APIRouter(prefix="/api/ports", tags=["ports"])


@router.get("", response_model=List[schemas.PortListItem])
async def list_ports(
    country: Optional[str] = Query(None),
    congestion: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(models.Port)
    if country:
        query = query.where(models.Port.country_code == country.upper())
    if congestion:
        query = query.where(models.Port.congestion_level == congestion)
    if search:
        query = query.where(
            models.Port.name.ilike(f"%{search}%") |
            models.Port.unlocode.ilike(f"%{search}%")
        )
    result = await db.execute(query.order_by(models.Port.name))
    return result.scalars().all()


@router.get("/{port_id}", response_model=schemas.PortResponse)
async def get_port(port_id: int, db: AsyncSession = Depends(get_db)):
    port = await db.get(models.Port, port_id)
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")
    return port


@router.get("/{port_id}/terminals", response_model=List[schemas.TerminalResponse])
async def get_port_terminals(port_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Terminal).where(models.Terminal.port_id == port_id)
    )
    return result.scalars().all()


@router.get("/{port_id}/terminals/{terminal_id}/berths", response_model=List[schemas.BerthResponse])
async def get_terminal_berths(
    port_id: int, terminal_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Berth).where(models.Berth.terminal_id == terminal_id)
    )
    return result.scalars().all()


@router.get("/{port_id}/supplementary", response_model=List[schemas.SupplementaryInfoResponse])
async def get_supplementary(
    port_id: int,
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(models.PortSupplementaryInfo).where(
        models.PortSupplementaryInfo.port_id == port_id
    )
    if category:
        query = query.where(models.PortSupplementaryInfo.category == category)
    result = await db.execute(query.order_by(models.PortSupplementaryInfo.created_at.desc()))
    return result.scalars().all()


@router.post("/{port_id}/supplementary", response_model=schemas.SupplementaryInfoResponse)
async def add_supplementary(
    port_id: int,
    payload: schemas.SupplementaryInfoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    port = await db.get(models.Port, port_id)
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")

    info = models.PortSupplementaryInfo(
        port_id=port_id,
        category=payload.category,
        title=payload.title,
        content=payload.content,
        source=payload.source,
        created_by=current_user.id,
    )
    db.add(info)
    await db.commit()
    await db.refresh(info)
    return info


@router.get("/{port_id}/card")
async def get_port_card(port_id: int, db: AsyncSession = Depends(get_db)):
    """Generate port card data for export/printing."""
    port = await db.get(models.Port, port_id)
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")

    terminals_result = await db.execute(
        select(models.Terminal).where(models.Terminal.port_id == port_id)
    )
    terminals = terminals_result.scalars().all()

    supplementary_result = await db.execute(
        select(models.PortSupplementaryInfo).where(
            models.PortSupplementaryInfo.port_id == port_id
        ).order_by(models.PortSupplementaryInfo.category)
    )
    supplementary = supplementary_result.scalars().all()

    return {
        "port": {
            "id": port.id,
            "unlocode": port.unlocode,
            "name": port.name,
            "country": port.country,
            "latitude": port.latitude,
            "longitude": port.longitude,
            "num_terminals": port.num_terminals,
            "quay_length_m": port.quay_length_m,
            "max_vessel_loa_m": port.max_vessel_loa_m,
            "max_draft_m": port.max_draft_m,
            "tidal_range_m": port.tidal_range_m,
            "water_density": port.water_density,
            "anchorage_capacity": port.anchorage_capacity,
            "congestion_level": port.congestion_level,
            "vessels_waiting": port.vessels_waiting,
            "vessels_at_berth": port.vessels_at_berth,
            "avg_waiting_hours": port.avg_waiting_hours,
            "berth_utilization_pct": port.berth_utilization_pct,
        },
        "terminals": [
            {
                "name": t.name,
                "operator": t.operator,
                "total_quay_length_m": t.total_quay_length_m,
                "berth_configuration": t.berth_configuration,
                "max_draft_m": t.max_draft_m,
                "crane_count": t.crane_count,
                "yard_capacity_teu": t.yard_capacity_teu,
                "berth_utilization_pct": t.berth_utilization_pct,
            }
            for t in terminals
        ],
        "supplementary": [
            {
                "category": s.category,
                "title": s.title,
                "content": s.content,
                "source": s.source,
            }
            for s in supplementary
        ],
    }


@router.get("/export/all")
async def export_all_ports(
    format: str = Query("json", enum=["json", "csv"]),
    db: AsyncSession = Depends(get_db),
):
    """Export all port data."""
    result = await db.execute(select(models.Port).order_by(models.Port.name))
    ports = result.scalars().all()

    data = [
        {
            "unlocode": p.unlocode,
            "name": p.name,
            "country": p.country,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "num_terminals": p.num_terminals,
            "quay_length_m": p.quay_length_m,
            "max_draft_m": p.max_draft_m,
            "congestion_level": p.congestion_level,
            "vessels_waiting": p.vessels_waiting,
            "vessels_at_berth": p.vessels_at_berth,
            "berth_utilization_pct": p.berth_utilization_pct,
        }
        for p in ports
    ]

    if format == "csv":
        import io
        import csv
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ports.csv"},
        )
    return data
