# Tasks Tab Gap Mitigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 12 confirmed gaps between the Tasks tab and its audited intent — 7 functional (interval anchor, pause, validation, future-day guard, water filter, doc drift) and 5 design/tone (تو voice, calm overdue, neutral toast, hidden empty sections, accent-budget ADR).

**Architecture:** All changes stay inside the existing offline-first rule+log model (ADR-0016): mobile-only, no schema changes, no new dependencies. UI changes touch `TasksScreen.tsx`, `TaskFormScreen.tsx`, `PetDetailScreen.tsx`, `toastConfig.tsx`; the one store change is a guard in `tasksStore.ts`. Copy changes are confined to `src/i18n/fa.json`. Docs work adds ADR-0020, marks ADR-0017 superseded, and reconciles DESIGN.md, mobile/CLAUDE.md, and specs 07/10.

**Tech Stack:** Expo SDK 56 / React Native, TypeScript, Zustand, expo-sqlite (sync API), jest-expo + @testing-library/react-native, i18next (fa only, flat keys).

## Global Constraints

- After every task: `npx tsc --noEmit` → 0 errors, `npm test` → green. Run from `mobile/`.
- All user-facing strings live in `mobile/src/i18n/fa.json` (flat keys). Tests assert copy via `i18n.t("key")` — **never** a hardcoded Persian literal.
- Voice register: intimate **تو** for any copy that addresses the user. Impersonal statements (errors like «... الزامی است») are register-neutral and stay.
- Theme tokens only (`src/theme/theme.ts`): `colors.*`, `spacing.*`, `radius.*`, `typography.*`, `fonts.*`. No hex literals.
- Tehran time = fixed **+03:30** offset; storage UTC ISO, display Jalali (ADR-0010). Never materialise occurrences to storage (ADR-0016).
- RTL: use `Start`/`End` style properties, never `left`/`right`.
- Commits: `type(scope): summary` — lowercase imperative, no trailing period; scope `mobile.tasks` for app code, `docs` for documentation. End commit messages with the project's Claude co-author trailer.
- Jest hoisting: variables referenced inside `jest.mock` factories must be `mock`-prefixed. `render(...)` returns a Promise in this RTL v14 setup — always `await` it. Date fixtures in screen tests must be **relative to `Date.now()`** (bucketing runs against the real clock).

## i18n Key Delta (single source of truth for all tasks below)

**Added:**

| Key | Value |
|---|---|
| `tasks.schedule.start` | `شروع از` |
| `tasks.field.title_required` | `عنوان` |
| `tasks.error.title_required` | `برای نوع «سایر» نوشتن عنوان لازم است` |
| `tasks.action.pause` | `توقف یادآوری` |
| `tasks.status.paused` | `متوقف` |
| `tasks.field.status` | `وضعیت` |
| `tasks.active.on` | `فعال` |
| `tasks.active.off` | `متوقف` |
| `tasks.done.confirm` | `کار {{name}} انجام شد` |

**Changed:**

| Key | Old | New |
|---|---|---|
| `tasks.empty` | `امروز کاری برای انجام ندارید` | `امروز کاری برای انجام نداری` |
| `tasks.delete_confirm` | `آیا مطمئن هستید که می‌خواهید این کار را حذف کنید؟` | `مطمئنی می‌خواهی این کار را حذف کنی؟` |
| `tasks.error.pet_required` | `حداقل یک پت را انتخاب کنید` | `حداقل یک پت را انتخاب کن` |
| `tasks.section.overdue` | `عقب‌افتاده` | `مانده از قبل` |
| `tasks.status.missed` | `از دست رفت` | `انجام نشده` |

**Removed:** `tasks.done.cheer.0`, `tasks.done.cheer.1`, `tasks.done.cheer.2`, `tasks.empty.overdue`, `tasks.empty.today`, `tasks.empty.upcoming`.

---

