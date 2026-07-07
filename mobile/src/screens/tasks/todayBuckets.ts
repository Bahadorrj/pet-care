/**
 * Pure bucketing helper — no I/O, no react-native import.
 * Mirrors the lib/taskSchedule.ts pattern so it unit-tests without RN.
 *
 * Tehran = fixed UTC+03:30 (no DST, per ADR).
 */

import type { Occurrence } from "../../db/types";

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000; // 210 min in ms
const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;

/**
 * Compute the UTC instant that is Tehran midnight (start of Tehran day) for a
 * given UTC `now`. Tehran has no DST, so the shift is always +03:30.
 *
 * Algorithm: shift `now` forward by +03:30, floor to UTC midnight of that
 * shifted date, then shift back by -03:30.
 */
function tehranStartOfDay(now: Date): Date {
  const shifted = now.getTime() + TEHRAN_OFFSET_MS;
  const shiftedDate = new Date(shifted);
  // UTC midnight of the shifted date
  const midnight = Date.UTC(
    shiftedDate.getUTCFullYear(),
    shiftedDate.getUTCMonth(),
    shiftedDate.getUTCDate(),
  );
  return new Date(midnight - TEHRAN_OFFSET_MS);
}

/**
 * Returns true when the occurrence is considered overdue at `now`:
 * - status 'missed', OR
 * - status 'pending' AND dueAt is before now (snapshot staleness)
 */
export function isOverdue(occ: Occurrence, now: Date): boolean {
  return (
    occ.status === "missed" ||
    (occ.status === "pending" && occ.dueAt < now.toISOString())
  );
}

/**
 * Sort a mixed overdue+today array: overdue-flagged items first, then
 * chronological by dueAt within each group.
 */
export function sortOccurrences(occs: Occurrence[], now: Date): Occurrence[] {
  return [...occs].sort((a, b) => {
    const aOver = isOverdue(a, now) ? 0 : 1;
    const bOver = isOverdue(b, now) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;
  });
}

/**
 * UTC ISO for "tomorrow" (the Tehran calendar day after `now`'s) at `atUtcIso`'s
 * own Tehran wall-clock time.
 */
export function tomorrowSameTime(atUtcIso: string, now: Date): string {
  const tomorrowTehranMidnightUtcMs = tehranStartOfDay(now).getTime() + DAY_MS;
  const atTehranShiftedMs = new Date(atUtcIso).getTime() + TEHRAN_OFFSET_MS;
  const wallClockMs = ((atTehranShiftedMs % DAY_MS) + DAY_MS) % DAY_MS;
  return new Date(tomorrowTehranMidnightUtcMs + wallClockMs).toISOString();
}

export interface BucketResult {
  overdue: Occurrence[];
  today: Occurrence[];
  upcoming: Occurrence[];
  completed: Occurrence[];
  progress: { done: number; total: number };
}

/**
 * Bucket occurrences by Tehran-day position relative to `now`.
 *
 * - **overdue**: dueAt < startOfToday AND status not done/skipped AND
 *                dueAt >= now − 7d (7-day look-back cap; older dropped)
 * - **today**: startOfToday ≤ dueAt < endOfToday
 * - **upcoming**: dueAt ≥ endOfToday
 *
 * Overdue + today are sorted overdue-first then chronological.
 * Upcoming is sorted chronologically.
 */
export function bucketOccurrences(occs: Occurrence[], now: Date): BucketResult {
  const startOfToday = tehranStartOfDay(now);
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);
  const lookBackStart = new Date(now.getTime() - SEVEN_DAYS_MS);

  const startISO = startOfToday.toISOString();
  const endISO = endOfToday.toISOString();
  const lookBackISO = lookBackStart.toISOString();

  const overdue: Occurrence[] = [];
  const today: Occurrence[] = [];
  const upcoming: Occurrence[] = [];
  const completed: Occurrence[] = [];

  // Today-dueAt occurrences pre-split (finals + non-final) — progress is
  // derived from this full set so moving finals into `completed` can't
  // change the numbers.
  const todayAll: Occurrence[] = [];

  for (const occ of occs) {
    const { dueAt, status } = occ;
    const isFinal = status === "done" || status === "skipped";

    if (dueAt >= endISO) {
      upcoming.push(occ);
    } else if (dueAt >= startISO) {
      todayAll.push(occ);
      if (isFinal) {
        if (dueAt >= lookBackISO) completed.push(occ);
      } else {
        today.push(occ);
      }
    } else {
      // dueAt < startOfToday — candidate for overdue/completed
      if (isFinal) {
        if (dueAt >= lookBackISO) completed.push(occ); // older than look-back → dropped
        continue;
      }
      if (dueAt < lookBackISO) continue; // older than 7-day look-back cap
      overdue.push(occ);
    }
  }

  // Sort overdue + today combined: overdue-flagged first, then chronological
  const sortedOverdue = sortOccurrences(overdue, now);
  const sortedToday = sortOccurrences(today, now);

  // Sort upcoming chronologically
  const sortedUpcoming = [...upcoming].sort((a, b) =>
    a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0,
  );

  // Sort completed reverse-chronologically (most recent first)
  const sortedCompleted = [...completed].sort((a, b) =>
    a.dueAt > b.dueAt ? -1 : a.dueAt < b.dueAt ? 1 : 0,
  );

  // Progress: today-dueAt occurrences, excluding skipped, done vs total
  const todayForProgress = todayAll.filter((o) => o.status !== "skipped");
  const progress = {
    done: todayForProgress.filter((o) => o.status === "done").length,
    total: todayForProgress.length,
  };

  return {
    overdue: sortedOverdue,
    today: sortedToday,
    upcoming: sortedUpcoming,
    completed: sortedCompleted,
    progress,
  };
}
