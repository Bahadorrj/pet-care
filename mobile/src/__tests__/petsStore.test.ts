/**
 * petsStore tests
 *
 * Verifies the 5 spec bullets:
 * 1. Store initialises `pets` from listPets() at module load.
 * 2. add() validates first (throws before any db/file op), then savePhoto +
 *    insert + refresh from listPets().
 * 3. update() validates first, swaps photo (delete old when replaced), then
 *    updatePet + refresh.
 * 4. remove() deletes the photo then the row, then refreshes.
 * 5. Validation throws Error('pets.error.name_required') /
 *    Error('pets.error.species_required') BEFORE any db/file op.
 *
 * expo-sqlite is mocked with an in-memory fake driver (real src/db + src/db/pets
 * run against it). petPhoto is mocked with jest.fn()s. Fake timers + setSystemTime
 * give deterministic created_at/updated_at so the DESC ordering is stable.
 */

// ---- In-memory fake expo-sqlite driver -------------------------------------
// A minimal synchronous SQLite stand-in: it understands only the handful of
// statements src/db + src/db/pets issue (CREATE TABLE, INSERT, SELECT ... ORDER
// BY created_at DESC [WHERE id=?], UPDATE ... WHERE id=?, DELETE ... WHERE id=?).
interface FakeRow {
  id: string;
  name: string;
  species: string;
  gender: string | null;
  photo_uri: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

let fakeRows: FakeRow[] = [];

// `mock`-prefixed so jest allows the factory below to close over it (hoisting).
const mockFakeDb = {
  runSync(sql: string, params: unknown[] = []) {
    const s = sql.trim().toUpperCase();
    if (s.startsWith('CREATE TABLE')) return;
    if (s.startsWith('INSERT INTO PETS')) {
      const [id, name, species, gender, photo_uri, notes, created_at, updated_at] =
        params as (string | null)[];
      fakeRows.push({
        id: id as string,
        name: name as string,
        species: species as string,
        gender: gender as string | null,
        photo_uri: photo_uri as string | null,
        notes: notes as string | null,
        created_at: created_at as string,
        updated_at: updated_at as string,
      });
      return;
    }
    if (s.startsWith('UPDATE PETS')) {
      const [name, species, gender, photo_uri, notes, updated_at, id] =
        params as (string | null)[];
      const row = fakeRows.find((r) => r.id === id);
      if (row) {
        row.name = name as string;
        row.species = species as string;
        row.gender = gender as string | null;
        row.photo_uri = photo_uri as string | null;
        row.notes = notes as string | null;
        row.updated_at = updated_at as string;
      }
      return;
    }
    if (s.startsWith('DELETE FROM PETS')) {
      const [id] = params as string[];
      fakeRows = fakeRows.filter((r) => r.id !== id);
      return;
    }
    // Cascade deletes from deleteChoresForPet — petsStore now calls it on remove.
    // No chore rows exist in this fake, so these are no-ops.
    if (s.startsWith('DELETE FROM CHORE_LOGS')) return;
    if (s.startsWith('DELETE FROM CHORES')) return;
    throw new Error(`fakeDb.runSync: unhandled SQL: ${sql}`);
  },
  getAllSync<T>(sql: string): T[] {
    const u = sql.trim().toUpperCase();
    // Cascade: deleteChoresForPet queries chores by pet_id — return empty (no chores seeded here)
    if (u.includes('FROM CHORES')) return [] as unknown as T[];
    // SELECT * FROM pets ORDER BY created_at DESC
    return [...fakeRows].sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
    ) as unknown as T[];
  },
  getFirstSync<T>(_sql: string, params: unknown[] = []): T | null {
    const [id] = params as string[];
    const row = fakeRows.find((r) => r.id === id);
    return (row ?? null) as unknown as T | null;
  },
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockFakeDb),
}));

// Deterministic UUIDs so we can assert on them. `mock`-prefixed counter holder
// so the factory may close over it under jest's hoisting rules.
const mockUuid = { counter: 0 };
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `uuid-${++mockUuid.counter}`),
}));

// petPhoto file-lifecycle helpers are pure jest.fn()s.
jest.mock('../lib/petPhoto', () => ({
  savePhoto: jest.fn(),
  deletePhoto: jest.fn(),
}));

import * as petPhoto from '../lib/petPhoto';

const mockedSavePhoto = petPhoto.savePhoto as jest.MockedFunction<
  typeof petPhoto.savePhoto
>;
const mockedDeletePhoto = petPhoto.deletePhoto as jest.MockedFunction<
  typeof petPhoto.deletePhoto
>;

