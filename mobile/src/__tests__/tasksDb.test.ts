/**
 * DB-layer tests for src/db/tasks.ts.
 *
 * The jest.mock factory is hoisted before module-level code runs, so the
 * entire in-memory store lives inside the factory closure. A shared `store`
 * object (mutated by reference) lets beforeEach reset state from test scope.
 */

import type { Schedule } from '../db/types';

// ---------------------------------------------------------------------------
// Shared store — allocated once, mutated by reference so the factory and
// test helpers see the same object after jest.mock hoisting.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface Store {
  tasks: Row[];
  task_logs: Row[];
}

const store: Store = { tasks: [], task_logs: [] };

// ---------------------------------------------------------------------------
// expo-sqlite mock  (overrides __mocks__/expo-sqlite.js for this file)
// ---------------------------------------------------------------------------

jest.mock('expo-sqlite', () => {
  // `store` is captured by reference from the enclosing module scope.
  // jest.mock factory runs after hoisting but before any import, so by the
  // time this runs `store` is already initialised.
  const s = store; // alias inside factory

  const db = {
    runSync(sql: string, params: unknown[] = []) {
      const u = sql.trim().toUpperCase().replace(/\s+/g, ' ');

      if (u.startsWith('CREATE TABLE')) return;

      // ---- tasks ----
      if (u.startsWith('INSERT INTO TASKS ')) {
        const [id, pet_id, type, title, schedule_json, end_kind, end_until, end_count, active, created_at, updated_at] =
          params;
        s.tasks.push({ id, pet_id, type, title, schedule_json, end_kind, end_until, end_count, active, created_at, updated_at });
        return;
      }
      if (u.startsWith('UPDATE TASKS SET')) {
        const [type, title, schedule_json, end_kind, end_until, end_count, active, updated_at, id] = params;
        const row = s.tasks.find((r) => r.id === id);
        if (row) Object.assign(row, { type, title, schedule_json, end_kind, end_until, end_count, active, updated_at });
        return;
      }
      if (u.startsWith('DELETE FROM TASKS WHERE ID')) {
        const [id] = params as string[];
        s.tasks = s.tasks.filter((r) => r.id !== id);
        return;
      }
      if (u.startsWith('DELETE FROM TASKS WHERE PET_ID')) {
        const [pet_id] = params as string[];
        s.tasks = s.tasks.filter((r) => r.pet_id !== pet_id);
        return;
      }

      // ---- task_logs (upsert) ----
      if (u.startsWith('INSERT INTO TASK_LOGS') && u.includes('ON CONFLICT')) {
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

      // ---- delete logs for a task ----
      if (u.startsWith('DELETE FROM TASK_LOGS WHERE TASK_ID')) {
        const [task_id] = params as string[];
        s.task_logs = s.task_logs.filter((r) => r.task_id !== task_id);
        return;
      }
    },

    getAllSync<T>(sql: string, params: unknown[] = []): T[] {
      const u = sql.trim().toUpperCase().replace(/\s+/g, ' ');

      if (u.includes('FROM TASKS') && u.includes('PET_ID')) {
        const [pet_id] = params as string[];
        return s.tasks.filter((r) => r.pet_id === pet_id) as unknown as T[];
      }
      if (u.includes('FROM TASKS')) {
        return [...s.tasks] as unknown as T[];
      }
      // task_id AND due_at exact match (used by logOccurrence post-upsert lookup)
      // Must check for WHERE ... AND DUE_AT (not just ORDER BY due_at)
      if (u.includes('FROM TASK_LOGS') && u.includes('AND DUE_AT') && !u.includes('LIKE')) {
        const [task_id, due_at] = params as string[];
        return s.task_logs.filter(
          (r) => r.task_id === task_id && r.due_at === due_at,
        ) as unknown as T[];
      }
      // getLogsForTask — task_id only
      if (u.includes('FROM TASK_LOGS') && u.includes('TASK_ID')) {
        const [task_id] = params as string[];
        return s.task_logs.filter((r) => r.task_id === task_id) as unknown as T[];
      }
      // getLogsForDay — LIKE day%
      if (u.includes('FROM TASK_LOGS') && u.includes('LIKE')) {
        const [pattern] = params as string[];
        const day = (pattern as string).replace(/%/g, '');
        return s.task_logs.filter((r) =>
          (r.due_at as string).startsWith(day),
        ) as unknown as T[];
      }

      return [] as T[];
    },

    getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
      const u = sql.trim().toUpperCase().replace(/\s+/g, ' ');
      if (u.includes('FROM TASKS')) {
        const [id] = params as string[];
        return (s.tasks.find((r) => r.id === id) ?? null) as T | null;
      }
      return null;
    },
  };

  return { openDatabaseSync: () => db };
});

// ---------------------------------------------------------------------------
// expo-crypto mock
// ---------------------------------------------------------------------------

