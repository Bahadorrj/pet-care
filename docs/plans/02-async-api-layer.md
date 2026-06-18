# Implementation Plan: Async API Layer (aiosqlite)

Status: **Implemented**
Spec: `docs/specs/02-async-api-layer.md`
ADR: `docs/ard/0013-async-sqlalchemy-aiosqlite.md`

## Overview

Convert the backend's runtime DB path from sync SQLAlchemy to async SQLAlchemy 2.0
over `aiosqlite`, with identical external behavior. Alembic stays sync. Tests move to
`httpx.AsyncClient` + `pytest-asyncio`.

## Architecture Decisions (from ADR-0013 / spec)

- Runtime: `create_async_engine` + `async_sessionmaker`, `get_db` yields `AsyncSession`,
  `expire_on_commit=False`.
- Config exposes **two** URLs: sync `DATABASE_URL` (Alembic) + derived `async_database_url`
  (`sqlite+aiosqlite://…`, future `postgresql+asyncpg://…`).
- Queries use `select()` + `await db.execute()`; routers/services/`current_user` async.
- Tests: `httpx.AsyncClient` over `ASGITransport`, in-memory `aiosqlite` + `StaticPool`.

## Dependency Graph

```
pyproject deps + config.async_database_url        (Task 1 — additive, non-breaking)
        │
        ▼
database.py  (async engine / session / get_db)    (Task 2)
        │
        ├──► services/user.py   (Task 3)
        ├──► core/auth.py       (Task 4)
        └──► routers/auth.py    (Task 5)
                   │
                   ▼
        tests/ (conftest + DB-touching tests)      (Task 6)
                   │
                   ▼
        smoke + alembic + docs reconcile           (Task 7)
```

Bottom-up. Tasks 2–6 form one contagious swap: **pytest is expected RED between Task 2
and Task 6**; it returns GREEN at the Task 6 checkpoint. Don't treat intermediate red as
failure — treat green-at-checkpoint as the gate.

---

## Phase 1: Foundation (non-breaking)

### Task 1: Add async deps + dual-URL config
**Description:** Add `aiosqlite`, `greenlet` (runtime) and `pytest-asyncio` (dev); set
`asyncio_mode = "auto"`. Add an `async_database_url` property to `Settings` that derives
the async driver from `DATABASE_URL` (`sqlite` → `sqlite+aiosqlite`, `postgresql` →
`postgresql+asyncpg`), leaving `DATABASE_URL` itself sync for Alembic.

**Acceptance criteria:**
- [ ] `aiosqlite`, `greenlet`, `pytest-asyncio` present in `pyproject.toml`; `uv.lock` updated.
- [ ] `settings.async_database_url` returns `sqlite+aiosqlite:///./petcare.db` for the default.
- [ ] `[tool.pytest.ini_options]` has `asyncio_mode = "auto"`.

**Verification:**
- [ ] `uv sync` succeeds.
- [ ] `uv run python -c "import aiosqlite, greenlet; from app.core.config import settings; print(settings.async_database_url)"` prints the aiosqlite URL.
- [ ] `uv run pytest` still passes (nothing wired to async yet).

**Dependencies:** None
**Files:** `pyproject.toml`, `uv.lock`, `app/core/config.py`
**Scope:** S

### Checkpoint: Foundation
- [ ] `uv sync` clean, existing suite still green, async URL resolves.

---

## Phase 2: Core async swap (contagious — pytest red until Task 6)

### Task 2: Async engine, session, and get_db
**Description:** Rewrite `app/core/database.py` to `create_async_engine(settings.async_database_url)`,
`async_sessionmaker(expire_on_commit=False, autoflush=False)`, and an async `get_db`
yielding `AsyncSession` via `async with`. Keep `Base` and the sqlite `check_same_thread`
guard.

**Acceptance criteria:**
- [ ] `engine` is an async engine; `get_db` yields `AsyncSession`.
- [ ] `expire_on_commit=False` set on the factory.
- [ ] No `create_engine` / `sessionmaker` / `Session` import remains in the file.

**Verification:**
- [ ] `uv run python -c "from app.core.database import get_db, engine; print(type(engine))"` shows `AsyncEngine`.

**Dependencies:** Task 1
**Files:** `app/core/database.py`
**Scope:** S

### Task 3: Async UserService
**Description:** Make `UserService.get_by_email` / `create` async; replace `db.query(...)`
with `select(User).where(...)` + `await db.execute(...)` (`scalar_one_or_none`); `await`
`commit`/`refresh`. Preserve the duplicate-email pre-check pattern. (Light cleanup allowed
per spec scope.)

**Acceptance criteria:**
- [ ] Both methods are `async`, take `AsyncSession`, use `select()` + awaited execute.
- [ ] Duplicate-email pre-check and `EmailAlreadyRegisteredError` behavior unchanged.

**Verification:**
- [ ] `uv run python -c "import ast,sys; ast.parse(open('app/services/user.py').read())"` (syntax) — full behavior verified at Task 6.

