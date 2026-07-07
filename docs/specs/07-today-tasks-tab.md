# 07 — Today → Tasks Tab

**Status:** Approved design (brainstorm output) · 2026-06-22
**Supersedes:** the read-only Today view shipped with `06-chores-spec.md`

> Tone and empty-section behavior revised per ADR-0020.
> Row actions, checked-row placement, and filter no-match revised per ADR-0021 / spec 15.

## Goal

Turn the Today tab from a flat, read-only list of *today's* chore occurrences
into a full todo hub: a time-horizon view (overdue / today / next 7 days), with
quick ad-hoc task creation, pet/type filtering, and a daily progress indicator.

No new data model. Ad-hoc todos are `one_off` chores (`type: 'other'`). The tab
is a richer **view layer** over the existing chores + logs, keeping the
derive-at-query-time approach (ADR-0016, approach B): occurrences are never
materialised.

## Non-goals

- No new `Todo` table or standalone todo concept — reuse `Chore` / `ChoreLog`.
- No "someday"/undated bucket — every item is a dated occurrence.
- No streak/adherence surfacing in this tab (the engine has `streak`/`adherence`
  already; not used here).
- No swipe gestures.
- No cross-device sync changes.

## Decisions captured from brainstorm

| Question | Decision |
|---|---|
| Core intent | All four: see beyond today, add ad-hoc todos, organize/filter, progress |
| Ad-hoc model | Reuse `one_off` chore (`type: 'other'`); no new table |
| Time horizon | Three sections: **Overdue / Today / Next 7 days** |
| Overdue look-back | Capped at **7 days** (bounded; recurring missed beyond that drop off) |
| Quick add | Lightweight quick-add sheet (title + pet + when), "More options →" full form |
| Row action | **Checkbox** to complete (with undo); **⋯** → sheet (Postpone (one-off only) / Skip / Edit / Pause / Delete — pause added per ADR-0020, postpone + delete confirmation added per ADR-0021); **tap row body** → edit directly, superseding the tap→sheet description below (ADR-0021) |
| Top chrome | Today progress counter + filter by pet + filter by type (no streak) |

## Architecture

### Data flow

One ranged occurrence computation, bucketed:

1. Compute occurrences once over the UTC window **`[now − 7d, now + 7d)`** using
   the existing pure `occurrencesForDay(chores, logs, range)` engine
   (`mobile/src/lib/choreSchedule.ts`). It already accepts any range; the name is
   the only thing that says "day".
