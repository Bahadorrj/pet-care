# Implementation Plan: Foundation Layer — Branded Home + Auth Flow

## Overview

Build the launchable shell of PetCare: a branded home screen (guest by default) and a complete
optional auth flow (register + login + persistent JWT session). This plan covers the FastAPI
backend and the React Native mobile app. No feature content is built here — only the structural
foundation everything else will be added on top of.

**Spec:** `docs/specs/01-foundation-layer.md`

---

## Architecture Decisions

- **Backend first, then mobile integration.** Mobile screens will have their API client wired
  but can be built against a local dev server. No API mocking in the mobile code — the real
  backend is the source of truth.
- **Zustand auth store is the single source of auth state.** Screens read from it; they do not
  hold local auth state. JWT hydration from SecureStore happens at store initialisation (not in
  a component lifecycle).
- **Navigation types defined once in `RootNavigator.tsx`.** All screens import
  `RootNavigationProp` from there — no inline navigation typing.
- **Backend uses a service layer** (`app/services/user.py`) to keep route handlers thin and
  keep the test surface clean. Routes call services; tests can call services directly.

---

## Dependency Graph

```
backend/core/config.py
    │
    └── backend/core/database.py
            │
            └── backend/models/user.py
                    │
                    ├── alembic migration (0001_create_users)
                    │
                    └── backend/core/auth.py (JWT + bcrypt)
                            │
                            └── backend/schemas/auth.py
                                    │
                                    └── backend/routers/auth.py
                                            │
                                            └── backend/main.py
                                                    │
                                                    └── tests/test_auth.py

mobile/i18n/ (RTL + strings)   ←─ independent
mobile/store/authStore.ts      ←─ independent (hydrates from SecureStore)
mobile/api/client.ts           ←─ independent
    │
    └── mobile/api/auth.ts
            │
            └── mobile/navigation/RootNavigator.tsx
                    │
                    ├── screens/HomeScreen.tsx
                    ├── screens/auth/SigninScreen.tsx
                    └── screens/auth/SignupScreen.tsx
                                    │
                                    └── mobile tests
```

---

## Task List

### Phase 1: Backend Foundation

---

#### Task 1: FastAPI project scaffolding

**Description:** Create the `backend/` directory with the FastAPI application entry point,
environment-based settings, and the database session factory. No routes yet — just a working
server that starts cleanly and exposes a health check.

**Acceptance criteria:**
- [ ] `uvicorn app.main:app --reload` starts without errors
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] `DATABASE_URL` and `SECRET_KEY` are read from environment / `.env` file, never hardcoded
- [ ] `requirements.txt` pins all dependencies with versions

**Verification:**
- [ ] `uvicorn app.main:app --reload` → server starts, no import errors
- [ ] `curl http://localhost:8000/health` → `{"status":"ok"}`
- [ ] `pytest` → 0 tests collected, 0 errors

**Dependencies:** None

