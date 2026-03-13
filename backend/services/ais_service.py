"""
AIS Service - connects to aisstream.io WebSocket and streams vessel positions.

Subscription: all vessels (no server-side ShipTypes filter — many container
ships have type_code=0 because they haven't sent ShipStaticData recently and
would be missed by server-side filtering).

Client-side filtering:
- MMSI validation rejects non-vessel AIS targets (buoys/AtoN 99x, MOB 98x,
  EPIRB/SART 97x, SAR aircraft 111x, group calls 00x)
- ShipStaticData type codes evict confirmed non-container ships
- Unspecified type (0) is kept until proven otherwise
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

# Container ship AIS type codes (ITU)
CONTAINER_SHIP_TYPES = set(range(70, 80))

# Vessel MMSI prefixes to REJECT (non-vessel AIS transmitters)
# 99 = Aids to Navigation (buoys, beacons, lighthouses)
# 98 = Craft associated with parent ship (MOB devices)
# 97 = EPIRB / AIS-SART / Man-Overboard
# 00 = Group / broadcast calls
# 111 = SAR aircraft
_INVALID_MMSI_PREFIXES = ('99', '98', '97', '00', '01', '111')

MAX_TRACKED_VESSELS = 10_000  # raised: no server-side ShipTypes filter

_subscribers: Set[asyncio.Queue] = set()
_live_positions: dict = {}

# MMSI set of confirmed container ships (from ShipStaticData)
_container_mmsi: set = set()
# MMSI set of confirmed non-container ships (exclude from tracking)
_non_container_mmsi: set = set()

# Connection state tracking
_status: dict = {
    "connected": False,
    "last_connected_at": None,
    "last_message_at": None,
    "messages_received": 0,
    "reconnect_count": 0,
    "last_error": None,
}

NAV_STATUS = {
    0: "underway", 1: "at_anchor", 5: "moored", 8: "underway_sailing",
}

PIL_KEYWORDS = ["PIL", "PACIFIC INTERNATIONAL", "PAC INT"]


def _is_pil_vessel(name: str) -> bool:
    return any(kw in (name or "").upper() for kw in PIL_KEYWORDS)


def _is_valid_vessel_mmsi(mmsi: str) -> bool:
    """
    Reject non-vessel AIS targets: buoys (99x), MOB devices (98x),
    EPIRBs/SART (97x), group calls (00x/01x), SAR aircraft (111x).
    Valid vessel MMSI = exactly 9 digits, MID 002-775.
    """
    if not mmsi or len(mmsi) != 9 or not mmsi.isdigit():
        return False
    if mmsi.startswith(_INVALID_MMSI_PREFIXES):
        return False
    return True


async def _save_positions_batch(positions: list[dict]):
    if not positions:
        return
    async with AsyncSessionLocal() as db:
        for pos in positions:
            mmsi = pos["mmsi"]
            existing = await db.get(models.Vessel, mmsi)
            if not existing:
                vessel = models.Vessel(
                    mmsi=mmsi,
                    name=pos.get("name", "Unknown"),
                    vessel_type=pos.get("vessel_type", "Container Ship"),
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
    dead = set()
    for q in _subscribers:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            dead.add(q)
    _subscribers.difference_update(dead)


def get_status() -> dict:
    return {
        **_status,
        "vessels_tracked": len(_live_positions),
        "api_key_configured": bool(settings.AISSTREAM_API_KEY),
    }


async def run_ais_stream():
    if not settings.AISSTREAM_API_KEY:
        logger.warning("AISSTREAM_API_KEY not set - AIS stream disabled")
        _status["last_error"] = "AISSTREAM_API_KEY not configured"
        return

    backoff = 2
    while True:
        try:
            await _connect_and_stream()
            backoff = 2
        except Exception as e:
            _status["connected"] = False
            _status["last_error"] = str(e)
            _status["reconnect_count"] += 1
            logger.error(f"AIS stream error: {e}. Reconnecting in {backoff}s...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


async def _connect_and_stream():
    # No server-side ShipTypes filter: many container ships have type_code=0
    # (unspecified) because they haven't broadcast ShipStaticData recently.
    # Server-side filtering would miss them. We filter client-side via MMSI
    # validation and ShipStaticData type codes as static messages arrive.
    subscription = {
        "APIKey": settings.AISSTREAM_API_KEY,
        "BoundingBoxes": [[[-90, -180], [90, 180]]],
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }

    batch = []
    batch_interval = 30
    last_save = asyncio.get_event_loop().time()

    logger.info("Connecting to aisstream.io (all commercial vessels, client-side filtering)...")
    async with websockets.connect(AIS_WS_URL, ping_interval=20, ping_timeout=30) as ws:
        await ws.send(json.dumps(subscription))
        _status["connected"] = True
        _status["last_connected_at"] = datetime.now(timezone.utc).isoformat()
        _status["last_error"] = None
        logger.info("AIS stream connected")

        async for raw_msg in ws:
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                continue

            _status["messages_received"] += 1
            _status["last_message_at"] = datetime.now(timezone.utc).isoformat()

            msg_type = msg.get("MessageType")
            meta = msg.get("MetaData", {})
            mmsi = str(meta.get("MMSI", ""))

            # Reject non-vessel AIS targets (buoys, AtoN, EPIRB, SAR, etc.)
            if not _is_valid_vessel_mmsi(mmsi):
                continue

            # Skip vessels confirmed as non-container ships
            if mmsi in _non_container_mmsi:
                continue

            if msg_type == "PositionReport":
                report = msg.get("Message", {}).get("PositionReport", {})
                lat = meta.get("latitude") or report.get("Latitude")
                lon = meta.get("longitude") or report.get("Longitude")
                if not lat or not lon:
                    continue
                if abs(lat) > 90 or abs(lon) > 180:
                    continue

                # Drop position if we've exceeded memory cap
                if len(_live_positions) >= MAX_TRACKED_VESSELS and mmsi not in _live_positions:
                    continue

                name = (meta.get("ShipName") or "").strip()
                pos_data = {
                    "mmsi": mmsi,
                    "name": name or _live_positions.get(mmsi, {}).get("name", "Unknown"),
                    "vessel_type": _live_positions.get(mmsi, {}).get("vessel_type", "Container Ship"),
                    "flag": _live_positions.get(mmsi, {}).get("flag"),
                    "operator": _live_positions.get(mmsi, {}).get("operator"),
                    "is_pil_vessel": _live_positions.get(mmsi, {}).get("is_pil_vessel", False) or _is_pil_vessel(name),
                    "latitude": lat,
                    "longitude": lon,
                    "speed_knots": report.get("Sog"),
                    "course": report.get("Cog"),
                    "heading": report.get("TrueHeading"),
                    "nav_status": report.get("NavigationalStatus", 15),
                    "destination": (meta.get("Destination") or "").strip() or None,
                    "eta": (meta.get("ETA") or "").strip() or None,
                    "draught": meta.get("Draught"),
                    "loa_m": _live_positions.get(mmsi, {}).get("loa_m"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                _live_positions[mmsi] = pos_data
                await _broadcast(pos_data)
                batch.append(pos_data)

            elif msg_type == "ShipStaticData":
                static = msg.get("Message", {}).get("ShipStaticData", {})
                type_code = static.get("TypeOfShipAndCargo", 0)

                # Categorize: keep only container ships
                if type_code in CONTAINER_SHIP_TYPES:
                    _container_mmsi.add(mmsi)
                    name = (static.get("Name") or meta.get("ShipName") or "").strip()
                    dim = static.get("Dimension", {})
                    loa = (dim.get("A", 0) or 0) + (dim.get("B", 0) or 0)
                    if mmsi in _live_positions:
                        _live_positions[mmsi].update({
                            "name": name or _live_positions[mmsi].get("name", "Unknown"),
                            "vessel_type": "Container Ship",
                            "flag": static.get("Flag"),
                            "loa_m": loa or None,
                            "is_pil_vessel": _is_pil_vessel(name),
                        })
                elif type_code > 0:
                    # Known non-container — evict from tracking
                    _non_container_mmsi.add(mmsi)
                    _live_positions.pop(mmsi, None)

            now = asyncio.get_event_loop().time()
            if now - last_save > batch_interval and batch:
                asyncio.create_task(_save_positions_batch(batch[-500:]))
                batch = []
                last_save = now


def subscribe() -> asyncio.Queue:
    q = asyncio.Queue(maxsize=500)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue):
    _subscribers.discard(q)


def get_live_positions() -> dict:
    return _live_positions
