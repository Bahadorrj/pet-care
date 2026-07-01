import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("petcare.db");

// Legacy rename: `chore`→`task`. Carry over data on devices created before the
// rename, then the CREATE TABLE IF NOT EXISTS below become no-ops.
function tableExists(name: string): boolean {
  return !!db.getFirstSync(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [name],
  );
}
if (tableExists("chores") && !tableExists("tasks")) {
  db.runSync("ALTER TABLE chores RENAME TO tasks");
}
if (tableExists("chore_logs") && !tableExists("task_logs")) {
  db.runSync("ALTER TABLE chore_logs RENAME TO task_logs");
  db.runSync("ALTER TABLE task_logs RENAME COLUMN chore_id TO task_id");
}

db.runSync(`
  CREATE TABLE IF NOT EXISTS pets (
    id            TEXT    PRIMARY KEY NOT NULL,
    name          TEXT    NOT NULL,
    species       TEXT    NOT NULL,
    species_other TEXT,
    gender        TEXT,
    photo_uri     TEXT,
    notes         TEXT,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
  )
`);

// Existing installs: CREATE TABLE IF NOT EXISTS above is a no-op for them, so
// add the column that pre-dates this migration explicitly.
function columnExists(table: string, column: string): boolean {
  return db
    .getAllSync<{ name: string }>(`PRAGMA table_info(${table})`)
    .some((c) => c.name === column);
}
if (!columnExists("pets", "species_other")) {
  db.runSync("ALTER TABLE pets ADD COLUMN species_other TEXT");
}

db.runSync(`
  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    pet_id        TEXT NOT NULL,
    type          TEXT NOT NULL,
    title         TEXT,
    schedule_json TEXT NOT NULL,
    end_kind      TEXT NOT NULL,
    end_until     TEXT,
    end_count     INTEGER,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  )
`);

db.runSync(`
  CREATE TABLE IF NOT EXISTS task_logs (
    id         TEXT PRIMARY KEY,
    task_id   TEXT NOT NULL,
    due_at     TEXT NOT NULL,
    status     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(task_id, due_at)
  )
`);
