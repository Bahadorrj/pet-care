# ADR-0013: Async SQLAlchemy over aiosqlite for the API layer

## Status
Accepted

## Date
2026-06-17

> Builds on ADR-0004 (SQLite now, Postgres deferred). This ADR converts the
> runtime DB path from synchronous to asynchronous SQLAlchemy; it does not change
> the database engine choice. See `docs/specs/02-async-api-layer.md` for the
> implementation spec.

## Context
The backend currently runs synchronous SQLAlchemy 2.0: `create_engine`,
`sessionmaker`, a `get_db` generator yielding `Session`, and legacy `db.query()`
calls in the service layer. FastAPI handlers are declared `def`, so every DB call
blocks a worker thread. As features grow (pets, reminders, content), keeping the
request path off the event loop matters, and FastAPI is async-native — the sync
session is the odd layer out.

## Decision
Move the **runtime** DB path to **async SQLAlchemy** over the **`aiosqlite`**
driver, with no change to external behavior:

- `create_async_engine` + `async_sessionmaker`; `get_db` yields an `AsyncSession`
  (async context manager). Session factory uses `expire_on_commit=False` so ORM
  objects stay usable after `await db.commit()`.
- Services become `async`, using `select(...)` + `await db.execute(...)` (the 2.0
  API; the legacy `Query` API has no async equivalent) and awaited
  `commit`/`refresh`.
- Routers and the `current_user` dependency become `async def`.
- Runtime DB URL gains the async driver: `sqlite+aiosqlite:///./petcare.db`. The
  driver is derived per ADR-0004's DB-agnostic rule (future Postgres →
  `postgresql+asyncpg`), not hardcoded.
- **Alembic stays synchronous.** Migrations are an offline CLI, not in the request
  path; `env.py` keeps a sync engine and the plain `sqlite:///./petcare.db` URL.
  Config therefore exposes both a sync URL (migrations) and an async URL (runtime).
- New deps: `aiosqlite`, `greenlet` (required by SQLAlchemy async) at runtime;
  `pytest-asyncio` for tests. Tests drive the app via `httpx.AsyncClient` +
  `ASGITransport` over in-memory `aiosqlite` + `StaticPool`.

## Alternatives Considered

### Stay synchronous
- Pros: Zero work; current code is correct and tested.
- Cons: Blocks the event loop on every query; misaligned with FastAPI's async
  design; the cost to convert only rises as more endpoints are added.
- Rejected: Convert now while the surface is a single auth slice.

### Convert Alembic to async too
- Pros: One driver and URL everywhere.
- Cons: Adds `run_sync`/asyncio boilerplate to migrations for no runtime benefit;
  migrations don't need concurrency.
- Rejected: Keep migrations sync; async buys nothing offline.

### Keep Starlette `TestClient` (only the override goes async)
- Pros: Smaller diff to test files.
- Cons: Tests don't run in a real async context, so they exercise the async path
  less faithfully.
- Rejected: Use `httpx.AsyncClient` for end-to-end async coverage.

## Consequences
- Non-blocking request path end to end (handler → service → `AsyncSession` →
  aiosqlite).
- `expire_on_commit=False` is now load-bearing: returning an attribute after commit
  (e.g. `user.id` in `register`) relies on it; changing it would reintroduce lazy
  loads on a closed async session.
- Two DB URLs coexist (sync for Alembic, async for runtime) — a deliberate split,
  not duplication to remove.
- The future Postgres cutover (ADR-0004's deferred migration) now also implies the
  `asyncpg` driver; that ADR will cover it.
- Service methods are `async`, so any new caller must `await` them.

## Guardrails

**Always**
- Use `select(...)` + `await db.execute(...)` for queries; await `commit`/`refresh`.
- Keep `expire_on_commit=False` on the async session factory.
- Derive the async driver from the URL; keep models/queries DB-agnostic (ADR-0004).
- Keep Alembic on the sync URL; run migrations via the existing CLI commands.

**Ask first**
- Before making Alembic async or collapsing the sync/async URL split.
- Before adding async DB deps beyond `aiosqlite` / `greenlet` / `pytest-asyncio`.

**Never**
- Never reintroduce a sync `Session`, `sessionmaker`, or `db.query()` in the
  runtime request path.
- Never block the event loop with sync DB I/O inside an `async def` handler.
