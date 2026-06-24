import * as Crypto from 'expo-crypto';
import { db } from './index';
import type { Chore, ChoreLog, ChoreType, EndKind, Schedule } from './types';

// ---------------------------------------------------------------------------
// Row shapes (SQLite returns plain objects)
// ---------------------------------------------------------------------------

interface ChoreRow {
  id: string;
  pet_id: string;
  type: string;
  title: string | null;
  schedule_json: string;
  end_kind: string;
  end_until: string | null;
  end_count: number | null;
  active: number;
  created_at: string;
  updated_at: string;
}

interface ChoreLogRow {
  id: string;
  chore_id: string;
  due_at: string;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Row → typed domain object mappers
// ---------------------------------------------------------------------------

function rowToChore(row: ChoreRow): Chore {
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type as ChoreType,
    title: row.title,
    schedule: JSON.parse(row.schedule_json) as Schedule,
    endKind: row.end_kind as EndKind,
    endUntil: row.end_until,
    endCount: row.end_count,
    active: row.active !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToChoreLog(row: ChoreLogRow): ChoreLog {
  return {
    id: row.id,
    choreId: row.chore_id,
    dueAt: row.due_at,
    status: row.status as ChoreLog['status'],
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Chore CRUD
// ---------------------------------------------------------------------------

export function insertChore(
  data: Omit<Chore, 'id' | 'createdAt' | 'updatedAt'>,
): Chore {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO chores (id, pet_id, type, title, schedule_json, end_kind, end_until, end_count, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.petId,
      data.type,
      data.title ?? null,
      JSON.stringify(data.schedule),
      data.endKind,
      data.endUntil ?? null,
      data.endCount ?? null,
      data.active ? 1 : 0,
      now,
      now,
    ],
  );
  return { id, ...data, title: data.title ?? null, endUntil: data.endUntil ?? null, endCount: data.endCount ?? null, createdAt: now, updatedAt: now };
}

export function listChores(): Chore[] {
  const rows = db.getAllSync<ChoreRow>('SELECT * FROM chores ORDER BY created_at DESC');
  return rows.map(rowToChore);
}

export function listChoresByPet(petId: string): Chore[] {
  const rows = db.getAllSync<ChoreRow>(
    'SELECT * FROM chores WHERE pet_id = ? ORDER BY created_at DESC',
    [petId],
  );
  return rows.map(rowToChore);
}

export function getChore(id: string): Chore | null {
  const row = db.getFirstSync<ChoreRow>('SELECT * FROM chores WHERE id = ?', [id]);
  return row ? rowToChore(row) : null;
}

export function updateChore(
  id: string,
  data: Omit<Chore, 'id' | 'petId' | 'createdAt' | 'updatedAt'>,
): Chore {
  const now = new Date().toISOString();
  db.runSync(
    `UPDATE chores SET type = ?, title = ?, schedule_json = ?, end_kind = ?, end_until = ?, end_count = ?, active = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.type,
      data.title ?? null,
      JSON.stringify(data.schedule),
      data.endKind,
      data.endUntil ?? null,
      data.endCount ?? null,
      data.active ? 1 : 0,
      now,
      id,
    ],
  );
  const row = db.getFirstSync<ChoreRow>('SELECT * FROM chores WHERE id = ?', [id]);
  if (!row) throw new Error(`Chore not found after update: ${id}`);
  return rowToChore(row);
}

export function deleteChore(id: string): void {
  db.runSync('DELETE FROM chores WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Chore log operations
// ---------------------------------------------------------------------------

export function logOccurrence(
  choreId: string,
  dueAt: string,
  status: ChoreLog['status'],
): ChoreLog {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO chore_logs (id, chore_id, due_at, status, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chore_id, due_at) DO UPDATE SET status = excluded.status`,
    [id, choreId, dueAt, status, now],
  );
  // Return the current state of this log (may be the existing row's id)
  const existing = db.getAllSync<ChoreLogRow>(
    'SELECT * FROM chore_logs WHERE chore_id = ? AND due_at = ?',
    [choreId, dueAt],
  );
  if (existing.length === 0) {
    // Fallback: return what we tried to insert
    return { id, choreId, dueAt, status, createdAt: now };
  }
  return rowToChoreLog(existing[0]);
}

export function getLogsForChore(choreId: string): ChoreLog[] {
  const rows = db.getAllSync<ChoreLogRow>(
    'SELECT * FROM chore_logs WHERE chore_id = ? ORDER BY due_at ASC',
    [choreId],
  );
  return rows.map(rowToChoreLog);
}

export function getLogsForDay(dayPrefix: string): ChoreLog[] {
  const rows = db.getAllSync<ChoreLogRow>(
    'SELECT * FROM chore_logs WHERE due_at LIKE ? ORDER BY due_at ASC',
    [`${dayPrefix}%`],
  );
  return rows.map(rowToChoreLog);
}

export function getLogsInRange(startPrefix: string, endPrefix: string): ChoreLog[] {
  const rows = db.getAllSync<ChoreLogRow>(
    'SELECT * FROM chore_logs WHERE due_at >= ? AND due_at < ? ORDER BY due_at ASC',
    [startPrefix, endPrefix],
  );
  return rows.map(rowToChoreLog);
}

export function removeLog(choreId: string, dueAt: string): void {
  db.runSync('DELETE FROM chore_logs WHERE chore_id = ? AND due_at = ?', [choreId, dueAt]);
}

// ---------------------------------------------------------------------------
// Cascade delete
// ---------------------------------------------------------------------------

export function deleteChoresForPet(petId: string): void {
  // Delete chore_logs first (no FK enforcement in SQLite by default)
  const chores = db.getAllSync<ChoreRow>(
    'SELECT * FROM chores WHERE pet_id = ?',
    [petId],
  );
  for (const chore of chores) {
    db.runSync('DELETE FROM chore_logs WHERE chore_id = ?', [chore.id as string]);
  }
  db.runSync('DELETE FROM chores WHERE pet_id = ?', [petId]);
}
