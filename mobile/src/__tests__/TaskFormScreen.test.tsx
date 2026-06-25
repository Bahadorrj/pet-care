/**
 * TaskFormScreen tests — TDD
 *
 * Covers:
 * 1. Add – daily_times: type + default time → correct schedule, addTask called.
 * 2. Add – daily_times with second time appended → both in schedule.
 * 3. Add – weekdays: days + times → correct schedule.
 * 4. Add – interval: n + unit → correct schedule with UTC anchor.
 * 5. Add – one_off: date + time → UTC ISO `at` (Tehran +03:30 offset verified).
 * 6. Validation – no type selected → translated error shown, addTask not called.
 * 7. Validation – store throws schedule_empty → translated error shown, goBack not called.
 * 8. Validation – weekdays with no days → store throws, error shown.
 * 9. In-flight guard: rapid double-press calls addTask at most once.
 * 10. Edit mode: pre-fills from getTask; submit calls updateTask (not addTask).
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
const mockAddTask = jest.fn();
const mockUpdateTask = jest.fn();

jest.mock('../store/tasksStore', () => ({
  useTasksStore: (
    selector: (s: {
      addTask: typeof mockAddTask;
      updateTask: typeof mockUpdateTask;
    }) => unknown,
  ) => selector({ addTask: mockAddTask, updateTask: mockUpdateTask }),
}));

// ── Pets store mock ───────────────────────────────────────────────────────────
import type { Pet } from '../db/types';

let mockPets: Pet[] = [
  { id: 'pet-1', name: 'رکس', species: 'dog', gender: null, photoUri: null, notes: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' } as Pet,
];

jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: Pet[] }) => unknown) => selector({ pets: mockPets }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockGetTask = jest.fn();
jest.mock('../db/tasks', () => ({
  getTask: (...args: unknown[]) => mockGetTask(...args),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
let mockRouteParams: { petId?: string; taskId?: string; title?: string } = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── i18n (real Farsi strings) ─────────────────────────────────────────────────
import '../i18n';
import TaskFormScreen from '../screens/tasks/TaskFormScreen';
import type { Task } from '../db/types';
// Note: Pet type imported above (before jest.mock) — no second import needed

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

const EXISTING_TASK: Task = {
  id: 'task-edit-1',
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
  mockAddTask.mockReset();
  mockUpdateTask.mockReset();
  mockGetTask.mockReset();
  mockGoBack.mockClear();
  mockRouteParams = {};
  mockPets = [
    { id: 'pet-1', name: 'رکس', species: 'dog', gender: null, photoUri: null, notes: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' } as Pet,
  ];
});

// ── 1. Add – daily_times happy path ──────────────────────────────────────────

describe('TaskFormScreen – Add – daily_times', () => {
  test('type + default time → addTask with correct schedule, navigates back', async () => {
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-feeding'));
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));

    const call = mockAddTask.mock.calls[0][0];
    expect(call.petId).toBe('pet-1');
    expect(call.type).toBe('feeding');
    expect(call.schedule.kind).toBe('daily_times');
    expect(call.schedule.times).toContain('08:00');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('second time added → both times in schedule', async () => {
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-meds'));
    await press(getByTestId('taskform-time-add'));
    await changeText(getByTestId('taskform-time-1'), '20:00');
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));

    const call = mockAddTask.mock.calls[0][0];
    expect(call.schedule.kind).toBe('daily_times');
    expect(call.schedule.times).toHaveLength(2);
    expect(call.schedule.times).toContain('20:00');
  });

  test('sole pet is pre-selected → addTask called without pressing a pet chip', async () => {
    mockAddTask.mockResolvedValue(undefined);
    // mockPets default (beforeEach) is the single pet 'pet-1'
    const { getByTestId } = await render(<TaskFormScreen />);
    await press(getByTestId('taskform-type-feeding'));
    await press(getByTestId('taskform-submit'));
    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));
    expect(mockAddTask.mock.calls[0][0].petId).toBe('pet-1');
  });
});

// ── 2. Add – weekdays ─────────────────────────────────────────────────────────

describe('TaskFormScreen – Add – weekdays', () => {
  test('days + times → correct weekdays schedule', async () => {
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-play'));
    await press(getByTestId('taskform-schedule-weekdays'));
    await press(getByTestId('taskform-day-1')); // Mon
    await press(getByTestId('taskform-day-3')); // Wed
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));

    const call = mockAddTask.mock.calls[0][0];
    expect(call.schedule.kind).toBe('weekdays');
    expect(call.schedule.days).toContain(1);
    expect(call.schedule.days).toContain(3);
    expect(Array.isArray(call.schedule.times)).toBe(true);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

// ── 3. Add – interval ─────────────────────────────────────────────────────────

describe('TaskFormScreen – Add – interval', () => {
  test('n=3, unit=days → correct interval schedule with UTC anchor', async () => {
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-grooming'));
    await press(getByTestId('taskform-schedule-interval'));
    await changeText(getByTestId('taskform-interval-n'), '3');
    await press(getByTestId('taskform-unit-days'));
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));

    const call = mockAddTask.mock.calls[0][0];
    expect(call.schedule.kind).toBe('interval');
    expect(call.schedule.n).toBe(3);
    expect(call.schedule.unit).toBe('days');
    expect(typeof call.schedule.anchor).toBe('string'); // UTC ISO
  });
});

// ── 4. Add – one_off (Jalali input) ──────────────────────────────────────────

describe('TaskFormScreen – Add – one_off', () => {
  test('Jalali 1405/04/10 at Tehran 10:00 → UTC 06:30 ISO at field', async () => {
    // 1405/04/10 (Jalali) = 2026-07-01 (Gregorian). Tehran +03:30: 10:00 − 210min = 06:30 UTC.
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-vet'));
    await press(getByTestId('taskform-schedule-one_off'));
    await changeText(getByTestId('taskform-oneoff-date'), '1405/04/10');
    await changeText(getByTestId('taskform-oneoff-time'), '10:00');
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));

    const call = mockAddTask.mock.calls[0][0];
    expect(call.schedule.kind).toBe('one_off');
    // No Gregorian date reaches the user; UTC conversion must still be correct
    expect(call.schedule.at).toBe('2026-07-01T06:30:00.000Z');
  });

  test('invalid Jalali date → schedule error shown, addTask not called', async () => {
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-vet'));
    await press(getByTestId('taskform-schedule-one_off'));
    // Type garbage — form-level validation rejects with invalid_date before submit
    await changeText(getByTestId('taskform-oneoff-date'), 'not-a-date');
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(getByText('تاریخ باید به شکل yyyy/MM/dd باشد')).toBeTruthy());
    expect(mockAddTask).not.toHaveBeenCalled();
  });
});

// ── 4b. end-until Jalali input ────────────────────────────────────────────────

describe('TaskFormScreen – end-until Jalali input', () => {
  test('Jalali end-until 1405/04/10 → correct UTC endUntil on submit', async () => {
    // 1405/04/10 = 2026-07-01 Gregorian. toUtcIso('00:00', '2026-07-01') = '2026-06-30T20:30:00.000Z'
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-feeding'));
    // press the "until" chip (testID = taskform-end-until); then fill the date field
    await press(getByTestId('taskform-end-until'));
    await changeText(getByTestId('taskform-end-until-date'), '1405/04/10');
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(1));

    const call = mockAddTask.mock.calls[0][0];
    expect(call.endKind).toBe('until');
    // Tehran midnight 00:00 on 2026-07-01 = UTC 2026-06-30T20:30:00.000Z
    expect(call.endUntil).toBe('2026-06-30T20:30:00.000Z');
  });

  test('end-until "until" with an invalid date is rejected, not silently saved as never', async () => {
    mockAddTask.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-feeding'));
    await press(getByTestId('taskform-end-until'));
    await changeText(getByTestId('taskform-end-until-date'), 'garbage');
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(getByText('تاریخ باید به شکل yyyy/MM/dd باشد')).toBeTruthy());
    expect(mockAddTask).not.toHaveBeenCalled();
  });
});

// ── 4c. Edit mode prefill: Jalali, not Gregorian ──────────────────────────────

describe('TaskFormScreen – Edit mode Jalali prefill', () => {
  const TASK_WITH_UNTIL: Task = {
    id: 'task-edit-until',
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
    mockRouteParams = { petId: 'pet-1', taskId: TASK_WITH_UNTIL.id };
    mockGetTask.mockReturnValue(TASK_WITH_UNTIL);
  });

  test('end-until prefill shows Jalali yyyy/MM/dd, not Gregorian YYYY-MM-DD', async () => {
    const { getByTestId } = await render(<TaskFormScreen />);
    const field = getByTestId('taskform-end-until-date');
    const val: string = field.props.value;
    // endUntil 2026-06-30T20:30:00Z = Tehran 2026-07-01 00:00 = Jalali 1405/04/10.
    // (Slicing the raw UTC date would wrongly give 2026-06-30 → 1405/04/09.)
    expect(val).toBe('1405/04/10');
  });

  test('one_off edit prefills the stored Tehran date AND time (not 09:00)', async () => {
    // at = 2026-06-30T22:30:00Z = Tehran 2026-07-01 02:00 (crosses UTC day).
    // Date must be the Tehran day (1405/04/10), time the stored 02:00 — not 09:00.
    const TASK_ONE_OFF: Task = {
      id: 'task-edit-oneoff',
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
    mockRouteParams = { petId: 'pet-1', taskId: TASK_ONE_OFF.id };
    mockGetTask.mockReturnValue(TASK_ONE_OFF);

    const { getByTestId } = await render(<TaskFormScreen />);
    expect(getByTestId('taskform-oneoff-date').props.value).toBe('1405/04/10');
    expect(getByTestId('taskform-oneoff-time').props.value).toBe('02:00');
  });
});

// ── 5. Validation – no type ───────────────────────────────────────────────────

describe('TaskFormScreen – validation – no type', () => {
  test('submit with no type shows translated error; addTask not called', async () => {
    const { getByTestId, getByText } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-submit'));

    await waitFor(() =>
      expect(getByText('انتخاب نوع کار الزامی است')).toBeTruthy(),
    );
    expect(mockAddTask).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

// ── 6. Validation – store throws schedule_empty ───────────────────────────────

describe('TaskFormScreen – validation – schedule_empty from store', () => {
  test('daily_times: store rejects schedule_empty → translated error; goBack not called', async () => {
    mockAddTask.mockRejectedValue(new Error('tasks.error.schedule_empty'));
    const { getByTestId, getByText } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-feeding'));
    await press(getByTestId('taskform-submit'));

    await waitFor(() =>
      expect(getByText('زمان‌بندی الزامی است')).toBeTruthy(),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('weekdays with no days: store rejects → translated error; goBack not called', async () => {
    mockAddTask.mockRejectedValue(new Error('tasks.error.schedule_empty'));
    const { getByTestId, getByText } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-type-play'));
    await press(getByTestId('taskform-schedule-weekdays'));
    // No days selected — form-level validation rejects with days_required
    await press(getByTestId('taskform-submit'));

    await waitFor(() =>
      expect(getByText('حداقل یک روز الزامی است')).toBeTruthy(),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

// ── 7. In-flight guard ────────────────────────────────────────────────────────

describe('TaskFormScreen – in-flight guard', () => {
  test('rapid double-press calls addTask at most once', async () => {
    let resolveAdd!: () => void;
    mockAddTask.mockImplementation(
      () => new Promise<void>((resolve) => { resolveAdd = resolve; }),
    );

    const { getByTestId } = await render(<TaskFormScreen />);
    await press(getByTestId('taskform-type-feeding'));

    await rnAct(async () => {
      fireEvent.press(getByTestId('taskform-submit'));
      fireEvent.press(getByTestId('taskform-submit'));
      await Promise.resolve();
      expect(mockAddTask).toHaveBeenCalledTimes(1);
      resolveAdd();
    });
  });
});

// ── 9. Pet picker – multi-pet submit ─────────────────────────────────────────

describe('TaskFormScreen – pet picker – multi-pet submit', () => {
  test('selecting two pets calls addTask twice with distinct petIds and same payload', async () => {
    mockAddTask.mockResolvedValue(undefined);
    mockPets = [
      { id: 'pet-1', name: 'رکس', species: 'dog', gender: null, photoUri: null, notes: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' } as Pet,
      { id: 'pet-2', name: 'پیشی', species: 'cat', gender: null, photoUri: null, notes: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' } as Pet,
    ];

    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-pet-pet-1'));
    await press(getByTestId('taskform-pet-pet-2'));
    await press(getByTestId('taskform-type-feeding'));
    await press(getByTestId('taskform-submit'));

    await waitFor(() => expect(mockAddTask).toHaveBeenCalledTimes(2));

    const calls = mockAddTask.mock.calls.map((c) => c[0]);
    const petIds = calls.map((c) => c.petId);
    expect(petIds).toContain('pet-1');
    expect(petIds).toContain('pet-2');
    // Same payload otherwise
    expect(calls[0].type).toBe('feeding');
    expect(calls[1].type).toBe('feeding');
    expect(calls[0].schedule.kind).toBe(calls[1].schedule.kind);
  });
});

// ── 10. Pet picker – empty selection ─────────────────────────────────────────

describe('TaskFormScreen – pet picker – empty selection error', () => {
  test('no pet selected → shows pet_required error, addTask not called', async () => {
    mockPets = [
      { id: 'pet-1', name: 'رکس', species: 'dog', gender: null, photoUri: null, notes: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' } as Pet,
      { id: 'pet-2', name: 'پیشی', species: 'cat', gender: null, photoUri: null, notes: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' } as Pet,
    ];

    const { getByTestId, getByText } = await render(<TaskFormScreen />);

    // Neither pet pre-selected (two pets → no auto-select)
    await press(getByTestId('taskform-type-feeding'));
    await press(getByTestId('taskform-submit'));

    await waitFor(() =>
      expect(getByText('حداقل یک حیوان را انتخاب کنید')).toBeTruthy(),
    );
    expect(mockAddTask).not.toHaveBeenCalled();
  });
});

// ── 11. Edit mode pet name display ────────────────────────────────────────────

describe('TaskFormScreen – Edit mode – pet name read-only', () => {
  beforeEach(() => {
    mockRouteParams = { petId: 'pet-1', taskId: EXISTING_TASK.id };
    mockGetTask.mockReturnValue(EXISTING_TASK);
  });

  test('edit mode shows pet name text, no picker chips', async () => {
    const { getByTestId, queryByTestId } = await render(<TaskFormScreen />);

    // Pet name displayed
    expect(getByTestId('taskform-pet-name').props.children).toBe('رکس');

    // No picker chip rendered
    expect(queryByTestId('taskform-pet-pet-1')).toBeNull();
  });
});

// ── 8. Edit mode ──────────────────────────────────────────────────────────────

describe('TaskFormScreen – Edit mode', () => {
  beforeEach(() => {
    mockRouteParams = { petId: 'pet-1', taskId: EXISTING_TASK.id };
    mockGetTask.mockReturnValue(EXISTING_TASK);
  });

  test('pre-fills title from existing task', async () => {
    const { getByTestId } = await render(<TaskFormScreen />);
    expect(getByTestId('taskform-title').props.value).toBe('صبح دارو');
  });

  test('submit calls updateTask (not addTask) and navigates back', async () => {
    mockUpdateTask.mockResolvedValue(undefined);
    const { getByTestId } = await render(<TaskFormScreen />);

    await press(getByTestId('taskform-submit'));

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledTimes(1);
      expect(mockUpdateTask).toHaveBeenCalledWith(
        EXISTING_TASK.id,
        expect.objectContaining({ type: 'meds' }),
      );
      expect(mockAddTask).not.toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});