2. Bucket each `Occurrence` by `dueAt` relative to the Tehran today window:
   - **Overdue** — `dueAt < startOfToday`, status not `done`/`skipped`, within the
     7-day look-back. (Stale-pending past `dueAt` from today is handled by the
     Today bucket's existing overdue-first ordering, see below.)
   - **Today** — `startOfToday ≤ dueAt < endOfToday` (Tehran day).
   - **Upcoming** — `dueAt ≥ endOfToday`, through `now + 7d`.
3. Sort:
   - Overdue & Today → overdue-first then chronological (reuse current
     `isOverdue` / `sortOccurrences` logic in `TodayScreen.tsx`).
   - Upcoming → chronological, grouped under a per-day sub-header label.

### Data-layer additions (small)

In `mobile/src/db/chores.ts`:
- `getLogsInRange(startPrefix: string, endPrefix: string): ChoreLog[]` — fetch
  logs across the window. (May be implemented by looping the existing
  `getLogsForDay` over UTC-date prefixes spanning the window; a single SQL
  `BETWEEN` on the `dueAt` prefix is preferred.)
- `removeLog(choreId: string, dueAt: string): void` — delete a single log row.
  Needed for **undo**; there is currently no way to un-log an occurrence.

In `mobile/src/store/choresStore.ts`:
- Replace `computeTodayOccurrences` usage in the Today path with a
  `computeRangeOccurrences()` that fills the 7d-back / 7d-forward window. The
  store may expose the bucketed result, or expose the flat ranged list and let
  the screen bucket. **Decision:** expose a flat `windowOccurrences` array +
  keep bucketing as a pure helper in the screen module (easier to unit-test).
  `occurrences` (today-only) stays for any other consumer; add
  `windowOccurrences` rather than breaking the existing field.
- `unmarkOccurrence(choreId, dueAt)` action → `removeLog` + recompute + sync
  notifications.

> Note: other consumers of `occurrences` (today-only) are unaffected. The new
> window field is additive.

## UI

### Screen structure

Wrap the Today tab in a **TodayStack** (`mobile/src/navigation/TodayStack.tsx`)
— it is currently a bare screen in `RootNavigator`. The stack hosts:
- `TodayScreen` (the list)
- `ChoreFormScreen` (reused, for Edit and "More options →")

Register the stack in `RootNavigator` in place of the direct `TodayScreen`.
Add `TodayStackParamList` typed contract mirroring `PetsStack`.

### Layout

```
┌─ Tasks ───────────────────────────────┐
│  ●●●○○○○   3 of 7 done today           │  ← progress (today only)
│                                        │
│  [All][Rex][Mia]      ⚲ type ▾         │  ← filters: pet chips + type
│ ───────────────────────────────────── │
│ ▾ Overdue · 2                          │  ← collapsible, count badge
│   ☐  Meds — Rex            08:00  ⋯    │
│   ☐  Feeding — Mia         18:00  ⋯    │
│ ▾ Today · 4                            │
│   ☑  Play — Rex            done        │  (checked, dimmed)
│   ☐  Feeding — Rex         18:00  ⋯    │
│ ▾ Upcoming · next 7 days · 6           │
│   Tue                                  │  ← day sub-header
│     ☐  Vet — Mia          10:00  ⋯    │
│   Wed …                                │
└────────────────────────────────────────┘
                                  ( + )  ← FAB → quick-add sheet
```

`SectionList` with three sections (overdue / today / upcoming). Upcoming day
labels render as inline sub-headers within the section. Collapse state is
in-memory (default expanded).

**Empty-section behavior (revised per ADR-0020, clarified per ADR-0021):** a
section does not render at all when its underlying **genuine** (pre-filter)
bucket is genuinely empty (zero occurrences) — no per-section empty row, and
no "🎉"-style copy. This gate is judged against the **unfiltered** window, not
the filtered one: a section narrowed to zero by active pet/type filters still
renders, keeping its header (count `۰`) with a quiet "no match" row, so filter
state stays legible per section (see Edge cases). The whole-screen empty state
(existing `today-empty`) shows only when the entire window has zero items;
the separate whole-list "no tasks match" block shows when filters wipe out
every section at once.

**Overdue styling (revised per ADR-0020):** overdue times render in neutral
ink, never Alert Brick — DESIGN.md reserves Alert Brick for errors and
destructive-action labels. The Overdue section title and status wording are
calm and non-alarmed («مانده از قبل» / «انجام نشده»); the section keeps its
position and count, it is not hidden or demoted.

### Row

Reuse the current row internals (type icon, pet name, chore title, Tehran time,
status badge). Changes:

- **Checkbox** (leading): tap → `markOccurrence(choreId, dueAt, 'done')`. Row
  animates to checked, dimmed/strikethrough, and a neutral **done** toast shows
  (~4s) — see `docs/specs/10-lively-task-done-toast.md` / ADR-0020. Undo →
  `unmarkOccurrence(choreId, dueAt)`. ~~Checked rows stay in place until next
  reload (focus/refresh re-buckets).~~ **Superseded by ADR-0021 / spec 15:**
  finalized (done/skipped) rows move into a fourth **Completed** section
  (collapsed by default, sorted newest-first) instead of staying in place;
  the checkbox there still calls `unmarkOccurrence`. **Upcoming (future-day)
  rows are not completable**: the checkbox is disabled/inert for occurrences
  whose `dueAt` is beyond today, so a task can't be marked done ahead of its
  date; those rows remain **pre-skippable** via the ⋯ sheet.
- **⋯ button** → action sheet (row-body tap navigates straight to edit
  instead, per ADR-0021):
  - **Postpone «به فردا»** (added per ADR-0021) → one-off, non-final,
    non-future occurrences only; reschedules `at` to tomorrow at the same
    Tehran wall-clock time
  - **Skip** → `markOccurrence(..., 'skipped')` (available on any row,
    including Upcoming/future-day rows)
  - **Edit** → navigate to `ChoreFormScreen` for that chore
  - **Pause** (added per ADR-0020) → stop generating/notifying future
    occurrences for the task; it disappears from the hub and shows a
    «متوقف» tag on PetDetail until resumed from the edit form
  - **Delete** → opens a `ConfirmDialog` (added per ADR-0021; was an instant
    `deleteChore(choreId)` call) — confirming calls `deleteChore(choreId)`.
    For recurring chores the dialog message reads "Delete this task and all
    its occurrences"; for one_off it reads "Delete this task".
- The standalone Done/Skip buttons from the current row are removed (checkbox +
  sheet replace them).

### Top chrome

- **Progress** (today only): `done / (done + pending + missed)` — `skipped`
  excluded from the denominator. Rendered as a segmented dot/bar + "N of M done
  today". Hidden when today has 0 occurrences.
- **Filters** (apply to all three sections, AND-combined):
  - Pet chips `All · Rex · Mia` — single-select.
  - Type filter button → multi-select sheet (feeding / meds / play / grooming /
    vet / other). Active filters narrow the buckets; section counts reflect the
    filtered set.

### Quick-add (FAB)

FAB → bottom sheet:
- **Title** (`TextField`)
- **Pet** (picker — reuse pet selection pattern from `ChoreFormScreen`)
- **When** (date + Tehran time; default today, next round hour)

On **Add** → `addChore({ petId, type: 'other', title, schedule: { kind:'one_off',
at }, endKind: 'never', endUntil: null, endCount: null, active: true })`. `at` is
the Tehran wall-clock → UTC via `toUtcIso`.

**"More options →"** navigates to `ChoreFormScreen`, carrying the typed title and
selected pet, for recurring setups.

### i18n / theme

- New flat `today.*` keys in `mobile/src/i18n/fa.json`: section titles
  (`today.section.overdue` / `.today` / `.upcoming`), progress
  (`today.progress`), undo (`today.undo`, `today.undone`), sheet actions
  (`today.action.skip` / `.edit` / `.delete`, plus recurring/one_off delete
  copy), quick-add labels (`today.quick.title` / `.pet` / `.when` / `.add` /
  `.more_options`), filter labels (`today.filter.all` / `.type`), per-section
  empty rows, and "no tasks match" + clear-filters.
- All colors/spacing/typography from `theme.ts`. Reuse `CHORE_TYPE_ICON`,
  `STATUS_COLOR`, `Button`, `TextField`.

## Edge cases

- **Midnight crossing while open** → re-bucket on focus (screen already reloads
  on `useIsFocused`).
- **Overdue cap** 7 days — recurring missed occurrences older than 7 days drop
  off (bounded, intentional).
- **Filter empties a section** → show the section's empty row (don't hide the
  section) so counts stay legible.
