import { create } from "zustand";
import {
  insertTask,
  listTasks,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  logOccurrence,
  getLogsForDay,
  getLogsInRange,
  removeLog,
  getLogsForTask as dbGetLogsForTask,
} from "../db/tasks";
import {
  occurrencesForDay,
  toUtcIso,
  tehranDayOffset,
} from "../lib/taskSchedule";
import type { Task, TaskLog, Occurrence, Schedule } from "../db/types";

// ---------------------------------------------------------------------------
// Notification hook seam
// ---------------------------------------------------------------------------
let _syncNotifications: () => void = () => {};

export function setTasksSyncNotifications(fn: () => void): void {
  _syncNotifications = fn;
}

// ---------------------------------------------------------------------------
// Tehran +03:30 day → UTC [start, end) range
// ---------------------------------------------------------------------------

const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30; // 210 min

function todayUtcRange(): { start: Date; end: Date; tehranDateStr: string } {
  const nowMs = Date.now();
  const tehranMs = nowMs + TEHRAN_OFFSET_MINUTES * 60 * 1000;
  const tehranDate = new Date(tehranMs);
  const yr = tehranDate.getUTCFullYear();
  const mo = String(tehranDate.getUTCMonth() + 1).padStart(2, "0");
  const dy = String(tehranDate.getUTCDate()).padStart(2, "0");
  const tehranDateStr = `${yr}-${mo}-${dy}`;

  // Tehran midnight = start of today in UTC
  const start = new Date(toUtcIso("00:00", tehranDateStr));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, tehranDateStr };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateSchedule(schedule: Schedule): void {
  if (schedule.kind === "daily_times" && schedule.times.length === 0) {
    throw new Error("tasks.error.schedule_empty");
  }
  if (schedule.kind === "weekdays") {
    if (schedule.days.length === 0 || schedule.times.length === 0) {
      throw new Error("tasks.error.schedule_empty");
    }
  }
}

// ---------------------------------------------------------------------------
// Derive today's occurrences from the current tasks + logs
// ---------------------------------------------------------------------------

function computeTodayOccurrences(tasks: Task[]): Occurrence[] {
  const { start, end } = todayUtcRange();
  // dueAt values are UTC ISOs whose date component is NOT the Tehran date.
  // We must fetch all logs within the UTC window [start, end) by querying
  // both the UTC-date prefixes that can occur in a Tehran day.
  // Simpler: collect all logs for the two UTC dates that overlap the Tehran day.
  const startDayPrefix = start.toISOString().slice(0, 10);
  const endDayPrefix = end.toISOString().slice(0, 10);
  const logsStart: TaskLog[] = getLogsForDay(startDayPrefix);
  const logsEnd: TaskLog[] =
    endDayPrefix !== startDayPrefix ? getLogsForDay(endDayPrefix) : [];
  const logs: TaskLog[] = [...logsStart, ...logsEnd];
  const activeTasks = tasks.filter((c) => c.active);
  return occurrencesForDay(activeTasks, logs, { start, end });
}

// ---------------------------------------------------------------------------
// Derive window occurrences [now − 7d, now + 7d) from the current tasks + logs
// ---------------------------------------------------------------------------

function computeRangeOccurrences(tasks: Task[]): Occurrence[] {
  const now = Date.now();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const end = new Date(now + 7 * 24 * 60 * 60 * 1000);
  const logs = getLogsInRange(start.toISOString(), end.toISOString());
  const activeTasks = tasks.filter((c) => c.active);
  return occurrencesForDay(activeTasks, logs, { start, end });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt">;
type TaskUpdate = Omit<Task, "id" | "petId" | "createdAt" | "updatedAt">;

interface TasksState {
  tasks: Task[];
  occurrences: Occurrence[];
  windowOccurrences: Occurrence[];

  /** Reload tasks from db and recompute today's occurrences. */
  load: () => Promise<void>;

  /** Read all logs for a specific task (synchronous db call). */
  getLogsForTask: (taskId: string) => TaskLog[];

  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, data: TaskUpdate) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleActive: (taskId: string) => Promise<void>;
  markOccurrence: (
    taskId: string,
    dueAt: string,
    status: TaskLog["status"],
  ) => Promise<void>;
  unmarkOccurrence: (taskId: string, dueAt: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => {
  // Module-level initialisation: read persisted tasks synchronously.
  const initialTasks = listTasks();
  const initialOccurrences = computeTodayOccurrences(initialTasks);
  const initialWindowOccurrences = computeRangeOccurrences(initialTasks);

  return {
    tasks: initialTasks,
    occurrences: initialOccurrences,
    windowOccurrences: initialWindowOccurrences,

    load: async () => {
      const tasks = listTasks();
      const occurrences = computeTodayOccurrences(tasks);
      const windowOccurrences = computeRangeOccurrences(tasks);
      set({ tasks, occurrences, windowOccurrences });
    },

    getLogsForTask: (taskId) => dbGetLogsForTask(taskId),

    addTask: async (input) => {
      validateSchedule(input.schedule);
      insertTask(input);
      const tasks = listTasks();
      const occurrences = computeTodayOccurrences(tasks);
      const windowOccurrences = computeRangeOccurrences(tasks);
      set({ tasks, occurrences, windowOccurrences });
      _syncNotifications();
    },

    updateTask: async (id, data) => {
      validateSchedule(data.schedule);
      dbUpdateTask(id, data);
      const tasks = listTasks();
      const occurrences = computeTodayOccurrences(tasks);
      const windowOccurrences = computeRangeOccurrences(tasks);
      set({ tasks, occurrences, windowOccurrences });
      _syncNotifications();
    },

    deleteTask: async (id) => {
      dbDeleteTask(id);
      const tasks = listTasks();
      const occurrences = computeTodayOccurrences(tasks);
      const windowOccurrences = computeRangeOccurrences(tasks);
      set({ tasks, occurrences, windowOccurrences });
      _syncNotifications();
    },

    toggleActive: async (taskId) => {
      const task = get().tasks.find((c) => c.id === taskId);
      if (!task) return;
      dbUpdateTask(taskId, { ...task, active: !task.active });
      const tasks = listTasks();
      const occurrences = computeTodayOccurrences(tasks);
      const windowOccurrences = computeRangeOccurrences(tasks);
      set({ tasks, occurrences, windowOccurrences });
      _syncNotifications();
    },

    // Logging done/skipped never changes which future occurrences are
    // scheduled, so it must not trigger a notification re-sync (cancel +
    // reschedule of up to 200 triggers) — this is the highest-frequency action.
    markOccurrence: async (taskId, dueAt, status) => {
      // Completing the future is a lie — 'done' only for today/past (Tehran
      // day). Pre-skipping a future day ("I'm away Friday") stays allowed.
      if (status === "done" && tehranDayOffset(dueAt) > 0) return;
      logOccurrence(taskId, dueAt, status);
      const tasks = get().tasks;
      const occurrences = computeTodayOccurrences(tasks);
      const windowOccurrences = computeRangeOccurrences(tasks);
      set({ occurrences, windowOccurrences });
    },

    unmarkOccurrence: async (taskId, dueAt) => {
      removeLog(taskId, dueAt);
      const tasks = get().tasks;
      const occurrences = computeTodayOccurrences(tasks);
      const windowOccurrences = computeRangeOccurrences(tasks);
      set({ occurrences, windowOccurrences });
    },
  };
});
