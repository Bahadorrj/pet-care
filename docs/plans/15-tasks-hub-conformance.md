# Tasks Hub Conformance + Completed Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Implements:** `docs/specs/15-tasks-hub-conformance.md`
**Goal:** Close the six audit findings — finalized rows move to a new Completed section (never vanish), per-section filter no-match, collapsible sections, quick postpone «به فردا», delete confirmation, and the row-tap/docs reconciliation (ADR-0021).

**Architecture:** Mobile-only, no schema changes, no new dependencies, no store changes. The pure bucketing helper (`todayBuckets.ts`) gains a `completed` bucket, a `progress` field (so the "unchanged math" invariant is tested, not accidental), and a pure `tomorrowSameTime` postpone calculator. `TasksScreen.tsx` gains the fourth section, collapse state, dual (genuine/filtered) bucketing for per-section no-match, a `{label, onPress}[]`-driven action sheet, and a `ConfirmDialog` for delete. Docs work adds ADR-0021 and reconciles spec 07 + mobile/CLAUDE.md.

**Tech Stack:** Expo SDK 56 / React Native, TypeScript, Zustand, jest-expo + @testing-library/react-native, i18next (fa only, flat keys).

## Global Constraints

- After every task: `npx tsc --noEmit` → 0 errors, `npm test` → green. Run from `mobile/`.
- Every intermediate state (after each task) keeps the full suite green — tasks are ordered so no task breaks a test another task fixes.
- All user-facing strings in `mobile/src/i18n/fa.json` (flat keys); tests assert via `i18n.t("key")`, never Persian literals. تو voice, calm register (ADR-0020): no praise copy, no Alert Brick outside destructive labels.
- Theme tokens only; `Start`/`End` RTL styles; Tehran = fixed +03:30; derive at query time, never materialise (ADR-0016).
- Jest: `mock`-prefixed vars in `jest.mock` factories; `await render(...)`; screen-test date fixtures relative to `Date.now()`.
- Commits: `type(scope): summary`, scope `mobile.tasks` / `docs`, Claude co-author trailer.

## i18n Key Delta

**Added:**

| Key | Value |
|---|---|
| `tasks.section.completed` | `انجام‌شده` |
| `tasks.action.postpone` | `به فردا` |
| `tasks.no_match_section` | `موردی مطابق فیلترها نیست` |
| `tasks.delete_confirm_recurring` | `مطمئنی می‌خواهی این کار و همه تکرارهای آن را حذف کنی؟` |

**Reused (already present):** `tasks.delete` (dialog title), `tasks.delete_confirm` (one-off message), `tasks.action.delete` (confirm label), `common.cancel`, `tasks.no_match`.

**Removed:** none.

---

### Task 1: `completed` bucket (additive) + `progress` in the pure helper

**Files:**
- Modify: `mobile/src/screens/tasks/todayBuckets.ts`
- Test: `mobile/src/__tests__/todayBuckets.test.ts`

**Interfaces:**
- Produces: `BucketResult` gains `completed: Occurrence[]` and `progress: { done: number; total: number }`. In **this task** `completed` collects only **past** finalized occurrences (currently dropped by the `continue`); today's finalized stay in `today` so the screen is untouched and stays green. Task 3 moves today's finals over.
- `progress` = over occurrences with a **today** dueAt: `total` = count(status ≠ skipped), `done` = count(status = done) — byte-identical to the screen's current math.

- [x] **Step 1: Failing tests** — past done → in `completed`, not dropped; past skipped → in `completed`; completed older than the 7-day look-back → dropped; `completed` sorted by `dueAt` **descending**; today done → still in `today` (this task); `progress` matches hand-computed done/total for a mixed fixture (pending + done + skipped + missed today); existing bucket cases unchanged.
- [x] **Step 2: Run** `npx jest src/__tests__/todayBuckets.test.ts` — expect FAIL (no `completed` field).
- [x] **Step 3: Implement** — in the loop's past branch, push finals (within look-back) to `completed` instead of `continue`; compute `progress` from the `today` bucket before returning; sort `completed` desc.
- [x] **Step 4: Run** the file, then `npm test` + `npx tsc --noEmit` — all green.
- [x] **Step 5: Commit** `feat(mobile.tasks): completed bucket for past finalized occurrences + progress derivation in the bucketing helper`