- **Filter empties the whole list** → "No tasks match" + a clear-filters action.
- **Undo after the toast expires** → not supported; toast window only. (Re-adding
  is via tapping the checkbox again on the still-checked row before reload, or
  re-opening — keep simple: toast Undo is the supported path.)
- **Stale pending** (a today occurrence whose `dueAt` passed while open) → stays
  in the Today bucket but sorts overdue-first (existing `isOverdue` logic).

## Testing

Extend `mobile/src/__tests__/TodayScreen.test.tsx` and add a pure helper test:

- **Bucketing helper** (pure): an occurrence with `dueAt` yesterday → overdue;
  today → today; +3 days → upcoming; done/skipped past → excluded from overdue;
  overdue older than 7 days → excluded.
- Checkbox tap → `markOccurrence(...,'done')` called; undo → `unmarkOccurrence`
  called and row returns to pending.
- Row sheet: Skip → `markOccurrence(...,'skipped')`; Edit → navigation to
  ChoreForm; Delete → `deleteChore`.
- Pet filter and type filter narrow the rendered set; combined filters AND.
- Progress count = `done / (done + pending + missed)` for today.
- Quick-add submits a `one_off` `other` chore via `addChore` with the expected
  shape.
- `npx tsc --noEmit` clean (0 errors) — the type gate.

## Files touched

- `mobile/src/screens/today/TodayScreen.tsx` — rewrite to SectionList + buckets +
  filters + progress + checkbox/sheet row.
- `mobile/src/screens/today/QuickAddSheet.tsx` — **new**, quick-add bottom sheet.
- `mobile/src/navigation/TodayStack.tsx` — **new**, stack wrapper.
- `mobile/src/navigation/RootNavigator.tsx` — use TodayStack.
- `mobile/src/store/choresStore.ts` — window occurrences + `unmarkOccurrence`.
- `mobile/src/db/chores.ts` — `getLogsInRange`, `removeLog`.
- `mobile/src/i18n/fa.json` — new `today.*` keys.
- `mobile/src/__tests__/TodayScreen.test.tsx` — extend; new bucketing helper test.
- `mobile/CLAUDE.md` — refresh stale tab description (currently says Home/Profile
  only).
