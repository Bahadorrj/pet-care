# Implementation Plan: 05 — Username (@-handle)

Implements [`docs/specs/05-username.md`](../specs/05-username.md).

## Overview

Add a unique public `username` to users, fullstack. Sliced vertically: one thin shared
foundation (the DB column both slices need), then two end-to-end slices each delivering a
working user outcome — **register with username** and **change username**.

## Architecture Decisions (from spec §3, confirmed)

- Register username-dup → `400 username_already_registered` (matches existing email pattern);
  change-username dup → `409 username_taken`.
- `username` + `email` added to `/auth/register` + `/auth/login` responses so mobile gets the
  handle without an extra `/me` round trip.
- Username normalized lowercase in Pydantic validators; stored `NOT NULL UNIQUE`; **not** in the JWT.

## Dependency graph

```
Task 1 (column + model + migration)
   ├── Task 2 (backend register path) ── Task 3 (mobile register path)
   └── Task 4 (backend change path) ───── Task 5 (mobile change path)
                                              ▲
                          Task 3 (store/api) ─┘
```

---

## Phase 1: Foundation (shared)

### Task 1: `username` column, model, migration
**Description:** Add the `username` column both slices depend on. No behavior yet.

**Acceptance criteria:**
- [ ] `User.username` mapped `String(30)`, `unique=True`, `nullable=False`.
- [ ] Alembic migration adds the column with the unique constraint.

**Verification:**
- [ ] `uv run alembic upgrade head` on a fresh DB succeeds.
- [ ] `uv run pytest` still green (existing tests unaffected).

**Dependencies:** None · **Files:** `backend/app/models/user.py`, `backend/alembic/versions/*` · **Scope:** S

### Checkpoint: Foundation
- [ ] Migration applies clean; suite green.

---

## Phase 2: Slice 1 — Register with a username (end-to-end)

User outcome: a new user registers with a username and sees `@handle` on their profile.

### Task 2: Backend register path
**Description:** Username flows through schema → service → register/me endpoints.

**Acceptance criteria:**
- [ ] `RegisterRequest.username` validated `^[a-zA-Z0-9_]{3,30}$`, lowercased; `UserResponse` + `TokenResponse` include `username` (`TokenResponse` also `email`).
- [ ] `UserService.create` takes `username`, pre-checks uniqueness → `UsernameAlreadyRegisteredError`; `get_by_username` added.
- [ ] `register` maps that error → `400 username_already_registered`; `/auth/me` returns `username`.

**Verification:**
- [ ] pytest: valid register → 201 + username stored lowercase; dup (`Bob` vs `bob`) → 400; invalid (`ab`, `bad!`) → 422.

**Dependencies:** 1 · **Files:** `backend/app/schemas/auth.py`, `services/user.py`, `routers/auth.py`, `tests/test_auth.py` · **Scope:** M

### Task 3: Mobile register path
**Description:** Username field in signup, plumbed through api + store, shown on profile.

**Acceptance criteria:**
- [ ] `api/auth.ts`: `register(email, password, username)`; `AuthResponse` gains `username`, `email`.
- [ ] `authStore` persists/hydrates `username` (`USERNAME_KEY`); `login(token, email, username)`.
- [ ] SignupScreen has a username `TextField` (no autocap/autocorrect), `422` → `auth.error.invalid_username`; SigninScreen stores username from login response; ProfileScreen renders `@username`.

**Verification:**
- [ ] `npx tsc --noEmit` → 0 errors; `npm test` green (signup, authStore tests).

**Dependencies:** 2 (API contract) · **Files:** `mobile/src/api/auth.ts`, `store/authStore.ts`, `screens/auth/SignupScreen.tsx`, `screens/auth/SigninScreen.tsx`, `screens/ProfileScreen.tsx`, `i18n/fa.json`, `__tests__/*` · **Scope:** M

### Checkpoint: Slice 1
- [ ] Backend + mobile suites green, `tsc` 0. Register→profile shows the handle end-to-end.
- [ ] Review with human before Slice 2.

---

## Phase 3: Slice 2 — Change username (end-to-end)

User outcome: an existing user edits their username and sees it update.

### Task 4: Backend change-username
**Description:** Authenticated `PATCH /auth/me` updates the handle.

**Acceptance criteria:**
- [ ] `ChangeUsernameRequest` (same validator); `UserService.change_username(db, user, username)` pre-checks uniqueness.
- [ ] `PATCH /auth/me` (requires `current_user`) returns `UserResponse`; dup → `409 username_taken`.

**Verification:**
- [ ] pytest: happy path → 200 + lowercased; taken → 409; unauthenticated → 401.

**Dependencies:** 2 · **Files:** `backend/app/schemas/auth.py`, `services/user.py`, `routers/auth.py`, `tests/test_auth.py` · **Scope:** M

### Task 5: Mobile change-username
**Description:** ChangeUsername screen wired into the Profile stack.

**Acceptance criteria:**
- [ ] `api/auth.ts`: `changeUsername(username)` → `PATCH /auth/me`; `authStore.setUsername`.
- [ ] New `ChangeUsername` screen (pre-filled, `useRef` in-flight guard) registered in `ProfileStack`; ProfileScreen has a "Change username" button → it.
- [ ] On success `setUsername` + navigate back; `409` → `auth.error.username_taken`, `422` → `auth.error.invalid_username`. i18n keys added.

**Verification:**
- [ ] `npx tsc --noEmit` → 0; `npm test` green (ChangeUsername screen test).

**Dependencies:** 4, 3 · **Files:** `mobile/src/api/auth.ts`, `store/authStore.ts`, `screens/ChangeUsername.tsx`, `navigation/ProfileStack.tsx`, `screens/ProfileScreen.tsx`, `i18n/fa.json`, `__tests__/*` · **Scope:** M

### Checkpoint: Complete
- [ ] All spec §7 tests pass; `tsc` 0. Register + change flows work end-to-end.

---

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite ALTER can't add `NOT NULL UNIQUE` to a populated table | Low (zero users) | Fresh column on empty table; batch-mode migration if autogen complains |
| Username case mismatch (display vs stored) | Med | Lowercase in validator; mobile stores server-returned value, not raw input |
| Register response shape change breaks existing signin/signup tests | Med | Update mobile tests in the same task that changes the contract |

## Open Questions
- None — spec §3 D1/D2 confirmed.
```

