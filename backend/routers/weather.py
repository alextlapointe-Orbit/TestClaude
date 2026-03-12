from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
import models
import httpx

router = APIRouter(prefix="/api/weather", tags=["weather"])

WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Icing fog", 51: "Light drizzle", 53: "Drizzle",
    55: "Heavy drizzle", 61: "Slight rain", 63: "Moderate rain",
    65: "Heavy rain", 71: "Slight snow", 73: "Moderate snow",
    75: "Heavy snow", 80: "Rain showers", 81: "Heavy showers",
    82: "Violent showers", 85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Heavy thunderstorm",
}


@router.get("/{port_id}")
async def get_port_weather(port_id: int, db: AsyncSession = Depends(get_db)):
    port = await db.get(models.Port, port_id)
    if not port:
        raise HTTPException(status_code=404, detail="Port not found")

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={port.latitude}&longitude={port.longitude}"
        f"&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,visibility"
        f"&hourly=wave_height,wind_speed_10m,wind_direction_10m,weather_code,visibility"
        f"&daily=weather_code,wind_speed_10m_max,wind_direction_10m_dominant"
        f"&wind_speed_unit=kmh&forecast_days=5&timezone=auto"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather API error: {str(e)}")

    current = data.get("current", {})
    hourly = data.get("hourly", {})
    wmo_code = current.get("weather_code", 0)

    # Build 48h hourly forecast (wind + wave height)
    times = hourly.get("time", [])
    wave_heights = hourly.get("wave_height", [])
    wind_speeds = hourly.get("wind_speed_10m", [])
    wind_dirs = hourly.get("wind_direction_10m", [])
    weather_codes = hourly.get("weather_code", [])
    visibilities = hourly.get("visibility", [])

    forecast = [
        {
            "time": times[i],
            "wave_height_m": wave_heights[i] if i < len(wave_heights) else None,
            "wind_speed_kmh": wind_speeds[i] if i < len(wind_speeds) else None,
            "wind_direction_deg": wind_dirs[i] if i < len(wind_dirs) else None,
            "weather_code": weather_codes[i] if i < len(weather_codes) else None,
            "description": WMO_CODES.get(weather_codes[i] if i < len(weather_codes) else 0, "Unknown"),
            "visibility_km": (visibilities[i] / 1000) if i < len(visibilities) and visibilities[i] else None,
        }
        for i in range(min(48, len(times)))
    ]

    return {
        "port_id": port_id,
        "port_name": port.name,
        "latitude": port.latitude,
        "longitude": port.longitude,
        "timestamp": current.get("time", ""),
        "temperature_c": current.get("temperature_2m"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "wind_direction_deg": current.get("wind_direction_10m"),
        "wave_height_m": wave_heights[0] if wave_heights else None,
        "visibility_km": (current.get("visibility", 0) or 0) / 1000,
        "weather_code": wmo_code,
        "weather_description": WMO_CODES.get(wmo_code, "Unknown"),
        "forecast": forecast,
    }
