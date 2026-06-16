"""
Tests for auth utilities (JWT, bcrypt) and UserService.
Written FIRST per TDD — all tests must fail before implementation exists.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# conftest.py sets SECRET_KEY env var before app imports
from app.core.config import settings
from app.core.database import Base
from app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.services.user import EmailAlreadyRegisteredError, UserService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def db_session():
    """In-memory SQLite session for UserService round-trip tests."""
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    yield db
    db.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def test_hash_password_returns_bcrypt_hash():
    h = hash_password("supersecret")
    assert isinstance(h, str)
    assert h != "supersecret"
    assert h.startswith("$2"), f"Expected bcrypt prefix $2, got: {h[:5]}"


def test_verify_password_correct():
    h = hash_password("mypassword")
    assert verify_password("mypassword", h) is True


def test_verify_password_wrong():
    h = hash_password("mypassword")
    assert verify_password("wrongpassword", h) is False


# ---------------------------------------------------------------------------
# JWT creation & decoding
# ---------------------------------------------------------------------------


def test_create_and_decode_access_token():
    user_id = str(uuid.uuid4())
    token = create_access_token(user_id)
    assert isinstance(token, str)
    decoded_id = decode_access_token(token)
    assert decoded_id == user_id


def test_token_payload_contains_sub_and_exp():
    user_id = str(uuid.uuid4())
    token = create_access_token(user_id)

    payload = jwt.decode(
        token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    assert "sub" in payload
    assert "exp" in payload
    assert payload["sub"] == user_id

    # exp should be approximately now + 30 days (within a 60-second window)
    expected_exp = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    actual_exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    delta = abs((actual_exp - expected_exp).total_seconds())
    assert delta < 60, f"exp off by {delta}s, expected ~{settings.JWT_EXPIRE_DAYS} days"


def test_decode_tampered_token_raises_401():
    user_id = str(uuid.uuid4())
    token = create_access_token(user_id)
    # Corrupt the first char of the signature segment. (Flipping the token's
    # last char is unreliable: base64url padding can decode to the same bytes.)
    header, payload, signature = token.split(".")
    signature = ("X" if signature[0] != "X" else "Y") + signature[1:]
    tampered = f"{header}.{payload}.{signature}"
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(tampered)
    assert exc_info.value.status_code == 401


def test_decode_expired_token_raises_401():
    user_id = str(uuid.uuid4())
    # Craft a token that expired 1 second ago, signed with the real key
    exp = datetime.now(timezone.utc) - timedelta(seconds=1)
    token = jwt.encode(
        {"sub": user_id, "exp": exp},
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)
    assert exc_info.value.status_code == 401


def test_decode_garbage_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token("this.is.garbage")
    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# UserService round-trip
# ---------------------------------------------------------------------------


def test_user_service_create_and_get_by_email(db_session):
    email = f"test-{uuid.uuid4()}@example.com"
    user = UserService.create(db_session, email=email, password="plaintext123")

    assert user.email == email
    assert user.password_hash != "plaintext123"
    assert verify_password("plaintext123", user.password_hash)

    fetched = UserService.get_by_email(db_session, email)
    assert fetched is not None
    assert fetched.id == user.id


def test_user_service_get_by_email_missing_returns_none(db_session):
    result = UserService.get_by_email(db_session, "nobody@example.com")
    assert result is None


def test_user_service_create_duplicate_email_raises_and_session_usable(db_session):
    email = f"dup-{uuid.uuid4()}@example.com"
    UserService.create(db_session, email=email, password="plaintext123")

    with pytest.raises(EmailAlreadyRegisteredError):
        UserService.create(db_session, email=email, password="other123")

    # Session must remain usable after the duplicate attempt (no poisoning).
    assert UserService.get_by_email(db_session, email) is not None
