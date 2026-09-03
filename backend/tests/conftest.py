"""Pytest configuration and test fixture definitions."""

import sys
from pathlib import Path
from typing import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Add backend and root directories to sys.path
backend_dir = Path(__file__).resolve().parent.parent
root_dir = backend_dir.parent
for p in [str(backend_dir), str(root_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.core.config import settings
from app.core.database import get_db
from app.main import app

# Create a NullPool async engine for tests to prevent event loop connection leakage
test_async_engine = create_async_engine(
    settings.async_database_url,
    poolclass=NullPool,
    echo=False,
    future=True,
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an asynchronous HTTP test client bound to the FastAPI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated asynchronous database session for unit test cases."""
    async with TestAsyncSessionLocal() as session:
        yield session
