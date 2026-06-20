# Spec: Chores (کارها)

> Source intent: brainstorming session 2026-06-20 (design approved).
> Status: **SPECIFY phase — awaiting human review before PLAN.**

## Objective

An offline-first **reminder + light task-tracker** for pet chores (feeding,
meds, play, grooming, vet, …). Any app user (guests included) defines recurring
or one-off chores per pet; the app fires **on-device local notifications**
(Notifee, ADR-0008) at the due time and lets the user mark each occurrence
**Done / Skipped**. A unified **Today** tab shows what's due across all pets;
per-chore **streaks & adherence** are computed from the completion log.

Architecture: **approach B — rule + completion log.** We persist the chore
*rule* and a log of what actually happened; every occurrence (today's agenda,
notification fire-times, "missed", streaks) is **derived** by expanding the rule
on demand. Nothing future is materialized to storage.

**Success criteria (testable):**

1. User adds a chore to a pet (type + schedule required) → it appears in that
   pet's chore list and in the Today tab when due today.
2. Today tab lists today's occurrences across all pets, chronological, each with
   pet + type icon + time + status; overdue-today floats to top.
3. Marking an occurrence Done/Skipped writes one log row; the row's status
   updates and survives app restart.
4. A scheduled chore fires a local notification at its Tehran wall-clock time,
   **with no network** (airplane mode).
5. Notification action buttons (Done / Snooze / Skip) work from the notification:
   Done/Skip write a log; Snooze re-fires in 15 min. (Phase 2)
6. All four schedule kinds + every-N-months produce correct occurrences across
   month/year boundaries (unit-tested).
7. End conditions honored: `until` stops after the date; `after_n` stops after
   the Nth occurrence counted from the chore's start.
8. Per-chore streak and adherence % are computed correctly from logs. (Phase 3)
9. Deleting a pet deletes its chores and their logs (no orphans).
10. `npx tsc --noEmit` is 0 errors and `npm test` is green.

## Tech Stack

- Expo SDK 56 / React Native / TypeScript (existing).
- **New dep (approved, ADR-0008):** `@notifee/react-native` — local scheduled
  notifications with action buttons + background event handler.
- Existing reused: `expo-sqlite` (ADR-0015), `expo-crypto` (`randomUUID()` for
  ids), `zustand`, `date-fns` / `date-fns-jalali` (ADR-0010), `react-i18next`
  (`fa`, flat keys), `@react-navigation/*`, theme tokens, `ui/` primitives.

Install pins from the **versioned** SDK 56 docs (per `mobile/CLAUDE.md`), and
Notifee's native setup verified on a real `expo run:android` build — not from
memory.

## Commands

```bash
cd mobile
npm install
npx expo run:android       # build + launch (Notifee is native; needs a real build, not just Metro)
npm start                  # Metro dev server
npm test                   # jest --passWithNoTests
npx jest src/__tests__/choreSchedule.test.ts   # the engine tests
npx tsc --noEmit           # typecheck gate (0 errors; no lint script)
```

## Project Structure

New files (mirror the pets feature — `db/pets.ts`, `petsStore`, `PetsStack`):

```
mobile/src/
  db/
    chores.ts            → typed CRUD: insertChore/listChores/listChoresByPet/
                           getChore/updateChore/deleteChore + logs:
                           logOccurrence/getLogsForChore/getLogsForDay
    types.ts             → (edit) add Chore, ChoreType, Schedule, ChoreLog, etc.
    index.ts             → (edit) add CREATE TABLE chores / chore_logs
  lib/
    choreSchedule.ts     → PURE engine: expandOccurrences, nextOccurrences,
                           toUtc/fromUtc (Tehran +03:30), streak/adherence
    choreNotifications.ts → syncNotifications(), Notifee channel + triggers,
                           background/foreground event handlers
  store/
    choresStore.ts       → Zustand: chores + today's occurrences + actions
  navigation/
    PetsStack.tsx        → (edit) add ChoreForm route
  screens/
    today/TodayScreen.tsx → the Today agenda tab
    pets/PetDetailScreen.tsx → (edit) add a "Chores" section + Add button
    chores/ChoreFormScreen.tsx → add/edit one chore (schedule builder)
  __tests__/
    choreSchedule.test.ts
    choresStore.test.ts
    ChoreFormScreen.test.tsx
    TodayScreen.test.tsx
```

Edited: `navigation/RootNavigator.tsx` (add **Today** tab), `i18n/fa.json`
(new keys), `App.tsx` (register Notifee background handler at module load,
alongside DB init). New ADR: `docs/adr/0016-chores-rule-plus-log.md` (written in
PLAN phase; records approach B + Notifee-first realization of ADR-0008).

## Data Model

Two new tables, created on first run alongside `pets` (no migration framework,
ADR-0015 — additive `CREATE TABLE IF NOT EXISTS`):