---

### Task 2: Collapsible section headers

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx`
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Produces: header-toggle pattern (`Pressable` header + chevron + `accessibilityState={{ expanded }}`) and a `collapsed: Record<SectionKind, boolean>` state that Task 3's Completed section plugs into (with `true` as its default). Collapsed = section keeps its header, contributes no rows.

- [x] **Step 1: Failing tests** — pressing `tasks-section-today` hides that section's rows (`queryByTestId("tasks-row-…") → null`) while other sections' rows stay; pressing again restores; header exposes `accessibilityState.expanded` flipping.
- [x] **Step 2: Run** `npx jest src/__tests__/TasksScreen.test.tsx -t "collapse"` — expect FAIL.
- [x] **Step 3: Implement** — `useState<Record<SectionKind, boolean>>({ overdue: false, today: false, upcoming: false })`; in the sections memo, `data: collapsed[key] ? [] : items` (header still renders — SectionList calls `renderSectionHeader` for empty-data sections); header becomes a `Pressable` with `accessibilityRole="button"`, `accessibilityState={{ expanded: !collapsed[key] }}`, chevron icon (`chevron-up`/`chevron-down`, `colors.inkMuted`); collapse state stays in the sections-memo dependency array.
- [x] **Step 4: Run** the file + `npx tsc --noEmit` — green / 0 errors.
- [x] **Step 5: Commit** `feat(mobile.tasks): collapsible section headers — in-memory, default expanded, a11y expanded state`

---

### Task 3: Completed section — finalized rows move, never vanish

**Files:**
- Modify: `mobile/src/screens/tasks/todayBuckets.ts` (today's finals → `completed`)
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx` (render 4th section)
- Modify: `mobile/src/i18n/fa.json` (`tasks.section.completed`)
- Test: `mobile/src/__tests__/todayBuckets.test.ts`, `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1's `completed`/`progress`, Task 2's collapse map.
- Produces: `SectionKind` gains `"completed"`; `today` bucket now holds **non-final** occurrences only; future pre-skipped stay in `upcoming`. This is the spec's headline behavior: checking/skipping an Overdue/Today row moves it to Completed where its checkbox still reverts it (spec 09 undo restored for overdue rows).

- [x] **Step 1: Failing helper tests** — today done/skipped → in `completed` (not `today`); `progress` unchanged for the same mixed fixture (the invariant: moving finals out of `today` must not change the numbers — adjust the derivation to compute over all today-dueAt occurrences, both buckets).
- [x] **Step 2: Failing screen tests** — a done today occurrence renders under `tasks-section-completed` (expand it first: header starts collapsed), not under today; Completed header shows count in Persian digits; section starts collapsed (`accessibilityState.expanded === false`, no rows until pressed); tapping the checkbox of a done row inside Completed calls `unmarkOccurrence`; a **skipped upcoming** occurrence still renders under upcoming; window holding only completed items renders the list (Completed section), **not** `tasks-empty`.
- [x] **Step 3: Run** both files — expect FAIL.
- [x] **Step 4: Implement** — helper: today-final push to `completed` (keep desc sort; today-dueAt finals and past finals interleave by `dueAt`); progress computed from all today-dueAt occurrences pre-split. Screen: `SectionKind` union += `"completed"`; collapse state gains `completed: true`; sections memo pushes Completed **last** when `completed.length > 0`; `counts.completed`; screen's progress lines switch to `buckets.progress`; whole-screen empty gate stays `allBucketsEmpty && !hasFilters` with `completed` included in `allBucketsEmpty` (a window with only completed items is **not** empty); rows in Completed get `future={false}`.
- [x] **Step 5: Run** both files, `npm test`, `npx tsc --noEmit` — all green. Existing tests asserting done rows dimmed in place will need their queries pointed at the Completed section (expand first).
- [x] **Step 6: Commit** `feat(mobile.tasks): completed section — finalized rows move to a collapsed-by-default section instead of vanishing, checkbox undo works from there`

---

### Checkpoint: Core (after Tasks 1–3)

- [x] `npm test` green, `npx tsc --noEmit` 0 errors.
- [ ] Manual smoke (`npx expo run:android`): check an **overdue** row → it moves into Completed (visible after expanding), checkbox there reverts it; progress numbers identical before/after this feature for the same data.
- [x] Review with human before proceeding — approved via /build auto checkpoint.

---

### Task 4: Per-section no-match (genuine vs filtered buckets)

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx`
- Modify: `mobile/src/i18n/fa.json` (`tasks.no_match_section`)
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: `bucketOccurrences` run twice — `genuine = bucket(windowOccurrences)`, `shown = hasFilters ? bucket(filtered) : genuine` (window is ≤ a few hundred items; two O(n) passes are fine).
- Produces: `ListItem` union gains `{ kind: "nomatch" }`. Section render rule: render header when the **genuine** bucket is non-empty; data = filtered items, or `[{ kind: "nomatch" }]` when filters emptied it; count shows the **filtered** count (`۰` when no-match). Genuinely empty buckets still render nothing (ADR-0020 gate preserved).

