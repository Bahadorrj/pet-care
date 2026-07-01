# ADR-0003: FastAPI as the backend framework

## Status
Accepted

## Date
2026-06-17

## Context
PetCare needs a backend for authentication now, and for pet/reminder sync and a
future AI tier later. Requirements:
- Async-capable (the future AI tier will make outbound API calls).
- Typed request/response contracts to keep the mobile client honest.
- Familiar to the solo developer.
- Self-hostable on an Iran-accessible VPS / Arvan Cloud (no managed-PaaS lock-in).

## Decision
Use **FastAPI** with **Pydantic** schemas and **SQLAlchemy 2.0** ORM. Route
handlers stay thin and delegate to a service layer (e.g. `app/services/user.py`).

## Alternatives Considered

### Django + DRF
- Pros: Batteries included, admin, mature ORM.
- Cons: Heavier; sync-first; more than this MVP needs; async story is bolted on.
- Rejected: Weight and async ergonomics don't fit a small, AI-bound roadmap.

### Node.js (Express / NestJS)
- Pros: Same language as the mobile client.
- Cons: The developer's backend expertise is in Python; Python is the stronger
  ecosystem for the planned AI features.
- Rejected: Python + FastAPI better matches developer expertise and the AI path.

## Consequences
- Pydantic schemas are the API contract; the mobile `api/` client mirrors them.
- A service layer keeps routes thin and directly unit-testable.
- Async endpoints are available for the future AI tier without a framework change.
- Auth specifics are covered by ADR-0005 (JWT/PyJWT) and ADR-0006 (bcrypt).

## Guardrails

**Always**
- Keep route handlers thin; put logic in `app/services/`.
- Define every request/response body as a Pydantic schema — no raw dict bodies.
- snake_case in Python (camelCase stays on the TS side).

**Ask first**
- Before any backend schema change after real user data exists (see PRD).
- Before adding a background worker / queue (new infra to host in Iran).

**Never**
- Never return ORM models directly; return Pydantic response models.
- Never put secrets in code — read them from env/settings (see ADR-0005).
