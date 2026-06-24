# Implementation Plan: 07 — Today → Tasks Tab

> Source spec: `docs/specs/07-today-tasks-tab.md`. Read it first — this plan only
> sequences the work; the spec owns the decisions.

## Overview

Rewrite the Today tab from a flat read-only list of today's occurrences into a
three-section task hub (Overdue / Today / Next 7 days) with quick-add, pet/type
filters, a today-progress indicator, and checkbox-complete-with-undo. No new data
model: ad-hoc todos are `one_off` `other` chores; occurrences stay derive-at-query
(ADR-0016 approach B). The window expands from 1 day to `[now−7d, now+7d)`.

## Architecture decisions (carried from spec, with build-time choices)

- **Window compute, screen-side bucketing.** Store exposes a flat
  `windowOccurrences` over `[now−7d, now+7d)`; bucketing is a *pure helper in the
  screen module* so it unit-tests without React. `occurrences` (today-only) stays
  untouched — the window field is additive.
- **Undo needs un-logging.** New `removeLog(choreId, dueAt)` in the data layer —
  there is currently no way to delete a single `chore_logs` row. `unmarkOccurrence`
  store action wraps it (mirrors `markOccurrence`: db write → recompute → sync).
- **Range log fetch.** `getLogsInRange(startPrefix, endPrefix)` via a single
  `due_at BETWEEN`-style prefix query (preferred over looping `getLogsForDay`).
- **Dependencies (decided):**
  - **Action sheet (Skip/Edit/Delete):** `@expo/react-native-action-sheet` —
    first-party Expo, native iOS action sheet + Android fallback, no reanimated.
  - **Undo toast:** `react-native-toast-message` — pure-JS, built-in action button
    for Undo, trivially mockable in jest.
  - **Quick-add sheet:** **no library** — a navigation screen with
    `presentation: 'formSheet'` via the already-installed `react-native-screens@4.25`.
    The heaviest "sheet" job is handled natively by what's already there.
  - **Rejected:** `@gorhom/bottom-sheet` / `sonner-native` — both pull in
    `react-native-reanimated` + `react-native-gesture-handler` (2 native deps +
    Babel/root wiring + dev-client rebuild) to animate one toast and two sheets this
    feature doesn't need. Revisit only if reanimated is adopted elsewhere.
- **Quick-add "More options →" prefill.** `ChoreFormScreen` currently only reads
  `{ petId, choreId }` from `PetsStackParamList`. Carrying a typed title requires
  one optional `title?: string` route param the form reads in Add mode. This is the
  only edit to existing-screen behavior; keep it surgical.

### Dependency graph

```
deps (action-sheet provider + toast root + jest mocks)
   └── (consumed by the screen + quick-add)

db/chores.ts (getLogsInRange, removeLog)
   └── choresStore.ts (windowOccurrences via computeRangeOccurrences, unmarkOccurrence)
          └── bucketing helper (pure, in screen module)
                 └── TodayScreen rewrite (SectionList + row + filters + progress)
                        └── QuickAddScreen (formSheet)
TodayStack + RootNavigator swap ── needs deps wired; hosts Today + ChoreForm + QuickAdd
i18n keys ── needed by screen/quick-add; lands in the final phase
```

Bottom-up: data layer → store → pure helper, in parallel with deps + navigation,
then the screen, then quick-add, then i18n/docs.

---

## Task List

### Phase 1: Foundation — data layer + store

#### Task 1: Data-layer range read + single-log delete
**Description:** Add `getLogsInRange(startPrefix, endPrefix)` and
`removeLog(choreId, dueAt)` to `mobile/src/db/chores.ts`. The range read backs the
7d window; `removeLog` backs undo.

**Acceptance criteria:**
- [ ] `getLogsInRange` returns all logs whose `due_at` falls in the window, mapped via `rowToChoreLog`, ordered ascending.
- [ ] `removeLog` deletes exactly the one `(chore_id, due_at)` row.

**Verification:**
- [ ] `npx tsc --noEmit` clean.
- [ ] Covered indirectly by store/screen tests in later tasks (no dedicated db test — matches repo convention of testing through the store).

**Dependencies:** None
**Files likely touched:** `mobile/src/db/chores.ts`
**Estimated scope:** S (1 file)