- [x] **Step 1: Failing tests** — two pets, overdue item for pet A only, today items for both; filter to pet B → `tasks-section-overdue` still renders, its count is `۰` (Persian), one `tasks-no-match-row` under it, today renders B's rows normally, and the whole-list `tasks-no-match` block is absent; existing whole-list no-match tests (filters empty *everything*) still pass — whole-list block renders and per-section rows don't duplicate it.
- [x] **Step 2: Run** — expect FAIL (overdue section disappears today).
- [x] **Step 3: Implement** — dual bucketing memos; sections memo takes both results; `keyExtractor` handles `nomatch-${sectionKey}`; `renderItem` renders a quiet caption row (`typography.caption`, `colors.inkMuted`) with `testID="tasks-no-match-row"`; whole-list no-match block now gates on *all genuine buckets* being filter-emptied (unchanged user-visible behavior).
- [x] **Step 4: Run** the file + gates — green.
- [x] **Step 5: Commit** `fix(mobile.tasks): filter-emptied sections keep their header with a quiet no-match row — genuine-empty gate now judged pre-filter (ADR-0020 §4)`

---

### Task 5: Postpone «به فردا» (one-off, non-future, non-final)

**Files:**
- Modify: `mobile/src/screens/tasks/todayBuckets.ts` (pure `tomorrowSameTime`)
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx` (entries-driven sheet + postpone handler)
- Modify: `mobile/src/i18n/fa.json` (`tasks.action.postpone`)
- Test: `mobile/src/__tests__/todayBuckets.test.ts`, `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: `tehranDayOffset` from `src/lib/taskSchedule.ts` (eligibility: `occ.task.schedule.kind === "one_off" && occ.status !== "done" && occ.status !== "skipped" && tehranDayOffset(occ.dueAt) <= 0`); `updateTask` from the store (validates + re-syncs notifications — no store change).
- Produces: `tomorrowSameTime(atUtcIso: string, now: Date): string` — UTC ISO for *tomorrow (Tehran day relative to `now`)* at `at`'s Tehran wall-clock time: `tehranStartOfDay(now) + DAY_MS + wallClockMs(at)`. The ⋯ sheet is rebuilt as an `entries: { label: string; onPress?: () => void; destructive?: true }[]` array — options/indices derived from it, so the conditional postpone entry can't skew the destructive/cancel indices (existing index-based tests updated to look up labels, not hardcoded indices).

