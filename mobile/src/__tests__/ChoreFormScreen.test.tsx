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

// ── 4. Add – one_off (Jalali input) ──────────────────────────────────────────

describe('ChoreFormScreen – Add – one_off', () => {
  test('Jalali 1405/04/10 at Tehran 10:00 → UTC 06:30 ISO at field', async () => {
    // 1405/04/10 (Jalali) = 2026-07-01 (Gregorian). Tehran +03:30: 10:00 − 210min = 06:30 UTC.
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-vet'));
    await press(getByTestId('choreform-schedule-one_off'));
    await changeText(getByTestId('choreform-oneoff-date'), '1405/04/10');
    await changeText(getByTestId('choreform-oneoff-time'), '10:00');
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call.schedule.kind).toBe('one_off');
    // No Gregorian date reaches the user; UTC conversion must still be correct
    expect(call.schedule.at).toBe('2026-07-01T06:30:00.000Z');
  });

  test('invalid Jalali date → schedule error shown, addChore not called', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-vet'));
    await press(getByTestId('choreform-schedule-one_off'));
    // Type garbage — jalaliToGregorian returns null → throws schedule_empty
    await changeText(getByTestId('choreform-oneoff-date'), 'not-a-date');
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(getByText('زمان‌بندی الزامی است')).toBeTruthy());
    expect(mockAddChore).not.toHaveBeenCalled();
  });
});

// ── 4b. end-until Jalali input ────────────────────────────────────────────────

describe('ChoreFormScreen – end-until Jalali input', () => {
  test('Jalali end-until 1405/04/10 → correct UTC endUntil on submit', async () => {
    // 1405/04/10 = 2026-07-01 Gregorian. toUtcIso('00:00', '2026-07-01') = '2026-06-30T20:30:00.000Z'
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<ChoreFormScreen />);

    await press(getByTestId('choreform-type-feeding'));
    // press the "until" chip (testID = choreform-end-until); then fill the date field
    await press(getByTestId('choreform-end-until'));
    await changeText(getByTestId('choreform-end-until-date'), '1405/04/10');
    await press(getByTestId('choreform-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call.endKind).toBe('until');
    // Tehran midnight 00:00 on 2026-07-01 = UTC 2026-06-30T20:30:00.000Z
    expect(call.endUntil).toBe('2026-06-30T20:30:00.000Z');
  });
});

// ── 4c. Edit mode prefill: Jalali, not Gregorian ──────────────────────────────

describe('ChoreFormScreen – Edit mode Jalali prefill', () => {
  const CHORE_WITH_UNTIL: Chore = {
    id: 'chore-edit-until',
    petId: 'pet-1',
    type: 'meds',
    title: null,
    schedule: { kind: 'daily_times', times: ['08:00'] },
    endKind: 'until',
    // endUntil = UTC ISO for 2026-07-01 midnight Tehran
    endUntil: '2026-06-30T20:30:00.000Z',
    endCount: null,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockRouteParams = { petId: 'pet-1', choreId: CHORE_WITH_UNTIL.id };
    mockGetChore.mockReturnValue(CHORE_WITH_UNTIL);
  });

  test('end-until prefill shows Jalali yyyy/MM/dd, not Gregorian YYYY-MM-DD', async () => {
    const { getByTestId } = await render(<ChoreFormScreen />);
    const field = getByTestId('choreform-end-until-date');
    const val: string = field.props.value;
    // endUntil 2026-06-30T20:30:00Z = Tehran 2026-07-01 00:00 = Jalali 1405/04/10.
    // (Slicing the raw UTC date would wrongly give 2026-06-30 → 1405/04/09.)
    expect(val).toBe('1405/04/10');
  });

  test('one_off edit prefills the stored Tehran date AND time (not 09:00)', async () => {
    // at = 2026-06-30T22:30:00Z = Tehran 2026-07-01 02:00 (crosses UTC day).
    // Date must be the Tehran day (1405/04/10), time the stored 02:00 — not 09:00.
    const CHORE_ONE_OFF: Chore = {
      id: 'chore-edit-oneoff',
      petId: 'pet-1',
      type: 'vet',
      title: null,
      schedule: { kind: 'one_off', at: '2026-06-30T22:30:00.000Z' },
      endKind: 'never',
      endUntil: null,
      endCount: null,
      active: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    mockRouteParams = { petId: 'pet-1', choreId: CHORE_ONE_OFF.id };
    mockGetChore.mockReturnValue(CHORE_ONE_OFF);

    const { getByTestId } = await render(<ChoreFormScreen />);
    expect(getByTestId('choreform-oneoff-date').props.value).toBe('1405/04/10');
    expect(getByTestId('choreform-oneoff-time').props.value).toBe('02:00');
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
