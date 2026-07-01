# Implementation Plan: Pets Multi-Select & Delete

Spec: `docs/specs/12-pets-select-delete.md`

## Overview

Add gallery-style multi-select to `PetsListScreen`: long-press a card to enter
selection mode, tap to toggle more, select-all, then batch-delete via one
`Alert.alert` confirm. Backed by a new `removeMany(ids)` action on
`petsStore` (single `listPets()` refresh instead of N).

Four vertical slices, each leaving the screen in a working, testable state:
store action → selection interaction (no delete yet) → toolbar + delete wired
in → Android back handling + polish.

## Architecture Decisions

- **Selection state is local to `PetsListScreen`** (`useState`), not a store —
  ephemeral UI state, not shared/persisted (spec decision).
- **`removeMany` is a new store action**, not a loop of `remove(id)` from the
  screen — one `listPets()` refresh for the whole batch (spec decision).
- **TDD per slice.** Each task writes/extends tests first where behavior is
  new, matching this repo's existing `petsStore.test.ts` /
  `PetsListScreen.test.tsx` mocking conventions (fake SQLite driver for the
  store, `jest.mock("../store/petsStore")` selector-mock for the screen).
- **No new files** beyond what's already in the spec's Project Structure —
  toolbar and checkmark overlay are inline JSX in `PetsListScreen.tsx`.

## Task List

### Phase 1: Store foundation

#### Task 1: `removeMany(ids)` on petsStore