// Load a fresh store after the fake db is seeded, so module-level
// `pets: listPets()` reads the seeded rows.
function loadFreshStore() {
  let store: typeof import('../store/petsStore');
  jest.isolateModules(() => {
    store = require('../store/petsStore');
  });
  return store!;
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeRows = [];
  mockUuid.counter = 0;
  mockedSavePhoto.mockResolvedValue('file:///doc/saved.jpg');
  mockedDeletePhoto.mockResolvedValue(undefined);
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('petsStore – init', () => {
  test('initialises pets from listPets() at module load, sorted created_at DESC', () => {
    // Seed two rows directly into the fake db before the store loads.
    fakeRows = [
      {
        id: 'a',
        name: 'Older',
        species: 'dog',
        gender: null,
        photo_uri: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'b',
        name: 'Newer',
        species: 'cat',
        gender: null,
        photo_uri: null,
        notes: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
    ];

    const { usePetsStore } = loadFreshStore();
    const pets = usePetsStore.getState().pets;

    expect(pets).toHaveLength(2);
    expect(pets[0].name).toBe('Newer'); // DESC: newest first
    expect(pets[1].name).toBe('Older');
  });
});

describe('petsStore – add', () => {
  test('validates, saves photo, inserts, and refreshes pets from db', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Rex',
      species: 'dog',
      gender: 'male',
      photoUri: 'file:///picked/tmp.jpg',
      notes: 'good boy',
    });

    expect(mockedSavePhoto).toHaveBeenCalledWith('file:///picked/tmp.jpg');

    const pets = usePetsStore.getState().pets;
    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Rex');
    // The persisted photoUri is the saved path, not the picked temp uri.
    expect(pets[0].photoUri).toBe('file:///doc/saved.jpg');
    expect(pets[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('does not call savePhoto when no photoUri is provided', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Bird',
      species: 'bird',
      gender: null,
      photoUri: null,
      notes: null,
    });

    expect(mockedSavePhoto).not.toHaveBeenCalled();
    expect(usePetsStore.getState().pets[0].photoUri).toBeNull();
  });

  test('throws name_required and performs no db/file op when name is blank', async () => {
    const { usePetsStore } = loadFreshStore();

    await expect(
      usePetsStore.getState().add({
        name: '   ',
        species: 'dog',
        gender: null,
        photoUri: 'file:///picked/tmp.jpg',
        notes: null,
      }),
    ).rejects.toThrow('pets.error.name_required');

    expect(mockedSavePhoto).not.toHaveBeenCalled();
    expect(usePetsStore.getState().pets).toHaveLength(0);
  });

  test('throws species_required and performs no db/file op when species is empty', async () => {
    const { usePetsStore } = loadFreshStore();

    await expect(
      usePetsStore.getState().add({
        name: 'Rex',
        species: '' as never,
        gender: null,
        photoUri: 'file:///picked/tmp.jpg',
        notes: null,
      }),
    ).rejects.toThrow('pets.error.species_required');

    expect(mockedSavePhoto).not.toHaveBeenCalled();
    expect(usePetsStore.getState().pets).toHaveLength(0);
  });

  test('throws species_required and writes no row for a non-empty invalid species', async () => {
    const { usePetsStore } = loadFreshStore();

    await expect(
      usePetsStore.getState().add({
        name: 'Rex',
        species: 'dragon' as never,
        gender: null,
        photoUri: null,
        notes: null,
      }),
    ).rejects.toThrow('pets.error.species_required');

    expect(mockedSavePhoto).not.toHaveBeenCalled();
    expect(usePetsStore.getState().pets).toHaveLength(0);
  });
});

