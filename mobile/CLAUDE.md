# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the **mobile** app (Expo / React Native). The FastAPI backend lives in the sibling `../backend` dir; `../docs/running-the-app.md` covers the full local stack.

## Expo has changed

Expo SDK 56 differs significantly from older versions. **Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo code** — do not rely on memory of older APIs.

## Commands

```bash
npm install
npx expo run:android         # build + launch on emulator/device (first build is slow)
npm start                    # Metro dev server
npm test                     # jest --passWithNoTests
npx jest src/__tests__/authStore.test.ts   # single test file
npx tsc --noEmit             # typecheck (must be 0 errors)
```

There is no lint script. Type-correctness via `tsc --noEmit` is the gate.

Requires `EXPO_PUBLIC_API_BASE_URL` in `.env` (default `http://10.0.2.2:8000`, the Android emulator's alias for the host). Use the machine's LAN IP for a physical device.

## Architecture

Bottom-tab navigator (`src/navigation/RootNavigator.tsx`) with three tabs: `Pets` (PetsStack), `Tasks` (TasksStack), and `Profile` (ProfileStack). `RootTabParamList` is the root typed contract. `TasksStack` is a native stack inside the Tasks tab hosting `TasksScreen` (tasks hub) and `TaskForm`; `TasksStackParamList` / `TasksNavigationProp` are the typed contracts for that stack. `ProfileStack` is a native stack inside the Profile tab hosting `ProfileMain`, `Signin`, and `Signup` screens; `ProfileStackParamList` / `ProfileNavigationProp` are the typed contracts for that stack.

**Auth & session** — `src/store/authStore.ts` is a Zustand store holding the JWT + email, persisted to `expo-secure-store`. It hydrates **asynchronously** at module load; `App.tsx` gates first render on `hasHydrated` (and `fontsLoaded`) so guest UI never flashes. `login`/`logout` write SecureStore *before* mutating in-memory state so the two never disagree.

**API** — `src/api/client.ts` is the shared axios instance; a request interceptor injects `Bearer <token>` from the auth store. `src/api/*.ts` are thin per-domain wrappers (e.g. `auth.ts`). Screens catch `axios.isAxiosError` and map status codes (e.g. 401) to translated error keys.

**i18n & RTL** — `src/i18n/index.ts` initialises i18next (`fa` only) and forces RTL via `I18nManager` at import. `App.tsx` imports `./src/i18n` first, for side effects. Keys are **flat** (`keySeparator`/`nsSeparator` disabled), so `"auth.error.network"` is a literal key, not a nested path. All user-facing strings live in `src/i18n/fa.json`.

**Theme** — `src/theme/theme.ts` is the single source of truth for colors, spacing, radius, typography, shadow. Import tokens instead of hard-coding. Custom font weights are selected by **family name** (`fonts.regular`/`medium`/…), not `fontWeight` — those families must match the keys registered in `useFonts` in `App.tsx`.

**UI primitives** — `src/components/ui/` (`Button`, `TextField`). Reuse these rather than raw RN components.

**Tasks** — offline-first task reminders (ADR-0016). Storage: `tasks` table
(rule as `schedule_json` TEXT discriminated union) + `task_logs` table (done/skipped
actions). Occurrences, today's agenda, missed status, streak, and adherence are
**always derived** from the rule + logs at query time — never materialised to
storage (approach B). Local notifications via `@notifee/react-native` (ADR-0008,
first realisation). Tehran time = fixed **+03:30** offset.

## Conventions

- Tests live in `src/__tests__/` (jest-expo + @testing-library/react-native). I18nManager RTL is asserted via spies, since the jest mock doesn't flip synchronously.
- Async submit handlers use a `useRef` in-flight guard to block duplicate requests before state re-renders.
- `@notifee/react-native` is a native module — mock it in tests; a real `expo run:android` build is required for notification verification.
