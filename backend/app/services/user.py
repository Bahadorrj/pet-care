"""Thin UserService for creating and fetching users."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.models.user import User


class EmailAlreadyRegisteredError(Exception):
    """Raised when creating a user with an email that already exists."""


class UsernameAlreadyRegisteredError(Exception):
    """Raised when creating a user with a username that already exists."""


class UsernameTakenError(Exception):
    """Raised when changing to a username already held by a different user."""


class UserService:
    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_username(db: AsyncSession, username: str) -> User | None:
        result = await db.execute(select(User).where(User.username == username.lower()))
        return result.scalar_one_or_none()

    @staticmethod
    async def change_username(db: AsyncSession, user: User, username: str) -> User:
        # ponytail: pre-check is TOCTOU; the unique DB constraint is the real
        # backstop, but a losing race surfaces as IntegrityError -> 500 rather
        # than 409. Fine on SQLite single-process; on Postgres/concurrent, wrap
        # the commit in try/except IntegrityError and map to UsernameTakenError.
        existing = await UserService.get_by_username(db, username)
        if existing is not None and existing.id != user.id:
            raise UsernameTakenError(username)
        user.username = username.lower()
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def create(db: AsyncSession, email: str, password: str, username: str) -> User:
        # Pre-checks keep the session usable on duplicate (an IntegrityError
        # from commit would poison the session for the rest of the request).
        # ponytail: same TOCTOU race as change_username — unique constraint is
        # the backstop; map IntegrityError -> domain error when going concurrent.
        if await UserService.get_by_email(db, email) is not None:
            raise EmailAlreadyRegisteredError(email)
        if await UserService.get_by_username(db, username) is not None:
            raise UsernameAlreadyRegisteredError(username)
        user = User(email=email, password_hash=hash_password(password), username=username)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
