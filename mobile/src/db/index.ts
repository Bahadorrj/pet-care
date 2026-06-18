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
