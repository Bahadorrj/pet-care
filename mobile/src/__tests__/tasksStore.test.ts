/**
 * tasksStore tests — TDD Red → Green
 *
 * Covers:
 * 1. add → list reflects in store state
 * 2. update reflects in store state
 * 3. delete reflects in store state
 * 4. markOccurrence writes a log and refreshes today's occurrences
 * 5. toggleActive flips the active flag
 * 6. deleting a pet via petsStore removes its tasks + logs (no orphans)
 * 7. validation: rejects a task with an empty schedule
 *
 * The `mock`-prefix trick: jest.mock factories are hoisted to the top of the
 * file, before any imports. Variables referenced inside the factory must be
 * declared with a `mock`-prefixed name so Babel's hoisting analysis allows it.
 */

// ---------------------------------------------------------------------------
// Shared in-memory store — `mock`-prefixed so jest allows the factory to
// reference it after hoisting.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { Schedule } from "../db/types";

type Row = Record<string, unknown>;

interface MockStore {
  pets: Row[];
  tasks: Row[];
  task_logs: Row[];
}

// `mock`-prefixed name is required by jest hoisting rules
const mockStore: MockStore = { pets: [], tasks: [], task_logs: [] };

// ---------------------------------------------------------------------------
// expo-sqlite mock
// ---------------------------------------------------------------------------

jest.mock("expo-sqlite", () => {
  // `mockStore` is allowed because of the `mock`-prefix convention
  const s = mockStore;

  const db = {
    runSync(sql: string, params: unknown[] = []) {
      const u = sql.trim().toUpperCase().replace(/\s+/g, " ");

      if (u.startsWith("CREATE TABLE")) return;

      // ---- pets ----
      if (u.startsWith("INSERT INTO PETS")) {
        const [
          id,
          name,
          species,
          gender,
          photo_uri,
          notes,
          breed,
          weight_value,
          weight_unit,
          created_at,
          updated_at,
        ] = params;
        s.pets.push({
          id,
          name,
          species,
          gender,
          photo_uri,
          notes,
          breed,
          weight_value,
          weight_unit,
          created_at,
          updated_at,
        });
        return;
      }
      if (u.startsWith("UPDATE PETS")) {
        const [
          name,
          species,
          gender,
          photo_uri,
          notes,
          breed,
          weight_value,
          weight_unit,
          updated_at,
          id,
        ] = params;
        const row = s.pets.find((r) => r.id === id);
        if (row)
          Object.assign(row, {
            name,
            species,
            gender,
            photo_uri,
            notes,
            breed,
            weight_value,
            weight_unit,
            updated_at,
          });
        return;
      }
      if (u.startsWith("DELETE FROM PETS")) {
        const [id] = params as string[];
        s.pets = s.pets.filter((r) => r.id !== id);
        return;
      }

      // ---- tasks ----
      if (u.startsWith("INSERT INTO TASKS ")) {
        const [
          id,
          pet_id,
          type,
          title,
          schedule_json,
          end_kind,
          end_until,
          end_count,
          active,
          created_at,
          updated_at,
        ] = params;
        s.tasks.push({
          id,
          pet_id,
          type,
          title,
          schedule_json,
          end_kind,
          end_until,
          end_count,
          active,
          created_at,
          updated_at,
        });
        return;
      }
      if (u.startsWith("UPDATE TASKS SET")) {
        const [
          type,
          title,
          schedule_json,
          end_kind,
          end_until,
          end_count,
          active,
          updated_at,
          id,
        ] = params;
        const row = s.tasks.find((r) => r.id === id);
        if (row)
          Object.assign(row, {
            type,
            title,
            schedule_json,
            end_kind,
            end_until,
            end_count,
            active,
            updated_at,
          });
        return;
      }
      if (u.startsWith("DELETE FROM TASKS WHERE ID")) {
        const [id] = params as string[];
        s.tasks = s.tasks.filter((r) => r.id !== id);
        return;
      }
      if (u.startsWith("DELETE FROM TASKS WHERE PET_ID")) {
        const [pet_id] = params as string[];
        s.tasks = s.tasks.filter((r) => r.pet_id !== pet_id);
        return;
      }

      // ---- task_logs ----
      if (u.startsWith("INSERT INTO TASK_LOGS") && u.includes("ON CONFLICT")) {
        const [id, task_id, due_at, status, created_at] = params as string[];
        const existing = s.task_logs.find(
          (r) => r.task_id === task_id && r.due_at === due_at,
        );
        if (existing) {
          existing.status = status;
        } else {
          s.task_logs.push({ id, task_id, due_at, status, created_at });
        }
        return;
      }
      if (u.startsWith("DELETE FROM TASK_LOGS WHERE TASK_ID")) {
        const [task_id] = params as string[];
        s.task_logs = s.task_logs.filter((r) => r.task_id !== task_id);
        return;
      }
    },

    getAllSync<T>(sql: string, params: unknown[] = []): T[] {
      const u = sql.trim().toUpperCase().replace(/\s+/g, " ");

      // pets
      if (u.includes("FROM PETS")) {
        return [...s.pets].sort((a, b) =>
          (a.created_at as string) < (b.created_at as string) ? 1 : -1,
        ) as unknown as T[];
      }

      // tasks by pet
      if (u.includes("FROM TASKS") && u.includes("PET_ID")) {
        const [pet_id] = params as string[];
        return s.tasks.filter((r) => r.pet_id === pet_id) as unknown as T[];
      }
      // all tasks
      if (u.includes("FROM TASKS")) {
        return [...s.tasks] as unknown as T[];
      }

      // task_id + due_at exact match (post-upsert lookup)
      if (
        u.includes("FROM TASK_LOGS") &&
        u.includes("AND DUE_AT") &&
        !u.includes("LIKE")
      ) {
        const [task_id, due_at] = params as string[];
        return s.task_logs.filter(
          (r) => r.task_id === task_id && r.due_at === due_at,
        ) as unknown as T[];
      }
      // getLogsForTask
      if (u.includes("FROM TASK_LOGS") && u.includes("TASK_ID")) {
        const [task_id] = params as string[];
        return s.task_logs.filter(
          (r) => r.task_id === task_id,
        ) as unknown as T[];
      }
      // getLogsForDay
      if (u.includes("FROM TASK_LOGS") && u.includes("LIKE")) {
        const [pattern] = params as string[];
        const day = (pattern as string).replace(/%/g, "");
        return s.task_logs.filter((r) =>
          (r.due_at as string).startsWith(day),
        ) as unknown as T[];
      }

      return [] as T[];
    },

    getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
      const u = sql.trim().toUpperCase().replace(/\s+/g, " ");

      if (u.includes("FROM PETS")) {
        const [id] = params as string[];
        return (s.pets.find((r) => r.id === id) ?? null) as T | null;
      }
      if (u.includes("FROM TASKS")) {
        const [id] = params as string[];
        return (s.tasks.find((r) => r.id === id) ?? null) as T | null;
      }
      return null;
    },
  };

  return { openDatabaseSync: () => db };
});