- [x] **Step 1: Failing helper tests** — an overdue `at` from 3 days ago at Tehran 09:00 → tomorrow 09:00 Tehran (UTC ISO 05:30Z); a today `at` → tomorrow same time; whole-minute fixtures.
- [x] **Step 2: Failing screen tests** — ⋯ on an overdue one-off: options contain `tasks.action.postpone`; choosing it calls `updateTask(task.id, { …task fields, schedule: { kind: "one_off", at: <tomorrowSameTime> } })`; ⋯ on a recurring row and on an upcoming one-off: postpone absent; delete stays the destructive index and cancel last in both shapes.
- [x] **Step 3: Run** both files — expect FAIL.
- [x] **Step 4: Implement** — export `tomorrowSameTime` (reuses the module's `tehranStartOfDay`); `handleMore` builds `entries` (postpone? · skip · edit · pause · delete · cancel), computes `destructiveButtonIndex`/`cancelButtonIndex` via `findIndex`/`length-1`, callback = `entries[index]?.onPress?.()`; postpone handler spreads the task into the `TaskUpdate` shape with the new `at`.
- [x] **Step 5: Run** files + `npm test` + `npx tsc --noEmit` — green.
- [x] **Step 6: Commit** `feat(mobile.tasks): postpone one-off tasks to tomorrow from the row menu — same Tehran wall-clock time, hidden for recurring/future/final rows`

---

### Task 6: Delete confirmation dialog

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx`
- Modify: `mobile/src/i18n/fa.json` (`tasks.delete_confirm_recurring`)
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`) — `visible/title/message/confirmLabel/cancelLabel/destructive/onConfirm/onCancel/testID`; Task 5's entries array (only the delete entry's `onPress` changes).
- Produces: delete from the sheet opens the dialog; confirm calls `deleteTask`, cancel is a no-op. Title `tasks.delete`, message `tasks.delete_confirm` / `tasks.delete_confirm_recurring`, confirm `tasks.action.delete`, cancel `common.cancel`, `destructive` (the dialog's danger styling is a permitted Alert Brick use — destructive-action label).

- [x] **Step 1: Failing tests** — choosing delete in the sheet does **not** call `deleteTask` but shows `tasks-delete-confirm`; pressing `tasks-delete-confirm-confirm` calls `deleteTask(task.id)`; pressing `tasks-delete-confirm-cancel` → `deleteTask` never called, dialog closes; recurring task → message is `i18n.t("tasks.delete_confirm_recurring")`, one-off → `i18n.t("tasks.delete_confirm")`.
- [x] **Step 2: Run** — expect FAIL (immediate delete).
- [x] **Step 3: Implement** — `const [pendingDelete, setPendingDelete] = useState<Task | null>(null)`; delete entry's `onPress` = `setPendingDelete(task)`; render `ConfirmDialog` beside the type-filter modal, `visible={pendingDelete !== null}`, recurring-aware message via `pendingDelete.schedule.kind`, `onConfirm` → `deleteTask(pendingDelete.id)` + clear, `onCancel` → clear.
- [x] **Step 4: Run** file + gates — green.
- [x] **Step 5: Commit** `feat(mobile.tasks): confirm before deleting a task — recurring-aware copy, ConfirmDialog over instant delete`

---

### Checkpoint: Features complete (after Tasks 4–6)

- [x] `npm test` green, `npx tsc --noEmit` 0 errors.
- [ ] Manual smoke: filter a populated section to zero → header + «موردی مطابق فیلترها نیست» row; postpone an overdue one-off → lands in Upcoming under tomorrow's day header, notification re-synced; delete a recurring task → dialog with the recurring message, cancel keeps it, confirm removes it.

---

### Task 7: ADR-0021 + documentation reconciliation

**Files:**
- Create: `docs/adrs/0021-tasks-hub-completed-section-and-row-actions.md`
- Modify: `docs/adrs/README.md` (index row)
- Modify: `docs/specs/07-today-tasks-tab.md` (superseded notes)
- Modify: `mobile/CLAUDE.md` (Tasks paragraph: 4 buckets, genuine-empty gate wording)

**Interfaces:** documentation only; verification is a consistency read-through.

- [x] **Step 1: Write ADR-0021** (Status Accepted, Date 2026-07-07, structure per ADR-0020). Decisions: (1) **row-tap → edit** canonized (matches Google Tasks/Todoist; supersedes spec 07's tap→sheet); (2) **Completed section** (collapsed-by-default, done+skipped, past+today, desc) supersedes spec 07's "checked rows stay in place until next reload" — rationale: restores spec 09's checkbox undo for overdue rows, Google Tasks pattern; (3) ADR-0020 §4 clarified: genuine emptiness judged on **unfiltered** buckets, filter-emptied sections render header + no-match row; (4) quick postpone for one-off non-future rows (no per-occurrence override model for recurring); (5) delete requires ConfirmDialog (destructive dialog styling = permitted Alert Brick use). Alternatives: revert tap→sheet (rejected — shipped+tested+industry standard); keep stay-in-place without Completed (rejected — user chose Google-style); undo-toast delete (rejected — needs task+log resurrection). Guardrails: Completed stays calm register (no celebration); never delete without confirmation; postpone never mutates recurring schedules.
- [x] **Step 2: Reconcile spec 07** — row-action table: note tap→edit per ADR-0021; checkbox bullet: "checked rows stay in place until next reload" → superseded note pointing at ADR-0021/spec 15; empty-section paragraph: point at the genuine-vs-filtered clarification. Add top-line: "Row actions, checked-row placement, and filter no-match revised per ADR-0021 / spec 15."
- [x] **Step 3: Sync `docs/adrs/README.md`** — add the 0021 row per the table's format.
- [x] **Step 4: Update `mobile/CLAUDE.md`** — Tasks paragraph: buckets are now `overdue / today / upcoming / completed` (completed = finalized past+today, collapsed by default; genuine-empty gate judged pre-filter).
- [x] **Step 5: Consistency read-through** — spec 15, spec 07, ADR-0020, ADR-0021, mobile/CLAUDE.md agree; ADR index lists 0001–0021.
- [x] **Step 6: Commit** `docs: ADR-0021 completed section and row actions — reconcile spec 07, tasks bucket docs, ADR index`

---

## Final Verification (after all tasks)

- [x] `cd mobile && npm test` — full suite green
- [x] `cd mobile && npx tsc --noEmit` — 0 errors
- [x] Grep gates: `grep -rn "no_match_section\|section.completed\|action.postpone\|delete_confirm_recurring" mobile/src/i18n/fa.json` → 4 hits; `grep -rn "windowIsEmpty" mobile/src` → no hits
- [ ] Manual smoke on emulator: full loop — check overdue row → Completed (expand, revert via checkbox); collapse/expand every section; filter a section to zero → no-match row; postpone → tomorrow; delete → dialog; progress numbers unchanged for the same data
- [ ] Success criteria 1–9 in `docs/specs/15-tasks-hub-conformance.md` each verified against a running app

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Progress math drifts when finals leave the `today` bucket | Med | `progress` computed inside the helper with an invariant test (Task 1 before/after Task 3 fixtures identical) |
| Conditional postpone entry skews sheet indices | Med | Entries-array refactor (Task 5) — indices derived, tests assert by label |
| Existing tests assume done rows render in place | Low | Task 3 Step 5 explicitly re-points them at the Completed section |
| Collapsed-by-default Completed hides the just-checked row | Low | Accepted (Google Tasks pattern); the 4s undo toast covers the immediate-mistap case |

## Open Questions

None — all scope decisions resolved in spec 15 (interview 2026-07-07).
