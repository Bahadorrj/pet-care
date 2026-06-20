/**
 * choresStore tests — TDD Red → Green
 *
 * Covers:
 * 1. add → list reflects in store state
 * 2. update reflects in store state
 * 3. delete reflects in store state
 * 4. markOccurrence writes a log and refreshes today's occurrences
 * 5. toggleActive flips the active flag
 * 6. deleting a pet via petsStore removes its chores + logs (no orphans)
 * 7. validation: rejects a chore with an empty schedule
 *
 * The `mock`-prefix trick: jest.mock factories are hoisted to the top of the
 * file, before any imports. Variables referenced inside the factory must be
 * declared with a `mock`-prefixed name so Babel's hoisting analysis allows it.
 */

// ---------------------------------------------------------------------------
// Shared in-memory store — `mock`-prefixed so jest allows the factory to
// reference it after hoisting.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface MockStore {
  pets: Row[];
  chores: Row[];
  chore_logs: Row[];
}

// `mock`-prefixed name is required by jest hoisting rules
const mockStore: MockStore = { pets: [], chores: [], chore_logs: [] };

// ---------------------------------------------------------------------------
// expo-sqlite mock
// ---------------------------------------------------------------------------

jest.mock('expo-sqlite', () => {
  // `mockStore` is allowed because of the `mock`-prefix convention
  const s = mockStore;

  const db = {
    runSync(sql: string, params: unknown[] = []) {
      const u = sql.trim().toUpperCase().replace(/\s+/g, ' ');

      if (u.startsWith('CREATE TABLE')) return;

      // ---- pets ----
      if (u.startsWith('INSERT INTO PETS')) {
        const [id, name, species, gender, photo_uri, notes, created_at, updated_at] = params;
        s.pets.push({ id, name, species, gender, photo_uri, notes, created_at, updated_at });
        return;
      }
      if (u.startsWith('UPDATE PETS')) {
        const [name, species, gender, photo_uri, notes, updated_at, id] = params;
        const row = s.pets.find((r) => r.id === id);
        if (row) Object.assign(row, { name, species, gender, photo_uri, notes, updated_at });
        return;
      }
      if (u.startsWith('DELETE FROM PETS')) {
        const [id] = params as string[];
        s.pets = s.pets.filter((r) => r.id !== id);
        return;
      }

      // ---- chores ----
      if (u.startsWith('INSERT INTO CHORES ')) {
        const [id, pet_id, type, title, schedule_json, end_kind, end_until, end_count, active, created_at, updated_at] = params;
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

      // ---- chore_logs ----
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
      if (u.startsWith('DELETE FROM CHORE_LOGS WHERE CHORE_ID')) {
        const [chore_id] = params as string[];
        s.chore_logs = s.chore_logs.filter((r) => r.chore_id !== chore_id);
        return;
      }
    },

    getAllSync<T>(sql: string, params: unknown[] = []): T[] {
      const u = sql.trim().toUpperCase().replace(/\s+/g, ' ');

      // pets
      if (u.includes('FROM PETS')) {
        return [...s.pets].sort((a, b) =>
          (a.created_at as string) < (b.created_at as string) ? 1 : -1,
        ) as unknown as T[];
      }

      // chores by pet
      if (u.includes('FROM CHORES') && u.includes('PET_ID')) {
        const [pet_id] = params as string[];
        return s.chores.filter((r) => r.pet_id === pet_id) as unknown as T[];
      }
      // all chores
      if (u.includes('FROM CHORES')) {
        return [...s.chores] as unknown as T[];
      }

      // chore_id + due_at exact match (post-upsert lookup)
      if (u.includes('FROM CHORE_LOGS') && u.includes('AND DUE_AT') && !u.includes('LIKE')) {
        const [chore_id, due_at] = params as string[];
        return s.chore_logs.filter(
          (r) => r.chore_id === chore_id && r.due_at === due_at,
        ) as unknown as T[];
      }
      // getLogsForChore
      if (u.includes('FROM CHORE_LOGS') && u.includes('CHORE_ID')) {
        const [chore_id] = params as string[];
        return s.chore_logs.filter((r) => r.chore_id === chore_id) as unknown as T[];
      }
      // getLogsForDay
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

      if (u.includes('FROM PETS')) {
        const [id] = params as string[];
        return (s.pets.find((r) => r.id === id) ?? null) as T | null;
      }
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
// expo-crypto mock — deterministic UUIDs
// ---------------------------------------------------------------------------

const mockUuidState = { counter: 0 };
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `uuid-${++mockUuidState.counter}`),
}));

// ---------------------------------------------------------------------------
// petPhoto mock (required by petsStore)
// ---------------------------------------------------------------------------

jest.mock('../lib/petPhoto', () => ({
  savePhoto: jest.fn(async (uri: string) => uri),
  deletePhoto: jest.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { Schedule } from '../db/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A daily_times chore due at 08:00 Tehran */
const DAILY_SCHEDULE: Schedule = { kind: 'daily_times', times: ['08:00'] };

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

/** Load a fresh choresStore module (re-executes module-level listChores()) */
function loadFreshChoresStore() {
  let mod: typeof import('../store/choresStore');
  jest.isolateModules(() => {
    mod = require('../store/choresStore');
  });
  return mod!;
}

function loadFreshPetsStore() {
  let mod: typeof import('../store/petsStore');
  jest.isolateModules(() => {
    mod = require('../store/petsStore');
  });
  return mod!;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.pets = [];
  mockStore.chores = [];
  mockStore.chore_logs = [];
  mockUuidState.counter = 0;
  jest.useFakeTimers();
  // "now" = Tehran 2026-06-20 10:00 → UTC 2026-06-20T06:30:00Z
  // (past the 08:00 occurrence so it shows as "missed" before marking)
  jest.setSystemTime(new Date('2026-06-20T06:30:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. add → list
// ---------------------------------------------------------------------------

describe('choresStore – add', () => {
  test('addChore inserts a chore and it appears in store.chores', async () => {
    const { useChoresStore } = loadFreshChoresStore();

    await useChoresStore.getState().addChore(makeChoreInput());

    const { chores } = useChoresStore.getState();
    expect(chores).toHaveLength(1);
    expect(chores[0].petId).toBe('pet-1');
    expect(chores[0].type).toBe('feeding');
    expect(chores[0].active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. update
// ---------------------------------------------------------------------------

describe('choresStore – update', () => {
  test('updateChore changes type+title and reflects in store', async () => {
    const { useChoresStore } = loadFreshChoresStore();

    await useChoresStore.getState().addChore(makeChoreInput());
    const id = useChoresStore.getState().chores[0].id;

    await useChoresStore.getState().updateChore(id, {
      type: 'meds',
      title: 'Evening meds',
      schedule: DAILY_SCHEDULE,
      endKind: 'never',
      endUntil: null,
      endCount: null,
      active: true,
    });

    const { chores } = useChoresStore.getState();
    expect(chores[0].type).toBe('meds');
    expect(chores[0].title).toBe('Evening meds');
  });
});

// ---------------------------------------------------------------------------
// 3. delete
// ---------------------------------------------------------------------------

describe('choresStore – delete', () => {
  test('deleteChore removes the chore from store', async () => {
    const { useChoresStore } = loadFreshChoresStore();

    await useChoresStore.getState().addChore(makeChoreInput());
    const id = useChoresStore.getState().chores[0].id;

    await useChoresStore.getState().deleteChore(id);

    expect(useChoresStore.getState().chores).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. toggleActive
// ---------------------------------------------------------------------------

describe('choresStore – toggleActive', () => {
  test('toggleActive flips the active flag from true to false', async () => {
    const { useChoresStore } = loadFreshChoresStore();

    await useChoresStore.getState().addChore(makeChoreInput()); // active: true
    const id = useChoresStore.getState().chores[0].id;

    await useChoresStore.getState().toggleActive(id);

    expect(useChoresStore.getState().chores[0].active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. markOccurrence → refreshes occurrences
// ---------------------------------------------------------------------------

describe('choresStore – markOccurrence', () => {
  test('markOccurrence writes a log and status flips to done in today occurrences', async () => {
    // createdAt must be before today so origin ≤ today
    jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
    const { useChoresStore } = loadFreshChoresStore();
    await useChoresStore.getState().addChore(makeChoreInput());
    const id = useChoresStore.getState().chores[0].id;

    // Move to "now" = Tehran 2026-06-20 10:00 (after 08:00 occurrence)
    jest.setSystemTime(new Date('2026-06-20T06:30:00.000Z'));

    // load() recomputes today's occurrences
    await useChoresStore.getState().load();

    const occs = useChoresStore.getState().occurrences;
    expect(occs.length).toBeGreaterThan(0);

    const occ = occs[0];
    expect(occ.status).toBe('missed'); // past due, no log yet

    await useChoresStore.getState().markOccurrence(occ.chore.id, occ.dueAt, 'done');

    const occsAfter = useChoresStore.getState().occurrences;
    const marked = occsAfter.find(
      (o) => o.chore.id === occ.chore.id && o.dueAt === occ.dueAt,
    );
    expect(marked?.status).toBe('done');
  });

  test('markOccurrence with skipped also refreshes occurrence to skipped', async () => {
    jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
    const { useChoresStore } = loadFreshChoresStore();
    await useChoresStore.getState().addChore(makeChoreInput());

    jest.setSystemTime(new Date('2026-06-20T06:30:00.000Z'));
    await useChoresStore.getState().load();

    const occ = useChoresStore.getState().occurrences[0];
    await useChoresStore.getState().markOccurrence(occ.chore.id, occ.dueAt, 'skipped');

    const marked = useChoresStore
      .getState()
      .occurrences.find((o) => o.chore.id === occ.chore.id && o.dueAt === occ.dueAt);
    expect(marked?.status).toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// 6. Pet-delete cascade
// ---------------------------------------------------------------------------

describe('petsStore – remove cascades to chores + logs', () => {
  test('deleting a pet removes its chores and logs, other pet chores survive', async () => {
    // Two pets
    const { usePetsStore } = loadFreshPetsStore();
    await usePetsStore.getState().add({
      name: 'Buddy',
      species: 'dog',
      gender: null,
      photoUri: null,
      notes: null,
    });
    await usePetsStore.getState().add({
      name: 'Kitty',
      species: 'cat',
      gender: null,
      photoUri: null,
      notes: null,
    });

    const pets = usePetsStore.getState().pets;
    const petA = pets.find((p) => p.name === 'Buddy')!;
    const petB = pets.find((p) => p.name === 'Kitty')!;

    // Chores for both pets
    const { useChoresStore } = loadFreshChoresStore();
    await useChoresStore.getState().addChore(makeChoreInput(petA.id));
    const choreA = useChoresStore.getState().chores[0];

    await useChoresStore.getState().addChore(makeChoreInput(petB.id));

    // A log for choreA
    const { logOccurrence, listChoresByPet, getLogsForChore } = require('../db/chores');
    logOccurrence(choreA.id, '2026-06-20T04:30:00.000Z', 'done');

    expect(listChoresByPet(petA.id)).toHaveLength(1);
    expect(listChoresByPet(petB.id)).toHaveLength(1);
    expect(getLogsForChore(choreA.id)).toHaveLength(1);

    // Delete petA — should cascade to chores + logs
    await usePetsStore.getState().remove(petA.id);

    expect(listChoresByPet(petA.id)).toHaveLength(0);
    expect(getLogsForChore(choreA.id)).toHaveLength(0);
    expect(listChoresByPet(petB.id)).toHaveLength(1);

    // Reload the chores store and confirm in-memory state
    await useChoresStore.getState().load();
    const remaining = useChoresStore.getState().chores;
    expect(remaining.some((c) => c.petId === petA.id)).toBe(false);
    expect(remaining.some((c) => c.petId === petB.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Validation — empty schedule rejected
// ---------------------------------------------------------------------------

describe('choresStore – validation', () => {
  test('rejects a daily_times chore with no times', async () => {
    const { useChoresStore } = loadFreshChoresStore();

    await expect(
      useChoresStore.getState().addChore({
        ...makeChoreInput(),
        schedule: { kind: 'daily_times', times: [] },
      }),
    ).rejects.toThrow('chores.error.schedule_empty');

    expect(useChoresStore.getState().chores).toHaveLength(0);
  });

  test('rejects a weekdays chore with no days', async () => {
    const { useChoresStore } = loadFreshChoresStore();

    await expect(
      useChoresStore.getState().addChore({
        ...makeChoreInput(),
        schedule: { kind: 'weekdays', days: [], times: ['08:00'] },
      }),
    ).rejects.toThrow('chores.error.schedule_empty');

    expect(useChoresStore.getState().chores).toHaveLength(0);
  });

  test('rejects a weekdays chore with no times', async () => {
    const { useChoresStore } = loadFreshChoresStore();

    await expect(
      useChoresStore.getState().addChore({
        ...makeChoreInput(),
        schedule: { kind: 'weekdays', days: [1, 3], times: [] },
      }),
    ).rejects.toThrow('chores.error.schedule_empty');

    expect(useChoresStore.getState().chores).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. toggleActive removes chore from Today occurrences
// ---------------------------------------------------------------------------

describe('choresStore – toggleActive excludes from occurrences', () => {
  test('inactive chore is absent from occurrences; active chore remains present', async () => {
    // Create both chores before "today" so their origin ≤ today
    jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
    const { useChoresStore } = loadFreshChoresStore();

    // Add two active chores
    await useChoresStore.getState().addChore(makeChoreInput());
    await useChoresStore.getState().addChore(makeChoreInput());

    const [choreA, choreB] = useChoresStore.getState().chores;

    // Advance to "now" = Tehran 2026-06-20 10:00 (after 08:00 occurrence)
    jest.setSystemTime(new Date('2026-06-20T06:30:00.000Z'));

    // Both chores should appear before toggling
    await useChoresStore.getState().load();
    expect(
      useChoresStore.getState().occurrences.some((o) => o.chore.id === choreA.id),
    ).toBe(true);
    expect(
      useChoresStore.getState().occurrences.some((o) => o.chore.id === choreB.id),
    ).toBe(true);

    // Toggle choreA inactive
    await useChoresStore.getState().toggleActive(choreA.id);

    const occs = useChoresStore.getState().occurrences;
    // Inactive chore must be absent
    expect(occs.some((o) => o.chore.id === choreA.id)).toBe(false);
    // Active chore must still be present
    expect(occs.some((o) => o.chore.id === choreB.id)).toBe(true);
  });
});