**Files:**
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/requirements.txt`
- `backend/.env.example`

**Scope:** S

---

#### Task 2: User model + Alembic migration

**Description:** Define the `User` SQLAlchemy model and create the first Alembic migration that
produces the `users` table (`id UUID PK`, `email UNIQUE`, `password_hash`, `created_at`).

**Acceptance criteria:**
- [ ] `alembic upgrade head` creates the `users` table in PostgreSQL
- [ ] `alembic downgrade -1` drops it cleanly
- [ ] `User` model has `id`, `email`, `password_hash`, `created_at` with correct column types
- [ ] `email` column has a unique constraint

**Verification:**
- [ ] `alembic upgrade head` → no errors
- [ ] `psql` → `\d users` shows correct schema
- [ ] `alembic downgrade -1` → `users` table gone, no errors

**Dependencies:** Task 1

**Files:**
- `backend/app/models/user.py`
- `backend/app/models/__init__.py`
- `backend/alembic/env.py`
- `backend/alembic/versions/0001_create_users.py`
- `backend/alembic.ini`

**Scope:** S

---

#### Task 3: Auth utilities — JWT + bcrypt + user service

**Description:** Implement the auth core: password hashing (bcrypt, cost 12), JWT
creation/verification (`python-jose`), the `current_user` FastAPI dependency, and a thin
`UserService` with `get_by_email` and `create` methods.

**Acceptance criteria:**
- [ ] `hash_password(plain)` returns a bcrypt hash; `verify_password(plain, hash)` returns bool
- [ ] `create_access_token(user_id)` returns a valid JWT signed with `SECRET_KEY`, expiring in
      30 days; payload contains `{"sub": "<uuid>", "exp": <unix_ts>}`
- [ ] `decode_access_token(token)` returns the `sub` UUID or raises `HTTPException 401`
- [ ] `current_user` dependency resolves a `User` from a valid `Authorization: Bearer` header
- [ ] `UserService.create(db, email, password)` hashes the password before inserting

**Verification:**
- [ ] Unit: call `hash_password` + `verify_password` in a pytest function, assert True
- [ ] Unit: create a token, decode it, assert the UUID matches
- [ ] Unit: decode an expired/tampered token, assert `HTTPException` 401

**Dependencies:** Tasks 1, 2

**Files:**
- `backend/app/core/auth.py`
- `backend/app/services/user.py`
- `backend/tests/test_auth_utils.py`

**Scope:** S

---

#### Task 4: Auth router + Pydantic schemas + full backend test suite

**Description:** Wire up the three auth endpoints (`POST /auth/register`,
`POST /auth/login`, `GET /auth/me`) with Pydantic request/response schemas, then write
the full backend test suite covering success paths and all error cases.

**Acceptance criteria:**
- [ ] `POST /auth/register` with new email + valid password → 201 `{access_token, token_type}`
- [ ] `POST /auth/register` with existing email → 400 `email_already_registered`
- [ ] `POST /auth/register` with malformed email or `password.len < 8` → 422
- [ ] `POST /auth/login` with correct credentials → 200 `{access_token, token_type}`
- [ ] `POST /auth/login` with wrong password or unknown email → 401 (same message, no enumeration)
- [ ] `GET /auth/me` with valid JWT → 200 `{id, email}`
- [ ] `GET /auth/me` with no/invalid/expired JWT → 401
- [ ] All tests run against real PostgreSQL (no mocks)
- [ ] `pytest --cov=app/routers/auth` → 100% coverage

**Verification:**
- [ ] `pytest` → all tests green
- [ ] `pytest --cov=app/routers/auth --cov-report=term-missing` → 100%

**Dependencies:** Tasks 1, 2, 3

**Files:**
- `backend/app/routers/auth.py`
- `backend/app/schemas/auth.py`
- `backend/app/main.py` (register router)
- `backend/tests/test_auth.py`
- `backend/tests/conftest.py` (DB fixture)

**Scope:** M

---

### Checkpoint 1: Backend complete

- [ ] `uvicorn app.main:app --reload` starts cleanly
- [ ] `pytest` → all tests green, 100% coverage on auth router
- [ ] `alembic upgrade head` → `users` table exists
- [ ] Register + login + /me work via `curl` or Postman against the local server

---

### Phase 2: Mobile Scaffolding

*Can begin in parallel with Phase 1. Integration with real backend happens in Task 10.*

---

#### Task 5: Expo project init + all dependencies

**Description:** Bootstrap the mobile project using Expo (bare workflow with TypeScript
template), then install every dependency needed for this layer in one pass. Expo is chosen
because it provides `expo-secure-store` as a first-class package, a working Android build
pipeline out of the box, and a simpler native module linking story than bare React Native.

**Bootstrap command:**
```bash
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile
```

**Install all dependencies in one pass:**
```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

# State + storage
npx expo install expo-secure-store
npm install zustand

# HTTP client
npm install axios

# i18n
npm install react-i18next i18next

# Jalali calendar (imported now; used in later layers)
npm install date-fns date-fns-jalali

