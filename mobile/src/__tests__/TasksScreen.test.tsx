/**
 * Key design choices:
 * - Store mock exposes `windowOccurrences` (built RELATIVE to `new Date()` — keep that approach;
 *   hardcoded past dates fall outside the ±7d window).
 * - The action-sheet mock exports a hoisted `showActionSheetWithOptions` jest.fn so
 *   every `useActionSheet()` call in the component shares the same reference.
 * - Toast mock is the existing __mocks__/react-native-toast-message.js stub.
 * - `render` returns a Promise in this RTL v14 + jest-expo setup — always `await` it.
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

// ── i18n ──────────────────────────────────────────────────────────────────────
import i18n from "../i18n";
import TasksScreen from "../screens/tasks/TasksScreen";
import { toPersianDigits } from "../lib/jalali";
import { colors } from "../theme/theme";
import type { Occurrence } from "../db/types";
import { useActionSheet } from "@expo/react-native-action-sheet";
import Toast from "react-native-toast-message";

// ── Store mock ────────────────────────────────────────────────────────────────
const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockMarkOccurrence = jest.fn().mockResolvedValue(undefined);
const mockUnmarkOccurrence = jest.fn().mockResolvedValue(undefined);
const mockDeleteTask = jest.fn().mockResolvedValue(undefined);
const mockToggleActive = jest.fn().mockResolvedValue(undefined);
let mockWindowOccurrences: unknown[] = [];

jest.mock("../store/tasksStore", () => ({
  useTasksStore: (
    selector: (s: {
      windowOccurrences: unknown[];
      load: typeof mockLoad;
      markOccurrence: typeof mockMarkOccurrence;
      unmarkOccurrence: typeof mockUnmarkOccurrence;
      deleteTask: typeof mockDeleteTask;
      toggleActive: typeof mockToggleActive;
    }) => unknown,
  ) =>
    selector({
      windowOccurrences: mockWindowOccurrences,
      load: mockLoad,
      markOccurrence: mockMarkOccurrence,
      unmarkOccurrence: mockUnmarkOccurrence,
      deleteTask: mockDeleteTask,
      toggleActive: mockToggleActive,
    }),
}));

// ── petsStore mock ────────────────────────────────────────────────────────────
let mockPets: { id: string; name: string }[] = [{ id: "pet-1", name: "رکسی" }];

jest.mock("../store/petsStore", () => ({
  usePetsStore: (
    selector: (s: { pets: { id: string; name: string }[] }) => unknown,
  ) => selector({ pets: mockPets }),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();
jest.mock("@react-navigation/native", () => {
  const ReactLocal = require("react");
  return {
    ...jest.requireActual("@react-navigation/native"),
    useIsFocused: () => true,
    // Run the focus callback on mount (and its cleanup on unmount), mimicking a
    // single focus event without a real NavigationContainer.
    useFocusEffect: (cb: () => undefined | (() => void)) =>
      ReactLocal.useEffect(cb, [cb]),
    useNavigation: () => ({
      navigate: mockNavigate,
      getParent: () => ({ navigate: mockParentNavigate }),
    }),
  };
});

// ── Fixtures — dueAt RELATIVE to now ─────────────────────────────────────────
//
// `bucketOccurrences` uses `new Date()` at render time, so fixtures must be
// relative to produce consistent bucket placement across test runs.
//
// Tehran = UTC+03:30. Tehran-start-of-today ≈ (UTC midnight - 03:30).
// To guarantee bucket placement we use large enough offsets:
//   overdue  = dueAt 2 days ago (before Tehran start-of-today, within 7d look-back)
//   today    = dueAt +1h (within today's Tehran day window)
//   upcoming = dueAt +3 days (after end of today's Tehran day)

const NOW = Date.now();
const DUE_OVERDUE = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
const DUE_TODAY = new Date(NOW + 60 * 60 * 1000).toISOString(); // +1h
const DUE_UPCOMING = new Date(NOW + 3 * 24 * 60 * 60 * 1000).toISOString(); // +3d
const DUE_TODAY_LATE = new Date(NOW + 2 * 60 * 60 * 1000).toISOString(); // +2h

const makeOcc = (
  id: string,
  dueAt: string,
  status: Occurrence["status"] = "pending",
  scheduleKind: "daily_times" | "one_off" = "daily_times",
  petId = "pet-1",
  type: Occurrence["task"]["type"] = "feeding",
): Occurrence => ({
  task: {
    id,
    petId,
    type,
    title: null,
    schedule:
      scheduleKind === "one_off"
        ? { kind: "one_off", at: dueAt }
        : { kind: "daily_times", times: ["09:00"] },
    endKind: "never",
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  dueAt,
  status,
});

const OCC_OVERDUE = makeOcc("task-overdue", DUE_OVERDUE, "pending");
const OCC_TODAY = makeOcc("task-today", DUE_TODAY, "pending");
const OCC_TODAY_LATE = makeOcc("task-today-late", DUE_TODAY_LATE, "pending");
const OCC_UPCOMING = makeOcc("task-upcoming", DUE_UPCOMING, "pending");
const OCC_DONE = makeOcc("task-done", DUE_TODAY, "done");
const OCC_SKIPPED = makeOcc("task-skipped", DUE_TODAY, "skipped");
const OCC_ONE_OFF = makeOcc("task-oneoff", DUE_TODAY, "pending", "one_off");

beforeEach(() => {
  mockLoad.mockClear();
  mockMarkOccurrence.mockClear();
  mockUnmarkOccurrence.mockClear();
  mockDeleteTask.mockClear();
  mockToggleActive.mockClear();
  mockNavigate.mockClear();
  mockParentNavigate.mockClear();
  (Toast.show as jest.Mock).mockClear();
  (Toast.hide as jest.Mock).mockClear();
  // Reset the hoisted showActionSheetWithOptions
  (useActionSheet().showActionSheetWithOptions as jest.Mock).mockClear();
  mockWindowOccurrences = [];
  mockPets = [{ id: "pet-1", name: "رکسی" }];
});

// ── 0. Deferred focus reload ──────────────────────────────────────────────────
describe("TasksScreen – deferred focus reload", () => {
  test("defers load() past interactions instead of running it on the focus tick", async () => {
    // Capture the deferred callback instead of letting it run, so the assertion
    // is deterministic.
    let deferred: (() => void) | null = null;
    const spy = jest.spyOn(global, "requestIdleCallback").mockImplementation(((
      cb: () => void,
    ) => {
      deferred = cb;
      return 1;
    }) as never);

    try {
      mockWindowOccurrences = [OCC_TODAY];
      await render(<TasksScreen />);

      // The recompute must NOT run synchronously on focus — that's what stutters
      // the tab transition. It is scheduled for after the animation instead.
      expect(mockLoad).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);

      // Once interactions settle, the reload runs.
      expect(deferred).not.toBeNull();
      deferred!();
      expect(mockLoad).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

// ── 1. Whole-screen empty state ───────────────────────────────────────────────
describe("TasksScreen – empty state", () => {
  test("shows whole-screen empty state when all buckets are empty", async () => {
    mockWindowOccurrences = [];
    const { getByTestId } = await render(<TasksScreen />);
    expect(getByTestId("tasks-empty")).toBeTruthy();
  });

  test("does NOT show whole-screen empty when any bucket has items", async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { queryByTestId } = await render(<TasksScreen />);
    expect(queryByTestId("tasks-empty")).toBeNull();
  });
});

// ── 2. Section headers + count badges ────────────────────────────────────────
describe("TasksScreen – section headers", () => {
  test("renders all three section headers", async () => {
    mockWindowOccurrences = [OCC_OVERDUE, OCC_TODAY, OCC_UPCOMING];
    const { getByTestId } = await render(<TasksScreen />);
    expect(getByTestId("tasks-section-overdue")).toBeTruthy();
    expect(getByTestId("tasks-section-today")).toBeTruthy();
    expect(getByTestId("tasks-section-upcoming")).toBeTruthy();
  });

  test("section header text includes count", async () => {
    mockWindowOccurrences = [
      OCC_OVERDUE,
      OCC_TODAY,
      OCC_TODAY_LATE,
      OCC_UPCOMING,
    ];
    const { getByTestId } = await render(<TasksScreen />);
    // Section header view wraps a Text child — verify both sections have content
    expect(getByTestId("tasks-section-overdue")).toBeTruthy();
    expect(getByTestId("tasks-section-today")).toBeTruthy();
  });

  test("per-section empty rows render when bucket is empty", async () => {
    // Only today item — overdue and upcoming buckets empty
    mockWindowOccurrences = [OCC_TODAY];
    const { getByTestId, queryByTestId } = await render(<TasksScreen />);
    expect(getByTestId("tasks-empty-overdue")).toBeTruthy();
    expect(getByTestId("tasks-empty-upcoming")).toBeTruthy();
    // today bucket has an item — no per-section empty for it
    expect(queryByTestId("tasks-empty-today")).toBeNull();
  });
});

// ── 3. Checkbox → markOccurrence + Toast ─────────────────────────────────────
describe("TasksScreen – checkbox", () => {
  test('pressing checkbox calls markOccurrence(id, dueAt, "done") and shows toast', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-check-task-today"));

    await waitFor(() => {
      expect(mockMarkOccurrence).toHaveBeenCalledWith(
        "task-today",
        OCC_TODAY.dueAt,
        "done",
      );
      expect(Toast.show).toHaveBeenCalledTimes(1);
    });

    // The done toast is informational only — it names the pet; undo is via the
    // row checkbox, not a toast button.
    const toastArgs = (Toast.show as jest.Mock).mock.calls[0][0];
    expect(toastArgs.type).toBe("taskDone");
    expect(toastArgs.props.petName).toBe("رکسی");
  });

  test("pressing checkbox on done row reverts it (unmarkOccurrence, no mark)", async () => {
    mockWindowOccurrences = [OCC_DONE];
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-check-task-done"));
    expect(mockUnmarkOccurrence).toHaveBeenCalledWith(
      "task-done",
      OCC_DONE.dueAt,
    );
    expect(mockMarkOccurrence).not.toHaveBeenCalled();
  });

  test("done row renders dimmed (opacity 0.5)", async () => {
    mockWindowOccurrences = [OCC_DONE];
    const { getByTestId } = await render(<TasksScreen />);
    const row = getByTestId("tasks-row-task-done");
    const flatStyle = Array.isArray(row.props.style)
      ? Object.assign({}, ...row.props.style.filter(Boolean))
      : row.props.style;
    expect(flatStyle.opacity).toBe(0.5);
  });
});

// ── 4. ⋯ button → action sheet ───────────────────────────────────────────────
describe("TasksScreen – action sheet", () => {
  test("pressing ⋯ calls showActionSheetWithOptions", async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-more-task-today"));

    expect(showActionSheetWithOptions).toHaveBeenCalledTimes(1);
  });

  test('action-sheet index 0 (skip) → markOccurrence(..., "skipped")', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-more-task-today"));

    const [, callback] = (showActionSheetWithOptions as jest.Mock).mock
      .calls[0];
    callback(0);

    expect(mockMarkOccurrence).toHaveBeenCalledWith(
      "task-today",
      OCC_TODAY.dueAt,
      "skipped",
    );
  });

  test("action-sheet index 1 (edit) → navigate to TaskForm", async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-more-task-today"));

    const [, callback] = (showActionSheetWithOptions as jest.Mock).mock
      .calls[0];
    callback(1);

    expect(mockNavigate).toHaveBeenCalledWith("TaskForm", {
      petId: "pet-1",
      taskId: "task-today",
    });
  });

  test("action-sheet index 3 (delete) → deleteTask(id)", async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-more-task-today"));

    const [, callback] = (showActionSheetWithOptions as jest.Mock).mock
      .calls[0];
    callback(3);

    expect(mockDeleteTask).toHaveBeenCalledWith("task-today");
  });

  test("delete label is the recurring-delete translation for recurring task", async () => {
    mockWindowOccurrences = [OCC_TODAY]; // daily_times schedule
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-more-task-today"));

    const [opts] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    expect(opts.options[3]).toBe(i18n.t("tasks.action.delete_recurring"));
  });

  test("delete label is the one-off-delete translation for one-off task", async () => {
    mockWindowOccurrences = [OCC_ONE_OFF]; // one_off schedule
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-more-task-oneoff"));

    const [opts] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    expect(opts.options[3]).toBe(i18n.t("tasks.action.delete_one_off"));
  });

  test("destructiveButtonIndex is 3, cancelButtonIndex is 4", async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-more-task-today"));

    const [opts] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    expect(opts.destructiveButtonIndex).toBe(3);
    expect(opts.cancelButtonIndex).toBe(4);
  });

  it("offers pause in the row menu and calls toggleActive", async () => {
    mockWindowOccurrences = [makeOcc("t1", DUE_TODAY)];
    const screen = await render(<TasksScreen />);
    fireEvent.press(screen.getByTestId("tasks-more-t1"));

    const [opts, cb] = (
      useActionSheet().showActionSheetWithOptions as jest.Mock
    ).mock.calls.at(-1)!;
    expect(opts.options).toContain(i18n.t("tasks.action.pause"));
    expect(opts.destructiveButtonIndex).toBe(3);
    expect(opts.cancelButtonIndex).toBe(4);

    cb(2); // pause
    expect(mockToggleActive).toHaveBeenCalledWith("t1");
  });
});

// Tehran wall-clock HH:MM for a UTC ISO (fixed +03:30) — mirrors the screen's formatter
const tehranHHMM = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 210 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

// ── 5. Tehran time display ────────────────────────────────────────────────────
describe("TasksScreen – Tehran time display", () => {
  test("shows Tehran wall-clock time HH:MM (not UTC)", async () => {
    // Compute the expected Tehran display for DUE_TODAY
    const expectedTehran = (() => {
      const tehranMs =
        new Date(DUE_TODAY).getTime() + (3 * 60 + 30) * 60 * 1000;
      const d = new Date(tehranMs);
      const h = String(d.getUTCHours()).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      return toPersianDigits(`${h}:${m}`);
    })();

    mockWindowOccurrences = [makeOcc("task-time", DUE_TODAY)];
    const { getByText } = await render(<TasksScreen />);
    expect(getByText(expectedTehran)).toBeTruthy();
  });

  it("renders overdue times without alert color", async () => {
    mockWindowOccurrences = [makeOcc("late", DUE_OVERDUE)];
    const screen = await render(<TasksScreen />);
    const time = screen.getByText(toPersianDigits(tehranHHMM(DUE_OVERDUE)));
    const flat = StyleSheet.flatten(time.props.style);
    expect(flat.color).not.toBe(colors.danger);
  });
});

// ── 6. Skipped row is dimmed, no action on checkbox ──────────────────────────
describe("TasksScreen – skipped row", () => {
  test("skipped row renders dimmed and checkbox reverts it", async () => {
    mockWindowOccurrences = [OCC_SKIPPED];
    const { getByTestId } = await render(<TasksScreen />);

    const row = getByTestId("tasks-row-task-skipped");
    const flatStyle = Array.isArray(row.props.style)
      ? Object.assign({}, ...row.props.style.filter(Boolean))
      : row.props.style;
    expect(flatStyle.opacity).toBe(0.5);

    fireEvent.press(getByTestId("tasks-check-task-skipped"));
    expect(mockUnmarkOccurrence).toHaveBeenCalledWith(
      "task-skipped",
      OCC_SKIPPED.dueAt,
    );
    expect(mockMarkOccurrence).not.toHaveBeenCalled();
  });
});

// ── 6b. Future upcoming rows: done checkbox locked, skip-undo stays tappable ──
describe("TasksScreen – upcoming rows", () => {
  test("disables the done checkbox on upcoming rows but keeps skipped-undo tappable", async () => {
    mockWindowOccurrences = [
      makeOcc("fut-pending", DUE_UPCOMING),
      makeOcc("fut-skipped", DUE_UPCOMING, "skipped"),
    ];
    const screen = await render(<TasksScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("tasks-check-fut-pending"));
    });
    expect(mockMarkOccurrence).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByTestId("tasks-check-fut-skipped"));
    });
    expect(mockUnmarkOccurrence).toHaveBeenCalledWith(
      "fut-skipped",
      DUE_UPCOMING,
    );
  });
});

// ── 7. Row body tap → edit ───────────────────────────────────────────────────
describe("TasksScreen – row body tap", () => {
  test("tapping row body navigates to edit (not the action sheet)", async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-row-task-today"));

    expect(mockNavigate).toHaveBeenCalledWith("TaskForm", {
      petId: OCC_TODAY.task.petId,
      taskId: OCC_TODAY.task.id,
    });
    expect(showActionSheetWithOptions).not.toHaveBeenCalled();
  });
});

// ── 8. Progress indicator ─────────────────────────────────────────────────────
describe("TasksScreen – progress indicator", () => {
  test('shows today-progress with correct "N of M" (skipped excluded from denominator)', async () => {
    // 1 done + 2 pending + 1 skipped → denominator = 3 (skipped excluded), numerator = 1
    // If skipped were wrongly included the count would be 4, not 3.
    mockWindowOccurrences = [
      makeOcc("t-done", DUE_TODAY, "done"),
      makeOcc("t-pend1", DUE_TODAY, "pending"),
      makeOcc("t-pend2", DUE_TODAY_LATE, "pending"),
      makeOcc("t-skip", DUE_TODAY, "skipped"),
    ];
    const { getByTestId, getAllByTestId } = await render(<TasksScreen />);
    expect(getByTestId("tasks-progress")).toBeTruthy();
    // Each dot represents one item counted in the denominator (skipped excluded).
    // Expected 3 dots (done + pend1 + pend2). Would be 4 if skipped were wrongly counted.
    expect(getAllByTestId("progress-dot")).toHaveLength(3);
  });

  test("progress hidden when today denominator is 0 (no today items)", async () => {
    // Only overdue and upcoming, nothing in today
    mockWindowOccurrences = [OCC_OVERDUE, OCC_UPCOMING];
    const { queryByTestId } = await render(<TasksScreen />);
    expect(queryByTestId("tasks-progress")).toBeNull();
  });

  test("skipped-only today items: progress hidden (denominator 0)", async () => {
    // All today items are skipped → todayTotal = 0 → progress hidden
    mockWindowOccurrences = [makeOcc("t-skip", DUE_TODAY, "skipped")];
    const { queryByTestId } = await render(<TasksScreen />);
    expect(queryByTestId("tasks-progress")).toBeNull();
  });
});

// ── 9. Pet filter ─────────────────────────────────────────────────────────────
describe("TasksScreen – pet filter", () => {
  test("selecting a pet chip narrows rendered rows to that pet only", async () => {
    mockPets = [
      { id: "pet-1", name: "رکسی" },
      { id: "pet-2", name: "گربه" },
    ];
    const occ1 = makeOcc(
      "task-pet1",
      DUE_TODAY,
      "pending",
      "daily_times",
      "pet-1",
    );
    const occ2 = makeOcc(
      "task-pet2",
      DUE_TODAY_LATE,
      "pending",
      "daily_times",
      "pet-2",
    );
    mockWindowOccurrences = [occ1, occ2];

    const { getByTestId, queryByTestId } = await render(<TasksScreen />);

    // Both rows visible initially
    expect(getByTestId("tasks-row-task-pet1")).toBeTruthy();
    expect(getByTestId("tasks-row-task-pet2")).toBeTruthy();

    // Select pet-1 chip
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-pet-pet-1"));
    });

    // pet-1 row still visible, pet-2 row gone
    expect(getByTestId("tasks-row-task-pet1")).toBeTruthy();
    expect(queryByTestId("tasks-row-task-pet2")).toBeNull();
  });

  test("tapping selected pet chip resets to All", async () => {
    mockPets = [
      { id: "pet-1", name: "رکسی" },
      { id: "pet-2", name: "گربه" },
    ];
    const occ1 = makeOcc(
      "task-p1",
      DUE_TODAY,
      "pending",
      "daily_times",
      "pet-1",
    );
    const occ2 = makeOcc(
      "task-p2",
      DUE_TODAY_LATE,
      "pending",
      "daily_times",
      "pet-2",
    );
    mockWindowOccurrences = [occ1, occ2];

    const { getByTestId } = await render(<TasksScreen />);

    // Select pet-1, then tap again to deselect
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-pet-pet-1"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-pet-pet-1"));
    });

    // Both rows back
    expect(getByTestId("tasks-row-task-p1")).toBeTruthy();
    expect(getByTestId("tasks-row-task-p2")).toBeTruthy();
  });
});

// ── 10. Type filter ───────────────────────────────────────────────────────────
describe("TasksScreen – type filter", () => {
  test("opening type filter modal and applying a type narrows rows", async () => {
    const feedingOcc = makeOcc(
      "task-feed",
      DUE_TODAY,
      "pending",
      "daily_times",
      "pet-1",
      "feeding",
    );
    const medsOcc = makeOcc(
      "task-meds",
      DUE_TODAY_LATE,
      "pending",
      "daily_times",
      "pet-1",
      "meds",
    );
    mockWindowOccurrences = [feedingOcc, medsOcc];

    const { getByTestId, queryByTestId } = await render(<TasksScreen />);

    // Both rows visible
    expect(getByTestId("tasks-row-task-feed")).toBeTruthy();
    expect(getByTestId("tasks-row-task-meds")).toBeTruthy();

    // Open modal
    await act(async () => {
      fireEvent.press(getByTestId("tasks-type-filter"));
    });

    // Toggle "feeding" chip
    await act(async () => {
      fireEvent.press(getByTestId("type-chip-feeding"));
    });

    // Apply
    await act(async () => {
      fireEvent.press(getByTestId("type-filter-apply"));
    });

    // Only feeding row visible
    expect(getByTestId("tasks-row-task-feed")).toBeTruthy();
    expect(queryByTestId("tasks-row-task-meds")).toBeNull();
  });

  test("clear in modal empties the type filter draft", async () => {
    const feedingOcc = makeOcc(
      "task-f2",
      DUE_TODAY,
      "pending",
      "daily_times",
      "pet-1",
      "feeding",
    );
    const medsOcc = makeOcc(
      "task-m2",
      DUE_TODAY_LATE,
      "pending",
      "daily_times",
      "pet-1",
      "meds",
    );
    mockWindowOccurrences = [feedingOcc, medsOcc];

    const { getByTestId } = await render(<TasksScreen />);

    // Open modal, toggle feeding, then clear, then apply
    await act(async () => {
      fireEvent.press(getByTestId("tasks-type-filter"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("type-chip-feeding"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("type-filter-clear"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("type-filter-apply"));
    });

    // Both rows back (filter cleared)
    expect(getByTestId("tasks-row-task-f2")).toBeTruthy();
    expect(getByTestId("tasks-row-task-m2")).toBeTruthy();
  });

  test("offers every task type in the filter modal, including water", async () => {
    mockWindowOccurrences = [makeOcc("t1", DUE_TODAY)];
    const screen = await render(<TasksScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("tasks-type-filter"));
    });
    for (const ct of [
      "feeding",
      "water",
      "meds",
      "play",
      "grooming",
      "vet",
      "other",
    ]) {
      expect(screen.getByTestId(`type-chip-${ct}`)).toBeTruthy();
    }
  });
});

// ── 11. Combined AND filter ───────────────────────────────────────────────────
describe("TasksScreen – combined pet + type filter", () => {
  test("pet AND type together narrow to intersection", async () => {
    mockPets = [
      { id: "pet-1", name: "رکسی" },
      { id: "pet-2", name: "گربه" },
    ];
    // pet-1 feeding, pet-1 meds, pet-2 feeding
    const occ_p1_feed = makeOcc(
      "c-p1f",
      DUE_TODAY,
      "pending",
      "daily_times",
      "pet-1",
      "feeding",
    );
    const occ_p1_meds = makeOcc(
      "c-p1m",
      DUE_TODAY_LATE,
      "pending",
      "daily_times",
      "pet-1",
      "meds",
    );
    const occ_p2_feed = makeOcc(
      "c-p2f",
      DUE_TODAY,
      "pending",
      "daily_times",
      "pet-2",
      "feeding",
    );
    mockWindowOccurrences = [occ_p1_feed, occ_p1_meds, occ_p2_feed];

    const { getByTestId, queryByTestId } = await render(<TasksScreen />);

    // Select pet-1
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-pet-pet-1"));
    });

    // Apply type=feeding via modal
    await act(async () => {
      fireEvent.press(getByTestId("tasks-type-filter"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("type-chip-feeding"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("type-filter-apply"));
    });

    // Only pet-1 + feeding survives
    expect(getByTestId("tasks-row-c-p1f")).toBeTruthy();
    expect(queryByTestId("tasks-row-c-p1m")).toBeNull();
    expect(queryByTestId("tasks-row-c-p2f")).toBeNull();
  });
});

// ── 12. FAB ──────────────────────────────────────────────────────────────────
describe("TasksScreen – FAB", () => {
  test("pressing today-fab navigates to TaskForm (with data)", async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { getByTestId } = await render(<TasksScreen />);
    fireEvent.press(getByTestId("tasks-fab"));
    expect(mockNavigate).toHaveBeenCalledWith("TaskForm", {});
  });

  test("pressing today-fab navigates to TaskForm (empty state)", async () => {
    mockWindowOccurrences = [];
    const { getByTestId } = await render(<TasksScreen />);
    fireEvent.press(getByTestId("tasks-fab"));
    expect(mockNavigate).toHaveBeenCalledWith("TaskForm", {});
  });

  test("pressing fab with no pets shows the hint toast and does NOT open TaskForm", async () => {
    mockPets = [];
    mockWindowOccurrences = [];
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-fab"));

    expect(Toast.show).toHaveBeenCalledTimes(1);
    const args = (Toast.show as jest.Mock).mock.calls[0][0];
    expect(args.type).toBe("hint");
    expect(mockNavigate).not.toHaveBeenCalledWith("TaskForm", {});
  });

  test("tapping the no-pets hint toast navigates to the Pets tab", async () => {
    mockPets = [];
    mockWindowOccurrences = [];
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-fab"));
    const args = (Toast.show as jest.Mock).mock.calls[0][0];
    args.onPress();

    expect(mockParentNavigate).toHaveBeenCalledWith("Pets");
  });
});

// ── 13. Filter-empty state (no-match) ────────────────────────────────────────
describe("TasksScreen – filter-empty (no-match)", () => {
  test("filters that match nothing show today-no-match (not today-empty)", async () => {
    mockPets = [
      { id: "pet-1", name: "رکسی" },
      { id: "pet-2", name: "گربه" },
    ];
    // Only pet-1 data in window
    mockWindowOccurrences = [
      makeOcc("c-only", DUE_TODAY, "pending", "daily_times", "pet-1"),
    ];

    const { getByTestId, queryByTestId } = await render(<TasksScreen />);

    // Select pet-2 (no data for this pet)
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-pet-pet-2"));
    });

    expect(getByTestId("tasks-no-match")).toBeTruthy();
    expect(queryByTestId("tasks-empty")).toBeNull();
  });

  test("clearing filters from no-match state restores the list", async () => {
    mockPets = [
      { id: "pet-1", name: "رکسی" },
      { id: "pet-2", name: "گربه" },
    ];
    mockWindowOccurrences = [
      makeOcc("c-restore", DUE_TODAY, "pending", "daily_times", "pet-1"),
    ];

    const { getByTestId, queryByTestId } = await render(<TasksScreen />);

    // Trigger no-match
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-pet-pet-2"));
    });
    expect(getByTestId("tasks-no-match")).toBeTruthy();

    // Clear via the "All" chip
    await act(async () => {
      fireEvent.press(getByTestId("tasks-filter-pet-all"));
    });

    expect(queryByTestId("tasks-no-match")).toBeNull();
    expect(getByTestId("tasks-row-c-restore")).toBeTruthy();
  });

  test("genuine empty (no window data) still shows today-empty (not no-match)", async () => {
    mockWindowOccurrences = [];
    const { getByTestId, queryByTestId } = await render(<TasksScreen />);
    expect(getByTestId("tasks-empty")).toBeTruthy();
    expect(queryByTestId("tasks-no-match")).toBeNull();
  });
});
