"""
Auth utilities: password hashing (bcrypt direct), JWT creation/verification,
and the current_user FastAPI dependency.

passlib 1.7.4 is incompatible with bcrypt>=4.1 (removed __about__.__version__
and changed the wrap-bug detection API), so we use bcrypt directly.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

_bearer = HTTPBearer()


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def hash_password(plain: str) -> str:
    """Return a bcrypt hash (cost 12) of *plain* as a UTF-8 string."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------


def create_access_token(user_id: str) -> str:
    """Return a signed JWT with sub=user_id, expiring in JWT_EXPIRE_DAYS days."""
    exp = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": exp}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """Decode *token* and return the sub (user_id) string.

    Raises HTTPException(401) on any invalid/expired/tampered token.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        sub: str | None = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="invalid_token")
        return sub
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid_token")


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
):
    """Resolve the authenticated User from a Bearer token.

    Raises HTTPException(401) if token is missing, invalid, or user not found.
    """
    from app.models.user import User  # local import avoids circular

    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user