describe('petsStore – update', () => {
  test('validates, deletes old photo when replaced, updates row, and refreshes', async () => {
    const { usePetsStore } = loadFreshStore();

    // Seed a pet with an existing saved photo.
    await usePetsStore.getState().add({
      name: 'Rex',
      species: 'dog',
      gender: 'male',
      photoUri: 'file:///picked/old.jpg',
      notes: null,
    });
    const id = usePetsStore.getState().pets[0].id;
    expect(usePetsStore.getState().pets[0].photoUri).toBe('file:///doc/saved.jpg');

    jest.clearAllMocks();
    mockedSavePhoto.mockResolvedValue('file:///doc/new.jpg');
    mockedDeletePhoto.mockResolvedValue(undefined);

    await usePetsStore.getState().update(id, {
      name: 'Rex II',
      species: 'dog',
      gender: 'male',
      photoUri: 'file:///picked/new.jpg', // a fresh picked photo → replace
      notes: 'renamed',
    });

    // Old saved photo deleted, new one saved.
    expect(mockedSavePhoto).toHaveBeenCalledWith('file:///picked/new.jpg');
    expect(mockedDeletePhoto).toHaveBeenCalledWith('file:///doc/saved.jpg');

    const pet = usePetsStore.getState().pets[0];
    expect(pet.name).toBe('Rex II');
    expect(pet.notes).toBe('renamed');
    expect(pet.photoUri).toBe('file:///doc/new.jpg');
  });

  test('keeps existing photo when photoUri is unchanged (no save/delete)', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Rex',
      species: 'dog',
      gender: 'male',
      photoUri: 'file:///picked/old.jpg',
      notes: null,
    });
    const pet0 = usePetsStore.getState().pets[0];
    const id = pet0.id;
    const savedUri = pet0.photoUri; // file:///doc/saved.jpg

    jest.clearAllMocks();

    await usePetsStore.getState().update(id, {
      name: 'Rex',
      species: 'dog',
      gender: 'male',
      photoUri: savedUri, // same persisted uri → no photo churn
      notes: 'note only',
    });

    expect(mockedSavePhoto).not.toHaveBeenCalled();
    expect(mockedDeletePhoto).not.toHaveBeenCalled();
    expect(usePetsStore.getState().pets[0].photoUri).toBe(savedUri);
    expect(usePetsStore.getState().pets[0].notes).toBe('note only');
  });

  test('deletes old photo when cleared to null', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Rex',
      species: 'dog',
      gender: null,
      photoUri: 'file:///picked/old.jpg',
      notes: null,
    });
    const id = usePetsStore.getState().pets[0].id;

    jest.clearAllMocks();

    await usePetsStore.getState().update(id, {
      name: 'Rex',
      species: 'dog',
      gender: null,
      photoUri: null, // cleared
      notes: null,
    });

    expect(mockedDeletePhoto).toHaveBeenCalledWith('file:///doc/saved.jpg');
    expect(mockedSavePhoto).not.toHaveBeenCalled();
    expect(usePetsStore.getState().pets[0].photoUri).toBeNull();
  });

  test('throws name_required before any db/file op', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Rex',
      species: 'dog',
      gender: null,
      photoUri: null,
      notes: null,
    });
    const id = usePetsStore.getState().pets[0].id;
    jest.clearAllMocks();

    await expect(
      usePetsStore.getState().update(id, {
        name: '',
        species: 'dog',
        gender: null,
        photoUri: null,
        notes: null,
      }),
    ).rejects.toThrow('pets.error.name_required');

    expect(mockedSavePhoto).not.toHaveBeenCalled();
    expect(mockedDeletePhoto).not.toHaveBeenCalled();
    // unchanged
    expect(usePetsStore.getState().pets[0].name).toBe('Rex');
  });

  test('bumps updatedAt and preserves createdAt', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Rex',
      species: 'dog',
      gender: null,
      photoUri: null,
      notes: null,
    });
    const before = usePetsStore.getState().pets[0];
    const originalCreatedAt = before.createdAt;
    const originalUpdatedAt = before.updatedAt;

    jest.advanceTimersByTime(5000); // move clock forward 5 s

    await usePetsStore.getState().update(before.id, {
      name: 'Rex Updated',
      species: 'dog',
      gender: null,
      photoUri: null,
      notes: null,
    });

    const after = usePetsStore.getState().pets[0];
    expect(after.createdAt).toBe(originalCreatedAt);
    expect(after.updatedAt > originalUpdatedAt).toBe(true);
  });
});

describe('petsStore – remove', () => {
  test('deletes the stored photo then the row, then refreshes', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Rex',
      species: 'dog',
      gender: null,
      photoUri: 'file:///picked/old.jpg',
      notes: null,
    });
    const pet = usePetsStore.getState().pets[0];
    jest.clearAllMocks();

    await usePetsStore.getState().remove(pet.id);

    expect(mockedDeletePhoto).toHaveBeenCalledWith('file:///doc/saved.jpg');
    expect(usePetsStore.getState().pets).toHaveLength(0);
  });

  test('removes a pet with no photo without throwing', async () => {
    const { usePetsStore } = loadFreshStore();

    await usePetsStore.getState().add({
      name: 'Bird',
      species: 'bird',
      gender: null,
      photoUri: null,
      notes: null,
    });
    const pet = usePetsStore.getState().pets[0];
    jest.clearAllMocks();

    await usePetsStore.getState().remove(pet.id);

    // deletePhoto is a no-op for null but the store may still call it; either is fine.
    expect(usePetsStore.getState().pets).toHaveLength(0);
  });
});
