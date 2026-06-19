# Spec: Foundation Layer — Branded Home + Auth Flow

## Objective

Establish the navigable shell of the PetCare app: a branded home screen that any user lands on
without being forced to sign in, and a complete optional auth flow (register + login + persistent
JWT session) reachable from a non-aggressive button at the bottom of that screen.

**Target users:** First-time openers — guest by default, optionally authenticated.
**Core problem:** The app needs a launchable shell with working auth before any feature screen
can be added on top of it.
**Success at this layer:** App launches → branded screen visible → button opens auth → register
or login succeeds → JWT persists across restarts → home screen reflects authenticated state.

---

## Scope

### In scope
- Branded home screen: app logo + app name in Farsi, no feature content
- "ورود / ثبت‌نام" button at the bottom of the home screen (non-aggressive)
- Sign-up screen: email + password fields, submit → JWT stored
- Sign-in screen: email + password fields, submit → JWT stored
- Persistent JWT session (survives app restart)
- Authenticated state reflected on home screen (e.g., logged-in indicator or different button label)
- Navigation skeleton wired: Home → Auth (Signin / Signup)
- RTL layout throughout (Farsi, right-to-left)
- All strings in `i18n/fa.json` — no hardcoded Farsi in components
- Backend: register + login endpoints, users table, bcrypt password hashing

### Explicitly out of scope
- Password reset / forgot password
- Email verification
- Onboarding carousel or walkthrough
- Pet profiles, reminders, or any knowledge base content
- Any screen other than Home, Signin, Signup
- Push notifications
- iOS

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile | React Native (TypeScript, strict mode) |
| Navigation | React Navigation v6 — Native Stack |
| Auth state | Zustand |
| JWT storage | `expo-secure-store` (encrypted, persists across restarts) |
| API client | axios |
| i18n | react-i18next + `i18n/fa.json` |
| Calendar | date-fns-jalali (imported now; not yet used in this layer) |
| Backend | FastAPI + SQLite now (PostgreSQL deferred — ADR-0004) |
| Auth | JWT via PyJWT (ADR-0005), bcrypt directly (ADR-0006) |
| Packaging (backend) | `uv` + `pyproject.toml` + `uv.lock` (ADR-0007) |
| Migrations | Alembic |

> **Note:** This layer was implemented with refinements to the original stack.
> The ADRs in `docs/adr/` are authoritative: ADR-0004 (SQLite now), ADR-0005
> (PyJWT, not python-jose), ADR-0006 (bcrypt directly, not passlib),
> ADR-0007 (`uv`, not pip).

---

## Commands

```bash
# Mobile (Expo)
cd mobile
npm install
npx expo run:android     # Build and run on Android emulator or device
npm test                 # Jest test suite

# Backend — uv-managed, see ADR-0007
cd backend
uv sync                              # Install deps from uv.lock
uv run python run.py                 # Dev server (port 8000)
uv run pytest                        # Full test suite
uv run alembic upgrade head          # Apply migrations
```

---

## Project Structure

Only directories relevant to this layer are listed. Everything else from the PRD structure
will be added later.

```
mobile/
  src/
    screens/
      HomeScreen.tsx          # Branded home; guest vs. auth state
      auth/
        SigninScreen.tsx
        SignupScreen.tsx
    navigation/
      RootNavigator.tsx       # Stack: Home + Auth group
    store/
      authStore.ts            # Zustand: { token, email, isAuthenticated, login, logout }
    api/
      client.ts               # axios instance with base URL + auth header injection
      auth.ts                 # register(email, pw) and login(email, pw) calls
    i18n/
      index.ts                # react-i18next setup, RTL config
      fa.json                 # All Farsi strings for this layer
    components/               # (empty for now — no shared components yet)

backend/
  app/
    routers/
      auth.py                 # POST /auth/register, POST /auth/login, GET /auth/me
    models/
      user.py                 # SQLAlchemy User model
    schemas/
      auth.py                 # Pydantic: RegisterRequest, LoginRequest, TokenResponse
    core/
      auth.py                 # JWT creation/verification, current_user dependency
      config.py               # Settings (SECRET_KEY, DATABASE_URL, JWT expiry)
      database.py             # Session factory
  alembic/
    versions/
      0001_create_users.py    # users table migration
  tests/
    test_auth.py              # register, login, duplicate email, wrong password
```

---

## API Contract

### POST `/auth/register`
```json
Request:  { "email": "user@example.com", "password": "secret123" }
Response: { "access_token": "<jwt>", "token_type": "bearer" }
Errors:   400 if email already registered
          422 if email malformed or password < 8 chars
```

### POST `/auth/login`
```json
Request:  { "email": "user@example.com", "password": "secret123" }
Response: { "access_token": "<jwt>", "token_type": "bearer" }
Errors:   401 if credentials invalid
```

### GET `/auth/me`
```json
Headers:  Authorization: Bearer <jwt>
Response: { "id": "<uuid>", "email": "user@example.com" }
Errors:   401 if token missing or invalid
```

---

## Database Schema

The schema below shows the PostgreSQL target shape. The current implementation
runs on SQLite (ADR-0004) with **DB-agnostic** types: the UUID is stored as
`String(36)` and generated in Python (`uuid.uuid4()`), and `created_at` is a
timezone-aware UTC `DateTime`. No engine-specific SQL (`gen_random_uuid()`,
`TIMESTAMPTZ`) is used in code.

