# CLAUDE.md

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

- **`app/core/config.py`** — `Settings` (pydantic-settings) is the single source of config, read once as `settings`. Validators reject the placeholder `SECRET_KEY` and non-positive expiry. LLM settings: `OPENROUTER_API_KEY` (empty key = chat sends fail with `provider_error`, but startup and every other endpoint stay functional by design), `LLM_MODEL`, `LLM_MAX_OUTPUT_TOKENS`.
- **`app/core/database.py`** — **async** SQLAlchemy over aiosqlite (ADR-0013): `create_async_engine`, `async_sessionmaker`, and a `get_db` dependency yielding `AsyncSession`; services and routers are `async def` throughout. `settings.async_database_url` derives the async driver URL from `DATABASE_URL` — Alembic stays sync. Keep models DB-agnostic (Postgres migration is deferred, see ADR-0004).
- **`app/core/auth.py`** — password hashing, JWT, and the `current_user` dependency. Uses **bcrypt directly** (not passlib — see module docstring/ADR-0006). PyJWT for tokens (ADR-0005).
- **`app/main.py`** — app instance, CORS, router registration, `/health`.

Auth specifics worth preserving: login does a constant-time bcrypt verify against `_DUMMY_PASSWORD_HASH` even for unknown emails (anti-enumeration); all auth failures return a uniform `invalid_token`/`invalid_credentials` detail. `User.id` is a UUID string PK. Emails are normalized to lowercase in schemas.

AI chat (ADR-0019): `routers/chat.py` streams SSE via `StreamingResponse`, with a `get_provider` dependency seam so tests inject a FakeProvider. `services/chat.py` (`ChatService`) owns conversations/messages, the 20-message history window, title generation, and a no-op `check_quota` seam already wired to 429. `services/llm.py` is the provider seam — `LLMProvider` protocol + `OpenRouterProvider`; only the chat service imports providers. `services/prompt.py` builds the prompt from the client-supplied pet-context bundle. Ownership checks raise a uniform `ConversationNotFoundError` (no existence leak).

## Tests

Tests are `async def` (pytest-asyncio). `tests/conftest.py` provides a `client` fixture — an httpx
`AsyncClient` over `ASGITransport` backed by an in-memory aiosqlite DB (StaticPool) with `get_db`
overridden — plus a bare `db` `AsyncSession` fixture for service-level tests. No real DB or
migrations involved; tables are created/dropped per test.
