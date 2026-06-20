/**
 * Tests for lib/choreSchedule.ts — pure schedule engine.
 * TDD: all tests written BEFORE implementation.
 */

import {
  expandOccurrences,
  occurrencesForDay,
  toUtcIso,
} from '../lib/choreSchedule';
import type { Chore, ChoreLog, Occurrence } from '../db/types';

// ---------------------------------------------------------------------------
// Helpers — build minimal Chore stubs
// ---------------------------------------------------------------------------

function makeChore(overrides: Partial<Chore> & { schedule: Chore['schedule'] }): Chore {
  return {
    id: 'c1',
    petId: 'p1',
    type: 'feeding',
    title: null,
    endKind: 'never',
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeLog(choreId: string, dueAt: string, status: 'done' | 'skipped' = 'done'): ChoreLog {
  return {
    id: `log-${dueAt}`,
    choreId,
    dueAt,
    status,
    createdAt: dueAt,
  };
}

// ---------------------------------------------------------------------------
// toUtcIso helper
// ---------------------------------------------------------------------------

describe('toUtcIso', () => {
  test('converts Tehran 08:00 on 2025-06-20 to UTC', () => {
    // Tehran +03:30 → 08:00 local = 04:30 UTC
    const result = toUtcIso('08:00', '2025-06-20');
    expect(result).toBe('2025-06-20T04:30:00.000Z');
  });

  test('converts Tehran 00:30 on 2025-06-20 — still same UTC date', () => {
    // 00:30 Tehran = 21:00 UTC of previous day
    const result = toUtcIso('00:30', '2025-06-20');
    expect(result).toBe('2025-06-19T21:00:00.000Z');
  });

  test('converts Tehran 23:59 on 2025-06-20 — crosses UTC midnight', () => {
    // 23:59 Tehran = 20:29 UTC same day
    const result = toUtcIso('23:59', '2025-06-20');
    expect(result).toBe('2025-06-20T20:29:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — one_off
// ---------------------------------------------------------------------------

describe('expandOccurrences — one_off', () => {
  test('returns the single occurrence when it falls in range', () => {
    const chore = makeChore({
      schedule: { kind: 'one_off', at: '2025-06-20T10:00:00.000Z' },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-21T00:00:00.000Z'),
    );
    expect(result).toEqual(['2025-06-20T10:00:00.000Z']);
  });

  test('returns empty when one_off is before range', () => {
    const chore = makeChore({
      schedule: { kind: 'one_off', at: '2025-06-19T10:00:00.000Z' },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-21T00:00:00.000Z'),
    );
    expect(result).toEqual([]);
  });

  test('returns empty when one_off equals toUtc (half-open range)', () => {
    const chore = makeChore({
      schedule: { kind: 'one_off', at: '2025-06-21T00:00:00.000Z' },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-21T00:00:00.000Z'),
    );
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — daily_times
// ---------------------------------------------------------------------------

describe('expandOccurrences — daily_times', () => {
  // createdAt is 2025-01-01T00:00:00.000Z = 2025-01-01 03:30 Tehran
  // so origin calendar day in Tehran = 2025-01-01
  const chore = makeChore({
    createdAt: '2025-01-01T00:00:00.000Z',
    schedule: { kind: 'daily_times', times: ['08:00', '20:00'] },
  });

  test('returns both times for a single day', () => {
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-21T00:00:00.000Z'),
    );
    // 08:00 Tehran = 04:30 UTC; 20:00 Tehran = 16:30 UTC
    expect(result).toEqual([
      '2025-06-20T04:30:00.000Z',
      '2025-06-20T16:30:00.000Z',
    ]);
  });

  test('returns 4 occurrences over 2 days', () => {
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-22T00:00:00.000Z'),
    );
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('2025-06-20T04:30:00.000Z');
    expect(result[3]).toBe('2025-06-21T16:30:00.000Z');
  });

  test('Tehran wall-clock midnight crosses UTC date boundary', () => {
    // 00:30 Tehran = 21:00 UTC previous day
    // Occurrence at Tehran-day 2025-06-20 00:30 should be UTC 2025-06-19T21:00
    const chore2 = makeChore({
      createdAt: '2025-01-01T00:00:00.000Z',
      schedule: { kind: 'daily_times', times: ['00:30'] },
    });
    const result = expandOccurrences(
      chore2,
      // range covers the UTC time 2025-06-19T21:00 (which is Tehran 2025-06-20 00:30)
      new Date('2025-06-19T20:00:00.000Z'),
      new Date('2025-06-20T00:00:00.000Z'),
    );
    expect(result).toEqual(['2025-06-19T21:00:00.000Z']);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — weekdays
// ---------------------------------------------------------------------------

describe('expandOccurrences — weekdays', () => {
  test('only fires on listed weekdays (Tehran calendar)', () => {
    // 2025-06-20 is a Friday (day 5). Let's check that with days=[5] only Friday fires.
    const chore = makeChore({
      createdAt: '2025-01-01T00:00:00.000Z',
      schedule: { kind: 'weekdays', days: [5], times: ['09:00'] }, // Fridays only
    });
    // Range: Mon 2025-06-16 to Sun 2025-06-22 (inclusive start, exclusive end Mon)
    const result = expandOccurrences(
      chore,
      new Date('2025-06-16T00:00:00.000Z'),
      new Date('2025-06-23T00:00:00.000Z'),
    );
    // Only one Friday in range: 2025-06-20, Tehran 09:00 = UTC 05:30
    expect(result).toEqual(['2025-06-20T05:30:00.000Z']);
  });

  test('fires on multiple weekdays with multiple times', () => {
    // Sat (6) and Sun (0) with 08:00 Tehran
    const chore = makeChore({
      createdAt: '2025-01-01T00:00:00.000Z',
      schedule: { kind: 'weekdays', days: [0, 6], times: ['08:00'] },
    });
    // Week of 2025-06-15 (Sun) to 2025-06-22 (Sun)
    const result = expandOccurrences(
      chore,
      new Date('2025-06-15T00:00:00.000Z'),
      new Date('2025-06-22T00:00:00.000Z'),
    );
    // Sun 2025-06-15 08:00 Tehran = 04:30 UTC
    // Sat 2025-06-21 08:00 Tehran = 04:30 UTC
    expect(result).toEqual([
      '2025-06-15T04:30:00.000Z',
      '2025-06-21T04:30:00.000Z',
    ]);
  });

  test('weekday computed in Tehran local time', () => {
    // 2025-06-20 00:30 Tehran = 2025-06-19 21:00 UTC (Friday in Tehran, Thursday in UTC)
    // With days=[5] (Friday), this occurrence should be INCLUDED
    // With days=[4] (Thursday), it should NOT be included
    const choreFri = makeChore({
      createdAt: '2025-01-01T00:00:00.000Z',
      schedule: { kind: 'weekdays', days: [5], times: ['00:30'] }, // Friday 00:30 Tehran
    });
    const result = expandOccurrences(
      choreFri,
      new Date('2025-06-19T20:00:00.000Z'),
      new Date('2025-06-20T02:00:00.000Z'),
    );
    // 2025-06-20 00:30 Tehran = Friday = day 5 ✓, UTC = 2025-06-19T21:00
    expect(result).toEqual(['2025-06-19T21:00:00.000Z']);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — interval (hours)
// ---------------------------------------------------------------------------

describe('expandOccurrences — interval hours', () => {
  test('fires every 6 hours from anchor', () => {
    const anchor = '2025-06-20T06:00:00.000Z';
    const chore = makeChore({
      schedule: { kind: 'interval', n: 6, unit: 'hours', anchor },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-21T00:00:00.000Z'),
    );
    // anchor 06:00, then 12:00, 18:00 — all in range; next would be 2025-06-21T00:00 which is excluded
    expect(result).toEqual([
      '2025-06-20T06:00:00.000Z',
      '2025-06-20T12:00:00.000Z',
      '2025-06-20T18:00:00.000Z',
    ]);
  });

  test('does not include occurrences before anchor', () => {
    const anchor = '2025-06-20T06:00:00.000Z';
    const chore = makeChore({
      schedule: { kind: 'interval', n: 6, unit: 'hours', anchor },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-19T00:00:00.000Z'),
      new Date('2025-06-20T10:00:00.000Z'),
    );
    // Only the anchor itself (06:00), no occurrences before it
    expect(result).toEqual(['2025-06-20T06:00:00.000Z']);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — interval (days)
// ---------------------------------------------------------------------------

describe('expandOccurrences — interval days', () => {
  test('fires every 3 days from anchor', () => {
    const anchor = '2025-06-01T08:00:00.000Z';
    const chore = makeChore({
      schedule: { kind: 'interval', n: 3, unit: 'days', anchor },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-01T00:00:00.000Z'),
      new Date('2025-06-15T00:00:00.000Z'),
    );
    // Jun 1, 4, 7, 10, 13 all at 08:00 UTC
    expect(result).toEqual([
      '2025-06-01T08:00:00.000Z',
      '2025-06-04T08:00:00.000Z',
      '2025-06-07T08:00:00.000Z',
      '2025-06-10T08:00:00.000Z',
      '2025-06-13T08:00:00.000Z',
    ]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — interval (months) + month/year rollover
// ---------------------------------------------------------------------------

describe('expandOccurrences — interval months + rollover', () => {
  test('fires monthly from anchor', () => {
    const anchor = '2025-01-15T10:00:00.000Z';
    const chore = makeChore({
      schedule: { kind: 'interval', n: 1, unit: 'months', anchor },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-01-01T00:00:00.000Z'),
      new Date('2025-04-01T00:00:00.000Z'),
    );
    expect(result).toEqual([
      '2025-01-15T10:00:00.000Z',
      '2025-02-15T10:00:00.000Z',
      '2025-03-15T10:00:00.000Z',
    ]);
  });

  test('month rollover: Jan 31 + 1 month = Feb 28 (2025 is not a leap year)', () => {
    const anchor = '2025-01-31T10:00:00.000Z';
    const chore = makeChore({
      schedule: { kind: 'interval', n: 1, unit: 'months', anchor },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-01-01T00:00:00.000Z'),
      new Date('2025-04-01T00:00:00.000Z'),
    );
    // Jan 31, Feb 28 (clamped), Mar 31
    expect(result).toEqual([
      '2025-01-31T10:00:00.000Z',
      '2025-02-28T10:00:00.000Z',
      '2025-03-31T10:00:00.000Z',
    ]);
  });

  test('year rollover: Nov 2025 + 3 months = Feb 2026', () => {
    const anchor = '2025-11-10T08:00:00.000Z';
    const chore = makeChore({
      schedule: { kind: 'interval', n: 3, unit: 'months', anchor },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-11-01T00:00:00.000Z'),
      new Date('2026-05-01T00:00:00.000Z'),
    );
    expect(result).toEqual([
      '2025-11-10T08:00:00.000Z',
      '2026-02-10T08:00:00.000Z',
    ]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — end conditions
// ---------------------------------------------------------------------------

describe('expandOccurrences — end_kind until', () => {
  test('stops including occurrences after endUntil date', () => {
    // endUntil = 2025-06-21T00:00:00.000Z means "stop after" that date
    // Spec says: "stops after the date" — occurrences ON that date are included
    const chore = makeChore({
      endKind: 'until',
      endUntil: '2025-06-21T23:59:59.000Z', // end of June 21
      schedule: { kind: 'daily_times', times: ['08:00'] },
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-23T00:00:00.000Z'),
    );
    // Jun 20 08:00 Tehran = 04:30 UTC ✓
    // Jun 21 08:00 Tehran = 04:30 UTC ✓ (before endUntil)
    // Jun 22 08:00 Tehran = 04:30 UTC ✗ (after endUntil)
    expect(result).toEqual([
      '2025-06-20T04:30:00.000Z',
      '2025-06-21T04:30:00.000Z',
    ]);
  });

  test('boundary: occurrence exactly at endUntil is included', () => {
    // endUntil = exact UTC of an occurrence
    const chore = makeChore({
      endKind: 'until',
      endUntil: '2025-06-20T04:30:00.000Z',
      schedule: { kind: 'daily_times', times: ['08:00'] },
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-22T00:00:00.000Z'),
    );
    // Jun 20 04:30 UTC == endUntil → included
    // Jun 21 04:30 UTC > endUntil → excluded
    expect(result).toEqual(['2025-06-20T04:30:00.000Z']);
  });
});

describe('expandOccurrences — end_kind after_n', () => {
  test('after_n stops after Nth occurrence counted from origin (not from fromUtc)', () => {
    // createdAt 2025-01-01T00:00:00.000Z = origin day in Tehran = 2025-01-01
    // daily_times 08:00 Tehran = origin counts from 2025-01-01
    // endCount = 3 → only 3 total occurrences ever
    const chore = makeChore({
      createdAt: '2025-01-01T00:00:00.000Z',
      endKind: 'after_n',
      endCount: 3,
      schedule: { kind: 'daily_times', times: ['08:00'] },
    });
    // Query a range that starts AFTER the origin (Jan 1, 2, 3 are the 3 occurrences)
    const result = expandOccurrences(
      chore,
      new Date('2025-01-01T00:00:00.000Z'),
      new Date('2025-01-10T00:00:00.000Z'),
    );
    // Only 3 occurrences from origin: Jan 1, Jan 2, Jan 3 at 04:30 UTC each
    expect(result).toEqual([
      '2025-01-01T04:30:00.000Z',
      '2025-01-02T04:30:00.000Z',
      '2025-01-03T04:30:00.000Z',
    ]);
  });

  test('after_n: query window starts mid-sequence — already-exhausted chore returns empty', () => {
    const chore = makeChore({
      createdAt: '2025-01-01T00:00:00.000Z',
      endKind: 'after_n',
      endCount: 3,
      schedule: { kind: 'daily_times', times: ['08:00'] },
    });
    // Occurrences 1-3 are Jan 1-3. Query from Jan 5 onwards → no occurrences left
    const result = expandOccurrences(
      chore,
      new Date('2025-01-05T00:00:00.000Z'),
      new Date('2025-01-10T00:00:00.000Z'),
    );
    expect(result).toEqual([]);
  });

  test('after_n with interval: counts from anchor', () => {
    // anchor = first occurrence, endCount = 2 → only 2 occurrences ever
    const anchor = '2025-06-01T08:00:00.000Z';
    const chore = makeChore({
      createdAt: '2025-01-01T00:00:00.000Z',
      endKind: 'after_n',
      endCount: 2,
      schedule: { kind: 'interval', n: 1, unit: 'days', anchor },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-01T00:00:00.000Z'),
      new Date('2025-06-10T00:00:00.000Z'),
    );
    expect(result).toEqual([
      '2025-06-01T08:00:00.000Z',
      '2025-06-02T08:00:00.000Z',
    ]);
  });

  test('after_n with one_off: count=1 is the single occurrence', () => {
    const chore = makeChore({
      endKind: 'after_n',
      endCount: 1,
      schedule: { kind: 'one_off', at: '2025-06-20T10:00:00.000Z' },
    });
    const result = expandOccurrences(
      chore,
      new Date('2025-06-20T00:00:00.000Z'),
      new Date('2025-06-21T00:00:00.000Z'),
    );
    expect(result).toEqual(['2025-06-20T10:00:00.000Z']);
  });
});

// ---------------------------------------------------------------------------
// occurrencesForDay
// ---------------------------------------------------------------------------

describe('occurrencesForDay', () => {
  const chore = makeChore({
    id: 'c1',
    createdAt: '2025-01-01T00:00:00.000Z',
    schedule: { kind: 'daily_times', times: ['08:00', '20:00'] },
  });

  const dayStart = new Date('2025-06-20T00:00:00.000Z');
  const dayEnd = new Date('2025-06-21T00:00:00.000Z');

  // Tehran 08:00 on 2025-06-20 = UTC 2025-06-20T04:30:00.000Z (in the past relative to 'now')
  // Tehran 20:00 on 2025-06-20 = UTC 2025-06-20T16:30:00.000Z (in the future)

  test('marks past occurrence with no log as missed', () => {
    const now = new Date('2025-06-20T10:00:00.000Z'); // after 04:30, before 16:30
    const result = occurrencesForDay([chore], [], { start: dayStart, end: dayEnd }, now);

    const missed = result.filter(o => o.status === 'missed');
    expect(missed).toHaveLength(1);
    expect(missed[0].dueAt).toBe('2025-06-20T04:30:00.000Z');
  });

  test('marks future occurrence as pending', () => {
    const now = new Date('2025-06-20T10:00:00.000Z');
    const result = occurrencesForDay([chore], [], { start: dayStart, end: dayEnd }, now);

    const pending = result.filter(o => o.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].dueAt).toBe('2025-06-20T16:30:00.000Z');
  });

  test('marks logged occurrence as done', () => {
    const now = new Date('2025-06-20T10:00:00.000Z');
    const log = makeLog('c1', '2025-06-20T04:30:00.000Z', 'done');
    const result = occurrencesForDay([chore], [log], { start: dayStart, end: dayEnd }, now);

    const done = result.filter(o => o.status === 'done');
    expect(done).toHaveLength(1);
    expect(done[0].dueAt).toBe('2025-06-20T04:30:00.000Z');
  });

  test('marks logged occurrence as skipped', () => {
    const now = new Date('2025-06-20T10:00:00.000Z');
    const log = makeLog('c1', '2025-06-20T04:30:00.000Z', 'skipped');
    const result = occurrencesForDay([chore], [log], { start: dayStart, end: dayEnd }, now);

    const skipped = result.filter(o => o.status === 'skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0].dueAt).toBe('2025-06-20T04:30:00.000Z');
  });

  test('handles multiple chores correctly', () => {
    const chore2 = makeChore({
      id: 'c2',
      createdAt: '2025-01-01T00:00:00.000Z',
      schedule: { kind: 'daily_times', times: ['12:00'] },
    });
    const now = new Date('2025-06-20T10:00:00.000Z');
    // c2's 12:00 Tehran = 08:30 UTC — in the past
    const result = occurrencesForDay([chore, chore2], [], { start: dayStart, end: dayEnd }, now);

    expect(result).toHaveLength(3); // 2 from chore, 1 from chore2
    const c2occ = result.filter(o => o.chore.id === 'c2');
    expect(c2occ).toHaveLength(1);
    expect(c2occ[0].status).toBe('missed'); // 08:30 UTC < now 10:00 UTC
  });

  test('empty chores list returns empty array', () => {
    const now = new Date('2025-06-20T10:00:00.000Z');
    const result = occurrencesForDay([], [], { start: dayStart, end: dayEnd }, now);
    expect(result).toEqual([]);
  });
});
