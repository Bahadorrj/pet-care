/**
 * todayBuckets tests — TDD RED → GREEN
 *
 * Fixed `now` = 2026-06-24T12:00:00Z (Tehran = 2026-06-24 15:30 local).
 * Tehran midnight of that day = 2026-06-23T20:30:00Z (UTC).
 * End of today = 2026-06-24T20:30:00Z (UTC).
 *
 * Covers:
 * 1. yesterday (pending) → overdue
 * 2. today → today
 * 3. +3 days → upcoming
 * 4. done/skipped in the past → excluded from overdue
 * 5. overdue older than 7 days → excluded (look-back cap)
 * 6. sort: overdue-first ordering within the overdue+today mix
 */

import { bucketOccurrences } from '../screens/tasks/todayBuckets';
import type { Chore, Occurrence } from '../db/types';

// ── Fixed clock ───────────────────────────────────────────────────────────────
const NOW = new Date('2026-06-24T12:00:00Z');

// Tehran = UTC+03:30 (fixed, no DST).
// Tehran midnight = 2026-06-23T20:30:00Z (UTC).
// End of Tehran today = 2026-06-24T20:30:00Z (UTC).

// ── Minimal chore stub ────────────────────────────────────────────────────────
const stubChore = (id: string): Chore =>
  ({
    id,
    petId: 'pet-1',
    type: 'feeding',
    title: null,
    schedule: { kind: 'daily_times', times: ['09:00'] },
    endKind: 'never',
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as Chore);

const occ = (id: string, dueAt: string, status: Occurrence['status']): Occurrence => ({
  chore: stubChore(id),
  dueAt,
  status,
});

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Yesterday: 2026-06-23T06:00:00Z (well inside Tehran's previous day, before Tehran midnight)
const YESTERDAY = occ('c-yesterday', '2026-06-23T06:00:00Z', 'pending');

// Today: 2026-06-24T06:00:00Z (inside Tehran today window 20:30 UTC prev day → 20:30 UTC today)
const TODAY = occ('c-today', '2026-06-24T06:00:00Z', 'pending');

// Upcoming: +3 days
const UPCOMING = occ('c-upcoming', '2026-06-27T06:00:00Z', 'pending');

// Past but done → should NOT appear in overdue
const PAST_DONE = occ('c-past-done', '2026-06-23T06:00:00Z', 'done');

// Past but skipped → should NOT appear in overdue
const PAST_SKIPPED = occ('c-past-skipped', '2026-06-23T06:00:00Z', 'skipped');

// Older than 7 days → should be excluded by look-back cap
// 7 days before now = 2026-06-17T12:00:00Z; use 2026-06-17T11:00:00Z (just outside)
const TOO_OLD = occ('c-too-old', '2026-06-17T11:00:00Z', 'pending');

// Two items for sort test: one missed in today's window (overdue-flagged),
// one future-pending (also today, but NOT overdue-flagged) with an earlier dueAt.
// The missed one should sort first despite having a later dueAt.
const SORT_OVERDUE = occ('c-sort-overdue', '2026-06-24T15:00:00Z', 'missed'); // missed → overdue-flagged, later dueAt
const SORT_TODAY_PENDING = occ('c-sort-today', '2026-06-24T14:00:00Z', 'pending'); // future-pending, earlier dueAt

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('bucketOccurrences', () => {
  test('yesterday pending → overdue bucket', () => {
    const { overdue, today, upcoming } = bucketOccurrences([YESTERDAY], NOW);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].chore.id).toBe('c-yesterday');
    expect(today).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
  });

  test('today occurrence → today bucket', () => {
    const { overdue, today, upcoming } = bucketOccurrences([TODAY], NOW);
    expect(today).toHaveLength(1);
    expect(today[0].chore.id).toBe('c-today');
    expect(overdue).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
  });

  test('+3 days → upcoming bucket', () => {
    const { overdue, today, upcoming } = bucketOccurrences([UPCOMING], NOW);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].chore.id).toBe('c-upcoming');
    expect(overdue).toHaveLength(0);
    expect(today).toHaveLength(0);
  });

  test('done in the past → excluded from overdue', () => {
    const { overdue } = bucketOccurrences([PAST_DONE], NOW);
    expect(overdue).toHaveLength(0);
  });

  test('skipped in the past → excluded from overdue', () => {
    const { overdue } = bucketOccurrences([PAST_SKIPPED], NOW);
    expect(overdue).toHaveLength(0);
  });

  test('pending overdue older than 7 days → excluded by look-back cap', () => {
    const { overdue } = bucketOccurrences([TOO_OLD], NOW);
    expect(overdue).toHaveLength(0);
  });

  test('sort: missed (overdue-flagged) sorts before earlier pending today', () => {
    // SORT_OVERDUE = missed at 06:00, SORT_TODAY_PENDING = pending at 05:00 (earlier dueAt)
    // After combined sort: overdue-flagged (missed) should appear first
    const { overdue, today } = bucketOccurrences([SORT_TODAY_PENDING, SORT_OVERDUE], NOW);
    // Both fall in the today window; SORT_OVERDUE is missed so isOverdue=true
    // The combined overdue+today sort puts overdue-flagged first
    // overdue bucket: items with dueAt < startOfToday → neither of these qualify
    // Both are in today's window → both in today[]
    // But sort should put missed (overdue-flagged) first despite later dueAt
    expect(today).toHaveLength(2);
    expect(today[0].chore.id).toBe('c-sort-overdue');   // missed → sorts first
    expect(today[1].chore.id).toBe('c-sort-today');     // pending → sorts after
    expect(overdue).toHaveLength(0);
  });

  test('upcoming sorts chronologically', () => {
    const early = occ('c-up-early', '2026-06-27T04:00:00Z', 'pending');
    const late = occ('c-up-late', '2026-06-27T10:00:00Z', 'pending');
    const { upcoming } = bucketOccurrences([late, early], NOW);
    expect(upcoming[0].chore.id).toBe('c-up-early');
    expect(upcoming[1].chore.id).toBe('c-up-late');
  });
});
