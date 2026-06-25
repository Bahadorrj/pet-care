# Implementation Plan: Unified Task-Add Route

Implements `docs/specs/08-unified-task-add.md`.

## Overview

Collapse two task-creation flows into one: the Tasks-tab FAB opens the full
`TaskFormScreen`, which gains a multi-select pet picker (add mode) and shows a
read-only pet name (edit mode). `QuickAddScreen` and the pet-detail add button
are removed. N selected pets → N independent `addTask` calls.

## Architecture Decisions

- **`petId` param becomes optional**, not a new param shape. Add mode supplies
  pets from the picker; edit mode derives the pet from the existing task.
- **No task-group model.** Multi-pet = a loop over the existing single-`petId`
  `addTask`. The N tasks are unrelated afterward.
- **Pet picker reuses `weekdays` multi-select pattern** already in the file —
  same chip styles, same toggle shape. No new component.

## Dependency Graph

```
T1 i18n keys ─┐
T2 param opt ─┼─→ T3 TaskForm (picker + loop) ──→ Checkpoint A
              └─→ T4 FAB repoint ─┐
T5 pet-detail (independent) ──────┼─→ T6 delete QuickAdd ──→ Checkpoint B
                                  ┘
```

T4 must precede T6 (FAB must stop navigating to `QuickAdd` before the route is
deleted, or the param type breaks). T5 is independent.

## Task List

### Phase 1: Foundation

#### Task 1: Add i18n keys
**Description:** Add the two new Persian strings the form needs.
**Acceptance criteria:**
- [ ] `tasks.field.pet` and `tasks.error.pet_required` exist in `fa.json`.
**Verification:**
- [ ] `npx tsc --noEmit` clean (no usage yet, just keys).
**Dependencies:** None
**Files:** `mobile/src/i18n/fa.json`
**Scope:** XS

#### Task 2: Make `petId` optional on the TaskForm route
**Description:** Loosen the `TaskForm` param in both stacks so add mode can open
with no pet.
**Acceptance criteria:**
- [ ] `TaskForm: { petId?: string; taskId?: string; title?: string }` in both
      `PetsStack` and `TasksStack`.
**Verification:**
- [ ] `npx tsc --noEmit` — expect the only new error to be inside
      `TaskFormScreen` (fixed in T3); no errors elsewhere.
**Dependencies:** None
**Files:** `mobile/src/navigation/PetsStack.tsx`, `mobile/src/navigation/TasksStack.tsx`
**Scope:** XS

### Phase 2: Core form

#### Task 3: Pet picker + multi-pet submit in TaskFormScreen
**Description:** Add the multi-select pet picker as the first field in add mode;
show read-only pet name in edit mode; loop `addTask` over selected pets.
**Acceptance criteria:**
- [ ] Add mode renders a multi-select pet picker at the top; sole pet
      pre-selected; ≥1 required (else `tasks.error.pet_required`, no `addTask`).
- [ ] Submitting with N pets calls `addTask` N times, same payload, distinct `petId`.
- [ ] Edit mode renders the owning pet's name read-only, no picker.
**Verification:**
- [ ] `npx jest src/__tests__/TaskFormScreen.test.tsx` green (incl. new 2-pet,
      empty-selection, and edit-mode-name cases).
- [ ] `npx tsc --noEmit` clean.
**Dependencies:** T1, T2
**Files:** `mobile/src/screens/tasks/TaskFormScreen.tsx`,
`mobile/src/__tests__/TaskFormScreen.test.tsx`
**Scope:** M

### Checkpoint A
- [ ] `tsc --noEmit` clean; `TaskFormScreen.test` green.
- [ ] Manual: FAB still opens QuickAdd (untouched) — app runs.

### Phase 3: Repoint entries, delete QuickAdd

#### Task 4: FAB opens TaskForm
**Description:** Repoint both FAB callsites from `QuickAdd` to `TaskForm` (add mode).
**Acceptance criteria:**
- [ ] Both `navigation.navigate('QuickAdd')` (lines ~275, ~480) → `navigate('TaskForm')`.
**Verification:**
- [ ] `npx jest src/__tests__/TasksScreen.test.tsx` green (FAB → `TaskForm`).
**Dependencies:** T2, T3
**Files:** `mobile/src/screens/tasks/TasksScreen.tsx`, `mobile/src/__tests__/TasksScreen.test.tsx`
**Scope:** S

#### Task 5: Remove pet-detail add button
**Description:** Delete the `petdetail-add-task` Pressable; keep the task list.
**Acceptance criteria:**
- [ ] No add button on pet detail; task list and "edit task" tap still work.
**Verification:**
- [ ] `npx jest src/__tests__/PetDetailScreen.test.tsx` green (no add button, list renders).
**Dependencies:** None
**Files:** `mobile/src/screens/pets/PetDetailScreen.tsx`, `mobile/src/__tests__/PetDetailScreen.test.tsx`
**Scope:** S

#### Task 6: Delete QuickAdd + dead i18n
**Description:** Remove the screen, its route registration + `QuickAdd` param, its
test, and the now-unused `tasks.quick.*` keys.
**Acceptance criteria:**
- [ ] `QuickAddScreen.tsx`, `QuickAddScreen.test.tsx` deleted; `QuickAdd` removed
      from `TasksStack` (import, `<Stack.Screen>`, param type).
- [ ] All 7 `tasks.quick.*` keys removed from `fa.json`.
**Verification:**
- [ ] `npx tsc --noEmit` clean; `grep -r QuickAdd src` → no hits.
**Dependencies:** T4
**Files:** `mobile/src/screens/tasks/QuickAddScreen.tsx` (del),
`mobile/src/__tests__/QuickAddScreen.test.tsx` (del),
`mobile/src/navigation/TasksStack.tsx`, `mobile/src/i18n/fa.json`
**Scope:** S

### Checkpoint B (Complete)
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm test` fully green.
- [ ] `grep -r QuickAdd mobile/src` → no hits.
- [ ] All spec success criteria met; ready for review.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Edit-mode pet lookup misses if pet deleted | Low | Fall back to blank/`existing.petId`; pets in store are the live set, edit reached only from existing task. |
| `petId` optional leaks an `undefined` into `addTask` | Med | T3 guards: submit blocked unless ≥1 pet selected; add path always passes a concrete id from the loop. |
| Partial failure mid-loop (task 2 of 3 throws) | Low | Accept per spec — surface generic error, no rollback; matches current single-add path. |

## Open Questions

None — intent + spec confirmed (2026-06-25).
