"""TDD test for User.username column (Task 1).

This test verifies that User can be created with a username and that it
round-trips through the DB correctly. It must fail (RED) before the column
is added to the model, and pass (GREEN) after.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.user import User


@pytest.fixture()
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def test_user_username_round_trips(db_session):
    """User created with a username persists and can be fetched back."""
    user = User(
        email="alice@example.com",
        password_hash="hashed",
        username="alice",
    )
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.email == "alice@example.com"))
    fetched = result.scalar_one()
    assert fetched.username == "alice"


async def test_user_username_unique_constraint(db_session):
    """Two users cannot share the same username."""
    from sqlalchemy.exc import IntegrityError

    db_session.add(User(email="a@example.com", password_hash="h", username="taken"))
    await db_session.commit()

    db_session.add(User(email="b@example.com", password_hash="h", username="taken"))
    with pytest.raises(IntegrityError):
        await db_session.commit()
