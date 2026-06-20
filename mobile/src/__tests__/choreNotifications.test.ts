/**
 * choreNotifications tests — TDD Red → Green
 *
 * Tests the PURE selection logic (window/cap/nearest-first/active-only/
 * end-conditions/payload) with Notifee and db/chores fully mocked.
 * Device-only behaviour (actual firing, airplane-mode, reschedule) is
 * NOT tested here — that is the human's post-merge verification.
 *
 * Mock-prefix convention: variables referenced inside jest.mock factories
 * must be declared with a `mock`-prefixed name so Babel hoisting allows it.
 */

// ---------------------------------------------------------------------------
// Notifee mock
// ---------------------------------------------------------------------------

const mockCancelTriggerNotifications = jest.fn().mockResolvedValue(undefined);
const mockCreateChannel = jest.fn().mockResolvedValue('chores');
const mockCreateTriggerNotification = jest.fn().mockResolvedValue(undefined);
const mockRequestPermission = jest.fn().mockResolvedValue({ authorizationStatus: 1 });

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelTriggerNotifications: (...args: unknown[]) => mockCancelTriggerNotifications(...args),
    createChannel: (...args: unknown[]) => mockCreateChannel(...args),
    createTriggerNotification: (...args: unknown[]) => mockCreateTriggerNotification(...args),
    requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4 },
  EventType: { PRESS: 1, DISMISSED: 0 },
}));

// ---------------------------------------------------------------------------
// db/chores mock
// ---------------------------------------------------------------------------

const mockListChores = jest.fn();

jest.mock('../db/chores', () => ({
  listChores: (...args: unknown[]) => mockListChores(...args),
}));

// ---------------------------------------------------------------------------
// choresStore mock (prevents Zustand/SQLite init at import time)
// ---------------------------------------------------------------------------