#### Task 2: Store window occurrences + `unmarkOccurrence`
**Description:** Add `computeRangeOccurrences()` (fills `[now−7d, now+7d)` using
`occurrencesForDay` with the wide range + `getLogsInRange`), expose
`windowOccurrences` on the store, recompute it everywhere `occurrences` is
recomputed (`load`/`add`/`update`/`delete`/`toggleActive`/`mark`), and add
`unmarkOccurrence(choreId, dueAt)` → `removeLog` + recompute + `_syncNotifications`.

**Acceptance criteria:**
- [ ] `windowOccurrences` is populated at init and after every mutating action, alongside the existing `occurrences`.
- [ ] `unmarkOccurrence` removes the log and the affected occurrence reverts to pending/missed on recompute.
- [ ] Existing `occurrences` field and its consumers are unchanged.

**Verification:**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npx jest src/__tests__/TodayScreen.test.tsx` still passes (store shape additive).

**Dependencies:** Task 1
**Files likely touched:** `mobile/src/store/choresStore.ts`
**Estimated scope:** S–M (1 file)

#### Task 3: Pure bucketing helper + its test
**Description:** Add a pure `bucketOccurrences(occs, now)` (with
`isOverdue`/`sortOccurrences`) in a new **sibling module
`mobile/src/screens/today/todayBuckets.ts`** — I/O-free, no `react-native` import,
mirroring the `lib/choreSchedule.ts` pattern so it unit-tests without dragging the
RN component graph through jest. Returns `{ overdue, today, upcoming }` per the
spec's Tehran-day rules. Write the helper test now (TDD): yesterday→overdue,
today→today, +3d→upcoming, done/skipped past→excluded from overdue, overdue older
than 7d→excluded.

**Acceptance criteria:**
- [ ] Helper buckets by `dueAt` vs Tehran today window exactly per spec §Architecture.
- [ ] Overdue excludes `done`/`skipped` and items older than the 7-day look-back.
- [ ] Overdue + Today sort overdue-first then chronological; Upcoming chronological.

**Verification:**
- [ ] New helper test passes (`npx jest -t "bucket"`).
- [ ] `npx tsc --noEmit` clean.

**Dependencies:** Task 2 (consumes `windowOccurrences` shape)
**Files likely touched:** `mobile/src/screens/today/todayBuckets.ts` (new), `mobile/src/__tests__/todayBuckets.test.ts` (new)
**Estimated scope:** S–M

### Checkpoint: Foundation
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm test` green (helper test + unchanged TodayScreen tests).
- [ ] Window data flows store → helper without touching the today-only path.

---

### Phase 2: Dependencies + navigation

#### Task 4: Add + wire `@expo/react-native-action-sheet` and `react-native-toast-message`
**Description:** Install both libs at Expo-compatible versions. Wrap the app in
`<ActionSheetProvider>` and mount the `<Toast />` root component (after the
navigation container) in `App.tsx`. Add jest mocks so neither breaks the test env:
mock `useActionSheet` to return a `showActionSheetWithOptions` `jest.fn`, and mock
`react-native-toast-message` (`Toast.show`/`hide`).

**Acceptance criteria:**
- [ ] App boots with `ActionSheetProvider` wrapping and `<Toast />` mounted at root.
- [ ] Versions resolved via `npx expo install` (SDK-56 compatible), recorded in `package.json`.
- [ ] Jest mocks in place; existing test suite still green.

**Verification:**
- [ ] `npm test` green.
- [ ] `npx tsc --noEmit` clean.
- [ ] Manual: app launches on emulator without a redbox.

**Dependencies:** None (parallelizable with Phase 1)
**Files likely touched:** `mobile/package.json`, `mobile/App.tsx`, jest mock(s) (test file or a `jest.setup`-style mock module)
**Estimated scope:** S–M

#### Task 5: TodayStack wrapper + RootNavigator swap + ChoreForm prefill param
**Description:** Add `mobile/src/navigation/TodayStack.tsx` (native stack, mirrors
`PetsStack` chrome) hosting `Today` (TodayScreen), the reused `ChoreForm`
(ChoreFormScreen), and `QuickAdd` (QuickAddScreen, `presentation: 'formSheet'`).
Define `TodayStackParamList`:
`Today: undefined; ChoreForm: { petId: string; choreId?: string; title?: string }; QuickAdd: undefined`.
Swap the direct `TodayScreen` in `RootNavigator` for `TodayStack`. Add optional
`title?` to `ChoreForm`'s param contract and have the form prefill title in Add mode.

**Acceptance criteria:**
- [ ] Today tab renders through TodayStack; tab bar/label unchanged.
- [ ] Navigating to `ChoreForm` and `QuickAdd` from the Today tab works.
- [ ] `ChoreFormScreen` reads `title?` and prefills it in Add mode; existing PetsStack callers unaffected (param optional).

