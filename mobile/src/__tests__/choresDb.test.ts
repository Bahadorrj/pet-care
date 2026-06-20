/**
 * DB-layer tests for src/db/chores.ts.
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
  chores: Row[];
  chore_logs: Row[];
}

const store: Store = { chores: [], chore_logs: [] };

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

      // ---- chores ----
      if (u.startsWith('INSERT INTO CHORES ')) {
        const [id, pet_id, type, title, schedule_json, end_kind, end_until, end_count, active, created_at, updated_at] =
          params;
        s.chores.push({ id, pet_id, type, title, schedule_json, end_kind, end_until, end_count, active, created_at, updated_at });
        return;
      }
      if (u.startsWith('UPDATE CHORES SET')) {
        const [type, title, schedule_json, end_kind, end_until, end_count, active, updated_at, id] = params;
        const row = s.chores.find((r) => r.id === id);
        if (row) Object.assign(row, { type, title, schedule_json, end_kind, end_until, end_count, active, updated_at });
        return;
      }
      if (u.startsWith('DELETE FROM CHORES WHERE ID')) {
        const [id] = params as string[];
        s.chores = s.chores.filter((r) => r.id !== id);
        return;
      }
      if (u.startsWith('DELETE FROM CHORES WHERE PET_ID')) {
        const [pet_id] = params as string[];
        s.chores = s.chores.filter((r) => r.pet_id !== pet_id);
        return;
      }

      // ---- chore_logs (upsert) ----
      if (u.startsWith('INSERT INTO CHORE_LOGS') && u.includes('ON CONFLICT')) {
        const [id, chore_id, due_at, status, created_at] = params as string[];
        const existing = s.chore_logs.find(
          (r) => r.chore_id === chore_id && r.due_at === due_at,
        );
        if (existing) {
          existing.status = status;
        } else {
          s.chore_logs.push({ id, chore_id, due_at, status, created_at });
        }
        return;
      }

      // ---- delete logs for a chore ----
      if (u.startsWith('DELETE FROM CHORE_LOGS WHERE CHORE_ID')) {
        const [chore_id] = params as string[];
        s.chore_logs = s.chore_logs.filter((r) => r.chore_id !== chore_id);
        return;
      }
    },

    getAllSync<T>(sql: string, params: unknown[] = []): T[] {
      const u = sql.trim().toUpperCase().replace(/\s+/g, ' ');

      if (u.includes('FROM CHORES') && u.includes('PET_ID')) {
        const [pet_id] = params as string[];
        return s.chores.filter((r) => r.pet_id === pet_id) as unknown as T[];
      }
      if (u.includes('FROM CHORES')) {
        return [...s.chores] as unknown as T[];
      }
      // chore_id AND due_at exact match (used by logOccurrence post-upsert lookup)
      // Must check for WHERE ... AND DUE_AT (not just ORDER BY due_at)
      if (u.includes('FROM CHORE_LOGS') && u.includes('AND DUE_AT') && !u.includes('LIKE')) {
        const [chore_id, due_at] = params as string[];
        return s.chore_logs.filter(
          (r) => r.chore_id === chore_id && r.due_at === due_at,
        ) as unknown as T[];
      }
      // getLogsForChore — chore_id only
      if (u.includes('FROM CHORE_LOGS') && u.includes('CHORE_ID')) {
        const [chore_id] = params as string[];
        return s.chore_logs.filter((r) => r.chore_id === chore_id) as unknown as T[];
      }
      // getLogsForDay — LIKE day%
      if (u.includes('FROM CHORE_LOGS') && u.includes('LIKE')) {
        const [pattern] = params as string[];
        const day = (pattern as string).replace(/%/g, '');
        return s.chore_logs.filter((r) =>
          (r.due_at as string).startsWith(day),
        ) as unknown as T[];
      }

      return [] as T[];
    },

    getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
      const u = sql.trim().toUpperCase().replace(/\s+/g, ' ');
      if (u.includes('FROM CHORES')) {
        const [id] = params as string[];
        return (s.chores.find((r) => r.id === id) ?? null) as T | null;
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
    'uuid-chore-1',
    'uuid-log-1',
    'uuid-log-2',
    'uuid-chore-2',
    'uuid-log-3',
    'uuid-chore-3',
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
  insertChore,
  listChores,
  listChoresByPet,
  getChore,
  updateChore,
  deleteChore,
  logOccurrence,
  getLogsForChore,
  getLogsForDay,
  deleteChoresForPet,
} from '../db/chores';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAILY_SCHEDULE: Schedule = { kind: 'daily_times', times: ['08:00', '18:00'] };

function makeChoreInput(petId = 'pet-1') {
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
  store.chores = [];
  store.chore_logs = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insertChore + getChore (round-trip)', () => {
  it('stores and retrieves a chore with schedule serialized/deserialized', () => {
    const chore = insertChore(makeChoreInput());

    expect(chore.petId).toBe('pet-1');
    expect(chore.type).toBe('feeding');
    expect(chore.title).toBe('Morning feed');
    expect(chore.active).toBe(true);
    // schedule round-trips as deep-equal
    expect(chore.schedule).toEqual(DAILY_SCHEDULE);

    const fetched = getChore(chore.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.schedule).toEqual(DAILY_SCHEDULE);
    expect(fetched!.active).toBe(true);
  });

  it('returns null for unknown id', () => {
    expect(getChore('nonexistent')).toBeNull();
  });
});

describe('listChores / listChoresByPet', () => {
  it('lists all chores and filters by pet', () => {
    insertChore(makeChoreInput('pet-A'));
    insertChore(makeChoreInput('pet-B'));

    expect(listChores()).toHaveLength(2);
    expect(listChoresByPet('pet-A')).toHaveLength(1);
    expect(listChoresByPet('pet-A')[0].petId).toBe('pet-A');
    expect(listChoresByPet('missing')).toHaveLength(0);
  });
});

describe('updateChore', () => {
  it('persists changed fields including schedule and active flag', () => {
    const chore = insertChore(makeChoreInput());
    const newSchedule: Schedule = { kind: 'weekdays', days: [1, 3, 5], times: ['09:00'] };

    const updated = updateChore(chore.id, {
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

    // Confirm persistence via getChore
    const fetched = getChore(chore.id);
    expect(fetched!.active).toBe(false);
    expect(fetched!.schedule).toEqual(newSchedule);
  });
});

describe('deleteChore', () => {
  it('removes the chore', () => {
    const chore = insertChore(makeChoreInput());
    deleteChore(chore.id);
    expect(getChore(chore.id)).toBeNull();
    expect(listChores()).toHaveLength(0);
  });
});

describe('logOccurrence (upsert)', () => {
  it('inserts a log; re-marking same (choreId,dueAt) flips status with exactly one row', () => {
    const chore = insertChore(makeChoreInput());
    const dueAt = '2025-06-01T08:00:00.000Z';

    // First mark
    const log1 = logOccurrence(chore.id, dueAt, 'done');
    expect(log1.status).toBe('done');
    expect(log1.choreId).toBe(chore.id);
    expect(log1.dueAt).toBe(dueAt);

    expect(getLogsForChore(chore.id)).toHaveLength(1);

    // Second mark — must flip to skipped, still exactly 1 row
    const log2 = logOccurrence(chore.id, dueAt, 'skipped');
    expect(log2.status).toBe('skipped');

    const logsAfter = getLogsForChore(chore.id);
    expect(logsAfter).toHaveLength(1);
    expect(logsAfter[0].status).toBe('skipped');
  });
});

describe('getLogsForDay', () => {
  it('returns only logs whose due_at starts with the given day prefix', () => {
    const chore = insertChore(makeChoreInput());
    logOccurrence(chore.id, '2025-06-01T08:00:00.000Z', 'done');
    logOccurrence(chore.id, '2025-06-02T08:00:00.000Z', 'skipped');

    expect(getLogsForDay('2025-06-01')).toHaveLength(1);
    expect(getLogsForDay('2025-06-01')[0].status).toBe('done');
    expect(getLogsForDay('2025-06-02')).toHaveLength(1);
    expect(getLogsForDay('2025-06-99')).toHaveLength(0);
  });
});

describe('deleteChoresForPet', () => {
  it('removes the pet chores and all their logs, leaving other pets untouched', () => {
    const choreA = insertChore(makeChoreInput('pet-A'));
    const choreB = insertChore(makeChoreInput('pet-B'));
    logOccurrence(choreA.id, '2025-06-01T08:00:00.000Z', 'done');

    deleteChoresForPet('pet-A');

    expect(listChoresByPet('pet-A')).toHaveLength(0);
    // No orphan logs
    expect(getLogsForChore(choreA.id)).toHaveLength(0);
    // pet-B chore intact
    expect(listChoresByPet('pet-B')).toHaveLength(1);
    expect(getChore(choreB.id)).not.toBeNull();
  });
});
