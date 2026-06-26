# Spec: Undo Task Completion

## Objective

Let a user revert a task occurrence from a final state (`done` or `skipped`)
back to `pending` in the Tasks tab. This recovers from a mistaken check —
the user taps a task's checkbox by accident and wants it un-done.

**Already exists:** the store action `unmarkOccurrence(taskId, dueAt)` (removes
the log via `removeLog`), and a 4-second undo Toast shown right after marking
done (`handleCheck` in `TasksScreen.tsx`). The gap is **persistent** undo —
once the Toast expires there is no way to revert a finalised occurrence except
deleting the whole task.

**Success looks like:** tapping the leading checkbox of a `done` or `skipped`
occurrence returns it to `pending`, with the same haptic + animation language
as marking done. No new UI surface, no new store action.

## Tech Stack

Mobile only (Expo SDK 56, React Native, TypeScript, Zustand). No backend
change — tasks are offline-first local SQLite (ADR-0016). Occurrence status is
**derived** from rule + logs at query time, never materialised.

## Commands

```bash
cd mobile
npx jest src/__tests__/TasksScreen.test.tsx   # affected test file
npm test                                       # full jest suite
npx tsc --noEmit                               # typecheck gate (must be 0 errors)
```

## Project Structure

```
mobile/src/screens/tasks/TasksScreen.tsx   → checkbox handler (handleCheck)
mobile/src/store/tasksStore.ts             → unmarkOccurrence (exists, unchanged)
mobile/src/i18n/fa.json                     → undo affordance label
mobile/src/__tests__/TasksScreen.test.tsx   → tests
```

## Code Style

Reuse the existing toggle pattern. `handleCheck` currently early-returns on a
final status; instead branch to unmark:

```tsx
function handleCheck(occ: Occurrence) {
  const { task, dueAt, status } = occ;
  if (status === 'done' || status === 'skipped') {
    hapticLight();
    unmarkOccurrence(task.id, dueAt);   // → back to pending
    return;
  }
  hapticSuccess();
  markOccurrence(task.id, dueAt, 'done');
  Toast.show({ /* existing 4s undo toast — unchanged */ });
}
```

`accessibilityLabel` on the checkbox already flips on `isDone`; extend it so a
final occurrence announces the undo action (currently a `skipped` row reads the
generic `mark_done`).

## Testing Strategy

jest-expo + @testing-library/react-native, in `src/__tests__/`. Cover:

- Tap checkbox of a `done` occurrence → `unmarkOccurrence` called with its
  `(taskId, dueAt)`; `markOccurrence` not called.
- Tap checkbox of a `skipped` occurrence → same unmark path.
- Tap checkbox of a `pending` occurrence → still marks done (no regression).
- Checkbox `accessibilityState.checked` / label reflects the revert affordance.

## Boundaries

- **Always:** run `tsc --noEmit` + jest before commit; keep status derivation
  (no materialised status); reuse existing store action and toast.
- **Ask first:** any new store action, new menu entry, new i18n namespace, or
  touching the schedule/log DB layer.
- **Never:** add a backend endpoint; materialise occurrence status to storage;
  introduce a second undo surface (⋯ menu) — checkbox toggle is the sole
  affordance (decided).

## Success Criteria

1. Tapping a `done` checkbox reverts it to `pending` (icon → blank circle,
   row un-dims) — verified by test + manual.
2. Tapping a `skipped` checkbox reverts it to `pending` — verified by test.
3. Tapping a `pending` checkbox still marks `done` with the 4s toast — no
   regression.
4. Reverted occurrence's checkbox is reachable by screen reader with an
   undo-appropriate label.
5. `npx tsc --noEmit` = 0 errors; jest suite green.

## Decisions (resolved)

- **Affordance:** tap the leading checkbox to toggle off. No ⋯-menu entry, no
  new component.
- **Scope:** both `done` and `skipped` revert to `pending` (symmetric).

## Open Questions

None — ready for Phase 2 (Plan).