**Verification:**
- [ ] `npx tsc --noEmit` clean (both param lists type-check).
- [ ] Manual: open Today tab, tap a row → Edit → ChoreForm opens and back-navigates.

**Dependencies:** Task 4 (QuickAdd screen exists by Task 8; register a stub or land Task 8 first if needed)
**Files likely touched:** `mobile/src/navigation/TodayStack.tsx` (new), `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/screens/chores/ChoreFormScreen.tsx`
**Estimated scope:** M (3 files)

### Checkpoint: Deps + navigation
- [ ] App launches; Today tab routes through TodayStack; action-sheet + toast roots mounted.
- [ ] `tsc` clean, `npm test` green.

---

### Phase 3: Core screen rewrite

#### Task 6: SectionList + row (checkbox + undo toast + action sheet)
**Description:** Rewrite `TodayScreen` to a `SectionList` over the three buckets.
Row: leading checkbox → `markOccurrence(...,'done')`, then `Toast.show` a ~4s
"Done · Undo" toast whose Undo action → `unmarkOccurrence`. `⋯`/row-body tap →
`useActionSheet().showActionSheetWithOptions` with Skip → `markOccurrence(...,'skipped')`,
Edit → navigate to `ChoreForm`, Delete (destructive index) → `deleteChore` (copy
differs recurring vs one_off). Remove the old standalone Done/Skip buttons.
Per-section empty rows; whole-screen empty state (`today-empty`) when the window is
empty. Upcoming day sub-headers inline. Re-bucket on focus (existing `useIsFocused`).

**Acceptance criteria:**
- [ ] Three sections render with count badges; checked rows dim in place until reload.
- [ ] Checkbox → `markOccurrence(...,'done')` + toast; Undo → `unmarkOccurrence`.
- [ ] Action sheet wires Skip/Edit/Delete to the right store/nav calls with correct delete copy per schedule kind.

**Verification:**
- [ ] `npx jest src/__tests__/TodayScreen.test.tsx` passes after updating it for the new row interactions (checkbox/sheet/toast replace Done/Skip buttons; assert against the mocked `showActionSheetWithOptions` and `Toast.show`).
- [ ] `npx tsc --noEmit` clean.
- [ ] Manual: complete → undo; skip; delete (both copies).

**Dependencies:** Tasks 3, 4, 5
**Files likely touched:** `mobile/src/screens/today/TodayScreen.tsx`, `mobile/src/__tests__/TodayScreen.test.tsx`
**Estimated scope:** L (2 files — the largest single change)

#### Task 7: Top chrome — progress + pet/type filters
**Description:** Add the today-progress indicator (`done / (done + pending + missed)`,
`skipped` excluded; hidden when today has 0) and the filter bar: single-select pet
chips + a multi-select type filter. The type filter is a **small custom chip modal**
(RN `Modal` of toggle chips reusing the `ChoreFormScreen` type-chip pattern + an
Apply/Clear footer) — *not* the action-sheet lib, which is built for fire-once
mutually-exclusive choices and has no persistent checked state for multi-select.
Filters AND-combine and apply to all three sections; section counts and empty rows
reflect the filtered set. Whole-list "No tasks match" + clear-filters when filters
empty everything.

**Acceptance criteria:**
- [ ] Progress shows N of M for today only with the stated denominator; hidden at 0.
- [ ] Pet filter (single) and type filter (multi) narrow the rendered set; combined = AND.
- [ ] Filter-empty shows section empty rows (sections stay) and a whole-list clear-filters state when everything is filtered out.

**Verification:**
- [ ] `npx jest src/__tests__/TodayScreen.test.tsx` passes with added filter + progress cases.
- [ ] `npx tsc --noEmit` clean.

**Dependencies:** Task 6
**Files likely touched:** `mobile/src/screens/today/TodayScreen.tsx` (filter bar + chip modal), `mobile/src/__tests__/TodayScreen.test.tsx`
**Estimated scope:** M

### Checkpoint: Core screen
- [ ] All TodayScreen tests green; `tsc` clean.
- [ ] End-to-end: buckets correct, complete/undo/skip/delete work, filters + progress reflect state.

---

### Phase 4: Quick-add + i18n + docs

