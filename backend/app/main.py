from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.core.database import async_engine
from backend.app.api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Verify database connectivity
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1;"))
        print("[FastAPI] Successfully connected to PostgreSQL Database.")
    except Exception as e:
        print(f"[FastAPI] Warning: Database connection failed during startup: {e}")
    yield
    # Shutdown: Dispose engine pool
    await async_engine.dispose()
    print("[FastAPI] Database engine connection pool disposed.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    description="""
    ## Credit Wallet 2.0 - Personal Finance & Credit Card Management API
    
    Backend RESTful API Service for managing credit cards, accounts, statements,
    transactions ledger, installment plans, reward ledgers, and financial analytics.
    """,
    version="2.0.0",
)

# Set CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "Internal Server Error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred.",
        },
    )


# Health Check
@app.get("/health", tags=["Health Check"], summary="Service Health Check")
async def health_check():
    db_status = "healthy"
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1;"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": "2.0.0",
        "database": db_status,
    }


@app.get("/", tags=["Root"], include_in_schema=False)
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
        "health": "/health",
        "api_v1": settings.API_V1_STR,
    }


# Include API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)
