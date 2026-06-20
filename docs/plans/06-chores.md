# Implementation Plan: Chores (کارها)

Spec: `docs/specs/06-chores-spec.md`
Status: **DRAFT — awaiting approval**

## Overview

An offline-first reminder + light task-tracker for pet chores. **Approach B**:
persist the chore *rule* + a completion log; derive every occurrence (agenda,
notification fire-times, missed, streaks) on demand. Layered like the pets
feature: `lib/choreSchedule` (pure engine) + `db/chores` (schema + typed CRUD) →
`lib/choreNotifications` (Notifee) → `choresStore` (Zustand) → screens (Today
tab, pet-detail Chores section, ChoreForm). Built in three phases:
**P1 core reminder app → P2 notification actions → P3 stats.**

## Architecture Decisions

- **Approach B (rule + log).** `chores` holds the rule, `chore_logs` holds only
  done/skipped events. Future occurrences are never stored — they're derived by
  the pure engine. (ADR-0016, written in Task 1.)
- **Pure engine first (`lib/choreSchedule.ts`).** All date math is I/O-free and
  unit-tested before anything consumes it. `expandOccurrences` is the primitive
  everything builds on. Tehran = fixed **+03:30** (no DST).
- **`schedule_json` as one TEXT column** (discriminated union) — never queried
  into, so no nullable column sprawl. Mirrors the "thin synchronous `db/`"
  pattern from `db/pets.ts`.
- **Notifee, scheduled from rules.** `syncNotifications()` cancels-all then
  re-registers triggers for a 60-day / 200-cap window on launch + after
  mutations. First realization of ADR-0008.
- **Store mirrors `petsStore`**: Zustand, in-memory `chores[]` + today's derived
  `occurrences[]`; actions call `db/chores` then re-`set`. SQLite is the
  persistence.
- **One `ChoreFormScreen` for Add + Edit**, mode chosen by a `choreId?` route
  param (like `PetFormScreen`). Reached from pet detail.
- **Pet delete cascades** to chores + logs in app code (SQLite FKs not enforced).
  `petsStore.deletePet` gains a call into `db/chores`.

## Dependency Graph

```
Task 1  deps(@notifee) + types + i18n + ADR-0016          (foundation, no behavior)
   │
   ├── Task 2  lib/choreSchedule.ts  (PURE engine + tests)   ← highest risk, built first
   │       │
   ├── Task 3  db/index.ts tables + db/chores.ts CRUD + logs
   │       │        │
   │       │        └── Task 4  store/choresStore.ts (+ petsStore cascade)
   │       │                │
   │       │                ├── Task 5  ChoreFormScreen + PetsStack route + pet-detail Chores section
   │       │                └── Task 6  TodayScreen + RootNavigator tab (in-app Done/Skip)
   │       │
   │       └── Task 7  lib/choreNotifications.ts: sync + channel + tap-to-open  + App.tsx wiring
   │  ── P1 complete ───────────────────────────────────────────────────────────
   │
   ├── Task 8  Notification action buttons + background/foreground handlers      (P2)
   │  ── P2 complete ───────────────────────────────────────────────────────────
   │
   └── Task 9  streak/adherence in engine + display on chore rows               (P3)
```

Bottom-up: engine → data → store → UI → notifications, then P2/P3 layers.

---

## Task List

### Phase 1 — Core reminder app

#### Task 1: Deps, types, i18n keys, ADR-0016

**Description:** Foundation, no behavior. Add `@notifee/react-native` (SDK 56
versioned docs, native config), add `Chore`/`ChoreType`/`Schedule`/`ChoreLog`/
`Occurrence`/`EndKind` to `db/types.ts`, add `chores.*` Farsi keys to `fa.json`,
write `docs/adr/0016-chores-rule-plus-log.md` and reference it from
`mobile/CLAUDE.md`.

**Acceptance criteria:**
- [ ] `@notifee/react-native` installed at the SDK 56-compatible pin; `npx tsc --noEmit` clean.
- [ ] All chore TS types compile and match the spec shapes.
- [ ] ADR-0016 records approach B + Notifee-first realization of ADR-0008.

**Verification:** `npx tsc --noEmit` 0 errors; ADR + i18n keys present.
**Dependencies:** None.
**Files:** `package.json`, `src/db/types.ts`, `src/i18n/fa.json`, `docs/adr/0016-chores-rule-plus-log.md`, `mobile/CLAUDE.md`.
**Scope:** M.

#### Task 2: Pure schedule engine (`lib/choreSchedule.ts`) — TDD

