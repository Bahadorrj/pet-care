# PetCare

A pet-care app with a **mobile client** (Expo / React Native) and **backend API** (FastAPI + SQLAlchemy).

Quick setup: `docs/running-the-app.md` covers the full local stack (all dependencies, environment, running both tiers).

## Stack

- **Backend** (`backend/`): FastAPI, SQLAlchemy 2.0, Alembic, uv, Python 3.12+
- **Mobile** (`mobile/`): Expo SDK 56, React Native, TypeScript, Zustand, axios

## Documentation & Decisions

- Specs live in `docs/specs/`.
- Plans live in `docs/plans/`.
- Architecture decisions live in `docs/adrs/` (ADRs); reconcile the spec when changing a decision; When changing a decision, add a new ADR and reconcile the spec — don't silently diverge. Keep `docs/adrs/README.md` synced.
- User-defined issues live in `docs/issues/`.
- User-defined ideas live in `docs/issues/`.

## Graphify
- Codebase questions: use `graphify query "<question>"` (scoped subgraph) or `graphify path "A" "B"` for relationships instead of grep/raw browsing

## Sub-Guides

- @backend/CLAUDE.md — Read before touching anything inside `backend/`
- @mobile/CLAUDE.md — Read before touching anything inside `mobile/`

## Commit Conventions

Format: `type(scope): summary`. These are hard rules:

- **Type**: one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, plus two project-specific types — `remove` (deleting a feature/file outright) and `polish` (non-functional UX/quality pass).
- **Scope**: Include a scope when the change is limited to a single, well-defined area (e.g. `mobile`, `backend`). If the change affects a sub-area within a broader scope, use a hierarchical scope in the format <parent>.<child> (e.g. `mobile.tasks`, `backend.auth`, `backend.services.user`). This makes it clear both which top-level area and which specific component the commit targets.
- **Summary**: lowercase, imperative mood (`add`, not `added`/`adds`), no trailing period. No hard length limit — use an em dash (`—`) to append a compact list of specifics instead of wrapping to a body (e.g. `perf(tasks): speed up Tasks tab entry — defer reload, memoize rows, drop per-row animation`).
- **Body**: only when the "why" isn't obvious from the diff (a non-obvious tradeoff, root cause, or workaround) — never restate "what" the diff already shows.