// ---------------------------------------------------------------------------
// expo-crypto mock — deterministic UUIDs
// ---------------------------------------------------------------------------

const mockUuidState = { counter: 0 };
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => `uuid-${++mockUuidState.counter}`),
}));

// ---------------------------------------------------------------------------
// petPhoto mock (required by petsStore)
// ---------------------------------------------------------------------------

jest.mock("../lib/petPhoto", () => ({
  savePhoto: jest.fn(async (uri: string) => uri),
  deletePhoto: jest.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A daily_times task due at 08:00 Tehran */
const DAILY_SCHEDULE: Schedule = { kind: "daily_times", times: ["08:00"] };

function makeTaskInput(petId = "pet-1") {
  return {
    petId,
    type: "feeding" as const,
    title: "Morning feed",
    schedule: DAILY_SCHEDULE,
    endKind: "never" as const,
    endUntil: null,
    endCount: null,
    active: true,
  };
}

/** Load a fresh tasksStore module (re-executes module-level listTasks()) */
function loadFreshTasksStore() {
  let mod: typeof import("../store/tasksStore");
  jest.isolateModules(() => {
    mod = require("../store/tasksStore");
  });
  return mod!;
}

function loadFreshPetsStore() {
  let mod: typeof import("../store/petsStore");
  jest.isolateModules(() => {
    mod = require("../store/petsStore");
  });
  return mod!;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.pets = [];
  mockStore.tasks = [];
  mockStore.task_logs = [];
  mockUuidState.counter = 0;
  jest.useFakeTimers();
  // "now" = Tehran 2026-06-20 10:00 → UTC 2026-06-20T06:30:00Z
  // (past the 08:00 occurrence so it shows as "missed" before marking)
  jest.setSystemTime(new Date("2026-06-20T06:30:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. add → list
// ---------------------------------------------------------------------------

describe("tasksStore – add", () => {
  test("addTask inserts a task and it appears in store.tasks", async () => {
    const { useTasksStore } = loadFreshTasksStore();

    await useTasksStore.getState().addTask(makeTaskInput());

    const { tasks } = useTasksStore.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].petId).toBe("pet-1");
    expect(tasks[0].type).toBe("feeding");
    expect(tasks[0].active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. update
// ---------------------------------------------------------------------------

describe("tasksStore – update", () => {
  test("updateTask changes type+title and reflects in store", async () => {
    const { useTasksStore } = loadFreshTasksStore();

    await useTasksStore.getState().addTask(makeTaskInput());
    const id = useTasksStore.getState().tasks[0].id;

    await useTasksStore.getState().updateTask(id, {
      type: "meds",
      title: "Evening meds",
      schedule: DAILY_SCHEDULE,
      endKind: "never",
      endUntil: null,
      endCount: null,
      active: true,
    });

    const { tasks } = useTasksStore.getState();
    expect(tasks[0].type).toBe("meds");
    expect(tasks[0].title).toBe("Evening meds");
  });
});

// ---------------------------------------------------------------------------
// 3. delete
// ---------------------------------------------------------------------------

describe("tasksStore – delete", () => {
  test("deleteTask removes the task from store", async () => {
    const { useTasksStore } = loadFreshTasksStore();

    await useTasksStore.getState().addTask(makeTaskInput());
    const id = useTasksStore.getState().tasks[0].id;

    await useTasksStore.getState().deleteTask(id);

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. toggleActive
// ---------------------------------------------------------------------------

describe("tasksStore – toggleActive", () => {
  test("toggleActive flips the active flag from true to false", async () => {
    const { useTasksStore } = loadFreshTasksStore();

    await useTasksStore.getState().addTask(makeTaskInput()); // active: true
    const id = useTasksStore.getState().tasks[0].id;

    await useTasksStore.getState().toggleActive(id);

    expect(useTasksStore.getState().tasks[0].active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. markOccurrence → refreshes occurrences
// ---------------------------------------------------------------------------

describe("tasksStore – markOccurrence", () => {
  test("markOccurrence writes a log and status flips to done in today occurrences", async () => {
    // createdAt must be before today so origin ≤ today
    jest.setSystemTime(new Date("2026-06-18T10:00:00.000Z"));
    const { useTasksStore } = loadFreshTasksStore();
    await useTasksStore.getState().addTask(makeTaskInput());

    // Move to "now" = Tehran 2026-06-20 10:00 (after 08:00 occurrence)
    jest.setSystemTime(new Date("2026-06-20T06:30:00.000Z"));

    // load() recomputes today's occurrences
    await useTasksStore.getState().load();

    const occs = useTasksStore.getState().occurrences;
    expect(occs.length).toBeGreaterThan(0);

    const occ = occs[0];
    expect(occ.status).toBe("missed"); // past due, no log yet

    await useTasksStore
      .getState()
      .markOccurrence(occ.task.id, occ.dueAt, "done");

    const occsAfter = useTasksStore.getState().occurrences;
    const marked = occsAfter.find(
      (o) => o.task.id === occ.task.id && o.dueAt === occ.dueAt,
    );
    expect(marked?.status).toBe("done");
  });

  test("markOccurrence with skipped also refreshes occurrence to skipped", async () => {
    jest.setSystemTime(new Date("2026-06-18T10:00:00.000Z"));
    const { useTasksStore } = loadFreshTasksStore();
    await useTasksStore.getState().addTask(makeTaskInput());

    jest.setSystemTime(new Date("2026-06-20T06:30:00.000Z"));
    await useTasksStore.getState().load();

    const occ = useTasksStore.getState().occurrences[0];
    await useTasksStore
      .getState()
      .markOccurrence(occ.task.id, occ.dueAt, "skipped");

    const marked = useTasksStore
      .getState()
      .occurrences.find(
        (o) => o.task.id === occ.task.id && o.dueAt === occ.dueAt,
      );
    expect(marked?.status).toBe("skipped");
  });
});

// ---------------------------------------------------------------------------
// 5b. Notification re-sync seam — only schedule-changing ops re-sync
// ---------------------------------------------------------------------------

describe("tasksStore – notification re-sync seam", () => {
  test("addTask triggers a notification re-sync", async () => {
    const { useTasksStore, setTasksSyncNotifications } = loadFreshTasksStore();
    const syncSpy = jest.fn();
    setTasksSyncNotifications(syncSpy);

    await useTasksStore.getState().addTask(makeTaskInput());

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  test("markOccurrence / unmarkOccurrence do NOT re-sync notifications", async () => {
    // Completing an occurrence never changes which future occurrences are
    // scheduled, so it must not cancel + reschedule the notification set.
    jest.setSystemTime(new Date("2026-06-18T10:00:00.000Z"));
    const { useTasksStore, setTasksSyncNotifications } = loadFreshTasksStore();
    await useTasksStore.getState().addTask(makeTaskInput());

    jest.setSystemTime(new Date("2026-06-20T06:30:00.000Z"));
    await useTasksStore.getState().load();
    const occ = useTasksStore.getState().occurrences[0];

    // Install the spy only now, so addTask's own sync isn't counted.
    const syncSpy = jest.fn();
    setTasksSyncNotifications(syncSpy);

    await useTasksStore
      .getState()
      .markOccurrence(occ.task.id, occ.dueAt, "done");
    await useTasksStore.getState().unmarkOccurrence(occ.task.id, occ.dueAt);

    expect(syncSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Pet-delete cascade
// ---------------------------------------------------------------------------

describe("petsStore – remove cascades to tasks + logs", () => {
  test("deleting a pet removes its tasks and logs, other pet tasks survive", async () => {
    // Two pets
    const { usePetsStore } = loadFreshPetsStore();
    await usePetsStore.getState().add({
      name: "Buddy",
      species: "dog",
      gender: null,
      photoUri: null,
      notes: null,
    });
    await usePetsStore.getState().add({
      name: "Kitty",
      species: "cat",
      gender: null,
      photoUri: null,
      notes: null,
    });

    const pets = usePetsStore.getState().pets;
    const petA = pets.find((p) => p.name === "Buddy")!;
    const petB = pets.find((p) => p.name === "Kitty")!;

    // Tasks for both pets
    const { useTasksStore } = loadFreshTasksStore();
    await useTasksStore.getState().addTask(makeTaskInput(petA.id));
    const taskA = useTasksStore.getState().tasks[0];

    await useTasksStore.getState().addTask(makeTaskInput(petB.id));

    // A log for taskA
    const {
      logOccurrence,
      listTasksByPet,
      getLogsForTask,
    } = require("../db/tasks");
    logOccurrence(taskA.id, "2026-06-20T04:30:00.000Z", "done");

    expect(listTasksByPet(petA.id)).toHaveLength(1);
    expect(listTasksByPet(petB.id)).toHaveLength(1);
    expect(getLogsForTask(taskA.id)).toHaveLength(1);

    // Delete petA — should cascade to tasks + logs
    await usePetsStore.getState().remove(petA.id);

    expect(listTasksByPet(petA.id)).toHaveLength(0);
    expect(getLogsForTask(taskA.id)).toHaveLength(0);
    expect(listTasksByPet(petB.id)).toHaveLength(1);

    // Reload the tasks store and confirm in-memory state
    await useTasksStore.getState().load();
    const remaining = useTasksStore.getState().tasks;
    expect(remaining.some((c) => c.petId === petA.id)).toBe(false);
    expect(remaining.some((c) => c.petId === petB.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Validation — empty schedule rejected
// ---------------------------------------------------------------------------

describe("tasksStore – validation", () => {
  test("rejects a daily_times task with no times", async () => {
    const { useTasksStore } = loadFreshTasksStore();

    await expect(
      useTasksStore.getState().addTask({
        ...makeTaskInput(),
        schedule: { kind: "daily_times", times: [] },
      }),
    ).rejects.toThrow("tasks.error.schedule_empty");

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  test("rejects a weekdays task with no days", async () => {
    const { useTasksStore } = loadFreshTasksStore();

    await expect(
      useTasksStore.getState().addTask({
        ...makeTaskInput(),
        schedule: { kind: "weekdays", days: [], times: ["08:00"] },
      }),
    ).rejects.toThrow("tasks.error.schedule_empty");

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  test("rejects a weekdays task with no times", async () => {
    const { useTasksStore } = loadFreshTasksStore();

    await expect(
      useTasksStore.getState().addTask({
        ...makeTaskInput(),
        schedule: { kind: "weekdays", days: [1, 3], times: [] },
      }),
    ).rejects.toThrow("tasks.error.schedule_empty");

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. toggleActive removes task from Today occurrences
// ---------------------------------------------------------------------------

describe("tasksStore – toggleActive excludes from occurrences", () => {
  test("inactive task is absent from occurrences; active task remains present", async () => {
    // Create both tasks before "today" so their origin ≤ today
    jest.setSystemTime(new Date("2026-06-18T10:00:00.000Z"));
    const { useTasksStore } = loadFreshTasksStore();

    // Add two active tasks
    await useTasksStore.getState().addTask(makeTaskInput());
    await useTasksStore.getState().addTask(makeTaskInput());

    const [taskA, taskB] = useTasksStore.getState().tasks;

    // Advance to "now" = Tehran 2026-06-20 10:00 (after 08:00 occurrence)
    jest.setSystemTime(new Date("2026-06-20T06:30:00.000Z"));

    // Both tasks should appear before toggling
    await useTasksStore.getState().load();
    expect(
      useTasksStore.getState().occurrences.some((o) => o.task.id === taskA.id),
    ).toBe(true);
    expect(
      useTasksStore.getState().occurrences.some((o) => o.task.id === taskB.id),
    ).toBe(true);

    // Toggle taskA inactive
    await useTasksStore.getState().toggleActive(taskA.id);

    const occs = useTasksStore.getState().occurrences;
    // Inactive task must be absent
    expect(occs.some((o) => o.task.id === taskA.id)).toBe(false);
    // Active task must still be present
    expect(occs.some((o) => o.task.id === taskB.id)).toBe(true);
  });
});
