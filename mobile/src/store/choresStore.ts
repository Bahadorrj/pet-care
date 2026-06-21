import { create } from 'zustand';
import {
  insertChore,
  listChores,
  updateChore as dbUpdateChore,
  deleteChore as dbDeleteChore,
  logOccurrence,
  getLogsForDay,
  getLogsForChore as dbGetLogsForChore,
} from '../db/chores';
import { occurrencesForDay, toUtcIso } from '../lib/choreSchedule';
import type { Chore, ChoreLog, Occurrence, Schedule } from '../db/types';

// ---------------------------------------------------------------------------
// Notification hook seam
// Task 7 will replace this by calling:
//   import { setChoresSyncNotifications } from './choresStore';
//   setChoresSyncNotifications(myRealSyncFn);
// ---------------------------------------------------------------------------
let _syncNotifications: () => void = () => {};

export function setChoresSyncNotifications(fn: () => void): void {
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
  const mo = String(tehranDate.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(tehranDate.getUTCDate()).padStart(2, '0');
  const tehranDateStr = `${yr}-${mo}-${dy}`;

  // Tehran midnight = start of today in UTC
  const start = new Date(toUtcIso('00:00', tehranDateStr));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, tehranDateStr };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateSchedule(schedule: Schedule): void {
  if (schedule.kind === 'daily_times' && schedule.times.length === 0) {
    throw new Error('chores.error.schedule_empty');
  }
  if (schedule.kind === 'weekdays') {
    if (schedule.days.length === 0 || schedule.times.length === 0) {
      throw new Error('chores.error.schedule_empty');
    }
  }
}

// ---------------------------------------------------------------------------
// Derive today's occurrences from the current chores + logs
// ---------------------------------------------------------------------------

function computeTodayOccurrences(chores: Chore[]): Occurrence[] {
  const { start, end, tehranDateStr } = todayUtcRange();
  // dueAt values are UTC ISOs whose date component is NOT the Tehran date.
  // We must fetch all logs within the UTC window [start, end) by querying
  // both the UTC-date prefixes that can occur in a Tehran day.
  // Simpler: collect all logs for the two UTC dates that overlap the Tehran day.
  const startDayPrefix = start.toISOString().slice(0, 10);
  const endDayPrefix = end.toISOString().slice(0, 10);
  const logsStart: ChoreLog[] = getLogsForDay(startDayPrefix);
  const logsEnd: ChoreLog[] =
    endDayPrefix !== startDayPrefix ? getLogsForDay(endDayPrefix) : [];
  const logs: ChoreLog[] = [...logsStart, ...logsEnd];
  const activeChores = chores.filter((c) => c.active);
  return occurrencesForDay(activeChores, logs, { start, end });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type ChoreInput = Omit<Chore, 'id' | 'createdAt' | 'updatedAt'>;
type ChoreUpdate = Omit<Chore, 'id' | 'petId' | 'createdAt' | 'updatedAt'>;

interface ChoresState {
  chores: Chore[];
  occurrences: Occurrence[];

  /** Reload chores from db and recompute today's occurrences. */
  load: () => Promise<void>;

  /** Read all logs for a specific chore (synchronous db call). */
  getLogsForChore: (choreId: string) => ChoreLog[];

  addChore: (input: ChoreInput) => Promise<void>;
  updateChore: (id: string, data: ChoreUpdate) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  toggleActive: (choreId: string) => Promise<void>;
  markOccurrence: (choreId: string, dueAt: string, status: ChoreLog['status']) => Promise<void>;
}

export const useChoresStore = create<ChoresState>((set, get) => {
  // Module-level initialisation: read persisted chores synchronously.
  const initialChores = listChores();
  const initialOccurrences = computeTodayOccurrences(initialChores);

  return {
    chores: initialChores,
    occurrences: initialOccurrences,

    load: async () => {
      const chores = listChores();
      const occurrences = computeTodayOccurrences(chores);
      set({ chores, occurrences });
    },

    getLogsForChore: (choreId) => dbGetLogsForChore(choreId),

    addChore: async (input) => {
      validateSchedule(input.schedule);
      insertChore(input);
      const chores = listChores();
      const occurrences = computeTodayOccurrences(chores);
      set({ chores, occurrences });
      _syncNotifications();
    },

    updateChore: async (id, data) => {
      validateSchedule(data.schedule);
      dbUpdateChore(id, data);
      const chores = listChores();
      const occurrences = computeTodayOccurrences(chores);
      set({ chores, occurrences });
      _syncNotifications();
    },

    deleteChore: async (id) => {
      dbDeleteChore(id);
      const chores = listChores();
      const occurrences = computeTodayOccurrences(chores);
      set({ chores, occurrences });
      _syncNotifications();
    },

    toggleActive: async (choreId) => {
      const chore = get().chores.find((c) => c.id === choreId);
      if (!chore) return;
      dbUpdateChore(choreId, { ...chore, active: !chore.active });
      const chores = listChores();
      const occurrences = computeTodayOccurrences(chores);
      set({ chores, occurrences });
      _syncNotifications();
    },

    markOccurrence: async (choreId, dueAt, status) => {
      logOccurrence(choreId, dueAt, status);
      const chores = get().chores;
      const occurrences = computeTodayOccurrences(chores);
      set({ occurrences });
      _syncNotifications();
    },
  };
});
