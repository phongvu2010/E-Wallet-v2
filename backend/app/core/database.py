"""Database Engine and Session Management Configuration.

Configures both asynchronous (asyncpg) and synchronous (psycopg2) SQLAlchemy engines,
connection pooling parameters, transaction pooler compatibility (Supabase / PgBouncer),
and FastAPI dependency injection for asynchronous sessions.
"""

from typing import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine_kwargs = {
    "echo": False,
    "future": True,
}
if "sqlite" not in settings.async_database_url:
    engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "pool_pre_ping": settings.DB_POOL_PRE_PING,
        }
    )

# Connection arguments for asyncpg (e.g. Supabase / PgBouncer / Transaction pooler compatibility)
async_connect_args = {}
if settings.DATABASE_URL and (
    "supabase.co" in settings.DATABASE_URL
    or "pooler.supabase.com" in settings.DATABASE_URL
    or ":6543" in settings.DATABASE_URL
):
    # Transaction pooler (PgBouncer/Supavisor) does not support prepared statements cache
    async_connect_args["statement_cache_size"] = 0

# Async Engine (Default for FastAPI routes)
async_engine = create_async_engine(
    settings.async_database_url,
    connect_args=async_connect_args,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Sync Engine (For migrations, seeding, background sync)
sync_engine = create_engine(
    settings.sync_database_url,
    echo=False,
    pool_pre_ping=True,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an asynchronous SQLAlchemy database session.

    Ensures transactions are automatically rolled back on unhandled exceptions and
    connections are safely returned to the connection pool.

    Yields:
        AsyncGenerator[AsyncSession, None]: Asynchronous database session context.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
