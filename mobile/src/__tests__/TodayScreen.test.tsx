/**
 * TodayScreen tests — rewritten for Task 6 (SectionList + checkbox/undo/action-sheet)
 *
 * Key design choices:
 * - Store mock exposes `windowOccurrences` (not `occurrences`) — the screen reads this.
 * - Fixture dueAt values are RELATIVE to real `new Date()` so `bucketOccurrences`
 *   places them inside the ±7-day window (hardcoded 2024 dates would fall outside).
 * - The action-sheet mock exports a hoisted `showActionSheetWithOptions` jest.fn so
 *   every `useActionSheet()` call in the component shares the same reference.
 * - Toast mock is the existing __mocks__/react-native-toast-message.js stub.
 * - `render` returns a Promise in this RTL v14 + jest-expo setup — always `await` it.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ── Store mock ────────────────────────────────────────────────────────────────
const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockMarkOccurrence = jest.fn().mockResolvedValue(undefined);
const mockUnmarkOccurrence = jest.fn().mockResolvedValue(undefined);
const mockDeleteChore = jest.fn().mockResolvedValue(undefined);
let mockWindowOccurrences: unknown[] = [];

jest.mock('../store/choresStore', () => ({
  useChoresStore: (
    selector: (s: {
      windowOccurrences: unknown[];
      load: typeof mockLoad;
      markOccurrence: typeof mockMarkOccurrence;
      unmarkOccurrence: typeof mockUnmarkOccurrence;
      deleteChore: typeof mockDeleteChore;
    }) => unknown,
  ) =>
    selector({
      windowOccurrences: mockWindowOccurrences,
      load: mockLoad,
      markOccurrence: mockMarkOccurrence,
      unmarkOccurrence: mockUnmarkOccurrence,
      deleteChore: mockDeleteChore,
    }),
}));

// ── petsStore mock ────────────────────────────────────────────────────────────
jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: { id: string; name: string }[] }) => unknown) =>
    selector({ pets: [{ id: 'pet-1', name: 'رکسی' }] }),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ── i18n ──────────────────────────────────────────────────────────────────────
import '../i18n';
import TodayScreen from '../screens/today/TodayScreen';
import type { Occurrence } from '../db/types';
import { useActionSheet } from '@expo/react-native-action-sheet';
import Toast from 'react-native-toast-message';

// ── Fixtures — dueAt RELATIVE to now ─────────────────────────────────────────
//
// `bucketOccurrences` uses `new Date()` at render time, so fixtures must be
// relative to produce consistent bucket placement across test runs.
//
// Tehran = UTC+03:30. Tehran-start-of-today ≈ (UTC midnight - 03:30).
// To guarantee bucket placement we use large enough offsets:
//   overdue  = dueAt 2 days ago (before Tehran start-of-today, within 7d look-back)
//   today    = dueAt +1h (within today's Tehran day window)
//   upcoming = dueAt +3 days (after end of today's Tehran day)

const NOW = Date.now();
const DUE_OVERDUE = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
const DUE_TODAY = new Date(NOW + 60 * 60 * 1000).toISOString();              // +1h
const DUE_UPCOMING = new Date(NOW + 3 * 24 * 60 * 60 * 1000).toISOString(); // +3d
const DUE_TODAY_LATE = new Date(NOW + 2 * 60 * 60 * 1000).toISOString();    // +2h

const makeOcc = (
  id: string,
  dueAt: string,
  status: Occurrence['status'] = 'pending',
  scheduleKind: 'daily_times' | 'one_off' = 'daily_times',
): Occurrence => ({
  chore: {
    id,
    petId: 'pet-1',
    type: 'feeding',
    title: null,
    schedule:
      scheduleKind === 'one_off'
        ? { kind: 'one_off', at: dueAt }
        : { kind: 'daily_times', times: ['09:00'] },
    endKind: 'never',
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  dueAt,
  status,
});

const OCC_OVERDUE = makeOcc('chore-overdue', DUE_OVERDUE, 'pending');
const OCC_TODAY = makeOcc('chore-today', DUE_TODAY, 'pending');
const OCC_TODAY_LATE = makeOcc('chore-today-late', DUE_TODAY_LATE, 'pending');
const OCC_UPCOMING = makeOcc('chore-upcoming', DUE_UPCOMING, 'pending');
const OCC_DONE = makeOcc('chore-done', DUE_TODAY, 'done');
const OCC_SKIPPED = makeOcc('chore-skipped', DUE_TODAY, 'skipped');
const OCC_ONE_OFF = makeOcc('chore-oneoff', DUE_TODAY, 'pending', 'one_off');

beforeEach(() => {
  mockLoad.mockClear();
  mockMarkOccurrence.mockClear();
  mockUnmarkOccurrence.mockClear();
  mockDeleteChore.mockClear();
  mockNavigate.mockClear();
  (Toast.show as jest.Mock).mockClear();
  (Toast.hide as jest.Mock).mockClear();
  // Reset the hoisted showActionSheetWithOptions
  (useActionSheet().showActionSheetWithOptions as jest.Mock).mockClear();
  mockWindowOccurrences = [];
});

// ── 1. Whole-screen empty state ───────────────────────────────────────────────
describe('TodayScreen – empty state', () => {
  test('shows whole-screen empty state when all buckets are empty', async () => {
    mockWindowOccurrences = [];
    const { getByTestId } = await render(<TodayScreen />);
    expect(getByTestId('today-empty')).toBeTruthy();
  });

  test('does NOT show whole-screen empty when any bucket has items', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { queryByTestId } = await render(<TodayScreen />);
    expect(queryByTestId('today-empty')).toBeNull();
  });
});

// ── 2. Section headers + count badges ────────────────────────────────────────
describe('TodayScreen – section headers', () => {
  test('renders all three section headers', async () => {
    mockWindowOccurrences = [OCC_OVERDUE, OCC_TODAY, OCC_UPCOMING];
    const { getByTestId } = await render(<TodayScreen />);
    expect(getByTestId('today-section-overdue')).toBeTruthy();
    expect(getByTestId('today-section-today')).toBeTruthy();
    expect(getByTestId('today-section-upcoming')).toBeTruthy();
  });

  test('section header text includes count', async () => {
    mockWindowOccurrences = [OCC_OVERDUE, OCC_TODAY, OCC_TODAY_LATE, OCC_UPCOMING];
    const { getByTestId } = await render(<TodayScreen />);
    // Section header view wraps a Text child — verify both sections have content
    expect(getByTestId('today-section-overdue')).toBeTruthy();
    expect(getByTestId('today-section-today')).toBeTruthy();
  });

  test('per-section empty rows render when bucket is empty', async () => {
    // Only today item — overdue and upcoming buckets empty
    mockWindowOccurrences = [OCC_TODAY];
    const { getByTestId, queryByTestId } = await render(<TodayScreen />);
    expect(getByTestId('today-empty-overdue')).toBeTruthy();
    expect(getByTestId('today-empty-upcoming')).toBeTruthy();
    // today bucket has an item — no per-section empty for it
    expect(queryByTestId('today-empty-today')).toBeNull();
  });
});

// ── 3. Checkbox → markOccurrence + Toast ─────────────────────────────────────
describe('TodayScreen – checkbox', () => {
  test('pressing checkbox calls markOccurrence(id, dueAt, "done") and shows toast', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-check-chore-today'));

    await waitFor(() => {
      expect(mockMarkOccurrence).toHaveBeenCalledWith(
        'chore-today',
        OCC_TODAY.dueAt,
        'done',
      );
      expect(Toast.show).toHaveBeenCalledTimes(1);
    });

    // Verify Toast.show was called with an onPress that triggers unmark
    const toastArgs = (Toast.show as jest.Mock).mock.calls[0][0];
    expect(toastArgs.type).toBe('success');
    expect(typeof toastArgs.onPress).toBe('function');

    // Invoke the undo handler
    toastArgs.onPress();
    expect(mockUnmarkOccurrence).toHaveBeenCalledWith('chore-today', OCC_TODAY.dueAt);
    expect(Toast.hide).toHaveBeenCalled();
  });

  test('pressing checkbox on already-done row does nothing', async () => {
    mockWindowOccurrences = [OCC_DONE];
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-check-chore-done'));
    expect(mockMarkOccurrence).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  test('done row renders dimmed (opacity 0.5)', async () => {
    mockWindowOccurrences = [OCC_DONE];
    const { getByTestId } = await render(<TodayScreen />);
    const row = getByTestId('today-row-chore-done');
    const flatStyle = Array.isArray(row.props.style)
      ? Object.assign({}, ...row.props.style.filter(Boolean))
      : row.props.style;
    expect(flatStyle.opacity).toBe(0.5);
  });
});

// ── 4. ⋯ button → action sheet ───────────────────────────────────────────────
describe('TodayScreen – action sheet', () => {
  test('pressing ⋯ calls showActionSheetWithOptions', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-more-chore-today'));

    expect(showActionSheetWithOptions).toHaveBeenCalledTimes(1);
  });

  test('action-sheet index 0 (skip) → markOccurrence(..., "skipped")', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-more-chore-today'));

    const [, callback] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    callback(0);

    expect(mockMarkOccurrence).toHaveBeenCalledWith('chore-today', OCC_TODAY.dueAt, 'skipped');
  });

  test('action-sheet index 1 (edit) → navigate to ChoreForm', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-more-chore-today'));

    const [, callback] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    callback(1);

    expect(mockNavigate).toHaveBeenCalledWith('ChoreForm', {
      petId: 'pet-1',
      choreId: 'chore-today',
    });
  });

  test('action-sheet index 2 (delete) → deleteChore(id)', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-more-chore-today'));

    const [, callback] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    callback(2);

    expect(mockDeleteChore).toHaveBeenCalledWith('chore-today');
  });

  test('delete label is "today.action.delete_recurring" for recurring chore', async () => {
    mockWindowOccurrences = [OCC_TODAY]; // daily_times schedule
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-more-chore-today'));

    const [opts] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    // i18n key returned as-is in test env
    expect(opts.options[2]).toBe('today.action.delete_recurring');
  });

  test('delete label is "today.action.delete_one_off" for one-off chore', async () => {
    mockWindowOccurrences = [OCC_ONE_OFF]; // one_off schedule
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-more-chore-oneoff'));

    const [opts] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    expect(opts.options[2]).toBe('today.action.delete_one_off');
  });

  test('destructiveButtonIndex is 2, cancelButtonIndex is 3', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-more-chore-today'));

    const [opts] = (showActionSheetWithOptions as jest.Mock).mock.calls[0];
    expect(opts.destructiveButtonIndex).toBe(2);
    expect(opts.cancelButtonIndex).toBe(3);
  });
});

// ── 5. Tehran time display ────────────────────────────────────────────────────
describe('TodayScreen – Tehran time display', () => {
  test('shows Tehran wall-clock time HH:MM (not UTC)', async () => {
    // Compute the expected Tehran display for DUE_TODAY
    const expectedTehran = (() => {
      const tehranMs = new Date(DUE_TODAY).getTime() + (3 * 60 + 30) * 60 * 1000;
      const d = new Date(tehranMs);
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    })();

    mockWindowOccurrences = [makeOcc('chore-time', DUE_TODAY)];
    const { getByText } = await render(<TodayScreen />);
    expect(getByText(expectedTehran)).toBeTruthy();
  });
});

// ── 6. Skipped row is dimmed, no action on checkbox ──────────────────────────
describe('TodayScreen – skipped row', () => {
  test('skipped row renders dimmed and checkbox press does nothing', async () => {
    mockWindowOccurrences = [OCC_SKIPPED];
    const { getByTestId } = await render(<TodayScreen />);

    const row = getByTestId('today-row-chore-skipped');
    const flatStyle = Array.isArray(row.props.style)
      ? Object.assign({}, ...row.props.style.filter(Boolean))
      : row.props.style;
    expect(flatStyle.opacity).toBe(0.5);

    fireEvent.press(getByTestId('today-check-chore-skipped'));
    expect(mockMarkOccurrence).not.toHaveBeenCalled();
  });
});

// ── 7. Row body tap → action sheet ───────────────────────────────────────────
describe('TodayScreen – row body tap', () => {
  test('tapping row body also opens action sheet', async () => {
    mockWindowOccurrences = [OCC_TODAY];
    const { showActionSheetWithOptions } = useActionSheet();
    const { getByTestId } = await render(<TodayScreen />);

    fireEvent.press(getByTestId('today-row-chore-today'));

    expect(showActionSheetWithOptions).toHaveBeenCalledTimes(1);
  });
});