**Description:** The heart, built test-first. `toUtc`/time helpers (fixed +03:30),
`expandOccurrences(chore, from, to)` for all four kinds (+ every-N-months),
end-condition handling (`until`, `after_n` counted from origin), and
`occurrencesForDay(chores, logs, dayRange)` resolving status
(done/skipped/missed/pending). No I/O.

**Acceptance criteria:**
- [ ] `expandOccurrences` correct for daily_times (multi-time), weekdays subset, interval hours/days/months, one_off.
- [ ] `until` stops after the date; `after_n` stops after the Nth occurrence from origin.
- [ ] `occurrencesForDay` marks past-no-log as `missed`, future as `pending`, logged as done/skipped.
- [ ] Month/year rollover and Tehran→UTC across midnight covered.

**Verification:** `npx jest src/__tests__/choreSchedule.test.ts` green; `tsc --noEmit` clean.
**Dependencies:** Task 1.
**Files:** `src/lib/choreSchedule.ts`, `src/__tests__/choreSchedule.test.ts`.
**Scope:** M.

#### Task 3: DB schema + CRUD (`db/index.ts`, `db/chores.ts`)

**Description:** Add `CREATE TABLE IF NOT EXISTS chores / chore_logs` to
`db/index.ts`. Thin synchronous typed CRUD in `db/chores.ts`: insert/list/
listByPet/get/update/delete chores; `logOccurrence` (upsert on `chore_id,due_at`),
`getLogsForChore`, `getLogsForDay`, `deleteChoresForPet`. Typed `rowTo*` mapping;
`schedule_json` (de)serialized at the boundary.

**Acceptance criteria:**
- [ ] Both tables created on import; existing `pets` flow unaffected.
- [ ] CRUD round-trips a chore incl. schedule serialization; `logOccurrence` upserts (re-mark flips status, no duplicate row).
- [ ] `deleteChoresForPet` removes a pet's chores + logs.

**Verification:** `npx jest src/__tests__/choresStore.test.ts` (db exercised via mock) green.
**Dependencies:** Task 1.
**Files:** `src/db/index.ts`, `src/db/chores.ts`.
**Scope:** M.

#### Task 4: Store (`choresStore.ts`) + pet-delete cascade

**Description:** Zustand store mirroring `petsStore`: in-memory `chores[]` and a
derived today `occurrences[]` (via the engine + logs), with actions
add/update/delete/toggleActive and `markOccurrence(choreId, dueAt, status)`.
Wire `petsStore.deletePet` to call `deleteChoresForPet`.

**Acceptance criteria:**
- [ ] Add→list, update, delete reflect in store state.
- [ ] `markOccurrence` writes a log and refreshes today's occurrences.
- [ ] Deleting a pet removes its chores+logs (no orphans).

**Verification:** `npx jest src/__tests__/choresStore.test.ts` green; `tsc --noEmit` clean.
**Dependencies:** Tasks 2, 3.
**Files:** `src/store/choresStore.ts`, `src/store/petsStore.ts`, `src/__tests__/choresStore.test.ts`.
**Scope:** M.

### Checkpoint: data + logic (after Task 4)
- [ ] All non-UI tests pass; `tsc --noEmit` clean. Engine + store solid before any screen.

#### Task 5: ChoreForm + pet-detail Chores section

**Description:** `ChoreFormScreen` (Add/Edit via `choreId?` param) with type chips,
optional title, schedule builder (kind → times / weekday picker / interval
n+unit / one-off date), end condition (never/until/after-N), Jalali date pickers.
Add a "Chores" section + "Add chore" to `PetDetailScreen`; add the route to
`PetsStack`. In-flight `useRef` guard on save.

**Acceptance criteria:**
- [ ] Create a chore of each kind from a pet; it appears in that pet's list.
- [ ] Edit persists; invalid schedule (e.g. no times/days) blocked with translated error.
- [ ] After save, `syncNotifications()` is invoked (Task 7 wires the real call; stub-safe until then).

**Verification:** `npx jest src/__tests__/ChoreFormScreen.test.tsx` green; manual add on device.
**Dependencies:** Task 4.
**Files:** `src/screens/chores/ChoreFormScreen.tsx`, `src/screens/pets/PetDetailScreen.tsx`, `src/navigation/PetsStack.tsx`, `src/__tests__/ChoreFormScreen.test.tsx`.
**Scope:** L.

#### Task 6: Today tab (`TodayScreen`) + nav

**Description:** New **Today (امروز)** bottom tab in `RootNavigator`. Agenda of
today's derived occurrences across all pets, chronological with overdue-today
first; row = pet + type icon/color + title + Tehran time + status badge, inline
Done/Skip calling `markOccurrence`. Empty state.

**Acceptance criteria:**
- [ ] Today's occurrences across pets render in time order; overdue-today first.
- [ ] Done/Skip updates the row and persists across restart.
- [ ] Empty state when nothing is due.

