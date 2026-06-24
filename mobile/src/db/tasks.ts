import * as Crypto from 'expo-crypto';
import { db } from './index';
import type { Task, TaskLog, TaskType, EndKind, Schedule } from './types';

// ---------------------------------------------------------------------------
// Row shapes (SQLite returns plain objects)
// ---------------------------------------------------------------------------

interface TaskRow {
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

interface TaskLogRow {
  id: string;
  task_id: string;
  due_at: string;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Row → typed domain object mappers
// ---------------------------------------------------------------------------

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type as TaskType,
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

function rowToTaskLog(row: TaskLogRow): TaskLog {
  return {
    id: row.id,
    taskId: row.task_id,
    dueAt: row.due_at,
    status: row.status as TaskLog['status'],
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

export function insertTask(
  data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
): Task {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO tasks (id, pet_id, type, title, schedule_json, end_kind, end_until, end_count, active, created_at, updated_at)
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

export function listTasks(): Task[] {
  const rows = db.getAllSync<TaskRow>('SELECT * FROM tasks ORDER BY created_at DESC');
  return rows.map(rowToTask);
}

export function listTasksByPet(petId: string): Task[] {
  const rows = db.getAllSync<TaskRow>(
    'SELECT * FROM tasks WHERE pet_id = ? ORDER BY created_at DESC',
    [petId],
  );
  return rows.map(rowToTask);
}

export function getTask(id: string): Task | null {
  const row = db.getFirstSync<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  return row ? rowToTask(row) : null;
}

export function updateTask(
  id: string,
  data: Omit<Task, 'id' | 'petId' | 'createdAt' | 'updatedAt'>,
): Task {
  const now = new Date().toISOString();
  db.runSync(
    `UPDATE tasks SET type = ?, title = ?, schedule_json = ?, end_kind = ?, end_until = ?, end_count = ?, active = ?, updated_at = ?
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
  const row = db.getFirstSync<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!row) throw new Error(`Task not found after update: ${id}`);
  return rowToTask(row);
}

export function deleteTask(id: string): void {
  db.runSync('DELETE FROM tasks WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Task log operations
// ---------------------------------------------------------------------------

export function logOccurrence(
  taskId: string,
  dueAt: string,
  status: TaskLog['status'],
): TaskLog {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO task_logs (id, task_id, due_at, status, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(task_id, due_at) DO UPDATE SET status = excluded.status`,
    [id, taskId, dueAt, status, now],
  );
  // Return the current state of this log (may be the existing row's id)
  const existing = db.getAllSync<TaskLogRow>(
    'SELECT * FROM task_logs WHERE task_id = ? AND due_at = ?',
    [taskId, dueAt],
  );
  if (existing.length === 0) {
    // Fallback: return what we tried to insert
    return { id, taskId, dueAt, status, createdAt: now };
  }
  return rowToTaskLog(existing[0]);
}

export function getLogsForTask(taskId: string): TaskLog[] {
  const rows = db.getAllSync<TaskLogRow>(
    'SELECT * FROM task_logs WHERE task_id = ? ORDER BY due_at ASC',
    [taskId],
  );
  return rows.map(rowToTaskLog);
}

export function getLogsForDay(dayPrefix: string): TaskLog[] {
  const rows = db.getAllSync<TaskLogRow>(
    'SELECT * FROM task_logs WHERE due_at LIKE ? ORDER BY due_at ASC',
    [`${dayPrefix}%`],
  );
  return rows.map(rowToTaskLog);
}

export function getLogsInRange(startPrefix: string, endPrefix: string): TaskLog[] {
  const rows = db.getAllSync<TaskLogRow>(
    'SELECT * FROM task_logs WHERE due_at >= ? AND due_at < ? ORDER BY due_at ASC',
    [startPrefix, endPrefix],
  );
  return rows.map(rowToTaskLog);
}

export function removeLog(taskId: string, dueAt: string): void {
  db.runSync('DELETE FROM task_logs WHERE task_id = ? AND due_at = ?', [taskId, dueAt]);
}

// ---------------------------------------------------------------------------
// Cascade delete
// ---------------------------------------------------------------------------

export function deleteTasksForPet(petId: string): void {
  // Delete task_logs first (no FK enforcement in SQLite by default)
  const tasks = db.getAllSync<TaskRow>(
    'SELECT * FROM tasks WHERE pet_id = ?',
    [petId],
  );
  for (const task of tasks) {
    db.runSync('DELETE FROM task_logs WHERE task_id = ?', [task.id as string]);
  }
  db.runSync('DELETE FROM tasks WHERE pet_id = ?', [petId]);
}