```sql
CREATE TABLE IF NOT EXISTS chores (
  id            TEXT PRIMARY KEY,          -- uuid (expo-crypto)
  pet_id        TEXT NOT NULL,             -- FK pets.id; app deletes children on pet delete
  type          TEXT NOT NULL,             -- feeding|meds|play|grooming|vet|other
  title         TEXT,                      -- optional; defaults to type label in UI
  schedule_json TEXT NOT NULL,             -- discriminated union (below); never queried into
  end_kind      TEXT NOT NULL,             -- never|until|after_n
  end_until     TEXT,                      -- ISO-8601 UTC date, when end_kind=until
  end_count     INTEGER,                   -- when end_kind=after_n
  active        INTEGER NOT NULL DEFAULT 1,-- 0/1 soft on-off toggle
  created_at    TEXT NOT NULL,             -- ISO-8601 UTC
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chore_logs (
  id         TEXT PRIMARY KEY,             -- uuid
  chore_id   TEXT NOT NULL,                -- FK chores.id
  due_at     TEXT NOT NULL,                -- ISO-8601 UTC of the occurrence this log is for
  status     TEXT NOT NULL,               -- done|skipped
  created_at TEXT NOT NULL,                -- when the user acted (UTC)
  UNIQUE(chore_id, due_at)                 -- one log per occurrence; upsert on re-action
);
```

`schedule_json` discriminated union (times are **Tehran wall-clock** strings):

```ts
type Schedule =
  | { kind: 'daily_times'; times: string[] }                 // ["08:00","18:00"]
  | { kind: 'weekdays'; days: number[]; times: string[] }    // days 0..6, 0=Sun
  | { kind: 'interval'; n: number; unit: 'hours'|'days'|'months'; anchor: string } // anchor = UTC ISO of first occurrence
  | { kind: 'one_off'; at: string };                         // at = UTC ISO
```

- **Derived, never stored:** future occurrences, "pending", "missed" (= an
  occurrence whose `due_at` is past with no `chore_logs` row).
- **Timestamps** stored UTC ISO, displayed Jalali + Tehran time (ADR-0010).
- **Tehran offset** is a fixed **+03:30** constant (Iran dropped DST in 2022).
  `// ponytail: fixed +03:30, revisit only if Iran reinstates DST`.
- **Occurrence enumeration origin** (for `after_n` counting): `anchor` for
  `interval`, `at` for `one_off`, and the chore's `created_at` calendar day
  (Tehran-local) for `daily_times` / `weekdays`. `daily_times` is engine-treated
  as `weekdays` with all 7 days.

### TS shapes (added to `db/types.ts`)

```ts
export type ChoreType = 'feeding' | 'meds' | 'play' | 'grooming' | 'vet' | 'other';
export type EndKind = 'never' | 'until' | 'after_n';

export interface Chore {
  id: string;
  petId: string;
  type: ChoreType;
  title: string | null;
  schedule: Schedule;
  endKind: EndKind;
  endUntil: string | null;   // UTC ISO
  endCount: number | null;
  active: boolean;
  createdAt: string;         // UTC ISO
  updatedAt: string;
}

export interface ChoreLog {
  id: string;
  choreId: string;
  dueAt: string;             // UTC ISO
  status: 'done' | 'skipped';
  createdAt: string;
}

// A derived view, not a table row:
export interface Occurrence {
  chore: Chore;
  dueAt: string;             // UTC ISO
  status: 'pending' | 'done' | 'skipped' | 'missed';
}
```

## The Engine (`lib/choreSchedule.ts`, pure)

The heart of the feature — one well-tested module, no I/O:

- `expandOccurrences(chore, fromUtc, toUtc): string[]` — all due `due_at`s of a
  chore in `[from, to)`, honoring end condition (incl. `after_n` counted from
  origin). All other features build on this.
- `occurrencesForDay(chores, logs, dayUtcRange): Occurrence[]` — today's agenda
  with status resolved (log → done/skipped; else past → missed, future → pending).
- `streak(chore, logs, now): number` and `adherence(chore, logs, since): number`
  — walk the rule backward, check logs. (Phase 3)
- `toUtc(wallClock, dateTehran)` / `formatJalaliTime(utc)` — the +03:30 boundary.

## Notifications (`lib/choreNotifications.ts`)

- `syncNotifications()` — runs on app launch and after any chore mutation:
  cancel all, then for each `active` chore expand occurrences over a rolling
  window (**next 60 days**, global cap **200** triggers nearest-first) and
  register Notifee `TimestampTrigger` notifications on one channel.
  `// ponytail: full reschedule on each launch is O(chores×window); fine for a personal app, revisit past ~hundreds of chores`.
