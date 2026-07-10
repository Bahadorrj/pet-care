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
| [0013](0013-async-sqlalchemy-aiosqlite.md) | Async SQLAlchemy over aiosqlite; Alembic stays sync | Accepted | — |
| [0014](0014-bottom-tab-navigation.md) | Bottom Tab navigator as the root navigation shell | Superseded by ADR-0018 | — |
| [0015](0015-mobile-sqlite-local-store.md) | On-device SQLite for user-generated app data (mobile) | Accepted | — |
| [0016](0016-chores-rule-plus-log.md) | Chores — rule + completion log (approach B); first Notifee realization | Accepted | — |
| [0017](0017-lively-task-done-toast.md) | Task-done toast — a sanctioned side-stripe success accent | Superseded by 0020 | — |
| [0018](0018-swipeable-bottom-tabs.md) | Swipeable bottom tabs via material-top-tabs pinned to the bottom | Accepted | — |
| [0019](0019-ai-chat-backend-llm-proxy.md) | AI chat via backend LLM proxy; client-supplied pet context; server-side history | Accepted | — |
| [0020](0020-quiet-tasks-tone.md) | Quiet Tasks tone — تو voice, calm overdue, neutral done toast, completion-state accent exception | Accepted | — |
| [0021](0021-tasks-hub-completed-section-and-row-actions.md) | Tasks hub — Completed section, row-tap→edit, per-section no-match, quick postpone, delete confirmation | Accepted | Yes — spec 07 (row action, checked-row placement, empty-section gate) |
| [0022](0022-assistant-thinking-indicator.md) | Assistant "thinking" indicator — a scoped, opacity-only ambient pulse | Accepted | — |
| [0023](0023-species-glyph-thumbnail-fallback.md) | Species-glyph thumbnail fallback for photo-less pets | Proposed | Would reverse DESIGN.md's Pet List Row "no blank avatar fallback" |