# Testing
npm install --save-dev @testing-library/react-native @testing-library/jest-native
```

**Acceptance criteria:**
- [ ] `npx expo run:android` builds and launches on Android emulator without errors
- [ ] TypeScript `strict: true` in `tsconfig.json`
- [ ] All dependencies listed above are present in `package.json`
- [ ] No `any` in the generated boilerplate (remove or type it)
- [ ] `expo-secure-store`, `react-native-screens`, `react-native-safe-area-context` are linked
      via Expo's auto-linking (no manual `react-native link`)

**Verification:**
- [ ] `npx expo run:android` → app launches, no red error screen
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → test runner initialises (0 tests, 0 failures)

**Dependencies:** None (parallel to Phase 1)

**Files:**
- `mobile/package.json`
- `mobile/tsconfig.json`
- `mobile/app.json` (Expo config)
- `mobile/App.tsx` (entry point, generated)
- `mobile/android/` (generated by Expo, not listed exhaustively)

**Scope:** M

---

#### Task 6: i18n setup + RTL config

**Description:** Wire `react-i18next` with `i18next`, populate `i18n/fa.json` with all strings
for this layer, and configure React Native's RTL layout direction so all screens flip to
right-to-left automatically.

**Acceptance criteria:**
- [ ] `useTranslation()` returns the correct Farsi string for every key in the spec's i18n table
- [ ] `I18nManager.isRTL` is `true` when the module is initialised
- [ ] `i18n/fa.json` contains all 13 string keys from the spec (no placeholders, correct Farsi)
- [ ] No Farsi string exists anywhere in `src/` outside `fa.json`

**Verification:**
- [ ] `npm test -- --testPathPattern=i18n` → tests for each key pass
- [ ] Run on emulator → all visible text renders right-to-left

**Dependencies:** Task 5

**Files:**
- `mobile/src/i18n/index.ts`
- `mobile/src/i18n/fa.json`
- `mobile/src/__tests__/i18n.test.ts`

**Scope:** S

---

#### Task 7: Zustand auth store + axios client + navigation skeleton

**Description:** Three independent pieces wired together in the correct order:
1. `authStore.ts` — Zustand store with `{ token, email, isAuthenticated, login, logout }`.
   On initialisation, reads JWT from `expo-secure-store` to restore session.
2. `api/client.ts` — axios instance pointed at `API_BASE_URL` (from env), with a request
   interceptor that attaches `Authorization: Bearer <token>` when `authStore.token` is set.
3. `navigation/RootNavigator.tsx` — Native Stack with `Home`, `Signin`, `Signup` screens,
   exporting `RootNavigationProp` type.

**Acceptance criteria:**
- [ ] `useAuthStore().login(token, email)` sets state and persists token to SecureStore
- [ ] `useAuthStore().logout()` clears state and removes token from SecureStore
- [ ] App restart with a stored token → `isAuthenticated` is `true` before first render
- [ ] axios client attaches `Authorization` header when token is present, omits it when absent
- [ ] `RootNavigator` renders without errors; `navigation.navigate('Signin')` type-checks

**Verification:**
- [ ] `npm test -- --testPathPattern=authStore` → login, logout, hydration tests pass
- [ ] `npm test -- --testPathPattern=client` → header injection tests pass
- [ ] `npx tsc --noEmit` → 0 errors

**Dependencies:** Tasks 5, 6

**Files:**
- `mobile/src/store/authStore.ts`
- `mobile/src/api/client.ts`
- `mobile/src/api/auth.ts`
- `mobile/src/navigation/RootNavigator.tsx`
- `mobile/src/__tests__/authStore.test.ts`
- `mobile/src/__tests__/apiClient.test.ts`
- `mobile/.env.example` (`API_BASE_URL=http://10.0.2.2:8000`)

**Scope:** M

---

### Checkpoint 2: Mobile scaffolding complete

- [ ] `npx expo run:android` → app launches, navigator renders (even if screens are stubs)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → i18n + authStore + apiClient tests all green
- [ ] Auth store hydrates from SecureStore correctly (manual test: set a fake token in store,
      restart app, confirm `isAuthenticated` is true)

---

### Phase 3: Screens

---

#### Task 8: HomeScreen

**Description:** Implement the branded home screen. It renders the app logo (placeholder asset
for now), app name from i18n, and a bottom button whose label changes based on auth state.
Guest: "ورود / ثبت‌نام" → navigates to Signin. Authenticated: "پروفایل" (stub, no action yet).

**Acceptance criteria:**
- [ ] Logo and app name render centred in the top half of the screen
- [ ] Button is at the bottom, non-aggressive (not full-width-loud; secondary style)
- [ ] Guest state: button label is `t('home.signin_signup')`, onPress navigates to `Signin`
- [ ] Authenticated state: button label is `t('home.profile')`
- [ ] No `left`/`right` in `StyleSheet` — only `start`/`end`
- [ ] No hardcoded strings

**Verification:**
- [ ] `npm test -- --testPathPattern=HomeScreen` → renders logo, name, correct button label in
      both guest and auth state; button press triggers navigation
- [ ] Manual on emulator: visual RTL check, both guest and auth state

**Dependencies:** Tasks 6, 7

