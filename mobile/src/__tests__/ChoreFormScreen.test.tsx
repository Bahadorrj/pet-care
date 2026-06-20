/**
 * ChoreFormScreen tests — TDD
 *
 * Covers:
 * 1. Add – daily_times: type + default time → correct schedule, addChore called.
 * 2. Add – daily_times with second time appended → both in schedule.
 * 3. Add – weekdays: days + times → correct schedule.
 * 4. Add – interval: n + unit → correct schedule with UTC anchor.
 * 5. Add – one_off: date + time → UTC ISO `at` (Tehran +03:30 offset verified).
 * 6. Validation – no type selected → translated error shown, addChore not called.
 * 7. Validation – store throws schedule_empty → translated error shown, goBack not called.
 * 8. Validation – weekdays with no days → store throws, error shown.
 * 9. In-flight guard: rapid double-press calls addChore at most once.
 * 10. Edit mode: pre-fills from getChore; submit calls updateChore (not addChore).
 *
 * Note: this project runs React concurrent mode — fireEvent calls require
 * wrapping in `act` so state updates flush before the next assertion.
 * This pattern was verified against the jest-expo + RNTL v14 setup.
 */

import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  act,
  act as rnAct,
} from '@testing-library/react-native';

// ── Store mock ────────────────────────────────────────────────────────────────
const mockAddChore = jest.fn();
const mockUpdateChore = jest.fn();

