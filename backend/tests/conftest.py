import os

# Must be set before any app module is imported so pydantic-settings can read it.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models import chat as _chat  # noqa: F401  (register chat tables with Base before create_all)


@pytest_asyncio.fixture()
async def db():
    """Bare AsyncSession on a fresh in-memory schema, for service-level tests."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(
        bind=test_engine, expire_on_commit=False, autoflush=False
    )
    async with TestSession() as session:
        yield session
    await test_engine.dispose()


@pytest_asyncio.fixture()
async def client():
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(
        bind=test_engine, expire_on_commit=False, autoflush=False
    )

    async def override_get_db():
        async with TestSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    app.dependency_overrides.clear()
