"""Full contract tests for /auth endpoints."""
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.core.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_EMAIL = "user@example.com"
VALID_PASSWORD = "securepassword123"


def register(client, email=VALID_EMAIL, password=VALID_PASSWORD):
    return client.post("/auth/register", json={"email": email, "password": password})


def login(client, email=VALID_EMAIL, password=VALID_PASSWORD):
    return client.post("/auth/login", json={"email": email, "password": password})


def _expired_token() -> str:
    """Craft a token with a past `exp` signed with the real secret."""
    exp = datetime.now(timezone.utc) - timedelta(seconds=1)
    payload = {"sub": "some-user-id", "exp": exp}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------


def test_register_new_user_returns_201_with_token(client):
    r = register(client)
    assert r.status_code == 201
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_register_duplicate_email_returns_400(client):
    register(client)
    r = register(client)
    assert r.status_code == 400
    assert r.json()["detail"] == "email_already_registered"


def test_register_malformed_email_returns_422(client):
    r = register(client, email="not-an-email")
    assert r.status_code == 422


def test_register_short_password_returns_422(client):
    r = register(client, password="short")
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------


def test_login_correct_credentials_returns_200_with_token(client):
    register(client)
    r = login(client)
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client):
    register(client)
    r = login(client, password="wrongpassword")
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"


def test_login_unknown_email_returns_401_same_detail_as_wrong_password(client):
    r_unknown = login(client, email="nobody@example.com")
    assert r_unknown.status_code == 401
    # Register and try wrong password — detail must be identical (no enumeration)
    register(client)
    r_wrong = login(client, password="wrongpassword")
    assert r_wrong.json()["detail"] == r_unknown.json()["detail"] == "invalid_credentials"


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------


def test_me_with_valid_token_returns_200_with_user(client):
    r_reg = register(client)
    token = r_reg.json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert "id" in body
    assert body["email"] == VALID_EMAIL


def test_me_no_header_returns_401(client):
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_me_garbage_token_returns_401(client):
    r = client.get("/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
    assert r.status_code == 401


def test_me_expired_token_returns_401(client):
    token = _expired_token()
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
