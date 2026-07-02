# Running PetCare locally

Two terminals — start the backend first, then the mobile app.

## 1. Backend (FastAPI, port 8000)

```bash
cd backend
uv sync                                    # install deps from uv.lock
cp .env.example .env                       # then edit .env (see below)
uv run alembic upgrade head                # create the users table (SQLite)
uv run python run.py                       # start dev server on :8000
```

**Edit `.env` before starting** — `config.py` fails fast on the placeholder secret, and the JWT key must be ≥ 32 bytes:

```bash
# generate a real key:
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put that value in `SECRET_KEY=...`; leave `DATABASE_URL=sqlite:///./petcare.db`.
`OPENROUTER_API_KEY=<your key>` enables the AI chat feature (دستیار); chat returns a
provider error without it, but every other endpoint stays functional.

Sanity check:

```bash
curl http://localhost:8000/health         # -> {"status":"ok"}
```

Interactive API docs: <http://localhost:8000/docs>

## 2. Mobile (Expo, Android)

```bash
cd mobile
npm install
cp .env.example .env                       # EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
npx expo run:android                       # builds + launches on emulator/device
```

`10.0.2.2` is the Android emulator's alias for your host machine — that's how the app
reaches the backend on `:8000`.

> **Physical device:** change `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP
> (e.g. `http://192.168.x.x:8000`) and make sure phone and computer are on the same network.

## 3. Walk the flow

Branded home → **ورود / ثبت‌نام** → sign up (email + password ≥ 8 chars) → lands back on
home in the authenticated state → kill & relaunch the app → still authenticated (JWT persisted
in SecureStore). Wrong password → Farsi error shown inline.

### AI chat (دستیار)

Sign in → دستیار tab → گفتگوی جدید → pick a pet chip → ask a question →
reply streams in Persian and references the pet → kill & relaunch → the
conversation is still listed → delete it via the trash icon.

## Tests (no emulator needed)

```bash
cd backend && uv run pytest          # 28/28
cd mobile  && npm test               # 38/38
cd mobile  && npx tsc --noEmit       # 0 errors
```

## Prerequisites

- [`uv`](https://docs.astral.sh/uv/) installed (backend package manager, see ADR-0007)
- Node 18+
- An Android emulator running (or a device with USB debugging) **before** `expo run:android`

> The first Android build is slow (Gradle); subsequent launches are fast.
