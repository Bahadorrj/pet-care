# Architecture Decision Records (ADRs)

This directory records the significant technical decisions behind PetCare, one
decision per file. Each ADR captures **why** a choice was made, what was
rejected, and the **guardrails** that follow from it.

## Audience

These ADRs are guardrails for **AI agents and future contributors**. Before
changing the stack, a tool choice, or an architectural strategy, read the
relevant ADR. Every ADR ends with an explicit **Guardrails** section
(`Always` / `Ask first` / `Never`) — honor it unless a new ADR supersedes it.

## How to use

- **Before coding:** find the ADR for the area you're touching and follow its
  guardrails.
- **When a decision changes:** do **not** edit the old ADR's Decision. Add a new
  numbered ADR, set the old one's status to `Superseded by ADR-XXXX`, and update
  any spec/PRD text the change affects (see ADR-0004 for the divergence pattern).
- **When the code diverges from a spec:** record it as a first-class ADR *and*
  reconcile the source spec so future sessions pick up the corrected direction.

## Status legend

`Proposed` → `Accepted` → (`Superseded by ADR-XXXX` | `Deprecated`)

## Index

| ADR | Decision | Status | Diverges from PRD/spec |
|---|---|---|---|
| [0001](0001-react-native-android-first.md) | React Native, Android-first, for mobile | Accepted | — |
| [0002](0002-expo-bare-workflow.md) | Expo (bare workflow) as the RN toolchain | Accepted | — |
| [0003](0003-fastapi-backend.md) | FastAPI as the backend framework | Accepted | — |
| [0004](0004-sqlite-now-postgres-deferred.md) | SQLite now, PostgreSQL deferred; DB-agnostic models | Accepted | Yes — PRD says PostgreSQL |
| [0005](0005-jwt-auth-pyjwt.md) | JWT auth via PyJWT | Accepted | Yes — spec said python-jose |
| [0006](0006-password-hashing-bcrypt-direct.md) | Password hashing with bcrypt directly | Accepted | Yes — spec said passlib |
| [0007](0007-uv-python-packaging.md) | `uv` for Python packaging | Accepted | Yes — spec said pip/requirements.txt |
| [0008](0008-local-notifications-no-fcm.md) | Local notifications only, no FCM | Accepted | — |
| [0009](0009-offline-first-bundled-content.md) | Offline-first bundled JSON knowledge base | Accepted | — |
| [0010](0010-jalali-ui-utc-storage.md) | Jalali (Shamsi) UI dates, UTC in storage | Accepted | — |
| [0011](0011-guest-first-no-login-wall.md) | Guest-first access; no login wall on knowledge | Accepted | — |
| [0012](0012-zustand-securestore-auth-state.md) | Zustand + expo-secure-store for mobile auth | Accepted | — |