**Files:**
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/assets/logo.png` (placeholder 1×1 PNG is fine)
- `mobile/src/__tests__/HomeScreen.test.tsx`

**Scope:** S

---

#### Task 9: SigninScreen + SignupScreen

**Description:** Two auth screens sharing a common visual style. Each has email + password
text inputs, a submit button, and a link that switches between the two screens. Both call
`api/auth.ts` functions and dispatch to `authStore`. Error states from the API are displayed
inline in Farsi. Loading state disables the submit button during the request.

**Acceptance criteria:**
- [ ] SigninScreen: email + password inputs, "ورود" button, link to Signup
- [ ] SignupScreen: email + password inputs, "ثبت‌نام" button, link to Signin
- [ ] Submit triggers `login()` or `register()` from `api/auth.ts`
- [ ] On success: `authStore.login(token, email)` is called → navigation back to Home
- [ ] On 401 (login) or 400 (register): correct Farsi error message shown inline
- [ ] On network error: `t('auth.error.network')` shown
- [ ] Submit button disabled while request is in flight (no double-submit)
- [ ] Password input has `secureTextEntry`
- [ ] All inputs are RTL-friendly (`textAlign: 'auto'`, `start`/`end` padding)

**Verification:**
- [ ] `npm test -- --testPathPattern=SigninScreen` → happy path, 401 error, loading state
- [ ] `npm test -- --testPathPattern=SignupScreen` → happy path, 400 error, link to Signin
- [ ] Manual on emulator against real backend: register a new user, then sign in

**Dependencies:** Tasks 7, 8

**Files:**
- `mobile/src/screens/auth/SigninScreen.tsx`
- `mobile/src/screens/auth/SignupScreen.tsx`
- `mobile/src/__tests__/SigninScreen.test.tsx`
- `mobile/src/__tests__/SignupScreen.test.tsx`

**Scope:** M

---

### Checkpoint 3: Screens complete

- [ ] `npm test` → all mobile tests green
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Manual end-to-end: fresh install → branded home → signup → JWT stored → restart → still
      authenticated; login with wrong password → Farsi error shown

---

### Phase 4: Integration + Final Verification

---

#### Task 10: End-to-end integration smoke test

**Description:** Run the full stack (backend + Android emulator) and walk through every success
criterion in the spec manually. Fix any integration issues found (e.g., CORS config, emulator
networking, SecureStore on emulator). Document the final `API_BASE_URL` value for Android
emulator dev (`http://10.0.2.2:8000`).

**Acceptance criteria:**
- [ ] All 10 success criteria in `docs/specs/01-foundation-layer.md` pass manually
- [ ] CORS is configured on the backend to accept requests from the Android emulator
- [ ] `.env.example` documents `API_BASE_URL` and `SECRET_KEY`
- [ ] No English strings visible in the app UI

**Verification:**
- [ ] Walk through every bullet in the spec's **Success Criteria** section, check each one off
- [ ] `pytest` → still green after any backend changes
- [ ] `npm test` → still green after any mobile changes

**Dependencies:** Tasks 1–9 (all complete)

**Files:**
- `backend/app/main.py` (CORS middleware if missing)
- `backend/.env.example`
- `mobile/.env.example`
- `docs/specs/01-foundation-layer.md` (check off success criteria)

**Scope:** S

---

### Final Checkpoint

- [ ] `pytest` → all backend tests green, 100% auth router coverage
- [ ] `npm test` → all mobile tests green
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx expo run:android` → app launches without red screen
- [ ] Manual walkthrough: all success criteria from spec checked off
- [ ] No hardcoded strings, no `left`/`right` in StyleSheet, no secrets in repo

---

## Parallelization Opportunities

| Tasks | Can parallelize? | Notes |
|-------|-----------------|-------|
| Phase 1 (1–4) + Phase 2 Tasks 5–6 | Yes | Backend and mobile scaffolding are independent |
| Task 7 + Task 4 | Yes | Auth store / client can be built while backend tests are written |
| Task 8 + Task 9 | Yes | HomeScreen and auth screens are independent once navigation exists |
| Task 10 | No | Needs all previous tasks complete |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `expo-secure-store` not available without Expo managed workflow | High | Verify compatibility with bare React Native during Task 5; fallback is `react-native-keychain` |
| Android emulator can't reach `localhost:8000` | Medium | Use `10.0.2.2:8000` (Android emulator host alias); document in `.env.example` |
| RTL text inputs behave unexpectedly on Android | Medium | Test inputs on real emulator in Task 9; use `textAlign: 'auto'` throughout |
| PostgreSQL `gen_random_uuid()` not available on older PG versions | Low | Require PostgreSQL ≥ 13 in docs; fallback is `uuid_generate_v4()` with `uuid-ossp` extension |

---

## Open Questions (carry-over from spec)

1. **App name:** Placeholder "پت‌کر" used throughout. Confirm before Task 8.
2. **JWT expiry:** Defaulting to 30 days. Confirm before Task 3.
3. **API_BASE_URL env var name:** Will use `API_BASE_URL`. Confirm before Task 7.
