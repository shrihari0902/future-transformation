from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.seed import seed_database

from app.routers.auth import router as auth_router
from app.routers.devices import router as devices_router
from app.routers.wallet import router as wallet_router
from app.routers.certificates import router as certificates_router
from app.routers.transactions import router as transactions_router
from app.routers.risk import router as risk_router
from app.routers.disputes import router as disputes_router
from app.routers.analyst import router as analyst_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist and seed demo accounts if empty
    Base.metadata.create_all(bind=engine)
    seed_database(reset=False)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FastAPI Backend for Offline Payment System with Double-Spend Protection, ECDSA P-256 Signatures, and Idempotent Settlement.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(auth_router, prefix="/api")
app.include_router(devices_router, prefix="/api")
app.include_router(wallet_router, prefix="/api")
app.include_router(certificates_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(risk_router, prefix="/api")
app.include_router(disputes_router, prefix="/api")
app.include_router(analyst_router, prefix="/api")


@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "redoc_url": "/redoc"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
