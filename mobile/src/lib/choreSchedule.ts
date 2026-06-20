/**
 * Pure schedule engine — no I/O, no side effects.
 * All date math for chore occurrence expansion and status resolution.
 */

import type { Chore, ChoreLog, Occurrence } from '../db/types';

// ponytail: fixed +03:30, revisit only if Iran reinstates DST
const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30; // 210 minutes

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Tehran wall-clock time "HH:MM" on a Tehran calendar date "YYYY-MM-DD"
 * to a UTC ISO string.
 */
export function toUtcIso(wallClock: string, tehranDate: string): string {
  const [h, m] = wallClock.split(':').map(Number);
  const [yr, mo, dy] = tehranDate.split('-').map(Number);

  // Build the UTC timestamp: Tehran local = UTC + 210 min → UTC = Tehran local - 210 min
  const localMinutes = h * 60 + m;
  const utcMinutes = localMinutes - TEHRAN_OFFSET_MINUTES;

  // Compute UTC date, adjusting for day overflow
  const baseMs = Date.UTC(yr, mo - 1, dy); // midnight UTC of the given date
  const utcMs = baseMs + utcMinutes * 60 * 1000;

  return new Date(utcMs).toISOString();
}

/**
 * Given a UTC Date, return the Tehran calendar date string "YYYY-MM-DD".
 */
function tehranDateStr(utc: Date): string {
  const tehranMs = utc.getTime() + TEHRAN_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(tehranMs);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

/**
 * Given a UTC Date, return the Tehran day-of-week (0=Sunday .. 6=Saturday).
 */
function tehranDayOfWeek(utc: Date): number {
  const tehranMs = utc.getTime() + TEHRAN_OFFSET_MINUTES * 60 * 1000;
  return new Date(tehranMs).getUTCDay();
}

/**
 * Add `n` months to a UTC Date, clamping to the last day of the target month.
 * Preserves time (HH:MM:SS.mmm).
 */
function addMonths(utc: Date, n: number): Date {
  const d = new Date(utc);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n, 1); // set to 1st to avoid skipping months
  const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, maxDay));
  return d;
}

/**
 * Iterate over Tehran calendar days overlapping the UTC range [fromUtc, toUtc).
 * Calls callback(tehranDateStr) for each day that might have occurrences.
 */
