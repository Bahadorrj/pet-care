# Spec: Async API Layer (aiosqlite)

Status: **Implemented**
Owner: backend
Related ADR: `docs/adr/0013-async-sqlalchemy-aiosqlite.md`

## Objective

Convert the PetCare backend's database/request path from **synchronous** SQLAlchemy
to **asynchronous** SQLAlchemy 2.0 over the `aiosqlite` driver, so the API runs on a
non-blocking I/O path end to end (FastAPI handler → service → `AsyncSession` → aiosqlite).

**Why:** the current sync `Session` blocks the event loop on every DB call. Moving to
async removes that bottleneck and aligns the stack with FastAPI's async-native design,
ahead of feature growth (pets, reminders, content).

**Success looks like:** identical external behavior (same endpoints, status codes, auth
semantics) running on an async engine, with the full test suite green and no sync DB
session remaining in the runtime path.

### User stories / acceptance criteria
- As an API consumer, every existing endpoint (`/auth/register`, `/auth/login`,
  `/auth/me`, `/health`) behaves byte-for-byte identically — same status codes, same
  error detail strings, same anti-enumeration timing guard.
- As a developer, `app/core/database.py` exposes an **async** engine, `AsyncSession`
  factory, and an async `get_db` dependency; no `Session`/`sessionmaker`/`db.query()`
  remains in `app/`.
- As a developer, the test suite drives the app through `httpx.AsyncClient` and passes.

## Tech Stack

- Python ≥ 3.12, FastAPI ≥ 0.137, SQLAlchemy ≥ 2.0 (async extension)
- **New runtime deps:** `aiosqlite`, `greenlet` (required by SQLAlchemy async)
- **New dev deps:** `pytest-asyncio`
- Alembic stays on the **sync** driver (migrations are offline CLI — see Decisions)
- bcrypt + PyJWT unchanged (CPU-bound, stay synchronous)
- Packaged with `uv`

## Commands

```bash
uv sync                                  # install deps incl. new aiosqlite/greenlet/pytest-asyncio
uv run python run.py                     # dev server with reload on :8000
uv run pytest                            # full suite (now async via pytest-asyncio)
uv run pytest tests/test_auth.py::test_x # single test
uv run pytest --cov=app                  # coverage
uv run alembic upgrade head              # migrations (SYNC driver, unchanged)
uv run alembic revision --autogenerate -m "msg"
graphify update .                        # refresh knowledge graph after changes (from repo root)
```

## Project Structure

No new directories. Files touched:

```
backend/
  app/
    core/
      config.py        → async DB URL handling (sqlite+aiosqlite); keep a sync URL for Alembic
      database.py      → async engine, async_sessionmaker, AsyncSession, async get_db   [CORE]
      auth.py          → current_user becomes async; db.get(...) awaited
    routers/
      auth.py          → handlers become `async def`; AsyncSession dependency
    services/
      user.py          → async methods; select() + await db.execute(); await commit/refresh
    main.py            → no change expected (health stays sync, fine)
  alembic/
    env.py             → UNCHANGED (stays sync; uses sync URL)
  tests/
    conftest.py        → httpx.AsyncClient + ASGITransport; async get_db override; pytest-asyncio
    test_auth.py       → tests become async (await client calls)
    test_health.py     → async
    test_cors.py       → async
    test_auth_utils.py → UNCHANGED (pure-function tests, no DB/client)
  pyproject.toml       → add deps; configure asyncio_mode
docs/                            → repo-root docs (NOT under backend/)
  specs/02-async-api-layer.md    → this spec
  plans/02-async-api-layer.md    → implementation plan
  adr/0013-async-sqlalchemy-aiosqlite.md  → ADR
```

## Code Style

SQLAlchemy 2.0 async idiom — `select()` over the legacy `Query` API, explicit `await`:

```python
# app/core/database.py
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(settings.async_database_url, connect_args=connect_args)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as db:
        yield db


# app/services/user.py
from sqlalchemy import select

class UserService:
    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, email: str, password: str) -> User:
        if await UserService.get_by_email(db, email) is not None:
            raise EmailAlreadyRegisteredError(email)
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
```

Conventions: `expire_on_commit=False` (so returned objects stay usable after commit);
keep the existing layered separation (routers translate exceptions, services never import
FastAPI); preserve the duplicate-email pre-check pattern.

## Testing Strategy

- Framework: `pytest` + `pytest-asyncio` (`asyncio_mode = "auto"` in `pyproject.toml`).
- Client: `httpx.AsyncClient(transport=ASGITransport(app=app))` replacing Starlette `TestClient`.
- DB: in-memory `aiosqlite` (`sqlite+aiosqlite:///:memory:`) with `StaticPool` so all
  connections share one in-memory DB; `get_db` override yields an `AsyncSession`.
- Tables created/dropped per test via `conn.run_sync(Base.metadata.create_all/drop_all)`
  inside the async engine's `begin()`.
- Coverage expectation: **all existing tests pass; no net loss in coverage.** No new
  behavioral tests required (pure infra swap) — but the swap itself is the verification.
- Test levels: `test_auth_utils.py` stays a pure unit test (no client); the rest are
  integration tests through the ASGI app.

## Boundaries

- **Always:**
  - Run `uv run pytest` before declaring a task done; every test green.
  - Preserve external behavior exactly (status codes, `invalid_token`/
    `invalid_credentials`/`email_already_registered` details, anti-enumeration timing).
  - Keep models DB-agnostic (ADR-0004): derive driver, don't hardcode SQLite assumptions
    into models.
  - Add ADR-0013 documenting the async switch and reconcile this spec (project convention).
  - Run `graphify update .` after code changes.
- **Ask first:**
  - Any change to endpoint behavior, request/response schemas, or auth semantics.
  - Adding deps beyond `aiosqlite`, `greenlet`, `pytest-asyncio`.
  - Touching Alembic migration files or the DB schema.
- **Never:**
  - Commit secrets or a real `SECRET_KEY`.
  - Remove or weaken a failing test to make the suite pass.
  - Leave a sync `Session` in the runtime request path.

## Decisions (from clarification)

1. **Alembic stays sync.** Migrations run as an offline CLI, not in the request path;
   adding async machinery there buys nothing. `env.py` is unchanged and uses a sync URL
   (`sqlite:///./petcare.db`). Config will expose both a sync URL (Alembic) and an async
   URL (`sqlite+aiosqlite:///./petcare.db`, runtime).
2. **Tests use `httpx.AsyncClient` + `pytest-asyncio`.** Idiomatic async testing that
   exercises the real async path end to end; conftest and DB-touching tests become async.
3. **Scope: swap + light cleanup.** Mechanical async conversion plus opportunistic tidying
   in files already being edited (e.g. service layer), no scope creep into new features.

## Success Criteria (testable)

- [ ] `uv run pytest` passes with 0 failures on the async stack.
- [ ] `grep -r "from sqlalchemy.orm import Session\|sessionmaker\|\.query(" app/` returns
      nothing in the runtime path (Alembic excluded).
- [ ] `app/core/database.py` uses `create_async_engine` + `async_sessionmaker`; `get_db`
      yields `AsyncSession`.
- [ ] All four `/auth` + `/health` behaviors verified identical by the (now async) tests.
- [ ] `uv run alembic upgrade head` still succeeds (sync path intact).
- [ ] ADR-0013 added; this spec committed under `docs/specs/`.

## Open Questions

None outstanding. (Resolved: Alembic = sync, tests = httpx AsyncClient, scope = swap +
light cleanup.)
