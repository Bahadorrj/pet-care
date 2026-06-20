import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('petcare.db');

db.runSync(`
  CREATE TABLE IF NOT EXISTS pets (
    id         TEXT    PRIMARY KEY NOT NULL,
    name       TEXT    NOT NULL,
    species    TEXT    NOT NULL,
    gender     TEXT,
    photo_uri  TEXT,
    notes      TEXT,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  )
`);

db.runSync(`
  CREATE TABLE IF NOT EXISTS chores (
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
  CREATE TABLE IF NOT EXISTS chore_logs (
    id         TEXT PRIMARY KEY,
    chore_id   TEXT NOT NULL,
    due_at     TEXT NOT NULL,
    status     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(chore_id, due_at)
  )
`);
