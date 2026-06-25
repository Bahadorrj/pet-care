# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PetCare backend: FastAPI + SQLAlchemy 2.0 + Alembic, packaged with `uv`. Python 3.12+.

## Commands

```bash
uv sync                      # install deps (incl. dev group) from uv.lock
uv run python run.py         # run dev server with reload on :8000
uv run pytest                # run the full test suite
uv run pytest tests/test_auth.py::test_name   # run a single test
uv run pytest --cov=app      # coverage
uv run alembic upgrade head  # apply migrations
uv run alembic revision --autogenerate -m "msg"  # new migration
```

`SECRET_KEY` must be set (via `.env` — copy `.env.example`) or app startup fails by design;
tests/migrations inject their own ephemeral key, so no `.env` is needed to run them.

## Architecture

Layered request flow: `routers/` (HTTP, status codes, `Depends`) → `services/` (business logic,
DB transactions, domain exceptions) → `models/` (SQLAlchemy ORM). `schemas/` holds Pydantic
request/response models. Keep these layers separate — routers translate service exceptions into
`HTTPException`; services never import FastAPI.

- **`app/core/config.py`** — `Settings` (pydantic-settings) is the single source of config, read once as `settings`. Validators reject the placeholder `SECRET_KEY` and non-positive expiry.
- **`app/core/database.py`** — `engine`, `SessionLocal`, declarative `Base`, and the `get_db` dependency. SQLite gets `check_same_thread=False`; keep models DB-agnostic (Postgres migration is deferred, see ADR-0004).
- **`app/core/auth.py`** — password hashing, JWT, and the `current_user` dependency. Uses **bcrypt directly** (not passlib — see module docstring/ADR-0006). PyJWT for tokens (ADR-0005).
- **`app/main.py`** — app instance, CORS, router registration, `/health`.

Auth specifics worth preserving: login does a constant-time bcrypt verify against `_DUMMY_PASSWORD_HASH` even for unknown emails (anti-enumeration); all auth failures return a uniform `invalid_token`/`invalid_credentials` detail. `User.id` is a UUID string PK. Emails are normalized to lowercase in schemas.

## Tests

`tests/conftest.py` provides a `client` fixture backed by an in-memory SQLite DB (StaticPool) with
`get_db` overridden per test — no real DB or migrations involved. Tables are created/dropped per test.