### Task 1: Add `water` to the hub type filter (gap 5)

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx:52-59`
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: `TaskType` union from `src/db/types.ts` (already includes `"water"`).
- Produces: nothing downstream; standalone fix.

- [ ] **Step 1: Write the failing test**

Add to `TasksScreen.test.tsx` (inside the existing type-filter describe block; reuse the file's existing `makeOcc` fixture and mock wiring):

```tsx
it("offers every task type in the filter modal, including water", async () => {
  mockWindowOccurrences = [makeOcc("t1", DUE_TODAY)];
  const screen = await render(<TasksScreen />);
  fireEvent.press(screen.getByTestId("tasks-type-filter"));
  for (const ct of ["feeding", "water", "meds", "play", "grooming", "vet", "other"]) {
    expect(screen.getByTestId(`type-chip-${ct}`)).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/TasksScreen.test.tsx -t "including water"`
Expected: FAIL — `Unable to find an element with testID: type-chip-water`

- [ ] **Step 3: Write minimal implementation**

In `TasksScreen.tsx`, replace the `TASK_TYPES` constant:

```tsx
const TASK_TYPES: TaskType[] = [
  "feeding",
  "water",
  "meds",
  "play",
  "grooming",
  "vet",
  "other",
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/TasksScreen.test.tsx -t "including water"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/tasks/TasksScreen.tsx mobile/src/__tests__/TasksScreen.test.tsx
git commit -m "fix(mobile.tasks): include water in the hub type filter"
```

---

### Task 2: Future-day completion guard (gap 7)

**Files:**
- Modify: `mobile/src/store/tasksStore.ts` (import + `markOccurrence`)
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx` (`RowProps`, `OccurrenceRow`, `renderItem`)
- Test: `mobile/src/__tests__/tasksStore.test.ts`, `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: `tehranDayOffset(isoUtc: string, now?: Date): number` from `src/lib/taskSchedule.ts` (0 = today, 1 = tomorrow).
- Produces: `OccurrenceRow` prop `future: boolean` (Task 7 and Task 9 snippets assume it exists).

Semantics (confirmed spec): occurrences on a **future Tehran day** cannot be marked `done`; they **can** be `skipped` and un-skipped. Today/overdue unchanged. Guard lives in both the store (defense) and the row UI (affordance).

- [ ] **Step 1: Write the failing store test**

Add to `tasksStore.test.ts` (reuse the file's `mockStore` sqlite mock and its add-task fixture pattern):

```ts
it("refuses to log 'done' for a future-day occurrence but allows 'skipped'", async () => {
  const futureIso = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const schedule: Schedule = { kind: "one_off", at: futureIso };
  await useTasksStore.getState().addTask({
    petId: "p1", type: "feeding", title: null, schedule,
    endKind: "never", endUntil: null, endCount: null, active: true,
  });
  const task = useTasksStore.getState().tasks[0];

  await useTasksStore.getState().markOccurrence(task.id, futureIso, "done");
  expect(mockStore.task_logs).toHaveLength(0);

  await useTasksStore.getState().markOccurrence(task.id, futureIso, "skipped");
  expect(mockStore.task_logs).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/tasksStore.test.ts -t "future-day"`
Expected: FAIL — `expect(received).toHaveLength(0)` received length 1

- [ ] **Step 3: Implement the store guard**

In `tasksStore.ts`, extend the schedule-engine import and guard `markOccurrence`:

```ts
import { occurrencesForDay, toUtcIso, tehranDayOffset } from "../lib/taskSchedule";
```

```ts
    markOccurrence: async (taskId, dueAt, status) => {
      // Completing the future is a lie — 'done' only for today/past (Tehran
      // day). Pre-skipping a future day ("I'm away Friday") stays allowed.
      if (status === "done" && tehranDayOffset(dueAt) > 0) return;
      logOccurrence(taskId, dueAt, status);
      // ... (rest of the existing body unchanged)
```

- [ ] **Step 4: Run store test to verify it passes**

Run: `npx jest src/__tests__/tasksStore.test.ts -t "future-day"`
Expected: PASS

- [ ] **Step 5: Write the failing screen test**

Add to `TasksScreen.test.tsx`:

```tsx
it("disables the done checkbox on upcoming rows but keeps skipped-undo tappable", async () => {
  mockWindowOccurrences = [
    makeOcc("fut-pending", DUE_UPCOMING),
    makeOcc("fut-skipped", DUE_UPCOMING, "skipped"),
  ];
  const screen = await render(<TasksScreen />);

  fireEvent.press(screen.getByTestId("tasks-check-fut-pending"));
  expect(mockMarkOccurrence).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId("tasks-check-fut-skipped"));
  expect(mockUnmarkOccurrence).toHaveBeenCalledWith("fut-skipped", DUE_UPCOMING);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest src/__tests__/TasksScreen.test.tsx -t "upcoming rows"`
Expected: FAIL — `mockMarkOccurrence` was called

- [ ] **Step 7: Implement the row affordance**

In `TasksScreen.tsx`:

1. Extend `RowProps` and destructure the new prop:

```tsx
type RowProps = {
  occ: Occurrence;
  petName: string;
  overdue: boolean;
  future: boolean;
  onCheck: (occ: Occurrence) => void;
  onEdit: (occ: Occurrence) => void;
  onMore: (occ: Occurrence) => void;
};
```

2. Inside `OccurrenceRow`, lock the done affordance for future pending rows (skipped rows stay tappable so undo works):

```tsx
  const isFinal = status === "done" || status === "skipped";
  const isDone = status === "done";
  const lockDone = future && !isFinal;
```

Replace the checkbox `Pressable` opening tag and icon color:

```tsx
      <Pressable
        testID={`tasks-check-${task.id}`}
        onPress={() => onCheck(occ)}
        disabled={lockDone}
        style={styles.checkbox}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isFinal, disabled: lockDone }}
        accessibilityLabel={
          isFinal ? t("tasks.undo.action") : t("tasks.action.mark_done")
        }
      >
        <MaterialCommunityIcons
          name={
            isDone
              ? "checkbox-marked-circle"
              : status === "skipped"
                ? "minus-circle-outline"
                : "checkbox-blank-circle-outline"
          }
          size={24}
          color={
            isDone
              ? colors.primary
              : lockDone
                ? colors.inkFaint
                : colors.inkMuted
          }
        />
      </Pressable>
```

3. In `renderItem`, pass the section down:

```tsx
          return (
            <OccurrenceRow
              occ={occ}
              petName={petNameById[occ.task.petId] ?? ""}
              overdue={(section as Section).sectionKey === "overdue"}
              future={(section as Section).sectionKey === "upcoming"}
              onCheck={handleCheck}
              onEdit={handleEdit}
              onMore={handleMore}
            />
          );
```

The ⋯ menu is intentionally unchanged — skip stays available on future rows.

- [ ] **Step 8: Run both test files, then the full gate**

Run: `npx jest src/__tests__/TasksScreen.test.tsx src/__tests__/tasksStore.test.ts`
Expected: PASS. Then `npx tsc --noEmit` → 0 errors.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/store/tasksStore.ts mobile/src/screens/tasks/TasksScreen.tsx mobile/src/__tests__/tasksStore.test.ts mobile/src/__tests__/TasksScreen.test.tsx
git commit -m "fix(mobile.tasks): block marking future-day occurrences done — store guard + disabled checkbox, pre-skip stays allowed"
```

---

### Task 3: Interval start picker + anchor preservation (gaps 1 & 2)

**Files:**
- Modify: `mobile/src/screens/tasks/TaskFormScreen.tsx` (state, `buildSchedule`, validation, interval JSX)
- Modify: `mobile/src/i18n/fa.json` (add `tasks.schedule.start`)
- Test: `mobile/src/__tests__/TaskFormScreen.test.tsx`

**Interfaces:**
- Consumes: `DatePickerField` / `TimePickerField` (props `testID`, `value`, `onChange`, `accessibilityLabel` — same usage as the existing one_off block); `utcIsoToTehranJalali`, `tehranTodayJalali`, `jalaliToGregorian` from `src/lib/jalali.ts`; `toUtcIso` from `src/lib/taskSchedule.ts`; `utcIsoToTehranTime` (local helper already in the file).
- Produces: interval `Schedule.anchor` is now user-chosen and stable across edits. No signature changes.

Note: the anchor round-trips through Jalali date + HH:MM, so seconds/millis are zeroed. Test fixtures must use a whole-minute anchor (e.g. `...T05:30:00.000Z`) to assert exact preservation.

- [ ] **Step 1: Write the failing tests**

Add to `TaskFormScreen.test.tsx` (reuse the file's existing mocks for `../db/tasks`' `getTask`, the tasksStore `addTask`/`updateTask` fns, and its render helper; `2026-07-01T05:30:00.000Z` = Tehran 09:00 on Jalali `1405/04/10`):

```tsx
it("preserves an interval task's anchor when editing an unrelated field", async () => {
  const anchor = "2026-07-01T05:30:00.000Z";
  mockGetTask.mockReturnValue({
    id: "task-1", petId: "pet-1", type: "meds", title: "قطره",
    schedule: { kind: "interval", n: 2, unit: "days", anchor },
    endKind: "never", endUntil: null, endCount: null, active: true,
    createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z",
  });
  const screen = await render(<TaskFormScreen />); // route params: { taskId: "task-1" }

  fireEvent.changeText(screen.getByTestId("taskform-title"), "قطره چشم");
  fireEvent.press(screen.getByTestId("taskform-submit"));

  await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
  const [, data] = mockUpdateTask.mock.calls[0];
  expect(data.schedule).toEqual({ kind: "interval", n: 2, unit: "days", anchor });
});

it("uses the picked start date+time as the interval anchor in add mode", async () => {
  const screen = await render(<TaskFormScreen />); // route params: {}
  fireEvent.press(screen.getByTestId("taskform-pet-pet-1"));
  fireEvent.press(screen.getByTestId("taskform-type-meds"));
  fireEvent.press(screen.getByTestId("taskform-schedule-interval"));

  fireEvent(screen.getByTestId("taskform-interval-start-date"), "onChange", "1405/04/10");
  fireEvent(screen.getByTestId("taskform-interval-start-time"), "onChange", "09:00");
  fireEvent.press(screen.getByTestId("taskform-submit"));

  await waitFor(() => expect(mockAddTask).toHaveBeenCalled());
  expect(mockAddTask.mock.calls[0][0].schedule.anchor).toBe("2026-07-01T05:30:00.000Z");
});
```

(If the existing picker mocks emit through a different event name, follow the pattern the file already uses for `taskform-oneoff-date` / `taskform-oneoff-time` — the assertion bodies stay the same.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/TaskFormScreen.test.tsx -t "anchor"`
Expected: FAIL — anchor equals a just-generated `new Date().toISOString()`, and `taskform-interval-start-date` not found.

- [ ] **Step 3: Implement**

In `TaskFormScreen.tsx`:

1. State (next to the other interval state, after line ~163):

```tsx
  // ── interval start (anchor) — Jalali date + Tehran wall-clock time ─────────
  const initIntervalStartDate =
    existing?.schedule.kind === "interval"
      ? utcIsoToTehranJalali(existing.schedule.anchor)
      : tehranTodayJalali();
  const initIntervalStartTime =
    existing?.schedule.kind === "interval"
      ? utcIsoToTehranTime(existing.schedule.anchor)
      : "09:00";
  const [intervalStartDate, setIntervalStartDate] = useState(initIntervalStartDate);
  const [intervalStartTime, setIntervalStartTime] = useState(initIntervalStartTime);
```

2. `buildSchedule` interval case — the anchor is derived from the picked start, never from "now" (this is also the edit-reset fix):

```tsx
      case "interval": {
        const n = parseInt(intervalN, 10);
        const greg = jalaliToGregorian(intervalStartDate);
        if (!greg) throw new Error("tasks.error.invalid_date");
        return {
          kind: "interval",
          n: isNaN(n) ? 1 : n,
          unit: intervalUnit,
          anchor: toUtcIso(intervalStartTime, greg),
        };
      }
```

3. Validation in `handleSubmit`, alongside the existing one_off block:

```tsx
    if (scheduleKind === "interval") {
      if (!jalaliToGregorian(intervalStartDate)) {
        setScheduleError(t("tasks.error.invalid_date"));
        return;
      }
      if (!isValidTime(intervalStartTime)) {
        setScheduleError(t("tasks.error.invalid_time"));
        return;
      }
    }
```

4. JSX inside the interval fieldGroup, between the unit chips and the error text:

```tsx
              <Text style={[styles.label, { marginTop: spacing.md }]}>
                {t("tasks.schedule.start")}
              </Text>
              <DatePickerField
                testID="taskform-interval-start-date"
                value={intervalStartDate}
                onChange={(v) => {
                  setIntervalStartDate(v);
                  if (scheduleError) setScheduleError("");
                }}
                accessibilityLabel={t("tasks.schedule.start")}
              />
              <TimePickerField
                testID="taskform-interval-start-time"
                value={intervalStartTime}
                onChange={(v) => {
                  setIntervalStartTime(v);
                  if (scheduleError) setScheduleError("");
                }}
                accessibilityLabel={t("tasks.schedule.time")}
              />
```

5. `fa.json`: add `"tasks.schedule.start": "شروع از"` (keep alphabetical-adjacent placement with the other `tasks.schedule.*` keys).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/TaskFormScreen.test.tsx`
Expected: PASS (whole file — the existing interval add-mode test asserting a fresh anchor may need its assertion updated to the picked-start default: today at 09:00 Tehran).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/tasks/TaskFormScreen.tsx mobile/src/i18n/fa.json mobile/src/__tests__/TaskFormScreen.test.tsx
git commit -m "fix(mobile.tasks): user-picked interval start date/time as anchor — no more silent anchor=now, edits preserve the anchor"
```

---

### Task 4: Require a title when type = `other` (gap 4)

**Files:**
- Modify: `mobile/src/screens/tasks/TaskFormScreen.tsx` (title error state, validation, label, error display)
- Modify: `mobile/src/i18n/fa.json` (add `tasks.field.title_required`, `tasks.error.title_required`)
- Test: `mobile/src/__tests__/TaskFormScreen.test.tsx`

**Interfaces:**
- Consumes: existing `title` state and chip handlers.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

```tsx
it("requires a title when type is 'other'", async () => {
  const screen = await render(<TaskFormScreen />); // route params: {}
  fireEvent.press(screen.getByTestId("taskform-pet-pet-1"));
  fireEvent.press(screen.getByTestId("taskform-type-other"));
  fireEvent.press(screen.getByTestId("taskform-submit"));

  expect(await screen.findByText(i18n.t("tasks.error.title_required"))).toBeTruthy();
  expect(mockAddTask).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByTestId("taskform-title"), "تمیز کردن قفس");
  fireEvent.press(screen.getByTestId("taskform-submit"));
  await waitFor(() => expect(mockAddTask).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/TaskFormScreen.test.tsx -t "requires a title"`
Expected: FAIL — error text not found, `mockAddTask` called on first submit.

- [ ] **Step 3: Implement**

In `TaskFormScreen.tsx`:

1. Error state (next to the other error states):

```tsx
  const [titleError, setTitleError] = useState("");
```

2. Validation in `handleSubmit`, immediately after the type check:

```tsx
    // 'other' is meaningless without a name; typed care falls back to its label
    if (taskType === "other" && title.trim() === "") {
      setTitleError(t("tasks.error.title_required"));
      return;
    }
    setTitleError("");
```

3. Title fieldGroup — label reflects requiredness, error renders inline:

```tsx
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {taskType === "other"
                ? t("tasks.field.title_required")
                : t("tasks.field.title")}
            </Text>
            <TextField
              testID="taskform-title"
              placeholder={
                taskType ? t(`tasks.type.${taskType}`) : t("tasks.field.title")
              }
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (titleError) setTitleError("");
              }}
              accessibilityLabel={t("tasks.field.title")}
            />
            {titleError !== "" && (
              <Text style={styles.errorText}>{titleError}</Text>
            )}
          </View>
```

4. `fa.json`: add `"tasks.field.title_required": "عنوان"` and `"tasks.error.title_required": "برای نوع «سایر» نوشتن عنوان لازم است"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/TaskFormScreen.test.tsx -t "requires a title"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/tasks/TaskFormScreen.tsx mobile/src/i18n/fa.json mobile/src/__tests__/TaskFormScreen.test.tsx
git commit -m "feat(mobile.tasks): require a title for type 'other'"
```

---

### Task 5: Pause/resume (gap 3)

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx` (⋯ menu gains «توقف یادآوری»)
- Modify: `mobile/src/screens/tasks/TaskFormScreen.tsx` (active state preserved; edit-mode status chip pair)
- Modify: `mobile/src/screens/pets/PetDetailScreen.tsx` (paused tag on task rows)
- Modify: `mobile/src/i18n/fa.json` (add `tasks.action.pause`, `tasks.status.paused`, `tasks.field.status`, `tasks.active.on`, `tasks.active.off`)
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`, `mobile/src/__tests__/TaskFormScreen.test.tsx`, `mobile/src/__tests__/PetDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `toggleActive(taskId: string): Promise<void>` from `tasksStore` (exists, currently uncalled). It re-syncs notifications internally.
- Produces: paused tasks vanish from the hub (no occurrences) but stay listed on PetDetail with a «متوقف» tag; their TaskForm shows a status chip pair.

UX (confirmed): pause from the hub row's ⋯ menu; resume via TaskForm edit reached from PetDetail. New ⋯ order: skip / edit / pause / delete / cancel (destructive 3, cancel 4).

- [ ] **Step 1: Write the failing hub test**

In `TasksScreen.test.tsx`, first add `toggleActive` to the store mock (mirror `mockDeleteTask`):

```tsx
const mockToggleActive = jest.fn().mockResolvedValue(undefined);
// ...and expose it in the jest.mock("../store/tasksStore") selector object:
//   toggleActive: mockToggleActive,
```

Then:

```tsx
it("offers pause in the row menu and calls toggleActive", async () => {
  mockWindowOccurrences = [makeOcc("t1", DUE_TODAY)];
  const screen = await render(<TasksScreen />);
  fireEvent.press(screen.getByTestId("tasks-more-t1"));

  const [opts, cb] = (useActionSheet().showActionSheetWithOptions as jest.Mock)
    .mock.calls.at(-1)!;
  expect(opts.options).toContain(i18n.t("tasks.action.pause"));
  expect(opts.destructiveButtonIndex).toBe(3);
  expect(opts.cancelButtonIndex).toBe(4);

  cb(2); // pause
  expect(mockToggleActive).toHaveBeenCalledWith("t1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/TasksScreen.test.tsx -t "pause"`
Expected: FAIL — options array lacks the pause label.

- [ ] **Step 3: Implement the ⋯ menu entry**

In `TasksScreen.tsx`:

1. Select the action from the store (next to `deleteTask`):

```tsx
  const toggleActive = useTasksStore((s) => s.toggleActive);
```

2. Replace the body of `handleMore`:

```tsx
      const options = [
        t("tasks.action.skip"),
        t("tasks.action.edit"),
        t("tasks.action.pause"),
        deleteLabel,
        t("tasks.action.cancel"),
      ];

      showActionSheetWithOptions(
        { options, destructiveButtonIndex: 3, cancelButtonIndex: 4 },
        (index?: number) => {
          if (index === 0) {
            markOccurrence(task.id, dueAt, "skipped");
          } else if (index === 1) {
            handleEdit(occ);
          } else if (index === 2) {
            toggleActive(task.id);
          } else if (index === 3) {
            deleteTask(task.id);
          }
        },
      );
```

Add `toggleActive` to the `handleMore` dependency array. Update any existing menu test that asserts the old delete index (was 2, now 3).

- [ ] **Step 4: Write the failing form tests**

In `TaskFormScreen.test.tsx`:

```tsx
it("keeps a paused task paused when edited without touching status", async () => {
  mockGetTask.mockReturnValue({ ...pausedTaskFixture, active: false });
  const screen = await render(<TaskFormScreen />); // route params: { taskId: "task-1" }
  fireEvent.press(screen.getByTestId("taskform-submit"));
  await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
  expect(mockUpdateTask.mock.calls[0][1].active).toBe(false);
});

it("resumes a paused task via the status chips", async () => {
  mockGetTask.mockReturnValue({ ...pausedTaskFixture, active: false });
  const screen = await render(<TaskFormScreen />);
  fireEvent.press(screen.getByTestId("taskform-active-on"));
  fireEvent.press(screen.getByTestId("taskform-submit"));
  await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
  expect(mockUpdateTask.mock.calls[0][1].active).toBe(true);
});
```

(`pausedTaskFixture`: any valid task fixture from the file, e.g. the daily_times one, with `active: false`.)

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx jest src/__tests__/TaskFormScreen.test.tsx -t "paused"`
Expected: FAIL — `active` submitted as `true`; `taskform-active-on` not found.

- [ ] **Step 6: Implement form status**

In `TaskFormScreen.tsx`:

1. State (near the other prefills):

```tsx
  const [active, setActive] = useState(existing?.active ?? true);
```

2. In `handleSubmit`'s `baseInput`, replace `active: true` with `active,`.

3. Edit-mode-only chip pair, placed after the end-condition block and before the submit button:

```tsx
          {isEdit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t("tasks.field.status")}</Text>
              <View style={styles.chipRow}>
                <Pressable
                  testID="taskform-active-on"
                  onPress={() => setActive(true)}
                  style={[styles.chip, active && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextSelected]}
                  >
                    {t("tasks.active.on")}
                  </Text>
                </Pressable>
                <Pressable
                  testID="taskform-active-off"
                  onPress={() => setActive(false)}
                  style={[styles.chip, !active && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !active }}
                >
                  <Text
                    style={[styles.chipText, !active && styles.chipTextSelected]}
                  >
                    {t("tasks.active.off")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
```

- [ ] **Step 7: PetDetail paused tag — failing test, then implement**

Test in `PetDetailScreen.test.tsx` (reuse the file's pet+task fixture wiring):

```tsx
it("tags paused tasks on the pet's task list", async () => {
  // arrange: one task for this pet with active: false in the tasks fixture
  const screen = await render(<PetDetailScreen />);
  expect(screen.getByText(i18n.t("tasks.status.paused"))).toBeTruthy();
});
```

Implement in `PetDetailScreen.tsx`, inside the task-row `Pressable` (the `petTasks.map` block starting at line ~230): after the existing schedule-summary/date text elements, add:

```tsx
                  {!task.active && (
                    <Text style={styles.taskPausedTag}>
                      {t("tasks.status.paused")}
                    </Text>
                  )}
```

with style (in the screen's StyleSheet):

```tsx
  taskPausedTag: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.medium,
    color: colors.inkMuted,
  },
```

4. `fa.json`: add the five keys from the delta table (`tasks.action.pause`, `tasks.status.paused`, `tasks.field.status`, `tasks.active.on`, `tasks.active.off`).

- [ ] **Step 8: Run all three test files + gate**

Run: `npx jest src/__tests__/TasksScreen.test.tsx src/__tests__/TaskFormScreen.test.tsx src/__tests__/PetDetailScreen.test.tsx`
Expected: PASS. Then `npx tsc --noEmit` → 0 errors.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/screens/tasks/TasksScreen.tsx mobile/src/screens/tasks/TaskFormScreen.tsx mobile/src/screens/pets/PetDetailScreen.tsx mobile/src/i18n/fa.json mobile/src/__tests__/TasksScreen.test.tsx mobile/src/__tests__/TaskFormScreen.test.tsx mobile/src/__tests__/PetDetailScreen.test.tsx
git commit -m "feat(mobile.tasks): pause/resume care items — pause in row menu, status chips in edit form, paused tag on pet detail, edits no longer silently reactivate"
```

---

### Task 6: Unify the voice to تو (gap 8)

**Files:**
- Modify: `mobile/src/i18n/fa.json` (3 value changes)
- Test: existing suites (assertions use `i18n.t`, so they track automatically)

**Interfaces:** none — value-only changes, no key renames.

- [ ] **Step 1: Apply the three "Changed" rows from the i18n delta that are voice fixes**

- `tasks.empty` → `امروز کاری برای انجام نداری`
- `tasks.delete_confirm` → `مطمئنی می‌خواهی این کار را حذف کنی؟`
- `tasks.error.pet_required` → `حداقل یک پت را انتخاب کن`

Then sweep the remaining `tasks.*` values for stray شما verb endings (`ید`-suffixed verbs addressing the user) — the audit found only these three; impersonal copy («... الزامی است», «رد شود») stays.

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS (any failure means a test hardcoded Persian — fix the test to use `i18n.t`, per repo convention).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/i18n/fa.json
git commit -m "polish(mobile.tasks): unify tasks copy to intimate تو voice"
```

---

### Task 7: Calm overdue (gap 9)

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx` (drop the red time + the now-unused `overdue` prop)
- Modify: `mobile/src/i18n/fa.json` (2 value changes)
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: `RowProps.future` from Task 2 (stays).
- Produces: `RowProps` no longer has `overdue` — Task 9's `renderItem` snippet assumes this.

- [ ] **Step 1: Write the failing style test**

```tsx
import { StyleSheet } from "react-native";
import { colors } from "../theme/theme";

// Tehran wall-clock HH:MM for a UTC ISO (fixed +03:30) — mirrors the screen's formatter
const tehranHHMM = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 210 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

it("renders overdue times without alert color", async () => {
  mockWindowOccurrences = [makeOcc("late", DUE_OVERDUE)];
  const screen = await render(<TasksScreen />);
  const time = screen.getByText(toPersianDigits(tehranHHMM(DUE_OVERDUE)));
  const flat = StyleSheet.flatten(time.props.style);
  expect(flat.color).not.toBe(colors.danger);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/TasksScreen.test.tsx -t "without alert color"`
Expected: FAIL — style contains `colors.danger`.

- [ ] **Step 3: Implement**

In `TasksScreen.tsx`:

1. In `OccurrenceRow`, the time Text loses the conditional:

```tsx
          <Text style={styles.time}>
            {toPersianDigits(toTehranTime(dueAt))}
          </Text>
```

2. Remove `overdue` from `RowProps`, from the destructured props, and from the `renderItem` call (keep `future`). Delete the `timeOverdue` style.

3. `fa.json`: `tasks.section.overdue` → `مانده از قبل`; `tasks.status.missed` → `انجام نشده`.

- [ ] **Step 4: Run the file + gate**

Run: `npx jest src/__tests__/TasksScreen.test.tsx` then `npx tsc --noEmit`
Expected: PASS / 0 errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/tasks/TasksScreen.tsx mobile/src/i18n/fa.json mobile/src/__tests__/TasksScreen.test.tsx
git commit -m "polish(mobile.tasks): calm overdue — drop alert-red times, guilt-free section and status wording"
```

---

### Task 8: Neutral done toast (gap 10)

**Files:**
- Modify: `mobile/src/components/toastConfig.tsx` (`cheerPhrase` → `donePhrase`)
- Modify: `mobile/src/i18n/fa.json` (remove 3 cheer keys, add `tasks.done.confirm`)
- Test: `mobile/src/__tests__/toastConfig.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: exported `donePhrase(t: TFunction, petName?: string): string` replaces `cheerPhrase` (grep confirms the only importers are `toastConfig.tsx` and its test). Toast type name `taskDone`, its emerald start-stripe styling, and the `TasksScreen` call site are unchanged.

- [ ] **Step 1: Rewrite the failing test**

Replace the cheer assertions in `toastConfig.test.tsx` with:

```tsx
import { donePhrase } from "../components/toastConfig";

it("returns a deterministic neutral confirmation naming the pet", () => {
  expect(donePhrase(i18n.t, "رکسی")).toBe(
    i18n.t("tasks.done.confirm", { name: "رکسی" }),
  );
});

it("falls back to the bare done label without a pet name", () => {
  expect(donePhrase(i18n.t)).toBe(i18n.t("tasks.undo.done"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/toastConfig.test.tsx`
Expected: FAIL — `donePhrase` is not exported.

- [ ] **Step 3: Implement**

In `toastConfig.tsx`, delete `CHEER_COUNT` and replace `cheerPhrase` with:

```tsx
// Neutral confirmation naming the pet; bare «انجام شد» without one.
// Deliberately not a cheer — warmth lives in calm, not praise (ADR-0020).
export function donePhrase(t: TFunction, petName?: string): string {
  if (!petName) return t("tasks.undo.done");
  return t("tasks.done.confirm", { name: petName });
}
```

In `TaskDoneToast`, swap the call (the `useMemo` keyed on `petName` stays — the library still reuses the mounted instance):

```tsx
  const phrase = React.useMemo(
    () => donePhrase(t, props.petName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.petName],
  );
```

In `fa.json`: remove `tasks.done.cheer.0/1/2`, add `"tasks.done.confirm": "کار {{name}} انجام شد"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/toastConfig.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/toastConfig.tsx mobile/src/i18n/fa.json mobile/src/__tests__/toastConfig.test.tsx
git commit -m "polish(mobile.tasks): replace randomized cheer toasts with one neutral done confirmation"
```

---

### Task 9: Hide empty sections (gap 11)

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx` (sections memo, `ListItem`, `keyExtractor`, `renderItem`, empty gate, styles)
- Modify: `mobile/src/i18n/fa.json` (remove 3 `tasks.empty.*` keys)
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2's `future` prop and Task 7's `overdue`-less `renderItem`.
- Produces: `ListItem` union is `occ | day` only; sections with no items don't render; genuine-empty gate covers the "only past-done items in window" edge.

- [ ] **Step 1: Write the failing tests**

```tsx
it("renders no section header or placeholder for empty sections", async () => {
  mockWindowOccurrences = [makeOcc("t1", DUE_TODAY)]; // today only
  const screen = await render(<TasksScreen />);
  expect(screen.queryByTestId("tasks-section-overdue")).toBeNull();
  expect(screen.queryByTestId("tasks-section-upcoming")).toBeNull();
  expect(screen.queryByTestId("tasks-empty-overdue")).toBeNull();
  expect(screen.getByTestId("tasks-section-today")).toBeTruthy();
});

it("shows the genuine empty state when everything in the window is already done", async () => {
  mockWindowOccurrences = [makeOcc("t1", DUE_OVERDUE, "done")];
  const screen = await render(<TasksScreen />);
  expect(screen.getByTestId("tasks-empty")).toBeTruthy();
});
```

Also delete/adjust any existing tests that assert the `tasks-empty-overdue|today|upcoming` placeholder rows or a permanent three-section skeleton.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/TasksScreen.test.tsx -t "empty"`
Expected: FAIL — empty-section headers/placeholders found; blank list instead of `tasks-empty`.

- [ ] **Step 3: Implement**

In `TasksScreen.tsx`:

1. Shrink the list-item union (empty placeholders are gone):

```tsx
type ListItem = { kind: "occ"; occ: Occurrence } | { kind: "day"; label: string };
```

2. Rebuild the sections memo — a section that has nothing to say doesn't speak:

```tsx
  const { sections, counts } = React.useMemo(() => {
    const upcomingItems: ListItem[] = [];
    let lastDay = "";
    for (const occ of upcoming) {
      const day = utcIsoToTehranJalali(occ.dueAt);
      if (day !== lastDay) {
        upcomingItems.push({ kind: "day", label: day });
        lastDay = day;
      }
      upcomingItems.push({ kind: "occ", occ });
    }

    const sections: Section[] = [];
    if (overdue.length > 0)
      sections.push({
        sectionKey: "overdue",
        data: overdue.map((occ) => ({ kind: "occ", occ })),
      });
    if (today.length > 0)
      sections.push({
        sectionKey: "today",
        data: today.map((occ) => ({ kind: "occ", occ })),
      });
    if (upcoming.length > 0)
      sections.push({ sectionKey: "upcoming", data: upcomingItems });

    const counts: Record<SectionKind, number> = {
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length,
    };

    return { sections, counts };
  }, [overdue, today, upcoming]);
```

3. Replace the whole-screen empty gate — bucket-based, so a window holding only past-done logs still reads as a clear day:

```tsx
  // Genuine empty: nothing actionable anywhere (and not a filter artifact)
  if (allBucketsEmpty && !hasFilters) {
```

Move the `allBucketsEmpty` / `hasFilters` declarations above this gate; delete `windowIsEmpty`. The filters-emptied-everything case keeps the existing `tasks-no-match` header block.

4. `keyExtractor` loses the `empty-` branch; `renderItem` loses the `item.kind === "empty"` branch; delete the `sectionEmptyRow` / `sectionEmptyText` styles.

5. `fa.json`: remove `tasks.empty.overdue`, `tasks.empty.today`, `tasks.empty.upcoming`.

- [ ] **Step 4: Run the file + full gate**

Run: `npx jest src/__tests__/TasksScreen.test.tsx` then `npm test` and `npx tsc --noEmit`
Expected: all PASS / 0 errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/tasks/TasksScreen.tsx mobile/src/i18n/fa.json mobile/src/__tests__/TasksScreen.test.tsx
git commit -m "polish(mobile.tasks): hide empty sections — no zero-count headers or placeholder rows, bucket-based genuine-empty gate"
```

---

### Task 10: ADR-0020 + documentation reconciliation (gaps 6 & 12)

**Files:**
- Create: `docs/adrs/0020-quiet-tasks-tone.md`
- Modify: `docs/adrs/0017-lively-task-done-toast.md` (Status → superseded)
- Modify: `docs/adrs/README.md` (index row)
- Modify: `docs/DESIGN.md` (One Voice Rule: completion-state exception)
- Modify: `mobile/CLAUDE.md` (stale bucket description)
- Modify: `docs/specs/07-today-tasks-tab.md`, `docs/specs/10-lively-task-done-toast.md` (reconcile per ADR workflow)

**Interfaces:** none — documentation only. No test cycle; verification is a consistency read-through.

- [ ] **Step 1: Write ADR-0020**

Create `docs/adrs/0020-quiet-tasks-tone.md` following the structure of ADR-0016 (Status / Date / Context / Decision / Alternatives Considered / Consequences / Guardrails):

- **Status:** Accepted. **Date:** 2026-07-06.
- **Context:** design audit of the Tasks tab against PRODUCT.md (calm/caring/no-guilt principle 6, anti-gamification) found: mixed شما/تو copy, Alert Brick on overdue times (violates DESIGN.md's "never repurposed for warnings"), praise-register cheer toasts (ADR-0017), always-rendered empty sections leading with lateness, and Garden Confident on completion UI (done-checkbox, progress dots) absent from the One Voice Rule's permitted list.
- **Decision:** (1) intimate **تو** voice for all user-addressed Tasks copy; (2) calm overdue — neutral ink, «مانده از قبل» / «انجام نشده» wording, section retains position and count; (3) neutral done toast — deterministic `tasks.done.confirm`, replacing ADR-0017's randomized cheer rotation (toast component, type name, and emerald start-stripe survive); (4) empty sections don't render; (5) **completion-state exception** to the One Voice Rule: Garden Confident is additionally permitted on completion indicators — the done checkbox and today-progress dots — because completion is an "active state" in spirit; the exception covers exactly these two uses.
- **Alternatives considered:** keep cheers (rejected: praise register reads coach/childish for adult users); recolor completion UI neutral (rejected: loses the tab's one quiet reward moment; checkbox/dots inconsistency); day-part agenda relayout (rejected: 3-section window confirmed as intended).
- **Guardrails:** Never reintroduce praise/exclamation copy in task feedback. Never use Alert Brick outside errors/destructive labels. Ask first before adding any new Garden Confident use beyond the documented list + this exception.

- [ ] **Step 2: Mark ADR-0017 superseded**

In `0017-lively-task-done-toast.md`, change Status to:

```markdown
## Status
Superseded by ADR-0020 (cheer rotation replaced with a neutral confirmation; the toast component and emerald start-stripe survive)
```

- [ ] **Step 3: Sync `docs/adrs/README.md`**

Add the 0020 index row; update 0017's status cell to "Superseded by 0020". Follow the README's existing table format.

- [ ] **Step 4: Update DESIGN.md**

In §2 under **The One Voice Rule**, after the sentence listing permitted uses ("Primary button fill, active tab icon, focused input border: that is the complete list."), append:

```markdown
One scoped exception: **completion state** in the Tasks tab — the done
checkbox and the today-progress dots render in Garden Confident (ADR-0020).
```

- [ ] **Step 5: Fix mobile/CLAUDE.md (gap 6)**

In the **Tasks** paragraph, replace the stale sentence

> `src/screens/tasks/todayBuckets.ts` groups occurrences into `overdue / morning / afternoon / evening / night` buckets for the Tasks tab.

with:

> `src/screens/tasks/todayBuckets.ts` buckets a ±7-day occurrence window into `overdue / today / upcoming` sections for the Tasks tab (7-day overdue look-back; empty sections are not rendered).

- [ ] **Step 6: Reconcile the specs**

- `docs/specs/07-today-tasks-tab.md`: where the hub's sections/empty behavior/overdue styling are described, update to match ADR-0020 (calm overdue naming, hidden empty sections, future-day rows not completable but pre-skippable, pause in the row menu). Add a one-line pointer: "Tone and empty-section behavior revised per ADR-0020."
- `docs/specs/10-lively-task-done-toast.md`: note at the top: "Superseded in part by ADR-0020 — the randomized cheer copy was replaced with a neutral `tasks.done.confirm`; component structure, `taskDone` type, and success stripe unchanged."

- [ ] **Step 7: Consistency read-through**

Re-read the four changed docs + ADR-0020 in sequence; confirm no doc still claims day-part buckets, cheer rotation, or an exception-free One Voice Rule. Confirm `docs/adrs/README.md` lists 0001–0020 with correct statuses.

- [ ] **Step 8: Commit**

```bash
git add docs/adrs/0020-quiet-tasks-tone.md docs/adrs/0017-lively-task-done-toast.md docs/adrs/README.md docs/DESIGN.md mobile/CLAUDE.md docs/specs/07-today-tasks-tab.md docs/specs/10-lively-task-done-toast.md
git commit -m "docs: ADR-0020 quiet tasks tone — supersede cheer toast ADR, completion-state accent exception, reconcile specs and stale bucket docs"
```

---

## Final Verification (after all tasks)

- [ ] `cd mobile && npm test` — full suite green
- [ ] `cd mobile && npx tsc --noEmit` — 0 errors
- [ ] Grep gates:
  - `grep -rn "tasks.done.cheer" mobile/src` → no hits
  - `grep -rn "tasks.empty.overdue\|tasks.empty.today\|tasks.empty.upcoming" mobile/src` → no hits
  - `grep -rn "timeOverdue" mobile/src` → no hits
  - `grep -n "cheerPhrase" -r mobile/src` → no hits
- [ ] Manual smoke on emulator (`npx expo run:android`): add an interval task with a chosen start date → edit its title → confirm next occurrence unchanged; pause a task from ⋯ → confirm it disappears from hub, tagged «متوقف» on PetDetail → resume via form; mark an Upcoming row — checkbox inert, skip from ⋯ works; complete a today task — neutral toast, no cheer.