jest.mock('../store/choresStore', () => ({
  setChoresSyncNotifications: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { Chore } from '../db/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW_UTC = new Date('2026-06-21T06:30:00.000Z'); // Tehran 2026-06-21 10:00
const WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // 60 days in ms

function makeChore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: 'chore-1',
    petId: 'pet-1',
    type: 'feeding',
    title: 'Feed',
    schedule: { kind: 'daily_times', times: ['08:00'] },
    endKind: 'never',
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW_UTC);
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. syncNotifications cancels then registers
// ---------------------------------------------------------------------------

describe('syncNotifications – cancel then register', () => {
  test('calls cancelTriggerNotifications before createTriggerNotification', async () => {
    mockListChores.mockReturnValue([makeChore()]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCancelTriggerNotifications).toHaveBeenCalledTimes(1);
    // At least one trigger notification created for an active daily chore
    expect(mockCreateTriggerNotification).toHaveBeenCalled();

    // Cancel called before first create
    const cancelOrder = mockCancelTriggerNotifications.mock.invocationCallOrder[0];
    const createOrder = mockCreateTriggerNotification.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(createOrder);
  });

  test('calls cancelTriggerNotifications even when no chores', async () => {
    mockListChores.mockReturnValue([]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCancelTriggerNotifications).toHaveBeenCalledTimes(1);
    expect(mockCreateTriggerNotification).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. active-only filter
// ---------------------------------------------------------------------------

describe('syncNotifications – active-only', () => {
  test('skips inactive chores', async () => {
    mockListChores.mockReturnValue([
      makeChore({ id: 'c1', active: true }),
      makeChore({ id: 'c2', active: false }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    // All registered notifications must come from active chore only
    for (const call of mockCreateTriggerNotification.mock.calls) {
      expect(call[0].data?.choreId).toBe('c1');
    }
  });

  test('no notifications when all chores inactive', async () => {
    mockListChores.mockReturnValue([makeChore({ active: false })]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. 60-day window
// ---------------------------------------------------------------------------

describe('syncNotifications – 60-day window', () => {
  test('does not schedule occurrences beyond 60 days from now', async () => {
    // one_off chore due at exactly now+61 days → outside window
    const beyond = new Date(NOW_UTC.getTime() + 61 * 24 * 60 * 60 * 1000).toISOString();
    mockListChores.mockReturnValue([
      makeChore({ schedule: { kind: 'one_off', at: beyond } }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).not.toHaveBeenCalled();
  });

  test('schedules occurrences within 60 days', async () => {
    // one_off chore due tomorrow (within window)
    const soon = new Date(NOW_UTC.getTime() + 24 * 60 * 60 * 1000).toISOString();
    mockListChores.mockReturnValue([
      makeChore({ schedule: { kind: 'one_off', at: soon } }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 4. 200-cap, nearest-first
// ---------------------------------------------------------------------------

describe('syncNotifications – cap 200, nearest-first', () => {
  test('caps at 200 triggers total across all chores', async () => {
    // hourly chore → many occurrences in 60 days (60*24 = 1440)
    mockListChores.mockReturnValue([
      makeChore({
        schedule: {
          kind: 'interval',
          n: 1,
          unit: 'hours',
          anchor: NOW_UTC.toISOString(),
        },
      }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(200);
  });

  test('nearest occurrences are scheduled first (timestamps ascending)', async () => {
    mockListChores.mockReturnValue([
      makeChore({
        schedule: {
          kind: 'interval',
          n: 1,
          unit: 'hours',
          anchor: NOW_UTC.toISOString(),
        },
      }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    const timestamps: number[] = mockCreateTriggerNotification.mock.calls.map(
      (call) => (call[1] as { timestamp: number }).timestamp,
    );
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Payload shape
// ---------------------------------------------------------------------------

describe('syncNotifications – payload', () => {
  test('each trigger notification has choreId + dueAt in data', async () => {
    const soon = new Date(NOW_UTC.getTime() + 60 * 60 * 1000).toISOString();
    mockListChores.mockReturnValue([
      makeChore({ id: 'chore-abc', schedule: { kind: 'one_off', at: soon } }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(1);
    const [notif, trigger] = mockCreateTriggerNotification.mock.calls[0];
    expect(notif.data).toEqual({ choreId: 'chore-abc', dueAt: soon });
    expect(trigger.type).toBe(0); // TriggerType.TIMESTAMP
    expect(trigger.timestamp).toBe(new Date(soon).getTime());
  });

  test('trigger timestamp equals new Date(dueAt).getTime() (no Tehran offset)', async () => {
    // dueAt is absolute UTC; trigger should fire at that exact epoch ms
    const dueAt = '2026-07-01T04:30:00.000Z'; // Tehran 08:00 on 2026-07-01
    mockListChores.mockReturnValue([
      makeChore({ schedule: { kind: 'one_off', at: dueAt } }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    const [, trigger] = mockCreateTriggerNotification.mock.calls[0];
    expect(trigger.timestamp).toBe(new Date(dueAt).getTime());
    expect(trigger.timestamp).toBe(1782880200000);
  });
});

// ---------------------------------------------------------------------------
// 6. End conditions respected (via expandOccurrences)
// ---------------------------------------------------------------------------

describe('syncNotifications – end conditions', () => {
  test('after_n=1 one_off: exactly 1 notification', async () => {
    const soon = new Date(NOW_UTC.getTime() + 60 * 60 * 1000).toISOString();
    mockListChores.mockReturnValue([
      makeChore({
        schedule: { kind: 'one_off', at: soon },
        endKind: 'after_n',
        endCount: 1,
      }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(1);
  });

  test('after_n=0: no notifications', async () => {
    const soon = new Date(NOW_UTC.getTime() + 60 * 60 * 1000).toISOString();
    mockListChores.mockReturnValue([
      makeChore({
        schedule: { kind: 'one_off', at: soon },
        endKind: 'after_n',
        endCount: 0,
      }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).not.toHaveBeenCalled();
  });

  test('until end condition: skips occurrences after endUntil', async () => {
    // anchor 5 days before now → first occurrence now+5d, second now+15d, third now+25d
    // endUntil = now+20d → only 2 occurrences (now+5d and now+15d)
    const anchor = new Date(NOW_UTC.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const endUntil = new Date(NOW_UTC.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString();
    mockListChores.mockReturnValue([
      makeChore({
        schedule: { kind: 'interval', n: 10, unit: 'days', anchor },
        endKind: 'until',
        endUntil,
      }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    // now+5d and now+15d are within endUntil; now+25d > endUntil → only 2
    expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 7. Multiple chores — all active contributions merged and capped
// ---------------------------------------------------------------------------

describe('syncNotifications – multiple chores merged', () => {
  test('occurrences from multiple chores are combined before cap', async () => {
    const soon1 = new Date(NOW_UTC.getTime() + 1 * 60 * 60 * 1000).toISOString();
    const soon2 = new Date(NOW_UTC.getTime() + 2 * 60 * 60 * 1000).toISOString();
    mockListChores.mockReturnValue([
      makeChore({ id: 'c1', schedule: { kind: 'one_off', at: soon1 } }),
      makeChore({ id: 'c2', schedule: { kind: 'one_off', at: soon2 } }),
    ]);

    const { syncNotifications } = require('../lib/choreNotifications');
    await syncNotifications();

    expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(2);
    const ids = mockCreateTriggerNotification.mock.calls.map((c) => c[0].data?.choreId);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
  });
});