jest.mock('expo-crypto', () => {
  let callCount = 0;
  const ids = [
    'uuid-task-1',
    'uuid-log-1',
    'uuid-log-2',
    'uuid-task-2',
    'uuid-log-3',
    'uuid-task-3',
    'uuid-log-4',
    'uuid-log-5',
  ];
  return {
    randomUUID: () => ids[callCount++] ?? `uuid-extra-${callCount}`,
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks are declared so hoisting takes effect)
// ---------------------------------------------------------------------------

import {
  insertTask,
  listTasks,
  listTasksByPet,
  getTask,
  updateTask,
  deleteTask,
  logOccurrence,
  getLogsForTask,
  getLogsForDay,
  deleteTasksForPet,
} from '../db/tasks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAILY_SCHEDULE: Schedule = { kind: 'daily_times', times: ['08:00', '18:00'] };

function makeTaskInput(petId = 'pet-1') {
  return {
    petId,
    type: 'feeding' as const,
    title: 'Morning feed',
    schedule: DAILY_SCHEDULE,
    endKind: 'never' as const,
    endUntil: null,
    endCount: null,
    active: true,
  };
}

beforeEach(() => {
  store.tasks = [];
  store.task_logs = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insertTask + getTask (round-trip)', () => {
  it('stores and retrieves a task with schedule serialized/deserialized', () => {
    const task = insertTask(makeTaskInput());

    expect(task.petId).toBe('pet-1');
    expect(task.type).toBe('feeding');
    expect(task.title).toBe('Morning feed');
    expect(task.active).toBe(true);
    // schedule round-trips as deep-equal
    expect(task.schedule).toEqual(DAILY_SCHEDULE);

    const fetched = getTask(task.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.schedule).toEqual(DAILY_SCHEDULE);
    expect(fetched!.active).toBe(true);
  });

  it('returns null for unknown id', () => {
    expect(getTask('nonexistent')).toBeNull();
  });
});

describe('listTasks / listTasksByPet', () => {
  it('lists all tasks and filters by pet', () => {
    insertTask(makeTaskInput('pet-A'));
    insertTask(makeTaskInput('pet-B'));

    expect(listTasks()).toHaveLength(2);
    expect(listTasksByPet('pet-A')).toHaveLength(1);
    expect(listTasksByPet('pet-A')[0].petId).toBe('pet-A');
    expect(listTasksByPet('missing')).toHaveLength(0);
  });
});

describe('updateTask', () => {
  it('persists changed fields including schedule and active flag', () => {
    const task = insertTask(makeTaskInput());
    const newSchedule: Schedule = { kind: 'weekdays', days: [1, 3, 5], times: ['09:00'] };

    const updated = updateTask(task.id, {
      type: 'meds',
      title: 'Evening meds',
      schedule: newSchedule,
      endKind: 'after_n',
      endUntil: null,
      endCount: 10,
      active: false,
    });

    expect(updated.type).toBe('meds');
    expect(updated.schedule).toEqual(newSchedule);
    expect(updated.endCount).toBe(10);
    expect(updated.active).toBe(false);

    // Confirm persistence via getTask
    const fetched = getTask(task.id);
    expect(fetched!.active).toBe(false);
    expect(fetched!.schedule).toEqual(newSchedule);
  });
});

describe('deleteTask', () => {
  it('removes the task', () => {
    const task = insertTask(makeTaskInput());
    deleteTask(task.id);
    expect(getTask(task.id)).toBeNull();
    expect(listTasks()).toHaveLength(0);
  });
});

describe('logOccurrence (upsert)', () => {
  it('inserts a log; re-marking same (taskId,dueAt) flips status with exactly one row', () => {
    const task = insertTask(makeTaskInput());
    const dueAt = '2025-06-01T08:00:00.000Z';

    // First mark
    const log1 = logOccurrence(task.id, dueAt, 'done');
    expect(log1.status).toBe('done');
    expect(log1.taskId).toBe(task.id);
    expect(log1.dueAt).toBe(dueAt);

    expect(getLogsForTask(task.id)).toHaveLength(1);

    // Second mark — must flip to skipped, still exactly 1 row
    const log2 = logOccurrence(task.id, dueAt, 'skipped');
    expect(log2.status).toBe('skipped');

    const logsAfter = getLogsForTask(task.id);
    expect(logsAfter).toHaveLength(1);
    expect(logsAfter[0].status).toBe('skipped');
  });
});

describe('getLogsForDay', () => {
  it('returns only logs whose due_at starts with the given day prefix', () => {
    const task = insertTask(makeTaskInput());
    logOccurrence(task.id, '2025-06-01T08:00:00.000Z', 'done');
    logOccurrence(task.id, '2025-06-02T08:00:00.000Z', 'skipped');

    expect(getLogsForDay('2025-06-01')).toHaveLength(1);
    expect(getLogsForDay('2025-06-01')[0].status).toBe('done');
    expect(getLogsForDay('2025-06-02')).toHaveLength(1);
    expect(getLogsForDay('2025-06-99')).toHaveLength(0);
  });
});

describe('deleteTasksForPet', () => {
  it('removes the pet tasks and all their logs, leaving other pets untouched', () => {
    const taskA = insertTask(makeTaskInput('pet-A'));
    const taskB = insertTask(makeTaskInput('pet-B'));
    logOccurrence(taskA.id, '2025-06-01T08:00:00.000Z', 'done');

    deleteTasksForPet('pet-A');

    expect(listTasksByPet('pet-A')).toHaveLength(0);
    // No orphan logs
    expect(getLogsForTask(taskA.id)).toHaveLength(0);
    // pet-B task intact
    expect(listTasksByPet('pet-B')).toHaveLength(1);
    expect(getTask(taskB.id)).not.toBeNull();
  });
});
