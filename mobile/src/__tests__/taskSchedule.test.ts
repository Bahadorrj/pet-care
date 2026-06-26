/**
 * Tests for lib/taskSchedule.ts — pure schedule engine.
 * TDD: all tests written BEFORE implementation.
 */

import {
  expandOccurrences,
  occurrencesForDay,
  toUtcIso,
  streak,
  adherence,
} from "../lib/taskSchedule";
import type { Task, TaskLog } from "../db/types";

// ---------------------------------------------------------------------------
// Helpers — build minimal Task stubs
// ---------------------------------------------------------------------------

function makeTask(
  overrides: Partial<Task> & { schedule: Task["schedule"] },
): Task {
  return {
    id: "c1",
    petId: "p1",
    type: "feeding",
    title: null,
    endKind: "never",
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLog(
  taskId: string,
  dueAt: string,
  status: "done" | "skipped" = "done",
): TaskLog {
  return {
    id: `log-${dueAt}`,
    taskId,
    dueAt,
    status,
    createdAt: dueAt,
  };
}

// ---------------------------------------------------------------------------
// toUtcIso helper
// ---------------------------------------------------------------------------

describe("toUtcIso", () => {
  test("converts Tehran 08:00 on 2025-06-20 to UTC", () => {
    // Tehran +03:30 → 08:00 local = 04:30 UTC
    const result = toUtcIso("08:00", "2025-06-20");
    expect(result).toBe("2025-06-20T04:30:00.000Z");
  });

  test("converts Tehran 00:30 on 2025-06-20 — still same UTC date", () => {
    // 00:30 Tehran = 21:00 UTC of previous day
    const result = toUtcIso("00:30", "2025-06-20");
    expect(result).toBe("2025-06-19T21:00:00.000Z");
  });

  test("converts Tehran 23:59 on 2025-06-20 — crosses UTC midnight", () => {
    // 23:59 Tehran = 20:29 UTC same day
    const result = toUtcIso("23:59", "2025-06-20");
    expect(result).toBe("2025-06-20T20:29:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — one_off
// ---------------------------------------------------------------------------

describe("expandOccurrences — one_off", () => {
  test("returns the single occurrence when it falls in range", () => {
    const task = makeTask({
      schedule: { kind: "one_off", at: "2025-06-20T10:00:00.000Z" },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-21T00:00:00.000Z"),
    );
    expect(result).toEqual(["2025-06-20T10:00:00.000Z"]);
  });

  test("returns empty when one_off is before range", () => {
    const task = makeTask({
      schedule: { kind: "one_off", at: "2025-06-19T10:00:00.000Z" },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-21T00:00:00.000Z"),
    );
    expect(result).toEqual([]);
  });

  test("returns empty when one_off equals toUtc (half-open range)", () => {
    const task = makeTask({
      schedule: { kind: "one_off", at: "2025-06-21T00:00:00.000Z" },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-21T00:00:00.000Z"),
    );
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — daily_times
// ---------------------------------------------------------------------------

describe("expandOccurrences — daily_times", () => {
  // createdAt is 2025-01-01T00:00:00.000Z = 2025-01-01 03:30 Tehran
  // so origin calendar day in Tehran = 2025-01-01
  const task = makeTask({
    createdAt: "2025-01-01T00:00:00.000Z",
    schedule: { kind: "daily_times", times: ["08:00", "20:00"] },
  });

  test("returns both times for a single day", () => {
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-21T00:00:00.000Z"),
    );
    // 08:00 Tehran = 04:30 UTC; 20:00 Tehran = 16:30 UTC
    expect(result).toEqual([
      "2025-06-20T04:30:00.000Z",
      "2025-06-20T16:30:00.000Z",
    ]);
  });

  test("returns 4 occurrences over 2 days", () => {
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-22T00:00:00.000Z"),
    );
    expect(result).toHaveLength(4);
    expect(result[0]).toBe("2025-06-20T04:30:00.000Z");
    expect(result[3]).toBe("2025-06-21T16:30:00.000Z");
  });

  test("Tehran wall-clock midnight crosses UTC date boundary", () => {
    // 00:30 Tehran = 21:00 UTC previous day
    // Occurrence at Tehran-day 2025-06-20 00:30 should be UTC 2025-06-19T21:00
    const task2 = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "daily_times", times: ["00:30"] },
    });
    const result = expandOccurrences(
      task2,
      // range covers the UTC time 2025-06-19T21:00 (which is Tehran 2025-06-20 00:30)
      new Date("2025-06-19T20:00:00.000Z"),
      new Date("2025-06-20T00:00:00.000Z"),
    );
    expect(result).toEqual(["2025-06-19T21:00:00.000Z"]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — performance: scan is bounded by the window, not task age
// ---------------------------------------------------------------------------

describe("expandOccurrences — bounded scan for non-after_n schedules", () => {
  test("work is proportional to the window, not the days since createdAt", () => {
    // Task created ~535 days before the query window. A correct-but-naive
    // implementation scans from the task origin (createdAt) to the window end,
    // doing O(task-age) date math. For non-after_n schedules only the window
    // matters, so work must stay O(window).
    const task = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "never",
      schedule: { kind: "daily_times", times: ["08:00"] },
    });

    // toISOString is the per-occurrence-day cost inside toUtcIso; count it as a
    // deterministic proxy for iteration count (no flaky wall-clock timing).
    const spy = jest.spyOn(Date.prototype, "toISOString");
    try {
      const result = expandOccurrences(
        task,
        new Date("2026-06-20T00:00:00.000Z"),
        new Date("2026-06-21T00:00:00.000Z"),
      );
      // Correctness preserved: the single in-window occurrence still returns.
      expect(result).toEqual(["2026-06-20T04:30:00.000Z"]);
      // A 1-day window must not pay ~535 days of scanning.
      expect(spy.mock.calls.length).toBeLessThan(100);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — weekdays
// ---------------------------------------------------------------------------

describe("expandOccurrences — weekdays", () => {
  test("only fires on listed weekdays (Tehran calendar)", () => {
    // 2025-06-20 is a Friday (day 5). Let's check that with days=[5] only Friday fires.
    const task = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "weekdays", days: [5], times: ["09:00"] }, // Fridays only
    });
    // Range: Mon 2025-06-16 to Sun 2025-06-22 (inclusive start, exclusive end Mon)
    const result = expandOccurrences(
      task,
      new Date("2025-06-16T00:00:00.000Z"),
      new Date("2025-06-23T00:00:00.000Z"),
    );
    // Only one Friday in range: 2025-06-20, Tehran 09:00 = UTC 05:30
    expect(result).toEqual(["2025-06-20T05:30:00.000Z"]);
  });

  test("fires on multiple weekdays with multiple times", () => {
    // Sat (6) and Sun (0) with 08:00 Tehran
    const task = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "weekdays", days: [0, 6], times: ["08:00"] },
    });
    // Week of 2025-06-15 (Sun) to 2025-06-22 (Sun)
    const result = expandOccurrences(
      task,
      new Date("2025-06-15T00:00:00.000Z"),
      new Date("2025-06-22T00:00:00.000Z"),
    );
    // Sun 2025-06-15 08:00 Tehran = 04:30 UTC
    // Sat 2025-06-21 08:00 Tehran = 04:30 UTC
    expect(result).toEqual([
      "2025-06-15T04:30:00.000Z",
      "2025-06-21T04:30:00.000Z",
    ]);
  });

  test("weekday computed in Tehran local time", () => {
    // 2025-06-20 00:30 Tehran = 2025-06-19 21:00 UTC (Friday in Tehran, Thursday in UTC)
    // With days=[5] (Friday), this occurrence should be INCLUDED
    // With days=[4] (Thursday), it should NOT be included
    const taskFri = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "weekdays", days: [5], times: ["00:30"] }, // Friday 00:30 Tehran
    });
    const result = expandOccurrences(
      taskFri,
      new Date("2025-06-19T20:00:00.000Z"),
      new Date("2025-06-20T02:00:00.000Z"),
    );
    // 2025-06-20 00:30 Tehran = Friday = day 5 ✓, UTC = 2025-06-19T21:00
    expect(result).toEqual(["2025-06-19T21:00:00.000Z"]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — interval (hours)
// ---------------------------------------------------------------------------

describe("expandOccurrences — interval hours", () => {
  test("fires every 6 hours from anchor", () => {
    const anchor = "2025-06-20T06:00:00.000Z";
    const task = makeTask({
      schedule: { kind: "interval", n: 6, unit: "hours", anchor },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-21T00:00:00.000Z"),
    );
    // anchor 06:00, then 12:00, 18:00 — all in range; next would be 2025-06-21T00:00 which is excluded
    expect(result).toEqual([
      "2025-06-20T06:00:00.000Z",
      "2025-06-20T12:00:00.000Z",
      "2025-06-20T18:00:00.000Z",
    ]);
  });

  test("does not include occurrences before anchor", () => {
    const anchor = "2025-06-20T06:00:00.000Z";
    const task = makeTask({
      schedule: { kind: "interval", n: 6, unit: "hours", anchor },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-19T00:00:00.000Z"),
      new Date("2025-06-20T10:00:00.000Z"),
    );
    // Only the anchor itself (06:00), no occurrences before it
    expect(result).toEqual(["2025-06-20T06:00:00.000Z"]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — interval (days)
// ---------------------------------------------------------------------------

describe("expandOccurrences — interval days", () => {
  test("fires every 3 days from anchor", () => {
    const anchor = "2025-06-01T08:00:00.000Z";
    const task = makeTask({
      schedule: { kind: "interval", n: 3, unit: "days", anchor },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-01T00:00:00.000Z"),
      new Date("2025-06-15T00:00:00.000Z"),
    );
    // Jun 1, 4, 7, 10, 13 all at 08:00 UTC
    expect(result).toEqual([
      "2025-06-01T08:00:00.000Z",
      "2025-06-04T08:00:00.000Z",
      "2025-06-07T08:00:00.000Z",
      "2025-06-10T08:00:00.000Z",
      "2025-06-13T08:00:00.000Z",
    ]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — interval (months) + month/year rollover
// ---------------------------------------------------------------------------

describe("expandOccurrences — interval months + rollover", () => {
  test("fires monthly from anchor", () => {
    const anchor = "2025-01-15T10:00:00.000Z";
    const task = makeTask({
      schedule: { kind: "interval", n: 1, unit: "months", anchor },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-04-01T00:00:00.000Z"),
    );
    expect(result).toEqual([
      "2025-01-15T10:00:00.000Z",
      "2025-02-15T10:00:00.000Z",
      "2025-03-15T10:00:00.000Z",
    ]);
  });

  test("month rollover: Jan 31 + 1 month = Feb 28 (2025 is not a leap year)", () => {
    const anchor = "2025-01-31T10:00:00.000Z";
    const task = makeTask({
      schedule: { kind: "interval", n: 1, unit: "months", anchor },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-04-01T00:00:00.000Z"),
    );
    // Jan 31, Feb 28 (clamped), Mar 31
    expect(result).toEqual([
      "2025-01-31T10:00:00.000Z",
      "2025-02-28T10:00:00.000Z",
      "2025-03-31T10:00:00.000Z",
    ]);
  });

  test("year rollover: Nov 2025 + 3 months = Feb 2026", () => {
    const anchor = "2025-11-10T08:00:00.000Z";
    const task = makeTask({
      schedule: { kind: "interval", n: 3, unit: "months", anchor },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-11-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z"),
    );
    expect(result).toEqual([
      "2025-11-10T08:00:00.000Z",
      "2026-02-10T08:00:00.000Z",
    ]);
  });
});

// ---------------------------------------------------------------------------
// expandOccurrences — end conditions
// ---------------------------------------------------------------------------

describe("expandOccurrences — end_kind until", () => {
  test("stops including occurrences after endUntil date", () => {
    // endUntil = 2025-06-21T00:00:00.000Z means "stop after" that date
    // Spec says: "stops after the date" — occurrences ON that date are included
    const task = makeTask({
      endKind: "until",
      endUntil: "2025-06-21T23:59:59.000Z", // end of June 21
      schedule: { kind: "daily_times", times: ["08:00"] },
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-23T00:00:00.000Z"),
    );
    // Jun 20 08:00 Tehran = 04:30 UTC ✓
    // Jun 21 08:00 Tehran = 04:30 UTC ✓ (before endUntil)
    // Jun 22 08:00 Tehran = 04:30 UTC ✗ (after endUntil)
    expect(result).toEqual([
      "2025-06-20T04:30:00.000Z",
      "2025-06-21T04:30:00.000Z",
    ]);
  });

  test("boundary: occurrence exactly at endUntil is included", () => {
    // endUntil = exact UTC of an occurrence
    const task = makeTask({
      endKind: "until",
      endUntil: "2025-06-20T04:30:00.000Z",
      schedule: { kind: "daily_times", times: ["08:00"] },
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-22T00:00:00.000Z"),
    );
    // Jun 20 04:30 UTC == endUntil → included
    // Jun 21 04:30 UTC > endUntil → excluded
    expect(result).toEqual(["2025-06-20T04:30:00.000Z"]);
  });
});

describe("expandOccurrences — end_kind after_n", () => {
  test("after_n stops after Nth occurrence counted from origin (not from fromUtc)", () => {
    // createdAt 2025-01-01T00:00:00.000Z = origin day in Tehran = 2025-01-01
    // daily_times 08:00 Tehran = origin counts from 2025-01-01
    // endCount = 3 → only 3 total occurrences ever
    const task = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "after_n",
      endCount: 3,
      schedule: { kind: "daily_times", times: ["08:00"] },
    });
    // Query a range that starts AFTER the origin (Jan 1, 2, 3 are the 3 occurrences)
    const result = expandOccurrences(
      task,
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-01-10T00:00:00.000Z"),
    );
    // Only 3 occurrences from origin: Jan 1, Jan 2, Jan 3 at 04:30 UTC each
    expect(result).toEqual([
      "2025-01-01T04:30:00.000Z",
      "2025-01-02T04:30:00.000Z",
      "2025-01-03T04:30:00.000Z",
    ]);
  });

  test("after_n: query window starts mid-sequence — already-exhausted task returns empty", () => {
    const task = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "after_n",
      endCount: 3,
      schedule: { kind: "daily_times", times: ["08:00"] },
    });
    // Occurrences 1-3 are Jan 1-3. Query from Jan 5 onwards → no occurrences left
    const result = expandOccurrences(
      task,
      new Date("2025-01-05T00:00:00.000Z"),
      new Date("2025-01-10T00:00:00.000Z"),
    );
    expect(result).toEqual([]);
  });

  test("after_n with interval: counts from anchor", () => {
    // anchor = first occurrence, endCount = 2 → only 2 occurrences ever
    const anchor = "2025-06-01T08:00:00.000Z";
    const task = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "after_n",
      endCount: 2,
      schedule: { kind: "interval", n: 1, unit: "days", anchor },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-01T00:00:00.000Z"),
      new Date("2025-06-10T00:00:00.000Z"),
    );
    expect(result).toEqual([
      "2025-06-01T08:00:00.000Z",
      "2025-06-02T08:00:00.000Z",
    ]);
  });

  test("after_n with one_off: count=1 is the single occurrence", () => {
    const task = makeTask({
      endKind: "after_n",
      endCount: 1,
      schedule: { kind: "one_off", at: "2025-06-20T10:00:00.000Z" },
    });
    const result = expandOccurrences(
      task,
      new Date("2025-06-20T00:00:00.000Z"),
      new Date("2025-06-21T00:00:00.000Z"),
    );
    expect(result).toEqual(["2025-06-20T10:00:00.000Z"]);
  });

  test("after_n with weekdays: only matching days count toward N, not skipped days", () => {
    // Fridays only (day 5) at 09:00 Tehran. createdAt = 2025-06-13 (a Friday).
    // endCount = 3 → 3 Fridays total: Jun 13, Jun 20, Jun 27. Jun 27 is the last.
    // Non-matching weekdays must NOT increment the count.
    const task = makeTask({
      createdAt: "2025-06-13T05:30:00.000Z", // 2025-06-13T09:00 Tehran = UTC 05:30
      endKind: "after_n",
      endCount: 3,
      schedule: { kind: "weekdays", days: [5], times: ["09:00"] }, // Fridays only
    });
    // Query spans all 3 Fridays and beyond to verify cutoff
    const result = expandOccurrences(
      task,
      new Date("2025-06-13T00:00:00.000Z"),
      new Date("2025-07-11T00:00:00.000Z"),
    );
    // 3 Fridays at 09:00 Tehran = 05:30 UTC each
    expect(result).toEqual([
      "2025-06-13T05:30:00.000Z",
      "2025-06-20T05:30:00.000Z",
      "2025-06-27T05:30:00.000Z",
    ]);
  });

  test("after_n with interval months: N monthly occurrences from anchor then stops", () => {
    // Monthly from Jan 15, endCount = 3 → Jan 15, Feb 15, Mar 15 only.
    const anchor = "2025-01-15T10:00:00.000Z";
    const task = makeTask({
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "after_n",
      endCount: 3,
      schedule: { kind: "interval", n: 1, unit: "months", anchor },
    });
    // Query beyond the 3rd occurrence to confirm hard cutoff
    const result = expandOccurrences(
      task,
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-06-01T00:00:00.000Z"),
    );
    expect(result).toEqual([
      "2025-01-15T10:00:00.000Z",
      "2025-02-15T10:00:00.000Z",
      "2025-03-15T10:00:00.000Z",
    ]);
  });
});

// ---------------------------------------------------------------------------
// occurrencesForDay
// ---------------------------------------------------------------------------

describe("occurrencesForDay", () => {
  const task = makeTask({
    id: "c1",
    createdAt: "2025-01-01T00:00:00.000Z",
    schedule: { kind: "daily_times", times: ["08:00", "20:00"] },
  });

  const dayStart = new Date("2025-06-20T00:00:00.000Z");
  const dayEnd = new Date("2025-06-21T00:00:00.000Z");

  // Tehran 08:00 on 2025-06-20 = UTC 2025-06-20T04:30:00.000Z (in the past relative to 'now')
  // Tehran 20:00 on 2025-06-20 = UTC 2025-06-20T16:30:00.000Z (in the future)

  test("marks past occurrence with no log as missed", () => {
    const now = new Date("2025-06-20T10:00:00.000Z"); // after 04:30, before 16:30
    const result = occurrencesForDay(
      [task],
      [],
      { start: dayStart, end: dayEnd },
      now,
    );

    const missed = result.filter((o) => o.status === "missed");
    expect(missed).toHaveLength(1);
    expect(missed[0].dueAt).toBe("2025-06-20T04:30:00.000Z");
  });

  test("marks future occurrence as pending", () => {
    const now = new Date("2025-06-20T10:00:00.000Z");
    const result = occurrencesForDay(
      [task],
      [],
      { start: dayStart, end: dayEnd },
      now,
    );

    const pending = result.filter((o) => o.status === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].dueAt).toBe("2025-06-20T16:30:00.000Z");
  });

  test("marks logged occurrence as done", () => {
    const now = new Date("2025-06-20T10:00:00.000Z");
    const log = makeLog("c1", "2025-06-20T04:30:00.000Z", "done");
    const result = occurrencesForDay(
      [task],
      [log],
      { start: dayStart, end: dayEnd },
      now,
    );

    const done = result.filter((o) => o.status === "done");
    expect(done).toHaveLength(1);
    expect(done[0].dueAt).toBe("2025-06-20T04:30:00.000Z");
  });

  test("marks logged occurrence as skipped", () => {
    const now = new Date("2025-06-20T10:00:00.000Z");
    const log = makeLog("c1", "2025-06-20T04:30:00.000Z", "skipped");
    const result = occurrencesForDay(
      [task],
      [log],
      { start: dayStart, end: dayEnd },
      now,
    );

    const skipped = result.filter((o) => o.status === "skipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0].dueAt).toBe("2025-06-20T04:30:00.000Z");
  });

  test("handles multiple tasks correctly", () => {
    const task2 = makeTask({
      id: "c2",
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "daily_times", times: ["12:00"] },
    });
    const now = new Date("2025-06-20T10:00:00.000Z");
    // c2's 12:00 Tehran = 08:30 UTC — in the past
    const result = occurrencesForDay(
      [task, task2],
      [],
      { start: dayStart, end: dayEnd },
      now,
    );

    expect(result).toHaveLength(3); // 2 from task, 1 from task2
    const c2occ = result.filter((o) => o.task.id === "c2");
    expect(c2occ).toHaveLength(1);
    expect(c2occ[0].status).toBe("missed"); // 08:30 UTC < now 10:00 UTC
  });

  test("empty tasks list returns empty array", () => {
    const now = new Date("2025-06-20T10:00:00.000Z");
    const result = occurrencesForDay(
      [],
      [],
      { start: dayStart, end: dayEnd },
      now,
    );
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// streak
// ---------------------------------------------------------------------------

describe("streak", () => {
  // daily_times 08:00 Tehran = 04:30 UTC; 20:00 Tehran = 16:30 UTC
  const dailyTask = makeTask({
    id: "c-streak",
    createdAt: "2025-01-01T00:00:00.000Z",
    schedule: { kind: "daily_times", times: ["08:00"] },
  });

  test("returns 0 when there are no past-due occurrences", () => {
    // now is before any occurrence could have been due
    const now = new Date("2025-01-01T00:00:00.000Z");
    expect(streak(dailyTask, [], now)).toBe(0);
  });

  test("returns 0 when there are past-due occurrences but none logged", () => {
    // Several occurrences in the past but no logs → first is missed → streak 0
    const now = new Date("2025-06-20T10:00:00.000Z"); // after 04:30 Jun 20
    expect(streak(dailyTask, [], now)).toBe(0);
  });

  test("returns 1 when last past-due occurrence is done but the one before is missed", () => {
    // Jun 20 08:00 Tehran = 2025-06-20T04:30Z (past, done)
    // Jun 19 08:00 Tehran = 2025-06-19T04:30Z (past, missed)
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [makeLog("c-streak", "2025-06-20T04:30:00.000Z", "done")];
    expect(streak(dailyTask, logs, now)).toBe(1);
  });

  test("returns 0 when last past-due occurrence is skipped", () => {
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [makeLog("c-streak", "2025-06-20T04:30:00.000Z", "skipped")];
    expect(streak(dailyTask, logs, now)).toBe(0);
  });

  test("counts consecutive done occurrences walking backward", () => {
    // Jun 18, 19, 20 all done
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [
      makeLog("c-streak", "2025-06-18T04:30:00.000Z", "done"),
      makeLog("c-streak", "2025-06-19T04:30:00.000Z", "done"),
      makeLog("c-streak", "2025-06-20T04:30:00.000Z", "done"),
    ];
    expect(streak(dailyTask, logs, now)).toBe(3);
  });

  test("stops at a skipped occurrence mid-run", () => {
    // Jun 18 done, Jun 19 skipped, Jun 20 done → streak = 1 (only Jun 20)
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [
      makeLog("c-streak", "2025-06-18T04:30:00.000Z", "done"),
      makeLog("c-streak", "2025-06-19T04:30:00.000Z", "skipped"),
      makeLog("c-streak", "2025-06-20T04:30:00.000Z", "done"),
    ];
    expect(streak(dailyTask, logs, now)).toBe(1);
  });

  test("stops at a missing-log occurrence mid-run (missed counts as break)", () => {
    // Jun 18 done, Jun 19 no log (missed), Jun 20 done → streak = 1
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [
      makeLog("c-streak", "2025-06-18T04:30:00.000Z", "done"),
      makeLog("c-streak", "2025-06-20T04:30:00.000Z", "done"),
    ];
    expect(streak(dailyTask, logs, now)).toBe(1);
  });

  test("ignores future occurrences — only past-due count", () => {
    // now is between 08:00 and 20:00 Tehran on Jun 20
    // 20:00 Tehran on Jun 20 = 2025-06-20T16:30Z which is in the future
    const multiTimeTask = makeTask({
      id: "c-multi",
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "daily_times", times: ["08:00", "20:00"] },
    });
    const now = new Date("2025-06-20T10:00:00.000Z"); // after 04:30 but before 16:30
    const logs = [makeLog("c-multi", "2025-06-20T04:30:00.000Z", "done")];
    // Only 1 past-due occurrence (08:00), and it's done → streak = 1
    // 20:00 occurrence is future → not counted
    expect(streak(multiTimeTask, logs, now)).toBe(1);
  });

  test("multi-time task: each time is its own occurrence (occurrence-level, not day-level)", () => {
    // // ponytail: occurrence-level streak — a day with 2 times = 2 separate occurrences
    // Jun 20 08:00 done, Jun 20 20:00 done, Jun 21 08:00 done, Jun 21 20:00 done
    const multiTimeTask = makeTask({
      id: "c-multi2",
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "daily_times", times: ["08:00", "20:00"] },
    });
    // now is after both occurrences on Jun 21
    const now = new Date("2025-06-21T20:00:00.000Z");
    const logs = [
      makeLog("c-multi2", "2025-06-20T04:30:00.000Z", "done"),
      makeLog("c-multi2", "2025-06-20T16:30:00.000Z", "done"),
      makeLog("c-multi2", "2025-06-21T04:30:00.000Z", "done"),
      makeLog("c-multi2", "2025-06-21T16:30:00.000Z", "done"),
    ];
    expect(streak(multiTimeTask, logs, now)).toBe(4);
  });

  test("after_n bounded task: streak respects the bound (no occurrences after endCount)", () => {
    const boundedTask = makeTask({
      id: "c-bounded",
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "after_n",
      endCount: 2,
      schedule: { kind: "daily_times", times: ["08:00"] },
    });
    // Only occurrences: Jan 1 and Jan 2
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [
      makeLog("c-bounded", "2025-01-01T04:30:00.000Z", "done"),
      makeLog("c-bounded", "2025-01-02T04:30:00.000Z", "done"),
    ];
    expect(streak(boundedTask, logs, now)).toBe(2);
  });

  test("until bounded task: streak respects until date", () => {
    const untilTask = makeTask({
      id: "c-until",
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "until",
      endUntil: "2025-06-18T04:30:00.000Z", // only Jun 18 08:00 Tehran = 04:30Z is included
      schedule: { kind: "daily_times", times: ["08:00"] },
    });
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [makeLog("c-until", "2025-06-18T04:30:00.000Z", "done")];
    // Jun 19 and Jun 20 occurrences are beyond endUntil — not generated → only Jun 18
    expect(streak(untilTask, logs, now)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// adherence
// ---------------------------------------------------------------------------

describe("adherence", () => {
  const dailyTask = makeTask({
    id: "c-adh",
    createdAt: "2025-01-01T00:00:00.000Z",
    schedule: { kind: "daily_times", times: ["08:00"] },
  });

  test("returns null when no past-due occurrences in [since, now]", () => {
    // since and now are before any occurrence
    const since = new Date("2025-01-01T00:00:00.000Z");
    const now = new Date("2025-01-01T00:00:00.000Z");
    expect(adherence(dailyTask, [], since, now)).toBeNull();
  });

  test("returns 0 when all due occurrences are missed (no logs)", () => {
    const since = new Date("2025-06-18T00:00:00.000Z");
    const now = new Date("2025-06-20T10:00:00.000Z"); // Jun 18, 19, 20 04:30Z are past-due
    expect(adherence(dailyTask, [], since, now)).toBe(0);
  });

  test("returns 1 when all due occurrences are done", () => {
    const since = new Date("2025-06-18T00:00:00.000Z");
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [
      makeLog("c-adh", "2025-06-18T04:30:00.000Z", "done"),
      makeLog("c-adh", "2025-06-19T04:30:00.000Z", "done"),
      makeLog("c-adh", "2025-06-20T04:30:00.000Z", "done"),
    ];
    expect(adherence(dailyTask, logs, since, now)).toBe(1);
  });

  test("returns correct fraction (2 done out of 3 due)", () => {
    const since = new Date("2025-06-18T00:00:00.000Z");
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [
      makeLog("c-adh", "2025-06-18T04:30:00.000Z", "done"),
      makeLog("c-adh", "2025-06-19T04:30:00.000Z", "done"),
      // Jun 20 missed (no log)
    ];
    expect(adherence(dailyTask, logs, since, now)).toBeCloseTo(2 / 3);
  });

  test("skipped counts as not-done (lowers adherence)", () => {
    const since = new Date("2025-06-18T00:00:00.000Z");
    const now = new Date("2025-06-20T10:00:00.000Z");
    const logs = [
      makeLog("c-adh", "2025-06-18T04:30:00.000Z", "done"),
      makeLog("c-adh", "2025-06-19T04:30:00.000Z", "skipped"), // not done
      makeLog("c-adh", "2025-06-20T04:30:00.000Z", "done"),
    ];
    // 2 done / 3 total
    expect(adherence(dailyTask, logs, since, now)).toBeCloseTo(2 / 3);
  });

  test("future occurrences (dueAt > now) are excluded from denominator", () => {
    const since = new Date("2025-06-20T00:00:00.000Z");
    // now is before 20:00 occurrence on Jun 20
    const now = new Date("2025-06-20T10:00:00.000Z"); // 04:30 is past, 16:30 would be future
    const multiTimeTask = makeTask({
      id: "c-adh-multi",
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "daily_times", times: ["08:00", "20:00"] },
    });
    // Only 04:30Z occurrence is past-due; 16:30Z is future → denominator = 1
    const logs = [makeLog("c-adh-multi", "2025-06-20T04:30:00.000Z", "done")];
    expect(adherence(multiTimeTask, logs, since, now)).toBe(1);
  });

  test("multi-time task: correct fraction with partial done", () => {
    const since = new Date("2025-06-20T00:00:00.000Z");
    const now = new Date("2025-06-21T00:00:00.000Z"); // both Jun 20 times are past
    const multiTimeTask = makeTask({
      id: "c-adh-m2",
      createdAt: "2025-01-01T00:00:00.000Z",
      schedule: { kind: "daily_times", times: ["08:00", "20:00"] },
    });
    const logs = [makeLog("c-adh-m2", "2025-06-20T04:30:00.000Z", "done")]; // 1 of 2 done
    expect(adherence(multiTimeTask, logs, since, now)).toBeCloseTo(0.5);
  });

  test("after_n bounded task: only includes occurrences up to the bound", () => {
    const boundedTask = makeTask({
      id: "c-adh-bounded",
      createdAt: "2025-01-01T00:00:00.000Z",
      endKind: "after_n",
      endCount: 3,
      schedule: { kind: "daily_times", times: ["08:00"] },
    });
    // 3 occurrences: Jan 1, 2, 3
    const since = new Date("2025-01-01T00:00:00.000Z");
    const now = new Date("2025-06-20T00:00:00.000Z");
    const logs = [
      makeLog("c-adh-bounded", "2025-01-01T04:30:00.000Z", "done"),
      makeLog("c-adh-bounded", "2025-01-02T04:30:00.000Z", "done"),
      // Jan 3 missed
    ];
    expect(adherence(boundedTask, logs, since, now)).toBeCloseTo(2 / 3);
  });
});