**Verification:** `npx jest src/__tests__/TodayScreen.test.tsx` green; manual on device.
**Dependencies:** Task 4.
**Files:** `src/screens/today/TodayScreen.tsx`, `src/navigation/RootNavigator.tsx`, `src/__tests__/TodayScreen.test.tsx`.
**Scope:** M.

#### Task 7: Notifications — schedule + tap-to-open (`lib/choreNotifications.ts`)

**Description:** Create the Notifee channel; `syncNotifications()` cancels-all and
registers `TimestampTrigger`s for the 60-day / 200-cap window from active chores'
expanded occurrences (payload = choreId + dueAt). Call it on app launch and after
chore mutations (Task 5/4 hooks). Tap opens the app to the Today tab. Request
notification permission on first use.

**Acceptance criteria:**
- [ ] A chore due soon fires a local notification at its Tehran time in airplane mode.
- [ ] Editing/deleting a chore reschedules (no stale notifications).
- [ ] Window cap respected; nearest occurrences prioritized.

**Verification:** Manual on a real `expo run:android` build (Notifee is native); unit test the window/cap selection with Notifee mocked.
**Dependencies:** Tasks 2, 4.
**Files:** `src/lib/choreNotifications.ts`, `src/store/choresStore.ts` (call sites), `App.tsx`, `src/__tests__/choreNotifications.test.ts`.
**Scope:** M.

### Checkpoint: P1 complete
- [ ] End-to-end: create chore → see in Today → get a notification → mark Done. Offline. Tests green, `tsc` clean. **Review with human before P2.**

### Phase 2 — Notification actions

#### Task 8: Done / Snooze / Skip buttons + background handlers

**Description:** Add action buttons to the trigger notifications. Register
Notifee `onBackgroundEvent` (at `App.tsx` module load) + `onForegroundEvent`:
Done/Skip → `logOccurrence`; Snooze → +15 min one-shot trigger. Verify SQLite
write works from the headless background context (the key risk).

**Acceptance criteria:**
- [ ] Done/Skip from the notification (app backgrounded) writes the correct log and the Today tab reflects it on next open.
- [ ] Snooze re-fires the same chore in 15 min.

**Verification:** Manual on device: background the app, trigger, press each action, reopen and confirm log. Mocked-handler unit test for the event→log mapping.
**Dependencies:** Task 7.
**Files:** `src/lib/choreNotifications.ts`, `App.tsx`, `src/__tests__/choreNotifications.test.ts`.
**Scope:** M.

### Checkpoint: P2 complete
- [ ] Notification actions verified on a real device. **Review before P3.**

### Phase 3 — Stats

#### Task 9: Streak + adherence

**Description:** Add `streak(chore, logs, now)` and `adherence(chore, logs, since)`
to the engine (walk the rule backward, check logs). Display per-chore streak +
adherence % on the chore row in the pet-detail Chores section.

**Acceptance criteria:**
- [ ] Streak = consecutive fully-done periods up to today; breaks on a missed occurrence.
- [ ] Adherence % = done ÷ due over the window, correct on sample data.
- [ ] Values render on each chore row; no value shown for chores with no due history yet.

**Verification:** `npx jest src/__tests__/choreSchedule.test.ts` (streak/adherence cases) green; manual visual check.
**Dependencies:** Task 2, Task 5.
**Files:** `src/lib/choreSchedule.ts`, `src/screens/pets/PetDetailScreen.tsx`, `src/__tests__/choreSchedule.test.ts`.
**Scope:** S–M.

### Checkpoint: Complete
- [ ] All success criteria in the spec met; tests green; `tsc --noEmit` clean; ready for review.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Background SQLite write from Notifee headless context fails | High | Isolated to Task 8; verify on device early; fallback = log on next app open from notification payload. |
| Schedule engine edge cases (month rollover, after_n, Tehran offset) | High | Engine is pure + TDD in Task 2 before any consumer; heavy unit coverage. |
| Android trigger-count limits | Med | 200-cap, nearest-first window; reschedule on launch. |
| Notifee native setup on SDK 56 bare | Med | Follow versioned docs; first thing built in Task 1/7 on a real build, not Metro. |
| `expo-sqlite` mocking for new tables in jest | Low | Reuse the pets-feature mock pattern. |

## Parallelization

Mostly sequential (engine → data → store → UI). Once Task 4 lands, **Task 5
(ChoreForm) and Task 6 (Today tab) are independent** and can be done in parallel.
P2/P3 are strictly after P1.

## Open Questions

None — spec defaults (60-day/200-cap window, fixed 15-min snooze) confirmed.
