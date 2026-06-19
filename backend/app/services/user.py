"""Thin UserService for creating and fetching users."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.models.user import User


class EmailAlreadyRegisteredError(Exception):
    """Raised when creating a user with an email that already exists."""


class UsernameAlreadyRegisteredError(Exception):
    """Raised when creating a user with a username that already exists."""


class UserService:
    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_username(db: AsyncSession, username: str) -> User | None:
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, email: str, password: str, username: str) -> User:
        # Pre-checks keep the session usable on duplicate (an IntegrityError
        # from commit would poison the session for the rest of the request).
        if await UserService.get_by_email(db, email) is not None:
            raise EmailAlreadyRegisteredError(email)
        if await UserService.get_by_username(db, username) is not None:
            raise UsernameAlreadyRegisteredError(username)
        user = User(email=email, password_hash=hash_password(password), username=username)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
