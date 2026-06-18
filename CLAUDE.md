# PetCare

A pet-care app with a **mobile client** (Expo / React Native) and **backend API** (FastAPI + SQLAlchemy).

Quick setup: `docs/running-the-app.md` covers the full local stack (all dependencies, environment, running both tiers).

## Stack

- **Backend** (`backend/`): FastAPI, SQLAlchemy 2.0, Alembic, uv, Python 3.12+
- **Mobile** (`mobile/`): Expo SDK 56, React Native, TypeScript, Zustand, axios
- **Persistence** (for now): SQLite + SecureStore; DB migrations deferred, write DB-agnostic models

## Documentation & Decisions

- Architecture decisions live in `docs/ard/` (ADRs); reconcile the spec when changing a decision
- Codebase questions: use `graphify query "<question>"` (scoped subgraph) or `graphify path "A" "B"` for relationships instead of grep/raw browsing
- For large codebase review: `graphify update .` after code changes (AST-only, no API cost)

## Sub-Guides

- **`backend/CLAUDE.md`** — Backend commands (uv, pytest, alembic), auth layer, services, tests
- **`mobile/CLAUDE.md`** — Mobile commands (expo, jest), navigator, auth store, i18n, theme