- **Action buttons** Done / Snooze / Skip (Phase 2). `onBackgroundEvent` /
  `onForegroundEvent` map a press → `logOccurrence` (Done/Skip) or a +15 min
  one-shot trigger (Snooze). Background handler registered at `App.tsx` module
  load (Notifee requirement).
- Notification payload carries `choreId` + `dueAt` so the handler can log the
  exact occurrence.

## UI Surfaces

- **Today tab (امروز)** — new bottom tab in `RootNavigator`. Agenda of today's
  occurrences across all pets, chronological, overdue-today first. Row: pet name
  + type icon/color + title + Tehran time + status badge, inline Done/Skip.
  Empty state when nothing is due.
- **Pet detail → Chores section** — lists that pet's chore definitions (with
  streak/adherence in Phase 3) + "Add chore"; tap a chore to edit. This is where
  chores are created/edited (chosen: managed per-pet, viewed globally).
- **Chore form** — type chips (preset + custom title), schedule builder
  (kind selector → times / weekday picker / interval n+unit / one-off), end
  condition (never / until-date / after-N). Jalali date pickers for dates.

## Code Style

Mirror `db/pets.ts` (thin, synchronous `expo-sqlite`, typed `rowTo*` mapping),
`petsStore.ts` (Zustand), `PetsStack.tsx` (typed stack). No inline Farsi — keys
in `fa.json`. Theme tokens, `start`/`end` in RTL styles, `useRef` in-flight
guard on async submits.

```ts
// lib/choreSchedule.ts — pure, the part that earns its tests
export function expandOccurrences(chore: Chore, fromUtc: Date, toUtc: Date): string[] {
  const out: string[] = [];
  // ... per-kind enumeration from origin, stop at end condition / toUtc
  return out;
}
```

## Testing Strategy

- Framework: `jest-expo` + `@testing-library/react-native`, tests in `src/__tests__/`.
- `expo-sqlite` and `@notifee/react-native` are **mocked** in tests.
- Cover:
  - **`choreSchedule`** (priority): each kind; daily multi-time; weekday subset;
    interval hours/days/months; one-off; month/year rollover; Tehran→UTC across
    midnight; `until` and `after_n` end conditions; missed-vs-pending resolution;
    streak & adherence.
  - `choresStore`: insert→list, log upsert (re-mark flips status, no dup row),
    delete-pet cascades chores+logs, validation rejects empty schedule.
  - `ChoreFormScreen`: schedule builder validation blocks save; in-flight guard.
  - `TodayScreen`: empty vs populated; overdue ordering; Done/Skip updates row.
- Notifee scheduling/handlers verified on-device early in Phase 2 (background
  SQLite write from headless JS is the key risk).
- Gate: `tsc --noEmit` 0 errors + `npm test` green before commit.

## Boundaries

- **Always:** run `tsc --noEmit` + `npm test` before commit; Farsi in `fa.json`;
  theme tokens; `start`/`end` RTL; store UTC, display Jalali; schedule via
  Notifee local triggers (ADR-0008); keep everything functional offline.
- **Ask first:** the new `@notifee/react-native` dep; any chore/`chore_logs`
  schema change after merge (no migration framework yet); touching `App.tsx`
  init/handler registration; changing the +03:30 offset assumption.
- **Never:** FCM / Firebase / Expo push (ADR-0008); a backend chores table or
  sync (offline-first, out of scope v1); store Jalali strings as source of
  truth; show a Gregorian date; materialize future occurrences to storage
  (breaks approach B).

## Phasing

1. **P1 — Core (shippable reminder app):** tables, engine, chore form,
   pet-detail chore list, Today tab, Notifee setup + tap-to-open, in-app
   Done/Skip via logs.
2. **P2 — Notification actions:** Done / Snooze / Skip buttons + background &
   foreground handlers.
3. **P3 — Stats:** streak + adherence computation and display.

## Out of Scope (v1)

Backend chores table / sync; cross-device; calendar/agenda beyond "today" (no
week/month view); reschedule-history or audit beyond the done/skipped log;
attachments/photos on chores; custom user categories (preset types + free title
only); per-chore custom snooze duration (fixed 15 min); reminder sounds beyond
the channel default.

## Resolved Decisions

1. **Approach B** (rule + completion log; derived occurrences) — approved.
2. **New dep:** `@notifee/react-native`; this feature is the first realization of
   ADR-0008.
3. **Schedule stored as one `schedule_json` TEXT column** (discriminated union),
   not many nullable typed columns — never queried into.
4. **Today is a new bottom tab**; chores are created/edited from pet detail.
5. **Tehran = fixed +03:30** (no DST).
6. **Pet delete cascades** to chores + logs in app code (no FK enforcement
   assumed in SQLite).
7. **ADR-0016** to be written in PLAN phase.

## Open Questions

None blocking. Confirm at review: (a) 60-day / 200-trigger window caps are
acceptable defaults; (b) fixed 15-min snooze is fine for v1.