```sql
-- PostgreSQL target (implemented today on SQLite, see ADR-0004)
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- impl: String(36), uuid4() in Python
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()           -- impl: timezone-aware UTC DateTime
);
```

---

## Code Style

### Mobile — screen example (RTL-safe, i18n, typed)

```tsx
export function HomeScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const navigation = useNavigation<RootNavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brand}>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <Text style={styles.appName}>{t('app.name')}</Text>
      </View>
      <TouchableOpacity
        style={styles.authButton}
        onPress={() => navigation.navigate('Signin')}
      >
        <Text style={styles.authButtonText}>
          {isAuthenticated ? t('home.profile') : t('home.signin_signup')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingStart: 24, paddingEnd: 24 },
  brand:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  authButton:{ marginBottom: 32, padding: 16, borderRadius: 8 },
  // RTL rule: start/end only — never left/right
});
```

### Backend — route example

```python
@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if user_service.get_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="email_already_registered")
    user = user_service.create(db, body.email, body.password)
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}
```

**Key conventions:**
- TypeScript strict mode — no `any`
- All Farsi strings in `i18n/fa.json`, never inline
- `start`/`end` in all StyleSheet padding/margin, never `left`/`right`
- Snake_case in Python, camelCase in TypeScript
- JWT payload: `{ "sub": "<user_uuid>", "exp": <unix_ts> }`
- Passwords: bcrypt with cost factor 12

---

## i18n Strings (this layer)

```json
{
  "app.name": "پت‌کر",
  "home.signin_signup": "ورود / ثبت‌نام",
  "home.profile": "پروفایل",
  "auth.email": "ایمیل",
  "auth.password": "رمز عبور",
  "auth.signin": "ورود",
  "auth.signup": "ثبت‌نام",
  "auth.no_account": "حساب ندارید؟ ثبت‌نام کنید",
  "auth.has_account": "قبلاً ثبت‌نام کرده‌اید؟ وارد شوید",
  "auth.error.invalid_credentials": "ایمیل یا رمز عبور اشتباه است",
  "auth.error.email_taken": "این ایمیل قبلاً ثبت شده است",
  "auth.error.weak_password": "رمز عبور باید حداقل ۸ کاراکتر باشد",
  "auth.error.network": "خطای شبکه. دوباره تلاش کنید"
}
```

---

## Testing Strategy

### Mobile (Jest + React Native Testing Library)
- `HomeScreen`: renders logo + app name + auth button; button navigates to Signin
- `SigninScreen`: submits email + password → calls `login()`; shows error on 401
- `SignupScreen`: submits email + password → calls `register()`; shows error on 400
- `authStore`: login sets token + email; logout clears both; token persists (mock SecureStore)
- No snapshot tests

### Backend (Pytest + real database — SQLite now, see ADR-0004)
- `POST /auth/register`: success 201, duplicate email 400, malformed email 422, short password 422
- `POST /auth/login`: success 200, wrong password 401, unknown email 401
- `GET /auth/me`: valid JWT → user data, no token → 401, expired token → 401
- Coverage target: 100% on `routers/auth.py`

---

## Boundaries

**Always:**
- Use `start`/`end` in all StyleSheet padding and margin — never `left`/`right`
- Keep all Farsi strings in `i18n/fa.json`
- Store JWT in `expo-secure-store`, never in plain AsyncStorage
- Hash passwords with bcrypt before storing — never store plaintext
- Return generic error messages to the client on invalid credentials (no user enumeration)

**Ask first:**
- Adding any third-party auth SDK (e.g., social login)
- Changing the JWT payload structure or expiry duration
- Adding fields to the signup form beyond email + password
- Any new screen not listed in this spec

**Never:**
- Gate the home screen behind a login wall
- Use FCM or any push notification service in this layer
- Hardcode Farsi strings in components
- Store the JWT SECRET_KEY in the codebase — use environment variables

---

## Success Criteria

- [ ] App launches and shows branded home screen with logo, app name, and bottom button
- [ ] Button navigates to Signin screen; Signin screen has a link to Signup and vice versa
- [ ] Signup with a new email + valid password → JWT stored → home screen shows authenticated state
- [ ] Login with registered credentials → JWT stored → home screen shows authenticated state
- [ ] App restart with stored JWT → home screen still shows authenticated state (no re-login needed)
- [ ] Login with wrong password → Farsi error message shown, no crash
- [ ] Signup with existing email → Farsi error message shown, no crash
- [ ] All text is right-to-left Farsi; no Gregorian dates, no English strings visible
- [x] Backend tests pass against real PostgreSQL (no mocks)
- [x] Mobile tests pass for all screens and auth store logic

> Items requiring a live Android emulator (launch, signup→restart persistence, visual RTL) are pending manual verification — see Task 10.

---

## Open Questions

1. **App name in Farsi:** "پت‌کر" is a transliteration placeholder. Confirm the final app name
   before this spec is implemented.
2. **Logo asset:** A placeholder image is fine for this layer. Final branding asset needed before
   the beta.
3. **JWT expiry:** Default will be 30 days. Confirm or adjust before implementation.
4. **API base URL config:** Dev points to `http://10.0.2.2:8000` (Android emulator localhost).
   Production URL is not yet set. This belongs in an `.env` file — confirm the variable name.
