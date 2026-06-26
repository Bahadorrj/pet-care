# Implementation Plan: Undo Task Completion

Spec: `docs/specs/09-undo-task-completion.md`

## Overview

Make a finalised task occurrence (`done` or `skipped`) revert to `pending` by
tapping its leading checkbox. The store action (`unmarkOccurrence`) and the 4s
undo toast already exist; this plan wires the **persistent** affordance into
`handleCheck` and updates the two existing tests that assert the old
"checkbox on a final row does nothing" behaviour, plus adds revert tests.

Single vertical slice, mobile-only, no DB/backend/store change.

## Architecture Decisions

- **Checkbox is the sole undo surface.** No ⋯-menu entry, no new component —
  smallest diff, mirrors the existing mark-done affordance (spec decision).
- **Both `done` and `skipped` revert.** `handleCheck` branches on
  `isFinal = status === 'done' || status === 'skipped'` → `unmarkOccurrence`,
  else marks done (spec decision).
- **No new store action.** Reuse `unmarkOccurrence(taskId, dueAt)`.
- **TDD.** Flip/extend the existing TasksScreen tests first (they encode the
  old behaviour and will fail), then change `handleCheck`.

## Task List

### Phase 1: Behaviour change (one slice)

#### Task 1: Update tests for checkbox revert

**Description:** Convert the two tests that lock in the old "does nothing"
behaviour and add the revert assertions. Existing fixtures `OCC_DONE`
(`task-done`) and `OCC_SKIPPED` (`task-skipped`) already exist.

**Acceptance criteria:**
- [ ] Test: checkbox on `done` row → `mockUnmarkOccurrence` called with
      `('task-done', OCC_DONE.dueAt)`; `mockMarkOccurrence` NOT called.
- [ ] Test: checkbox on `skipped` row → `mockUnmarkOccurrence` called with
      `('task-skipped', OCC_SKIPPED.dueAt)`.
- [ ] Existing `pending`-row test (line ~177: marks done + shows toast) left
      intact — no regression.
- [ ] Old assertions at lines ~203 ("already-done … does nothing") and ~342
      ("skipped … does nothing") are replaced, not duplicated.

**Verification:**
- [ ] `npx jest src/__tests__/TasksScreen.test.tsx` — new revert tests FAIL
      (red) before Task 2, since `handleCheck` still early-returns.

**Dependencies:** None.

**Files likely touched:**
- `mobile/src/__tests__/TasksScreen.test.tsx`

**Estimated scope:** Small (1 file).

#### Task 2: Branch `handleCheck` to unmark on final status

**Description:** In `TasksScreen.tsx`, replace the early-return-on-final at the
top of `handleCheck` with an unmark branch (light haptic + `unmarkOccurrence`).
Extend the checkbox `accessibilityLabel` so a finalised row announces the undo
action instead of the generic `mark_done`.

**Acceptance criteria:**
- [ ] `handleCheck`: when `status` is `done` or `skipped` → `hapticLight()` +
      `unmarkOccurrence(task.id, dueAt)` + return; otherwise existing
      mark-done + toast path unchanged.
- [ ] Checkbox `accessibilityLabel` reflects undo when the row is final
      (reuse `tasks.undo.*`; if no fitting key exists, this is the one
      ask-first i18n addition — confirm before adding).
- [ ] No change to `tasksStore.ts`, the DB layer, or the toast logic.

**Verification:**
- [ ] `npx jest src/__tests__/TasksScreen.test.tsx` — green.
- [ ] `npm test` — full suite green.
- [ ] `npx tsc --noEmit` — 0 errors.
- [ ] Manual: tap a done row's checkbox → icon returns to blank circle, row
      un-dims; tap a skipped row's checkbox → returns to pending.

**Dependencies:** Task 1.

**Files likely touched:**
- `mobile/src/screens/tasks/TasksScreen.tsx`
- `mobile/src/i18n/fa.json` (only if a new a11y label key is approved)

**Estimated scope:** Small (1–2 files).

### Checkpoint: Complete

- [ ] All spec success criteria (1–5) met
- [ ] `tsc --noEmit` clean, jest green
- [ ] Manual done→pending and skipped→pending confirmed
- [ ] Ready for review / commit

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Other tests assume final checkbox is inert | Low | Grep'd: only the two named tests (lines ~203, ~342) assert it; both updated in Task 1. |
| Accidental double-tap re-marks done after undo | Low | Acceptable — second tap just re-marks done, same as fresh. No guard needed. |
| a11y label needs a new i18n key | Low | Flagged ask-first; reuse `tasks.undo.action` ("لغو") if a new key isn't wanted. |

## Open Questions

- a11y checkbox label for a final row: reuse existing `tasks.undo.*` or add one
  new key? (Confirm during Task 2 — only net-new string in the change.)
