"""
AIS Service - connects to aisstream.io WebSocket and streams vessel positions.

Vessels are stored in the in-memory _live_positions dict (routers/vessels.py)
and periodically saved to PostgreSQL for historical tracking.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Set

import websockets
from sqlalchemy import select
from config import settings
from database import AsyncSessionLocal
import models

logger = logging.getLogger(__name__)

AIS_WS_URL = "wss://stream.aisstream.io/v0/stream"

# WebSocket clients subscribed to live position updates
_subscribers: Set[asyncio.Queue] = set()

# Current live positions dict - imported by vessels router
_live_positions: dict = {}

# AIS Nav Status codes
NAV_STATUS = {
    0: "underway", 1: "at_anchor", 2: "not_under_command",
    3: "restricted_manoeuvrability", 4: "constrained_by_draught",
    5: "moored", 6: "aground", 7: "engaged_in_fishing",
    8: "underway_sailing", 15: "unknown",
}

PIL_MMSI_PREFIXES = {"563", "477", "229", "235", "548"}  # SG, HK, MT, GB, MY flags typical for PIL


def _is_pil_vessel(mmsi: str, name: str) -> bool:
    """Heuristic: PIL vessels have specific MMSI prefixes or operator in name."""
    if any(mmsi.startswith(p) for p in PIL_MMSI_PREFIXES):
        return False  # Too broad; use operator field instead
    pil_keywords = ["PIL", "PACIFIC INTERNATIONAL", "PAC INT"]
    return any(kw in (name or "").upper() for kw in pil_keywords)


def _nav_status_to_vessel_status(nav_code: int) -> str:
    mapping = {0: "underway", 1: "anchored", 5: "moored", 8: "underway"}
    return mapping.get(nav_code, "unknown")


async def _save_positions_batch(positions: list[dict]):
    """Persist a batch of positions to the database."""
    if not positions:
        return
    async with AsyncSessionLocal() as db:
        for pos in positions:
            mmsi = pos["mmsi"]
            # Upsert vessel record
            existing = await db.get(models.Vessel, mmsi)
            if not existing:
                vessel = models.Vessel(
                    mmsi=mmsi,
                    name=pos.get("name", "Unknown"),
                    vessel_type=pos.get("vessel_type", "Unknown"),
                    flag=pos.get("flag"),
                    operator=pos.get("operator"),
                    loa_m=pos.get("loa_m"),
                    current_draft_m=pos.get("draught"),
                    is_pil_vessel=pos.get("is_pil_vessel", False),
                )
                db.add(vessel)
            else:
                if pos.get("name") and pos["name"] != "Unknown":
                    existing.name = pos["name"]
                if pos.get("draught"):
                    existing.current_draft_m = pos["draught"]
                existing.updated_at = datetime.now(timezone.utc)

            # Save position record
            position = models.VesselPosition(
                mmsi=mmsi,
                latitude=pos["latitude"],
                longitude=pos["longitude"],
                speed_knots=pos.get("speed_knots"),
                course=pos.get("course"),
                heading=pos.get("heading"),
                nav_status=pos.get("nav_status"),
                destination=pos.get("destination"),
                eta=pos.get("eta"),
                draught=pos.get("draught"),
                timestamp=datetime.now(timezone.utc),
            )
            db.add(position)

        try:
            await db.commit()
        except Exception as e:
            logger.warning(f"DB batch save error: {e}")
            await db.rollback()


async def _broadcast(data: dict):
    """Fan-out position update to all connected WebSocket clients."""
    dead = set()
    for q in _subscribers:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            dead.add(q)
    _subscribers.difference_update(dead)


async def run_ais_stream():
    """Main AIS stream loop. Reconnects on failure with exponential backoff."""
    if not settings.AISSTREAM_API_KEY:
        logger.warning("AISSTREAM_API_KEY not set - AIS stream disabled")
        return

    backoff = 2
    while True:
        try:
            await _connect_and_stream()
            backoff = 2  # reset on clean exit
        except Exception as e:
            logger.error(f"AIS stream error: {e}. Reconnecting in {backoff}s...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


async def _connect_and_stream():
    subscription = {
        "APIKey": settings.AISSTREAM_API_KEY,
        "BoundingBoxes": [[[-90, -180], [90, 180]]],  # worldwide
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }

    batch = []
    batch_interval = 30  # seconds
    last_save = asyncio.get_event_loop().time()

    logger.info("Connecting to aisstream.io...")
    async with websockets.connect(AIS_WS_URL, ping_interval=20, ping_timeout=30) as ws:
        await ws.send(json.dumps(subscription))
        logger.info("AIS stream connected")

        async for raw_msg in ws:
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("MessageType")
            meta = msg.get("MetaData", {})
            mmsi = str(meta.get("MMSI", ""))
            if not mmsi:
                continue

            if msg_type == "PositionReport":
                report = msg.get("Message", {}).get("PositionReport", {})
                lat = meta.get("latitude") or report.get("Latitude")
                lon = meta.get("longitude") or report.get("Longitude")
                if not lat or not lon:
                    continue
                # Filter invalid positions
                if abs(lat) > 90 or abs(lon) > 180:
                    continue

                name = (meta.get("ShipName") or "").strip()
                nav_code = report.get("NavigationalStatus", 15)
                pos_data = {
                    "mmsi": mmsi,
                    "name": name or _live_positions.get(mmsi, {}).get("name", "Unknown"),
                    "vessel_type": _live_positions.get(mmsi, {}).get("vessel_type", "Unknown"),
                    "flag": _live_positions.get(mmsi, {}).get("flag"),
                    "operator": _live_positions.get(mmsi, {}).get("operator"),
                    "is_pil_vessel": _live_positions.get(mmsi, {}).get("is_pil_vessel", False),
                    "latitude": lat,
                    "longitude": lon,
                    "speed_knots": report.get("Sog"),
                    "course": report.get("Cog"),
                    "heading": report.get("TrueHeading"),
                    "nav_status": nav_code,
                    "destination": meta.get("Destination", "").strip() or None,
                    "eta": meta.get("ETA", "").strip() or None,
                    "draught": meta.get("Draught"),
                    "loa_m": _live_positions.get(mmsi, {}).get("loa_m"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                _live_positions[mmsi] = pos_data
                await _broadcast(pos_data)
                batch.append(pos_data)

            elif msg_type == "ShipStaticData":
                static = msg.get("Message", {}).get("ShipStaticData", {})
                name = (static.get("Name") or meta.get("ShipName") or "").strip()
                type_code = static.get("TypeOfShipAndCargo", 0)
                vessel_type = _type_code_to_name(type_code)

                if mmsi in _live_positions:
                    _live_positions[mmsi].update({
                        "name": name or _live_positions[mmsi].get("name", "Unknown"),
                        "vessel_type": vessel_type,
                        "flag": static.get("Flag"),
                        "loa_m": static.get("Dimension", {}).get("A", 0) + static.get("Dimension", {}).get("B", 0) or None,
                        "is_pil_vessel": _is_pil_vessel(mmsi, name),
                    })

            # Periodic DB save
            now = asyncio.get_event_loop().time()
            if now - last_save > batch_interval and batch:
                asyncio.create_task(_save_positions_batch(batch[-500:]))  # save last 500
                batch = []
                last_save = now


def _type_code_to_name(code: int) -> str:
    if 70 <= code <= 79:
        return "Container Ship"
    if 80 <= code <= 89:
        return "Tanker"
    if 60 <= code <= 69:
        return "Passenger"
    if 30 <= code <= 39:
        return "Fishing"
    if code in (20, 21, 22, 23, 24):
        return "Tug/SAR"
    if 50 <= code <= 59:
        return "Service"
    if 40 <= code <= 49:
        return "HSC"
    if 90 <= code <= 99:
        return "Other"
    return "Unknown"


def subscribe() -> asyncio.Queue:
    """Register a new subscriber for live AIS position updates."""
    q = asyncio.Queue(maxsize=500)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue):
    _subscribers.discard(q)


def get_live_positions() -> dict:
    return _live_positions
