import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.services.seed_data import seed_database
from app.routers import (
    auth_router,
    users_router,
    beyblades_router,
    tournaments_router,
    matches_router,
    wallets_router,
    rankings_router,
    social_router,
    websockets_router
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API RESTful y WebSocket de Alto Rendimiento para AppBey (Torneos Beyblade X, Brackets, Decks, Wallet y Arbitraje en Vivo)",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_v1_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_v1_prefix)
app.include_router(users_router, prefix=api_v1_prefix)
app.include_router(beyblades_router, prefix=api_v1_prefix)
app.include_router(tournaments_router, prefix=api_v1_prefix)
app.include_router(matches_router, prefix=api_v1_prefix)
app.include_router(wallets_router, prefix=api_v1_prefix)
app.include_router(rankings_router, prefix=api_v1_prefix)
app.include_router(social_router, prefix=api_v1_prefix)
app.include_router(websockets_router)

frontend_path = settings.STATIC_DIR
frontend_path.mkdir(parents=True, exist_ok=True)
(frontend_path / "assets").mkdir(parents=True, exist_ok=True)
(frontend_path / "css").mkdir(parents=True, exist_ok=True)
(frontend_path / "js").mkdir(parents=True, exist_ok=True)

app.mount("/assets", StaticFiles(directory=str(frontend_path / "assets")), name="assets")
app.mount("/css", StaticFiles(directory=str(frontend_path / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(frontend_path / "js")), name="js")

@app.get("/manifest.json")
def get_manifest():
    manifest_file = settings.STATIC_DIR / "manifest.json"
    if manifest_file.exists():
        return FileResponse(manifest_file, media_type="application/manifest+json")
    return {"name": "AppBey"}

@app.get("/sw.js")
def get_service_worker():
    sw_file = settings.STATIC_DIR / "sw.js"
    if sw_file.exists():
        return FileResponse(sw_file, media_type="application/javascript")
    return ""

@app.get("/")
def serve_index():
    index_file = settings.STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "AppBey API Server Online", "docs_url": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
