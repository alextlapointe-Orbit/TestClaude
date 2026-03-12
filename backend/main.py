"""
TMM - Traffic Management Module
Maritime intelligence platform for container liner operations.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import init_db
from routers import auth, ports, vessels, weather, congestion, dashboard
import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Retry DB init — Render free-tier DB may need a moment to wake up
    for attempt in range(10):
        try:
            await init_db()
            break
        except Exception as e:
            logger.warning(f"DB init attempt {attempt+1} failed: {e}")
            if attempt < 9:
                await asyncio.sleep(3)
            else:
                raise
    try:
        from seed_data import seed
        await seed()
    except Exception as e:
        logger.warning(f"Seed skipped: {e}")

    from services.ais_service import run_ais_stream
    ais_task = asyncio.create_task(run_ais_stream())
    logger.info("AIS stream task started")

    yield

    ais_task.cancel()
    try:
        await ais_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="TMM - Traffic Management Module",
    description="Maritime traffic management for container liner operations",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ports.router)
app.include_router(vessels.router)
app.include_router(weather.router)
app.include_router(congestion.router)
app.include_router(dashboard.router)


@app.get("/api/config")
async def get_config():
    return {
        "mapbox_token": settings.MAPBOX_TOKEN,
        "app_name": settings.APP_NAME,
    }


@app.get("/api/health")
async def health_check():
    from database import AsyncSessionLocal
    from sqlalchemy import select, func
    try:
        async with AsyncSessionLocal() as db:
            user_count = (await db.execute(select(func.count(models.User.id)))).scalar()
            port_count = (await db.execute(select(func.count(models.Port.id)))).scalar()
        return {"status": "ok", "db_connected": True, "user_count": user_count, "port_count": port_count}
    except Exception as e:
        return {"status": "error", "db_connected": False, "error": str(e)}


@app.post("/api/seed")
async def force_seed():
    """Force re-seed the database. Safe to call if seed was skipped on startup."""
    from seed_data import seed
    try:
        await seed()
        return {"status": "ok", "message": "Seed completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.websocket("/ws/ais")
async def ais_websocket(websocket: WebSocket):
    from services.ais_service import subscribe, unsubscribe, get_live_positions
    await websocket.accept()
    queue = subscribe()
    try:
        snapshot = list(get_live_positions().values())
        await websocket.send_json({"type": "snapshot", "data": snapshot})
        while True:
            try:
                position = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json({"type": "position", "data": position})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS client disconnected: {e}")
    finally:
        unsubscribe(queue)


@app.websocket("/ws/congestion")
async def congestion_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            from database import AsyncSessionLocal
            from sqlalchemy import select
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(models.Port).order_by(models.Port.vessels_waiting.desc())
                )
                ports_list = result.scalars().all()
                data = [
                    {
                        "port_id": p.id,
                        "unlocode": p.unlocode,
                        "congestion_level": p.congestion_level,
                        "vessels_waiting": p.vessels_waiting,
                        "berth_utilization_pct": p.berth_utilization_pct,
                    }
                    for p in ports_list
                ]
            await websocket.send_json({"type": "congestion_update", "data": data})
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass


FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        return FileResponse(str(FRONTEND_DIST / "index.html"))
