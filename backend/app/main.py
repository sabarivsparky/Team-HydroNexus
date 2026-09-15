"""FastAPI application entry point."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import admin, auth, bands, readings, workers
from app.config import settings
from app.database import Base, engine, SessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if os.getenv("AUTO_SEED", "1") != "0":
        from app.seed import seed_if_empty
        db = SessionLocal()
        try:
            seed_if_empty(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Backend for the passive colorimetric H2S exposure-dosimeter "
        "wristband: CV feature extraction, ML dose estimation, workers, "
        "wristbands, readings and reporting."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(workers.router, prefix=settings.API_PREFIX)
app.include_router(bands.router, prefix=settings.API_PREFIX)
app.include_router(readings.router, prefix=settings.API_PREFIX)
app.include_router(admin.router, prefix=settings.API_PREFIX)

app.mount("/api/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)),
          name="uploads")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}
