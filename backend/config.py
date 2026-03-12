from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./tmm.db"

    # Auth
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # AIS
    AISSTREAM_API_KEY: str = ""

    # Mapbox (used by frontend, served via API)
    MAPBOX_TOKEN: str = ""

    # App
    APP_NAME: str = "TMM - Traffic Management Module"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
