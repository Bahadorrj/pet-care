# SPEC: Add `username` to users

## 1. Objective

Give every user a unique, public, human-readable `username` (@-handle) shown in the
mobile UI, distinct from the private `email`. Username is **not** a login credential —
email stays the sole auth identity. Fullstack: backend data + API, mobile UI.

**Target user:** all PetCare users. **Why now:** email is the only identity; no public handle exists.

**Success:** registration requires a valid unique username; uniqueness is enforced;
a user can change their username; mobile shows it and lets the user edit it.

## 2. Rules (confirmed)

- Format: `^[a-zA-Z0-9_]{3,30}$`
- Stored and compared **lowercase** (normalize before persist/query, like `email`)
- `NOT NULL UNIQUE`, required at registration
- Email remains the only login credential

**Out of scope:** username as a login path; reserved-name blocklist; rate-limiting on
change-username; username history/audit. No data-backfill/migration plan (zero existing users).

## 3. Decision points (confirm in §8)

- **D1 — Conflict status code.** Existing register email-dup returns `400 email_already_registered`.
  Proposal: register username-dup → `400 username_already_registered` (match existing pattern);
  change-username dup → `409 username_taken` (update semantics). *Recommend as written.*
- **D2 — How mobile learns username after login.** At login the user types email only, not
  username, so mobile can't display it without the server. Proposal: add `username` (and `email`)
  to the `/auth/register` + `/auth/login` response so mobile stores it directly — no extra round
  trip, no `/me` call added. *Recommend.* (Alt: GET `/auth/me` after login — cleaner separation, +1 request.)

## 4. Backend changes (`backend/`)

- **`app/models/user.py`** — add `username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)`.
- **`app/schemas/auth.py`**
  - `RegisterRequest`: add `username: str = Field(pattern=r"^[a-zA-Z0-9_]{3,30}$")` + `@field_validator` lowercasing it.
  - New `ChangeUsernameRequest`: same `username` field + validator.
  - `UserResponse`: add `username`.
  - Per D2: `TokenResponse` gains `username` + `email`.
- **`app/services/user.py`**
  - `create(...)` takes `username`, pre-checks uniqueness → new `UsernameAlreadyRegisteredError`.
  - New `get_by_username(db, username)` and `change_username(db, user, username)` (pre-check + commit).
- **`app/routers/auth.py`**
  - `register`: pass `username`; map `UsernameAlreadyRegisteredError` → `400 username_already_registered`.
  - New `PATCH /auth/me` (`current_user` dep): body `ChangeUsernameRequest` → `change_username`,
    dup → `409 username_taken`, returns `UserResponse`.
  - `me`: include `username`.
- Username **not** added to the JWT (token stays `user.id` only).

## 5. Mobile changes (`mobile/`)

- **`src/api/auth.ts`** — `register(email, password, username)`; `AuthResponse` gains `username`, `email`;
  new `changeUsername(username): Promise<UserResponse>` → `PATCH /auth/me`.
- **`src/store/authStore.ts`** — add `username` field + `USERNAME_KEY` SecureStore entry;
  `login(token, email, username)`; persist/hydrate/logout cover it; new `setUsername(username)` for change flow.
- **`src/screens/auth/SignupScreen.tsx`** — add username `TextField` (autoCapitalize none, autoCorrect off);
  pass to `apiRegister`; map `422` → new invalid-username error key; store username from response on success.
- **`src/screens/auth/SigninScreen.tsx`** — store `username` from login response.
- **`src/screens/ProfileScreen.tsx`** — render `@username` above email; "Change username" button → `ChangeUsername` screen.
- **New `src/screens/ChangeUsername.tsx`** + register in **`ProfileStack.tsx`** (`ChangeUsername: undefined`).
  Pre-fill current username, submit via `changeUsername`, on success `setUsername` + go back;
  map `409` → username-taken key, `422` → invalid-username key. Use `useRef` in-flight guard (existing convention).
- **`src/i18n/fa.json`** — flat keys: `auth.username`, `auth.error.username_taken`, `auth.error.invalid_username`,
  `profile.change_username`, plus screen title/subtitle keys.

## 6. Commands (unchanged)

- Backend: `uv run pytest`, `uv run alembic revision --autogenerate -m "add username"` + `upgrade head`.
- Mobile: `npx tsc --noEmit` (0 errors = gate), `npm test`.

## 7. Testing strategy

- **Backend** (`tests/`, in-memory SQLite fixture):
  - register with valid username → 201, username stored lowercase.
  - register dup username (diff case, e.g. `Bob`/`bob`) → 400 `username_already_registered`.
  - register invalid username (too short / bad char) → 422.
  - `PATCH /auth/me` happy path → 200, new username returned lowercase.
  - change to a taken username → 409 `username_taken`.
  - change unauthenticated → 401.
- **Mobile** (`src/__tests__/`):
  - SignupScreen renders + submits username; invalid → error key.
  - ChangeUsername screen submits, taken → error key, success → store updated + navigates back.
  - authStore persists/hydrates username.

## 8. Sub-tasks (ordered)

1. Backend model + schema (validators, UserResponse/TokenResponse) → verify: schema unit shape, `tsc`-equiv N/A.
2. Backend service (create+username, get_by_username, change_username, error class) → verify: service-level pytest.
3. Backend router (register dup-map, PATCH /auth/me, me) → verify: endpoint pytest (§7 backend list green).
4. Alembic migration for `username` column → verify: `upgrade head` on fresh DB succeeds.
5. Mobile api + authStore (username plumbing) → verify: authStore test green, `tsc --noEmit` 0.
6. Mobile SignupScreen + SigninScreen → verify: screen tests green.
7. Mobile ProfileScreen + ChangeUsername screen + ProfileStack + i18n keys → verify: screen tests green, `tsc` 0.

---

**Confirm:** §3 D1 + D2 as recommended, and the sub-task split. Yes / refine?