#### Task 8: QuickAddScreen (formSheet)
**Description:** New `mobile/src/screens/today/QuickAddScreen.tsx` — registered as a
`formSheet` screen in TodayStack. Title (`TextField`), Pet picker (reuse ChoreForm's
pet-selection pattern), When (date + Tehran time, default today/next round hour).
Add → `addChore({ type:'other', schedule:{kind:'one_off', at}, ... })` with `at` via
`toUtcIso`, then dismiss. "More options →" → navigate to `ChoreForm` carrying typed
title + selected pet. FAB on TodayScreen → `navigation.navigate('QuickAdd')`.

**Acceptance criteria:**
- [ ] Add submits a `one_off` `other` chore via `addChore` with the spec's shape; `at` is Tehran→UTC.
- [ ] "More options →" navigates to `ChoreForm` with `title` + `petId` prefilled.
- [ ] FAB opens the sheet; dismiss returns to the list which re-buckets on focus.

**Verification:**
- [ ] `npx jest src/__tests__/TodayScreen.test.tsx` quick-add case passes (asserts `addChore` shape).
- [ ] `npx tsc --noEmit` clean.
- [ ] Manual: FAB → add a todo → it appears in Today/Upcoming.

**Dependencies:** Tasks 5, 6
**Files likely touched:** `mobile/src/screens/today/QuickAddScreen.tsx` (new), `mobile/src/screens/today/TodayScreen.tsx` (FAB), `mobile/src/navigation/TodayStack.tsx` (final registration)
**Estimated scope:** M

#### Task 9: i18n keys + stale docs
**Description:** Add the flat `today.*` keys from spec §i18n to
`mobile/src/i18n/fa.json` (section titles, progress, undo, sheet actions incl.
recurring/one_off delete copy, quick-add labels, filter labels, per-section empty
rows, "no tasks match" + clear-filters). Refresh the stale tab description in
`mobile/CLAUDE.md` (it lists Home/Profile; actual tabs are Pets/Today/Profile — note
the Today→Tasks behavior).

**Acceptance criteria:**
- [ ] Every new string the screen/quick-add renders resolves to a real `fa.json` key (no raw key flashes).
- [ ] `mobile/CLAUDE.md` tab description matches the shipped navigation.

**Verification:**
- [ ] App renders with no missing-translation fallbacks for `today.*`.
- [ ] `npx tsc --noEmit` clean.

**Dependencies:** Tasks 6–8 (keys finalized once UI strings are known)
**Files likely touched:** `mobile/src/i18n/fa.json`, `mobile/CLAUDE.md`
**Estimated scope:** S

### Checkpoint: Complete
- [ ] `npm test` green; `npx tsc --noEmit` 0 errors (the type gate).
- [ ] All spec §Testing cases covered: bucketing, checkbox+undo, sheet Skip/Edit/Delete, pet+type+combined filters, progress count, quick-add shape.
- [ ] Manual run on emulator: full flow (buckets, complete/undo, skip, edit, delete, filter, quick-add) works.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| New native dep (`@expo/react-native-action-sheet`) needs a dev-client rebuild | Med | Install via `npx expo install`; rebuild once in Task 4 before screen work. Toast lib is pure-JS (no rebuild). |
| `formSheet` presentation behaves differently iOS vs Android | Low | `react-native-screens@4.25` supports it on both; verify the quick-add sheet manually on the Android emulator in Task 8. |
| 14-day window × recurring chores expands many occurrences per compute | Med | `expandOccurrences` already fast-forwards intervals; window is bounded ±7d. Profile only if a focus-reload janks. |
| `ChoreForm` `title?` param leaks into PetsStack callers | Low | Param optional; PetsStack callers omit it. Type-checked by `tsc`. |
| Test rewrite (Task 6) churns existing passing tests | Med | Update tests in the same task; keep ordering/empty-state cases, swap Done/Skip-button assertions for checkbox/sheet/toast against the mocks. |

## Resolved decisions

- **Bucketing helper location:** sibling pure module `todayBuckets.ts` (Task 3) —
  I/O-free, no `react-native` import, so it unit-tests in isolation like
  `lib/choreSchedule.ts`.
- **Type filter UI:** small custom chip modal (Task 7), not the action-sheet lib.
  The action-sheet lib is for fire-once mutually-exclusive choices (it still owns
  the row's Skip/Edit/Delete); multi-select needs persistent checked state + an
  Apply step, which a toggle-chip modal gives and matches the existing chip pattern.

## Parallelization

- Phase 1 (data: Tasks 1→2→3, strict chain) runs in parallel with Phase 2 deps/nav.
- Phase 3/4 touch the same screen file — keep Tasks 6→7→8 sequential.
