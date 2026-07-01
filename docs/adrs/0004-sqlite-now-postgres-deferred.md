# ADR-0004: SQLite now, PostgreSQL deferred; keep models DB-agnostic

## Status
Accepted

## Date
2026-06-17

> **Diverges from the PRD.** `docs/specs/00-initial-prd.md` and
> `docs/specs/01-foundation-layer.md` originally specified PostgreSQL. This ADR
> records the actual decision and supersedes that assumption for the current
> phase. The specs have been reconciled to point here.

## Context
The PRD picked PostgreSQL for the production backend (managed/VPS hosting, scales
to the AI tier). At the foundation stage there is no production deployment and no
real user data — only the auth slice exists. Standing up and running PostgreSQL
locally for every dev/test cycle is friction with no current payoff. We still
want a clean, zero-cost path to PostgreSQL later.

## Decision
Use **SQLite** as the backend database **for now** (default
`DATABASE_URL=sqlite:///./petcare.db`), and **write all models and queries to be
database-agnostic** so the move to PostgreSQL is a config change, not a rewrite.
PostgreSQL remains the intended production database; the migration is deferred,
not cancelled.

Concrete DB-agnostic choices already in the code:
- UUID primary keys stored as `String(36)` (SQLite has no native UUID type;
  generated in Python via `uuid.uuid4()`, not `gen_random_uuid()`).
- Timestamps stored as timezone-aware UTC `DateTime(timezone=True)`.
- `database.py` applies `check_same_thread=False` only for the `sqlite` URL, so a
  PostgreSQL URL needs no code change.

## Alternatives Considered

### PostgreSQL now (as the PRD specified)
- Pros: Production parity; native UUID, full-text search, concurrent writes.
- Cons: Local/CI service to run for a single-table auth slice; no current benefit.
- Rejected for now: Premature. Revisit before multi-user production data exists.

### SQLite permanently
- Pros: Zero ops.
- Cons: Weak concurrent writes; no managed hosting story for a multi-user app.
- Rejected: Does not meet the production multi-user requirement.

## Consequences
- Fast, dependency-free local dev and tests (tests run against real SQLite, no
  mocks — consistent with the PRD's "no DB mocks" rule).
- Postgres-only SQL/types must be avoided until the migration ADR lands.
- A future ADR will record the actual PostgreSQL cutover (Alembic migrations,
  UUID/JSONB review, connection/pooling config) and supersede this one's "for now".

## Guardrails

**Always**
- Keep models and queries portable across SQLite and PostgreSQL.
- Generate UUIDs in Python and store as `String(36)`.
- Store timestamps as timezone-aware UTC (see ADR-0010).
- Run tests against a real database (SQLite now), never mocks.

**Ask first**
- Before introducing any PostgreSQL-specific feature ahead of the migration
  (JSONB, array columns, `gen_random_uuid()`, full-text search).
- Before scheduling the PostgreSQL cutover (it needs its own ADR).

**Never**
- Never write raw SQL that only runs on one engine.
- Never assume a native `UUID` column type or DB-side UUID generation.