**Dependencies:** Task 2
**Files:** `app/services/user.py`
**Scope:** S

### Task 4: Async current_user dependency
**Description:** Make `current_user` in `app/core/auth.py` `async`, depend on the async
`get_db` (`AsyncSession`), and `await db.get(User, user_id)`. bcrypt/JWT stay synchronous.
Keep the uniform `invalid_token` detail.

**Acceptance criteria:**
- [ ] `current_user` is `async def`; `await db.get(...)`; type hint `AsyncSession`.
- [ ] Hashing/JWT functions untouched.

**Verification:** behavior verified at Task 6 (`/auth/me` tests).
**Dependencies:** Task 2
**Files:** `app/core/auth.py`
**Scope:** S

### Task 5: Async auth routers
**Description:** Convert `register` / `login` / `me` in `app/routers/auth.py` to `async def`,
`AsyncSession = Depends(get_db)`, and `await` the now-async service calls. Same status codes
and exception→`HTTPException` mapping.

**Acceptance criteria:**
- [ ] Handlers are `async def`; service calls awaited; `AsyncSession` type hint.
- [ ] Status codes (201/200/400/401) and detail strings unchanged.

**Verification:** behavior verified at Task 6.
**Dependencies:** Tasks 3, 4
**Files:** `app/routers/auth.py`
**Scope:** S

### Task 6: Async test harness + tests
**Description:** Rewrite `tests/conftest.py` to an async `client` fixture: `httpx.AsyncClient`
over `ASGITransport(app=app)`, in-memory `aiosqlite` engine + `StaticPool`, async `get_db`
override yielding `AsyncSession`, tables created/dropped via `conn.run_sync(...)`. Convert
`test_auth.py`, `test_health.py`, `test_cors.py` to `async def` + `await client...`. Leave
`test_auth_utils.py` unchanged (pure functions).

**Acceptance criteria:**
- [ ] `client` fixture is async (httpx AsyncClient + ASGITransport, aiosqlite StaticPool).
- [ ] All previously-existing test cases present and converted to async (none dropped).
- [ ] `test_auth_utils.py` untouched.

**Verification:**
- [ ] `uv run pytest` — **all green**.
- [ ] `uv run pytest --cov=app` — coverage not lower than before the swap.

**Dependencies:** Tasks 2–5
**Files:** `tests/conftest.py`, `tests/test_auth.py`, `tests/test_health.py`, `tests/test_cors.py`
**Scope:** M

### Checkpoint: Core swap complete (primary gate)
- [ ] `uv run pytest` passes, 0 failures.
- [ ] `grep -rn "import Session\|sessionmaker\|\.query(" app/` → empty (runtime path).
- [ ] App boots: `uv run python run.py` serves `/health` → `{"status":"ok"}`.
- [ ] **Review with human before Phase 3.**

---

## Phase 3: Verify intact paths + reconcile docs

### Task 7: Alembic smoke + docs reconcile
**Description:** Confirm Alembic still works on the sync URL (unchanged `env.py`). Reconcile
docs: flip spec + ADR status from DRAFT/Proposed to reflect implemented state, ensure ADR-0013
index row is correct, and run `graphify update .`.

**Acceptance criteria:**
- [ ] `uv run alembic upgrade head` succeeds against the sync URL.
- [ ] `docs/specs/02-async-api-layer.md` status updated to Implemented; ADR-0013 status confirmed Accepted.
- [ ] `graphify-out/` refreshed.

**Verification:**
- [ ] `uv run alembic upgrade head` exits 0.
- [ ] `uv run pytest` still green.

**Dependencies:** Task 6
**Files:** `docs/specs/02-async-api-layer.md`, `docs/ard/0013-async-sqlalchemy-aiosqlite.md` (+ graphify-out, generated)
**Scope:** S

### Checkpoint: Complete
- [ ] All spec success criteria met; ready for commit/PR.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Contagious swap leaves a long red window (Tasks 2–6) | Med | Keep Phase 2 a single tight session; checkpoint only at Task 6; don't commit mid-phase. |
| `expire_on_commit` default re-expires `user.id` after commit → `register` lazy-load error | High | Set `expire_on_commit=False` in Task 2; `register` test in Task 6 catches regressions. |
| In-memory aiosqlite not shared across connections → empty tables in tests | High | `StaticPool` + single in-memory engine in the fixture (Task 6). |
| Alembic accidentally pointed at the async URL | Med | Config keeps `DATABASE_URL` sync; `env.py` untouched; Task 7 smoke-tests `upgrade head`. |
| `greenlet` wheel missing on the platform | Low | Surfaced immediately by `uv sync` in Task 1 (fail fast). |

## Parallelization

Mostly sequential (dependency chain). Tasks 3, 4 can be done in parallel after Task 2 (both
depend only on `database.py`, touch different files); Task 5 needs both. Not worth splitting
across agents at this size — single session, bottom-up.

## Open Questions

None. (Spec decisions resolved: Alembic sync, httpx AsyncClient, swap + light cleanup.)