**Description:** Add a batch-delete action to `petsStore.ts` mirroring
`remove`'s per-pet cleanup (tasks, photo, row) but with a single `set({pets:
listPets()})` at the end. Extend `petsStore.test.ts` (existing file, has a
`describe("petsStore – remove")` block to sit alongside).

**Acceptance criteria:**
- [ ] `removeMany(ids: string[])` deletes tasks + photo + row for every id.
- [ ] `listPets()` (via `set`) is called exactly once for the whole batch,
      not once per id — assert via a spy count or by checking the fake db's
      read count if easily observable, otherwise assert final `pets` state
      is correct after a batch of 3.
- [ ] A pet with no photo in the batch doesn't throw and doesn't block the
      others.
- [ ] Empty array input is a no-op (no throw, no `set` needed either way —
      either behavior acceptable, just don't crash).

**Verification:**
- [ ] `npx jest src/__tests__/petsStore.test.ts` — new tests green, existing
      tests unaffected.
- [ ] `npx tsc --noEmit` — 0 errors.

**Dependencies:** None.

**Files likely touched:**
- `mobile/src/store/petsStore.ts`
- `mobile/src/__tests__/petsStore.test.ts`

**Estimated scope:** Small (2 files).

### Checkpoint: Phase 1

- [ ] `removeMany` covered by tests, jest green, `tsc --noEmit` clean.
- [ ] No screen changes yet — app behavior unchanged.

### Phase 2: Selection interaction (no delete yet)

#### Task 2: Long-press to select, tap-to-toggle, checkmark overlay

**Description:** Add `selectedIds` state to `PetsListScreen`. Card
`onLongPress` enters selection mode (seed `selectedIds` with that card's id +
haptic). While in selection mode, card `onPress` toggles selection instead of
navigating; outside selection mode, `onPress` still navigates (no
regression). Render a checkmark overlay on each card reflecting selected
state. No toolbar, no delete yet — `selectionMode` is derived as
`selectedIds.size > 0` for this task (Task 3 replaces this with the "stays
active at 0" rule once the toolbar/cancel button exists to exit it).

**Acceptance criteria:**
- [ ] Long-press an unselected card while not in selection mode → that card
      becomes selected (checkmark shows), medium haptic fires
      (`.catch(() => {})` swallow, matching `TasksScreen` convention).
- [ ] Tap a card while in selection mode → toggles its selected state; does
      NOT call `navigation.navigate`.
- [ ] Tap a card while NOT in selection mode → still calls
      `navigation.navigate("PetDetail", { petId })` — no regression
      (existing tests in `PetsListScreen.test.tsx` must stay green).
- [ ] Checkmark overlay only renders when selection mode is active.

**Verification:**
- [ ] `npx jest src/__tests__/PetsListScreen.test.tsx` — existing tests still
      green, new long-press/toggle tests green.
- [ ] `npx tsc --noEmit` — 0 errors.

**Dependencies:** None (independent of Task 1; can be built in parallel).

**Files likely touched:**
- `mobile/src/screens/pets/PetsListScreen.tsx`
- `mobile/src/__tests__/PetsListScreen.test.tsx`

**Estimated scope:** Small–Medium (2 files).

### Checkpoint: Phase 2

- [ ] Long-press/tap-toggle/checkmark verified by tests.
- [ ] Normal (non-selection) tap-to-navigate confirmed unregressed.
- [ ] Manual: long-press a card on device/emulator → checkmark appears; tap
      others → toggle; tap a card normally when nothing selected → still
      navigates.

### Phase 3: Toolbar, select-all, delete

#### Task 3: Selection toolbar + select-all + batch delete

**Description:** Replace the FAB with a selection toolbar (cancel X, "N
selected" count, select-all toggle, trash) while selection mode is active.
Wire trash → `Alert.alert` confirm (reusing the `pets.delete` /
`pets.delete_confirm_many` pattern) → `removeMany(selectedIds)` on confirm.
Redefine `selectionMode` per the spec decision: it does **not** auto-exit
when the last card is deselected — only the cancel button (or Task 4's
hardware back) exits it. Add the new i18n keys.

**Acceptance criteria:**
- [ ] Toolbar renders in place of the FAB whenever selection mode is active;
      FAB renders otherwise (no regression on add-pet flow).
- [ ] Deselecting the only selected card leaves selection mode active with 0
      selected; trash icon is disabled (not pressable) at 0.
- [ ] Select-all checks every pet; tapping again unchecks all (stays in
      selection mode, per spec decision).
- [ ] Cancel (X) clears `selectedIds` and exits selection mode; no store
      call.
- [ ] Trash tap with N > 0 selected → one `Alert.alert` with a destructive
      button naming the count (`pets.delete_confirm_many`); confirming calls
      `usePetsStore().removeMany` with exactly the selected ids; canceling
      calls neither `removeMany` nor changes selection.
- [ ] New i18n keys added to `fa.json`: `pets.select_mode.selected_count`,
      `pets.select_mode.select_all`, `pets.delete_confirm_many` (reuse
      `common.cancel` and `pets.delete` — no duplicate keys for those).

**Verification:**
- [ ] `npx jest src/__tests__/PetsListScreen.test.tsx` — toolbar/select-all/
      delete tests green, Phase 2 tests still green.
- [ ] `npm test` — full suite green.
- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Manual: full select → select-all → deselect-all → delete-with-confirm
      flow on device/emulator; verify deleted pets' tasks/photos are gone
      too (spot-check one pet with a photo + an active task).

**Dependencies:** Task 1 (`removeMany`), Task 2 (selection state/toggle).

**Files likely touched:**
- `mobile/src/screens/pets/PetsListScreen.tsx`
- `mobile/src/i18n/fa.json`
- `mobile/src/__tests__/PetsListScreen.test.tsx`

**Estimated scope:** Medium (3 files).

### Checkpoint: Phase 3

- [ ] All spec success criteria 1–6 covered by tests.
- [ ] `tsc --noEmit` clean, jest suite green.
- [ ] Manual end-to-end select → delete flow confirmed, including the
      cleanup cascade (tasks/photo removed with the pet).

### Phase 4: Android back handling + polish

#### Task 4: Hardware back exits selection mode

**Description:** While selection mode is active, intercept Android hardware
back (`BackHandler`) to exit selection mode (same effect as cancel) instead
of leaving the Pets tab. Add `accessibilityState={{ selected }}` /
`accessibilityLabel` polish on the toolbar buttons if not already covered in
Task 3.

**Acceptance criteria:**
- [ ] `hardwareBackPress` while selection mode is active → selection mode
      exits, `selectedIds` clears, screen does not navigate away (mock
      `BackHandler` in the test, assert the listener returns `true` /
      screen still renders `PetsListScreen`, not a navigation call).
- [ ] Hardware back listener is only registered while selection mode is
      active and is cleaned up (`sub.remove()`) on unmount/mode-exit — assert
      no leaked listener (e.g. `addEventListener`/`removeEventListener` call
      counts balance across mode toggles).

**Verification:**
- [ ] `npx jest src/__tests__/PetsListScreen.test.tsx` — new back-handler
      tests green.
- [ ] `npm test` — full suite green.
- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Manual on Android emulator: enter selection mode, press hardware back
      → returns to normal grid browsing, does not leave the Pets tab.

**Dependencies:** Task 3 (selection mode + cancel semantics must exist).

**Files likely touched:**
- `mobile/src/screens/pets/PetsListScreen.tsx`
- `mobile/src/__tests__/PetsListScreen.test.tsx`

**Estimated scope:** Small (2 files).

### Checkpoint: Complete

- [ ] All 7 spec success criteria met.
- [ ] `npx tsc --noEmit` = 0 errors; full `npm test` green.
- [ ] Manual pass on Android emulator: long-press → select/deselect →
      select-all → delete-with-confirm → hardware-back-cancels, all
      confirmed.
- [ ] Ready for review / commit.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `FlatList` + `Pressable` long-press timing flaky in RN Testing Library | Medium | Use `fireEvent(el, "longPress")` directly (matches RNTL convention) rather than timer-based simulation. |
| Toolbar replacing the FAB shifts existing FAB-related tests/snapshots | Low | Grep confirms no existing test asserts on FAB presence unconditionally; only add assertions, don't need to touch existing ones. |
| `removeMany` batch partially fails mid-loop (e.g. file deletion throws) | Low | Same risk profile as existing single `remove` — not newly introduced; out of scope per spec (no new error-recovery infra requested). |
| Select-all with a large pet list feels slow (re-render per toggle) | Low | Pet counts are small (personal pet-care app); no perf work planned unless it's observed on device. |

## Open Questions

None — ready for Phase 3 (Tasks, already embedded above) / Phase 4
(Implement) on approval.
