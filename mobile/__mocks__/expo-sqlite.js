// Manual mock for expo-sqlite.
//
// jest-expo does not provide the native SQLite module, so the real
// openDatabaseSync throws (`NativeDatabase is not a constructor`). App.tsx
// imports './src/db' for side effects, so every test that renders App would
// crash without this. A tiny in-memory stub is enough: it satisfies the
// synchronous API src/db + src/db/pets use and stores rows in a plain array.
//
// Tests that need to assert on db behaviour (petsStore.test.ts) provide their
// own jest.mock('expo-sqlite', ...) which takes precedence over this file.

let rows = [];

const db = {
  runSync(sql, params = []) {
    const s = String(sql).trim().toUpperCase();
    if (s.startsWith('CREATE TABLE')) return;
    if (s.startsWith('INSERT INTO PETS')) {
      const [id, name, species, gender, photo_uri, notes, created_at, updated_at] =
        params;
      rows.push({ id, name, species, gender, photo_uri, notes, created_at, updated_at });
      return;
    }
    if (s.startsWith('UPDATE PETS')) {
      const [name, species, gender, photo_uri, notes, updated_at, id] = params;
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, { name, species, gender, photo_uri, notes, updated_at });
      return;
    }
    if (s.startsWith('DELETE FROM PETS')) {
      const [id] = params;
      rows = rows.filter((r) => r.id !== id);
      return;
    }
  },
  // Ignores the SQL string; always returns all rows sorted created_at DESC.
  // Valid only while listPets() is the single getAllSync query in the codebase.
  getAllSync() {
    return [...rows].sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
    );
  },
  getFirstSync(_sql, params = []) {
    const [id] = params;
    return rows.find((r) => r.id === id) ?? null;
  },
};

module.exports = {
  openDatabaseSync: () => db,
};