jest.mock('../store/choresStore', () => ({
  useChoresStore: (
    selector: (s: {
      addChore: typeof mockAddChore;
      updateChore: typeof mockUpdateChore;
    }) => unknown,
  ) => selector({ addChore: mockAddChore, updateChore: mockUpdateChore }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockGetChore = jest.fn();
jest.mock('../db/chores', () => ({
  getChore: (...args: unknown[]) => mockGetChore(...args),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
let mockRouteParams: { petId: string; choreId?: string } = { petId: 'pet-1' };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── i18n (real Farsi strings) ─────────────────────────────────────────────────
import '../i18n';
import ChoreFormScreen from '../screens/chores/ChoreFormScreen';
import type { Chore } from '../db/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Press a Pressable, flushing state updates. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const press = async (el: any) => {
  await act(async () => { fireEvent.press(el); });
};

/** Change text, flushing state updates. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const changeText = async (el: any, value: string) => {
  await act(async () => { fireEvent.changeText(el, value); });
};

// ── Fixture ───────────────────────────────────────────────────────────────────

const EXISTING_CHORE: Chore = {
  id: 'chore-edit-1',
  petId: 'pet-1',
  type: 'meds',
  title: 'صبح دارو',
  schedule: { kind: 'daily_times', times: ['07:00'] },
  endKind: 'never',
  endUntil: null,
  endCount: null,
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  mockAddChore.mockReset();
  mockUpdateChore.mockReset();
  mockGetChore.mockReset();
  mockGoBack.mockClear();
  mockRouteParams = { petId: 'pet-1' };
});

// ── 1. Add – daily_times happy path ──────────────────────────────────────────

describe('ChoreFormScreen – Add – daily_times', () => {
  test('type + default time → addChore with correct schedule, navigates back', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-feeding'));
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call.petId).toBe('pet-1');
    expect(call.type).toBe('feeding');
    expect(call.schedule.kind).toBe('daily_times');
    expect(call.schedule.times).toContain('08:00');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('second time added → both times in schedule', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-meds'));
    await press(getByTestId('choreform-time-add'));
    await changeText(getByTestId('choreform-time-1'), '20:00');
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call.schedule.kind).toBe('daily_times');
    expect(call.schedule.times).toHaveLength(2);
    expect(call.schedule.times).toContain('20:00');
  });
});

// ── 2. Add – weekdays ─────────────────────────────────────────────────────────

describe('ChoreFormScreen – Add – weekdays', () => {
  test('days + times → correct weekdays schedule', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-play'));
    await press(getByTestId('choreform-schedule-weekdays'));
    await press(getByTestId('choreform-day-1')); // Mon
    await press(getByTestId('choreform-day-3')); // Wed
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call.schedule.kind).toBe('weekdays');
    expect(call.schedule.days).toContain(1);
    expect(call.schedule.days).toContain(3);
    expect(Array.isArray(call.schedule.times)).toBe(true);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

// ── 3. Add – interval ─────────────────────────────────────────────────────────

describe('ChoreFormScreen – Add – interval', () => {
  test('n=3, unit=days → correct interval schedule with UTC anchor', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-grooming'));
    await press(getByTestId('choreform-schedule-interval'));
    await changeText(getByTestId('choreform-interval-n'), '3');
    await press(getByTestId('choreform-unit-days'));
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call.schedule.kind).toBe('interval');
    expect(call.schedule.n).toBe(3);
    expect(call.schedule.unit).toBe('days');
    expect(typeof call.schedule.anchor).toBe('string'); // UTC ISO
  });
});

// ── 4. Add – one_off ──────────────────────────────────────────────────────────

describe('ChoreFormScreen – Add – one_off', () => {
  test('Tehran 10:00 on 2026-07-01 → UTC 06:30 ISO at field', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-vet'));
    await press(getByTestId('choreform-schedule-one_off'));
    await changeText(getByTestId('choreform-oneoff-date'), '2026-07-01');
    await changeText(getByTestId('choreform-oneoff-time'), '10:00');
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call.schedule.kind).toBe('one_off');
    // Tehran +03:30: 10:00 local − 210min = 06:30 UTC
    expect(call.schedule.at).toBe('2026-07-01T06:30:00.000Z');
  });
});

// ── 5. Validation – no type ───────────────────────────────────────────────────

describe('ChoreFormScreen – validation – no type', () => {
  test('submit with no type shows translated error; addChore not called', async () => {
    const { getByTestId, getByText } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-submit'));

    await waitFor(() =>
      expect(getByText('انتخاب نوع کار الزامی است')).toBeTruthy(),
    );
    expect(mockAddChore).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

// ── 6. Validation – store throws schedule_empty ───────────────────────────────

describe('ChoreFormScreen – validation – schedule_empty from store', () => {
  test('daily_times: store rejects schedule_empty → translated error; goBack not called', async () => {
    mockAddChore.mockRejectedValue(new Error('chores.error.schedule_empty'));
    const { getByTestId, getByText } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-feeding'));
    await press(getByTestId('choreform-submit'));

    await waitFor(() =>
      expect(getByText('زمان‌بندی الزامی است')).toBeTruthy(),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('weekdays with no days: store rejects → translated error; goBack not called', async () => {
    mockAddChore.mockRejectedValue(new Error('chores.error.schedule_empty'));
    const { getByTestId, getByText } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-play'));
    await press(getByTestId('choreform-schedule-weekdays'));
    // No days selected — store will throw schedule_empty
    await press(getByTestId('choreform-submit'));

    await waitFor(() =>
      expect(getByText('زمان‌بندی الزامی است')).toBeTruthy(),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

// ── 7. In-flight guard ────────────────────────────────────────────────────────

describe('ChoreFormScreen – in-flight guard', () => {
  test('rapid double-press calls addChore at most once', async () => {
    let resolveAdd!: () => void;
    mockAddChore.mockImplementation(
      () => new Promise<void>((resolve) => { resolveAdd = resolve; }),
    );

    const { getByTestId } = await render(<ChoreFormScreen />);
    await press(getByTestId('choreform-type-feeding'));

    await rnAct(async () => {
      fireEvent.press(getByTestId('choreform-submit'));
      fireEvent.press(getByTestId('choreform-submit'));
      await Promise.resolve();
      expect(mockAddChore).toHaveBeenCalledTimes(1);
      resolveAdd();
    });
  });
});

// ── 8. Edit mode ──────────────────────────────────────────────────────────────

describe('ChoreFormScreen – Edit mode', () => {
  beforeEach(() => {
    mockRouteParams = { petId: 'pet-1', choreId: EXISTING_CHORE.id };
    mockGetChore.mockReturnValue(EXISTING_CHORE);
  });

  test('pre-fills title from existing chore', async () => {
    const { getByTestId } = await render(<ChoreFormScreen />);
    expect(getByTestId('choreform-title').props.value).toBe('صبح دارو');
  });

  test('submit calls updateChore (not addChore) and navigates back', async () => {
    mockUpdateChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-submit'));

    await waitFor(() => {
      expect(mockUpdateChore).toHaveBeenCalledTimes(1);
      expect(mockUpdateChore).toHaveBeenCalledWith(
        EXISTING_CHORE.id,
        expect.objectContaining({ type: 'meds' }),
      );
      expect(mockAddChore).not.toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});
