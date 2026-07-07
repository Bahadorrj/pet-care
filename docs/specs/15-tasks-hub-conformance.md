# 14 — Tasks Hub: Audit Conformance + Completed Section

**Status:** Draft for review · 2026-07-07
**Amends:** `07-today-tasks-tab.md` (row-tap, checked-row placement), ADR-0020 (§4 implementation)
**Requires:** a new reconciling ADR (ADR-0021) — see Deliverables.

## Objective

A design-intent audit (2026-07-07) found four drifts between `TasksScreen` and its
written design, plus two gaps versus enterprise todo apps (Google Tasks class).
This spec closes all six so the Tasks hub behaves like a trustworthy todo app:

1. **Finalized rows vanish** — checking/skipping an Overdue row removes it
   instantly (store recompute + overdue bucket excludes finals), gutting
   spec 09's persistent checkbox-undo exactly where mis-taps matter most.
2. **Filter-emptied sections hide** — ADR-0020 §4 says a section narrowed to
   zero by filters still renders with a "no match" affordance; the code
   filters before bucketing, so the section disappears.
3. **No section collapse** — spec 07 requires collapsible sections
   (in-memory, default expanded); never built.
4. **Row-tap divergence** — spec 07 says row tap opens the action sheet; the
   shipped (and tested) behavior is tap → edit. **Decision: keep tap → edit**
   and reconcile the docs (matches Google Tasks/Todoist).
5. **No postpone** — an overdue item can only be done/skipped/re-scheduled via
   the full edit form. **Decision: quick «به فردا» action in the ⋯ sheet.**
6. **Delete is unguarded** — fires straight from the sheet, no confirm, no
   undo. **Decision: ConfirmDialog with recurring-aware copy.**

Plus one addition (user-confirmed): a **Completed section** — Google Tasks
style, collapsed by default, at the bottom — collecting finalized items.

**Success looks like:** a mis-tapped overdue checkbox is recoverable in place;
filters never make a populated section silently disappear; every section
collapses; overdue one-offs move to tomorrow in two taps; delete can't happen
by accident; finished items remain findable without cluttering the list.

## Behavior

### Completed section (new; supersedes spec 07 "checked rows stay in place")

- Fourth section, rendered **last**: «انجام‌شده» + count, **collapsed by
  default** (all others default expanded). Calm register per ADR-0020 — no
  celebration copy, count in Persian digits like other sections.
- Contains **done and skipped** occurrences with `dueAt < endOfToday` (Tehran),
  within the existing 7-day look-back window. Sorted by `dueAt` descending.
