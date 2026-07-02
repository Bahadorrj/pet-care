import { db } from "./index";

// Tiny device-local key/value store (first use: chat disclaimer dismissal).
db.runSync(
  "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
);

export function kvGet(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM kv WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  db.runSync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [
    key,
    value,
  ]);
}
