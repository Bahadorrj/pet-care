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