function eachTehranDay(fromUtc: Date, toUtc: Date, cb: (dateStr: string) => void): void {
  // Tehran day D runs from UTC (D T00:00 - 210min) to UTC (D+1 T00:00 - 210min).
  // To ensure we don't miss any day whose UTC range overlaps [fromUtc, toUtc),
  // we extend the scan window by ±1 day and deduplicate.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const startMs = fromUtc.getTime() - DAY_MS;
  // Extend end by one extra day so a 24h cursor step can't skip the last Tehran day
  const endMs = toUtc.getTime() + DAY_MS;

  let cursor = new Date(startMs);
  const seen = new Set<string>();
  while (cursor.getTime() < endMs) {
    const ds = tehranDateStr(cursor);
    if (!seen.has(ds)) {
      seen.add(ds);
      cb(ds);
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
}

// ---------------------------------------------------------------------------
// Origin date helpers (for after_n counting)
// ---------------------------------------------------------------------------

/**
 * Returns the Tehran calendar date string for the chore's "origin" for
 * daily_times and weekdays schedules (= createdAt calendar day in Tehran).
 */
function originTehranDate(chore: Chore): string {
  return tehranDateStr(new Date(chore.createdAt));
}

// ---------------------------------------------------------------------------
// expandOccurrences
// ---------------------------------------------------------------------------

/**
 * Returns all UTC ISO strings of due occurrences for `chore` in [fromUtc, toUtc).
 * Honors end conditions (until / after_n).
 */
export function expandOccurrences(chore: Chore, fromUtc: Date, toUtc: Date): string[] {
  const { schedule, endKind, endUntil, endCount } = chore;

  const endUntilMs = endKind === 'until' && endUntil ? new Date(endUntil).getTime() : Infinity;

  // Helper: apply end conditions to a candidate UTC ISO string
  // Returns true if we should include it, false if we should stop/skip.
  // Also tracks after_n count.
  let afterNTotal = 0; // how many occurrences have been produced in sequence from origin

  function shouldInclude(isoUtc: string): boolean {
    const ms = new Date(isoUtc).getTime();
    if (endKind === 'until' && ms > endUntilMs) return false;
    return true;
  }

  function inRange(isoUtc: string): boolean {
    const ms = new Date(isoUtc).getTime();
    return ms >= fromUtc.getTime() && ms < toUtc.getTime();
  }

  const out: string[] = [];

  // -------------------------------------------------------------------------
  // one_off
  // -------------------------------------------------------------------------
  if (schedule.kind === 'one_off') {
    const at = schedule.at;
    afterNTotal = 1;
    if (endKind === 'after_n' && endCount !== null && afterNTotal > endCount) {
      return [];
    }
    if (shouldInclude(at) && inRange(at)) {
      out.push(at);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // interval
  // -------------------------------------------------------------------------
  if (schedule.kind === 'interval') {
    const { n, unit, anchor } = schedule;
    const anchorDate = new Date(anchor);

    // Walk forward from anchor until we exceed toUtc or hit end condition
    let current = anchorDate;
    let count = 0;
    // For month intervals: track the step index to always add from anchor,
    // so clamped months don't accumulate drift (e.g. Jan 31 + 1m + 1m = Mar 31, not Mar 28).
    let monthStep = 0;

    while (current.getTime() < toUtc.getTime()) {
      const isoUtc = current.toISOString();
      count++;

      if (endKind === 'after_n' && endCount !== null && count > endCount) break;
      if (!shouldInclude(isoUtc)) break;

      if (inRange(isoUtc)) {
        out.push(isoUtc);
      }

      // Advance
      if (unit === 'hours') {
        current = new Date(current.getTime() + n * 60 * 60 * 1000);
      } else if (unit === 'days') {
        current = new Date(current.getTime() + n * 24 * 60 * 60 * 1000);
      } else {
        // months: always add from anchor to prevent drift after day clamping
        monthStep += n;
        current = addMonths(anchorDate, monthStep);
      }
    }

    return out;
  }

  // -------------------------------------------------------------------------
  // daily_times and weekdays (treated the same; daily_times = all 7 days)
  // -------------------------------------------------------------------------
  const times: string[] = schedule.times;
  const days: number[] = schedule.kind === 'weekdays' ? schedule.days : [0, 1, 2, 3, 4, 5, 6];

  // For after_n, we need to count from origin. Origin = createdAt Tehran calendar day.
  // We need to enumerate ALL occurrences from origin up through our range window,
  // counting them, then only include those that fall in [fromUtc, toUtc).
  // To avoid iterating from the very origin if the range is far in the future,
  // we use a two-pass approach: compute how many occurrences happened before fromUtc,
  // then pick up from there — but that's complex for weekdays.
  // Instead, we scan from the earlier of (origin, fromUtc - buffer) to toUtc,
  // counting all occurrences, and stop at endCount or endUntil.

  const originStr = originTehranDate(chore);
  const originUtcMs = new Date(toUtcIso('00:00', originStr)).getTime();
  // Scan from origin or fromUtc (whichever is earlier) to build count
  const scanFrom = Math.min(originUtcMs, fromUtc.getTime());

  // Collect all Tehran days from scanFrom to toUtc
  const scanFromDate = new Date(scanFrom);
  const allTehranDays: string[] = [];
  eachTehranDay(scanFromDate, toUtc, ds => allTehranDays.push(ds));

  // Sort days ascending
  allTehranDays.sort();

  // Filter out days before origin
  const filteredDays = allTehranDays.filter(ds => ds >= originStr);

  // Build occurrences in order
  let count = 0;
  outer: for (const ds of filteredDays) {
    // Compute weekday in Tehran local time using Tehran noon (avoids UTC date ambiguity)
    const tehranNoon = new Date(toUtcIso('12:00', ds));
    const weekday = tehranDayOfWeek(tehranNoon);

    if (!days.includes(weekday)) continue;

    // For each time on this day
    const sortedTimes = [...times].sort();
    for (const t of sortedTimes) {
      const isoUtc = toUtcIso(t, ds);
      count++;

      if (endKind === 'after_n' && endCount !== null && count > endCount) break outer;
      if (!shouldInclude(isoUtc)) break outer;

      if (inRange(isoUtc)) {
        out.push(isoUtc);
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// occurrencesForDay
// ---------------------------------------------------------------------------

export interface DayRange {
  start: Date; // inclusive
  end: Date;   // exclusive
}

/**
 * Build today's agenda with status resolved for each occurrence.
 * - Log match (choreId + dueAt) → done or skipped
 * - No log + dueAt < now → missed
 * - No log + dueAt >= now → pending
 */
export function occurrencesForDay(
  chores: Chore[],
  logs: ChoreLog[],
  dayUtcRange: DayRange,
  now: Date = new Date(),
): Occurrence[] {
  // Build a lookup: `${choreId}|${dueAt}` → log status
  const logMap = new Map<string, 'done' | 'skipped'>();
  for (const log of logs) {
    logMap.set(`${log.choreId}|${log.dueAt}`, log.status);
  }

  const result: Occurrence[] = [];
  const nowMs = now.getTime();

  for (const chore of chores) {
    const dueTimes = expandOccurrences(chore, dayUtcRange.start, dayUtcRange.end);
    for (const dueAt of dueTimes) {
      const key = `${chore.id}|${dueAt}`;
      const logStatus = logMap.get(key);

      let status: Occurrence['status'];
      if (logStatus !== undefined) {
        status = logStatus;
      } else if (new Date(dueAt).getTime() < nowMs) {
        status = 'missed';
      } else {
        status = 'pending';
      }

      result.push({ chore, dueAt, status });
    }
  }

  return result;
}
