import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR = BASE_DIR.parent / "frontend"

class Settings(BaseModel):
    PROJECT_NAME: str = "AppBey"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "appbey-super-secret-jwt-key-2026-beyblade-championship")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'appbey.db'}")
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    STATIC_DIR: Path = STATIC_DIR

settings = Settings()