- **On check/skip, the row moves here immediately** (this replaces spec 07's
  "checked rows stay in place until next reload"). The 4s done toast is
  unchanged; additionally the row remains reachable in Completed, where its
  checkbox still toggles back to pending (spec 09 undo now works for overdue
  rows too — the audit's biggest finding).
- Pre-skipped **future** occurrences stay in Upcoming (dimmed), as today.
- Skipped rows keep their «انجام نشده» tag inside Completed.
- Today's progress math is **unchanged**: `done / (done + pending + missed)`,
  skipped excluded, over today's occurrences regardless of which section they
  render in.
- Whole-screen empty state: unchanged (zero occurrences in the window). A
  window with only completed items shows the list with just the Completed
  section, not the empty state.

### Per-section no-match (fixes ADR-0020 §4)

- Genuine emptiness is judged on the **unfiltered** buckets: a section whose
  unfiltered bucket is empty does not render (unchanged).
- A section with unfiltered items but zero **filtered** items renders its
  header (count «۰») plus one quiet no-match row (`tasks.no_match_section`).
- The whole-list no-match + clear-filters block stays for the case where every
  section is filtered to zero.

### Collapsible sections (implements spec 07 as written)

- Section header becomes a toggle: chevron + existing title/count. In-memory
  `useState` only — no persistence. Default: expanded, except Completed
  (collapsed).
- Collapsed = the section's rows are omitted from the list data; header stays.
- Header toggle is accessible: `accessibilityRole="button"`,
  `accessibilityState={{ expanded }}`.

### Postpone («به فردا»)

- New ⋯-sheet action, inserted before Skip, shown **only** for `one_off` tasks
  whose occurrence is not final and not future (i.e. Overdue or Today rows).
- Effect: `updateTask` with `schedule.at` moved to **tomorrow (Tehran) at the
  same wall-clock time**. Existing validation + notification re-sync apply.
- Recurring tasks don't get postpone (skip remains their escape hatch); no
  per-occurrence override model is introduced.

### Delete confirmation

- ⋯-sheet Delete now opens the existing `ConfirmDialog` primitive instead of
  deleting immediately. Copy is recurring-aware (reuse the sheet's existing
  `delete_recurring` / `delete_one_off` distinction); confirm button is the
  destructive style. No undo machinery.

### Row tap (docs-only reconciliation)

- Behavior unchanged: row body → edit form, ⋯ → sheet. ADR-0021 records the
  decision; spec 07's row-action table gets a superseded note.

## Tech Stack

Existing only — Expo SDK 56 / React Native / TypeScript / Zustand / jest-expo.
No new dependencies. No backend changes (tasks are offline-first, ADR-0016).

## Commands

```bash
cd mobile
npx tsc --noEmit                              # gate: 0 errors
npm test                                      # full jest suite
npx jest src/__tests__/TasksScreen.test.tsx   # screen tests
npx jest src/__tests__/todayBuckets.test.ts   # pure bucketing tests
```

## Project Structure (touched files)

```
mobile/src/screens/tasks/todayBuckets.ts       → + completed bucket
mobile/src/screens/tasks/TasksScreen.tsx       → completed section, collapse,
                                                 per-section no-match, postpone
                                                 action, delete ConfirmDialog
mobile/src/i18n/fa.json                        → + tasks.section.completed,
                                                 tasks.action.postpone,
                                                 tasks.no_match_section,
                                                 tasks.delete.confirm_* keys
mobile/src/__tests__/todayBuckets.test.ts      → completed-bucket cases
mobile/src/__tests__/TasksScreen.test.tsx      → new behavior cases
docs/adrs/0021-*.md                            → reconciling ADR (new)
docs/specs/07-today-tasks-tab.md               → superseded notes (row tap,
                                                 checked-row placement)
docs/adrs/README.md                            → index ADR-0021
```

Store (`tasksStore.ts`) is expected to need **no change** — postpone uses
`updateTask`, undo uses `unmarkOccurrence`, both existing.

## Code Style

Match `TasksScreen.tsx` as it stands: theme tokens only, flat i18n keys,
`React.memo` rows with stable `useCallback` handlers, testIDs on every
interactive element, Persian digits via `toPersianDigits`. Bucketing changes
stay in the pure helper (no I/O, no RN imports):

```ts
export interface BucketResult {
  overdue: Occurrence[];
  today: Occurrence[];      // non-final today occurrences
  upcoming: Occurrence[];
  completed: Occurrence[];  // done/skipped, dueAt < endOfToday, desc
}
```

Progress derivation moves alongside the buckets so "unchanged math" is a
tested property, not a screen-side accident.

## Testing Strategy

jest-expo + @testing-library/react-native in `src/__tests__/`; assertions via
`i18n.t(key)` / fixture data, never Persian literals. Cover:

- **Buckets (pure):** past done → completed (not dropped); past skipped →
  completed; today done/skipped → completed; future pre-skipped → upcoming;
  completed sorted desc; overdue/today/upcoming otherwise unchanged;
  progress math identical before/after for the same fixtures.
- **Screen:** checking an overdue row keeps it on screen (moves to Completed,
  expandable, checkbox reverts it); Completed header renders collapsed with
  count; expanding reveals rows; each section header toggles its rows;
  pet-filter that empties only one populated section renders that section's
  header + no-match row (and count ۰) while other sections render normally;
  postpone appears in the sheet only for non-future one-off rows and calls
  `updateTask` with tomorrow-same-time `at`; postpone absent for recurring
  and upcoming rows; Delete opens ConfirmDialog — confirm calls `deleteTask`,
  cancel does not; existing suites stay green.
- `npx tsc --noEmit` — 0 errors.

## Boundaries

- **Always:** `tsc --noEmit` 0 errors + `npm test` green before done; derive
  everything at query time (no materialised status); calm register — no
  praise copy, no Alert Brick outside destructive labels (the ConfirmDialog
  destructive button is a permitted use); ship the ADR + spec-07 reconciliation
  in the same change as the behavior.
- **Ask first:** any `tasksStore` API addition, any change to `taskSchedule.ts`
  engine semantics, any new dependency, any per-occurrence override model.
- **Never:** backend/API changes; swipe gestures; streak/adherence surfacing;
  a someday/undated bucket; removing the 7-day look-back cap; praise/cheer
  copy anywhere in task feedback.

## Success Criteria

1. Checking or skipping an Overdue/Today row never makes it vanish — it moves
   to the Completed section, where its checkbox reverts it to pending.
2. Completed section renders last, collapsed by default, correct count,
   done + skipped (past + today) items, desc order.
3. Every section header toggles collapse; state resets on remount; a11y
   `expanded` state exposed.
4. A section emptied only by filters still renders (header + no-match row);
   a genuinely empty section still renders nothing.
5. «به فردا» moves a non-future one-off occurrence to tomorrow, same Tehran
   wall-clock time; hidden for recurring/future/final rows.
6. Delete requires a ConfirmDialog confirmation; cancel is a no-op.
7. Today progress numbers are byte-identical to before for the same data.
8. ADR-0021 exists (row tap → edit; Completed supersedes stay-in-place;
   ADR-0020 §4 clarified), spec 07 carries superseded notes, ADR index synced.
9. `npx tsc --noEmit` = 0 errors; full jest suite green.

## Open Questions

None — the four scope decisions (keep tap→edit, quick postpone, ConfirmDialog,
include Completed section) were confirmed by interview on 2026-07-07.
