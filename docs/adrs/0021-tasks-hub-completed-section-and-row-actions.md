# ADR-0021: Tasks hub — Completed section, row-tap→edit, per-section no-match, quick postpone, delete confirmation

## Status
Accepted

## Date
2026-07-07

## Context

A conformance audit of the Tasks hub against `docs/specs/07-today-tasks-tab.md`
and ADR-0020 found six gaps between the shipped implementation, the specs, and
industry-standard task-hub behavior (Google Tasks / Todoist):

- Checking or skipping an **Overdue** or **Today** row made it vanish from the
  hub until the next reload (spec 07's "checked rows stay in place until next
  reload" only holds within a single render pass) — finalized rows had no
  durable home, and spec 09's checkbox-undo affordance was unreachable for
  overdue rows once the row was gone.
- Row body tap already navigates straight to edit (shipped and tested), while
  spec 07 still documents tap-on-row as opening the action sheet — a
  stale-spec/live-code divergence never recorded.
- A pet/type filter that emptied one section (but not others) hid that
  section's header entirely, though ADR-0020 §4 intended filter-emptied
  sections to stay legible with a "no match" affordance — the gate was
  accidentally judged on the **filtered** bucket instead of the **genuine**
  (unfiltered) one.
- No quick way to move a stale overdue one-off task to tomorrow without
  opening the full edit form.
- Delete was instant from the row menu — no confirmation, unlike the rest of
  the app's destructive-action pattern (`ConfirmDialog`, see `PetDetailScreen`).
- Collapsible sections were speculative-but-unbuilt: a Completed section
  needs a collapse affordance so it doesn't dominate the hub by default.

## Decision

1. **Row tap → edit (canonized).** Tapping a row body navigates to
   `TaskFormScreen` for that occurrence's task; the ⋯ button remains the
   entry point for Skip / Postpone / Edit / Pause / Delete. This matches
   Google Tasks and Todoist and is already shipped and tested — spec 07's
   tap→sheet description is superseded, not reverted.
2. **Completed section.** Finalized occurrences (`done` or `skipped`) with a
   `dueAt` in the 7-day look-back window through today — past **and**
   today's — move into a fourth section, **Completed**, sorted by `dueAt`
   descending (most recent first), instead of staying in place in
   Overdue/Today or silently dropping off. The section is
   **collapsed by default** (Google Tasks pattern) so it doesn't dominate the
   hub; its rows keep the same checkbox, which still calls `unmarkOccurrence`
   — restoring spec 09's undo affordance for overdue rows that was lost once
   a finalized row left the visible bucket. Today's progress numbers
   (`done`/`total`) are computed before the today/completed split, so moving
   finalized rows out of the `today` bucket does not change the count.
3. **Genuine-vs-filtered empty gate (ADR-0020 §4 clarified).** A section's
   header renders when its **genuine** (pre-filter) bucket is non-empty,
   regardless of whether active filters have narrowed its **shown** data to
   zero. A filter-emptied section keeps its header (count `۰`) with a quiet
   inline "no match" row, instead of disappearing — this was ADR-0020's
   original intent; the gate was implemented against the wrong (filtered)
   bucket. The whole-list "no tasks match" block is unchanged: it still
   covers the case where filters wipe out every section at once.
4. **Quick postpone «به فردا».** The ⋯ sheet gains a **Postpone** entry for
   one-off, non-final, non-future occurrences (`tehranDayOffset(dueAt) <= 0`)
   — overdue or today one-off tasks only. Choosing it reschedules the task's
   `one_off` `at` to tomorrow (relative to now) at the same Tehran wall-clock
   time, via `updateTask`. There is no per-occurrence override model for
   recurring tasks, so postpone does not apply to `daily_times`/other
   recurring schedules — editing the task is the path for those.
5. **Delete requires confirmation.** Choosing Delete from the ⋯ sheet opens a
   `ConfirmDialog` (the same primitive `PetDetailScreen` uses) instead of
   deleting immediately. The message is recurring-aware
   (`tasks.delete_confirm_recurring` vs `tasks.delete_confirm`); the dialog's
   destructive-red confirm button is a **permitted Alert Brick use** — ADR-0020
   reserves Alert Brick for errors and destructive-action labels, and a
   delete-confirmation button is exactly that, not a repurposed warning.
6. **Collapsible sections.** Every section (Overdue / Today / Upcoming /
   Completed) gets a `Pressable` header with a chevron and
   `accessibilityState.expanded`; collapse state is in-memory only (matches
   spec 07's existing "in-memory, default expanded" line for the three
   original sections). Completed defaults to **collapsed**; the other three
   default to **expanded**, unchanged from before.

## Alternatives Considered

### Revert row-tap to open the action sheet (match the stale spec)
- Pros: spec 07 stays literally correct without an ADR.
- Cons: the sheet-on-tap behavior was never shipped this way — tap→edit is
  already live, tested, and matches the industry-standard pattern users
  expect. Reverting would be a regression with no upside. Rejected.

### Keep "checked rows stay in place until reload," no Completed section
- Pros: no new section, smaller diff.
- Cons: leaves spec 09's undo affordance broken for any row that survives
  past the current render (the common case — most completions happen away
  from the moment of a fresh load), and conflicts with the Google Tasks-style
  hub behavior the interview (2026-07-07) confirmed as the target. Rejected.

### Undo-toast delete (soft-delete + "Undo" toast) instead of a confirm dialog
- Pros: one fewer tap for the common case; matches the done/skip toast pattern.
- Cons: would require resurrecting a deleted task **and** its log rows within
  the toast window — a materially bigger change to `deleteTask` than a
  confirmation gate, for a destructive, comparatively rare action. A
  `ConfirmDialog` (already used for pet deletion) is simpler and consistent.
  Rejected.

## Consequences

- `mobile/src/screens/tasks/todayBuckets.ts`: `BucketResult` gains `completed`
  and `progress`; the loop routes finalized occurrences (past and today) into
  `completed` instead of `today`/`continue`; a new pure `tomorrowSameTime`
  helper backs the postpone calculation.
- `mobile/src/screens/tasks/TasksScreen.tsx`: a fourth `SectionKind`
  (`"completed"`), dual genuine/shown bucketing for the per-section no-match
  rule, an `entries`-array-driven ⋯ sheet (so the conditional postpone entry
  can't skew the destructive/cancel indices), and a `ConfirmDialog` replacing
  the immediate `deleteTask` call.
- `docs/specs/07-today-tasks-tab.md` is reconciled: the row-action table notes
  tap→edit per this ADR; the "checked rows stay in place" line is marked
  superseded; the empty-section paragraph points at the genuine-vs-filtered
  clarification above.
- `mobile/CLAUDE.md`'s Tasks paragraph now describes four buckets
  (overdue/today/upcoming/completed) and the pre-filter genuine-empty gate.

## Guardrails

**Always**
- Route finalized (`done`/`skipped`) occurrences within the 7-day look-back
  into the Completed section — never drop them and never leave them in
  place in Overdue/Today past the render that finalized them.
- Judge a section's genuine-empty gate against its **unfiltered** bucket;
  render a filter-emptied (but genuinely non-empty) section with a no-match
  row, not a hidden header.
- Keep the Completed section calm-register (ADR-0020) — no celebratory copy,
  no accent color beyond the existing done-checkbox/progress-dot exception.
- Require `ConfirmDialog` confirmation before any task delete; never wire a
  destructive action straight to `deleteTask`/`deleteChore`.
- Keep postpone scoped to one-off, non-final, non-future occurrences only —
  never mutate a recurring task's `schedule` via postpone.

**Ask first**
- Before changing the Completed section's default collapse state or sort
  order.
- Before adding a per-occurrence override model for recurring-task postpone.

**Never**
- Never revert row-tap back to opening the action sheet without a new ADR.
- Never let a conditional ⋯-sheet entry (like postpone) be wired by a
  hardcoded numeric index — derive destructive/cancel indices from the
  entries array.
