"""CORS middleware tests — verifies the API accepts cross-origin requests from the mobile client."""
import pytest


ORIGIN = "http://10.0.2.2:8000"


def test_cors_preflight_returns_allow_origin_header(client):
    """OPTIONS preflight with an Origin header must return access-control-allow-origin."""
    r = client.options(
        "/health",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" in r.headers


def test_cors_normal_request_returns_allow_origin_header(client):
    """A normal GET with an Origin header must echo access-control-allow-origin."""
    r = client.get("/health", headers={"Origin": ORIGIN})
    assert r.status_code == 200
    assert "access-control-allow-origin" in r.headers
