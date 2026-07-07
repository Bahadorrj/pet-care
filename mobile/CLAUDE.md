# CLAUDE.md

This is the **mobile** app (Expo / React Native). The FastAPI backend lives in the sibling `../backend` dir; `../docs/running-the-app.md` covers the full local stack.

## Expo has changed

Expo SDK 56 differs significantly from older versions. **Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo code** — do not rely on memory of older APIs.

## Commands

```bash
npm install
npx expo run:android                       # build + launch on emulator/device (first build is slow)
npm test                                   # jest --passWithNoTests
npx jest src/__tests__/authStore.test.ts   # single test file
npx tsc --noEmit                           # typecheck (must be 0 errors)
```

Requires `EXPO_PUBLIC_API_BASE_URL` in `.env` (default `http://10.0.2.2:8000`, the Android emulator's alias for the host). Use the machine's LAN IP for a physical device.

## Design Context

Read before any creative work.
- `../docs/PRODUCT.md` — strategic design context (register, users, brand personality, anti-references, principles).
- `../docs/DESIGN.md` — visual system (colors, typography, components); kept in sync with `src/theme/theme.ts` (the runtime source of truth).

## Architecture

Swipeable bottom tabs (`src/navigation/RootNavigator.tsx`) — a material top-tab navigator pinned to the bottom with a custom flat tab bar (`src/navigation/BottomTabBar.tsx`), so horizontal swipes switch tabs (ADR-0018). Four tabs, each a native stack: `Pets` (PetsStack), `Tasks` (TasksStack: TasksScreen + TaskForm), `Assistant` (AssistantStack: ConversationList + Chat), `Profile` (ProfileStack: ProfileMain, Signin, Signup, ChangeUsername). Each stack exports its `*ParamList` / `*NavigationProp` typed contracts.

**Auth & session** — `src/store/authStore.ts` (Zustand) holds JWT + email + username, persisted to `expo-secure-store` (ADR-0012). It hydrates **asynchronously** at module load; `App.tsx` gates first render on `hasHydrated` + `fontsLoaded` so guest UI never flashes. Mutations write SecureStore *before* in-memory state so the two never disagree.

**API** — `src/api/client.ts` is the shared axios instance; a request interceptor injects `Bearer <token>`. `src/api/*.ts` are thin per-domain wrappers. Exception: chat streaming (`src/api/chat.ts`) uses `expo/fetch`, because axios can't stream response bodies in RN, feeding `src/lib/sse.ts` (pure SSE parser, no I/O).

**Assistant (AI chat)** — server-side history, client-supplied pet context (ADR-0019, spec 13). `src/store/chatStore.ts` holds conversations + the active conversation's messages (server is source of truth) and applies streamed deltas. `src/lib/petContext.ts` builds the per-message pet-context bundle (pure; shapes mirror `backend/app/schemas/chat.py` exactly). `src/db/kv.ts` is a tiny SQLite key/value store (first use: chat disclaimer dismissal).

**i18n & RTL** — `src/i18n/index.ts` initialises i18next (`fa` only) and forces RTL via `I18nManager` at import; `App.tsx` imports it first for side effects. Keys are **flat** (`keySeparator`/`nsSeparator` disabled): `"auth.error.network"` is a literal key. All user-facing strings live in `src/i18n/fa.json`.

**Theme** — `src/theme/theme.ts` is the single source of truth (colors, spacing, radius, typography, shadow); import tokens, don't hard-code. Font weights are selected by **family name** (`fonts.regular`/…) matching the `useFonts` keys in `App.tsx`, not `fontWeight`. `src/theme/icons.ts` maps species and task types to monochrome MaterialCommunityIcons glyphs — render from these maps, not ad-hoc emoji.

**UI primitives** — `src/components/ui/` (`Button`, `TextField`, `ConfirmDialog`, `DatePickerField`, `TimePickerField`) and `src/components/toastConfig.tsx`. Reuse these over raw RN components.

**Pets** — `src/store/petsStore.ts` (Zustand) backed by on-device SQLite (`src/db/pets.ts`, ADR-0015). The sync expo-sqlite API means `pets` is populated at module load, no async hydration. `src/db/index.ts` opens the DB; `App.tsx` imports it for side effects. Photos are copied into app storage by `src/lib/petPhoto.ts`.

**Tasks** — offline-first reminders, rule + completion log (ADR-0016). Storage: `tasks` (rule as `schedule_json` discriminated union) + `task_logs`; types in `src/db/types.ts`. Occurrences, agenda, missed status, streak, and adherence are **always derived** at query time — never materialised. `src/lib/taskSchedule.ts` is the pure schedule engine (no I/O); `src/screens/tasks/todayBuckets.ts` buckets a ±7-day occurrence window into `overdue / today / upcoming / completed` sections for the Tasks tab (7-day look-back; `completed` = finalized done/skipped occurrences, past and today, sorted newest-first; also derives `progress` from the pre-split today set, and exports `tomorrowSameTime` for the postpone action). A section's genuine-empty gate (ADR-0020/ADR-0021) is judged against its **unfiltered** bucket — a filter-emptied but genuinely non-empty section stays visible with a quiet no-match row instead of disappearing. Completed defaults collapsed; the other three default expanded (in-memory collapse state, ADR-0021). Local notifications via `@notifee/react-native` (ADR-0008): `src/lib/taskNotifications.ts` owns the channel, 60-day trigger window (cap 200), snooze, tap-to-navigate, and injects its sync fn into the tasks store via `setTasksSyncNotifications` so the store stays I/O-free.

**Dates** — Jalali (Shamsi) UI, UTC storage (ADR-0010). `src/lib/jalali.ts` holds the shared helpers; Tehran time is a fixed **+03:30** offset (no DST).

**Haptics & Toast** — `expo-haptics` for mark-done/skip feedback (failures swallowed — never load-bearing); `react-native-toast-message` for undo prompts.

**Native UI patterns** — before building or restyling a screen, consult `expo:building-native-ui` (and `expo:expo-ui` for native components); pair them with `docs/DESIGN.md` for the visual system.

## Conventions

- Tests live in `src/__tests__/` (jest-expo + @testing-library/react-native). I18nManager RTL is asserted via spies, since the jest mock doesn't flip synchronously.
- Test assertions against user-facing text use `i18n.t("key")` (import `i18n` from `../i18n`) or the mock/fixture's own data, never a hardcoded Persian literal — a literal silently drifts from `src/i18n/fa.json` when copy changes. See `RootNavigator.test.tsx`, `SignupScreen.test.tsx`, `TasksScreen.test.tsx`.
- Async submit handlers use a `useRef` in-flight guard to block duplicate requests before state re-renders.
- Errors thrown in stores and services use i18n translation keys (e.g. `"pets.error.name_required"`) — screens surface them via `t(err.message)`.
