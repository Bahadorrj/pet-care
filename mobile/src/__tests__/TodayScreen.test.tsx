/**
 * TodayScreen tests — TDD RED → GREEN
 *
 * Covers:
 * 1. Renders occurrences in time order, overdue-today first.
 * 2. Done button calls markOccurrence with correct (choreId, dueAt, 'done').
 * 3. Skip button calls markOccurrence with correct (choreId, dueAt, 'skipped').
 * 4. Empty state when occurrences is empty.
 * 5. Done/Skip buttons hidden on already-done/skipped rows.
 *
 * Store mock: choresStore imports SQLite at module load → mock the whole module
 * using the mutable-ref pattern from PetDetailScreen.test.tsx.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ── Store mock ────────────────────────────────────────────────────────────────
const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockMarkOccurrence = jest.fn().mockResolvedValue(undefined);
let mockOccurrences: unknown[] = [];

jest.mock('../store/choresStore', () => ({
  useChoresStore: (selector: (s: { occurrences: unknown[]; load: typeof mockLoad; markOccurrence: typeof mockMarkOccurrence }) => unknown) =>
    selector({ occurrences: mockOccurrences, load: mockLoad, markOccurrence: mockMarkOccurrence }),
}));

// ── petsStore mock ────────────────────────────────────────────────────────────
// petsStore calls listPets() (SQLite) at module load — mock to avoid native db access.
jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: { id: string; name: string }[] }) => unknown) =>
    selector({ pets: [{ id: 'pet-1', name: 'رکسی' }] }),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));

// ── i18n ─────────────────────────────────────────────────────────────────────
import '../i18n';
import TodayScreen from '../screens/today/TodayScreen';
import type { Occurrence } from '../db/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────
// dueAt values are UTC ISOs. Tehran = UTC+03:30.
// 06:00 UTC = 09:30 Tehran, 03:00 UTC = 06:30 Tehran
const makeOccurrence = (
  id: string,
  dueAt: string,
  status: Occurrence['status'] = 'pending',
  petName = 'رکسی',
): Occurrence => ({
  chore: {
    id,
    petId: 'pet-1',
    type: 'feeding',
    title: null,
    schedule: { kind: 'daily_times', times: ['09:30'] },
    endKind: 'never',
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    // ponytail: pet name injected via petName field for test convenience
    // actual store carries Chore, petName looked up separately — we attach it here
    // via a type extension trick for test isolation
    ...(petName !== 'رکسی' ? {} : {}),
  } as Occurrence['chore'] & { _petName?: string },
  dueAt,
  status,
});

// Two pending occurrences at different times
const OCC_EARLY: Occurrence = makeOccurrence('chore-1', '2024-06-21T03:00:00Z', 'pending'); // 06:30 Tehran
const OCC_LATE: Occurrence = makeOccurrence('chore-2', '2024-06-21T06:00:00Z', 'pending');  // 09:30 Tehran
const OCC_MISSED: Occurrence = makeOccurrence('chore-3', '2024-06-21T01:00:00Z', 'missed'); // 04:30 Tehran — overdue
const OCC_DONE: Occurrence = makeOccurrence('chore-4', '2024-06-21T04:00:00Z', 'done');     // 07:30 Tehran
const OCC_SKIPPED: Occurrence = makeOccurrence('chore-5', '2024-06-21T04:30:00Z', 'skipped'); // 08:00 Tehran

beforeEach(() => {
  mockLoad.mockClear();
  mockMarkOccurrence.mockClear();
  mockOccurrences = [];
});

// ── 1. Empty state ────────────────────────────────────────────────────────────
describe('TodayScreen – empty state', () => {
  test('shows empty state message when no occurrences', async () => {
    mockOccurrences = [];
    const { getByTestId } = await render(<TodayScreen />);
    expect(getByTestId('today-empty')).toBeTruthy();
  });
});

// ── 2. Ordering: overdue-today first, then chronological ─────────────────────
describe('TodayScreen – ordering', () => {
  test('renders missed/overdue occurrences before upcoming pending ones', async () => {
    // OCC_MISSED is 'missed' (overdue), OCC_EARLY + OCC_LATE are pending
    mockOccurrences = [OCC_LATE, OCC_EARLY, OCC_MISSED];
    const { getAllByTestId } = await render(<TodayScreen />);
    const rows = getAllByTestId(/^today-row-/);
    // First row = overdue (missed), then pending in time order
    expect(rows[0].props.testID).toBe('today-row-chore-3'); // missed
    expect(rows[1].props.testID).toBe('today-row-chore-1'); // 06:30 Tehran
    expect(rows[2].props.testID).toBe('today-row-chore-2'); // 09:30 Tehran
  });

  test('sorts pending occurrences chronologically by dueAt', async () => {
    // OCC_EARLY has earlier dueAt than OCC_LATE — both pending
    mockOccurrences = [OCC_LATE, OCC_EARLY];
    const { getAllByTestId } = await render(<TodayScreen />);
    const rows = getAllByTestId(/^today-row-/);
    expect(rows[0].props.testID).toBe('today-row-chore-1'); // earlier dueAt
    expect(rows[1].props.testID).toBe('today-row-chore-2'); // later dueAt
  });
});

// ── 3. Done action ────────────────────────────────────────────────────────────
describe('TodayScreen – Done action', () => {
  test('pressing Done calls markOccurrence(choreId, dueAt, "done")', async () => {
    mockOccurrences = [OCC_EARLY];
    const { getByTestId } = await render(<TodayScreen />);
    fireEvent.press(getByTestId('today-done-chore-1'));
    await waitFor(() => {
      expect(mockMarkOccurrence).toHaveBeenCalledTimes(1);
      expect(mockMarkOccurrence).toHaveBeenCalledWith('chore-1', OCC_EARLY.dueAt, 'done');
    });
  });
});

// ── 4. Skip action ────────────────────────────────────────────────────────────
describe('TodayScreen – Skip action', () => {
  test('pressing Skip calls markOccurrence(choreId, dueAt, "skipped")', async () => {
    mockOccurrences = [OCC_EARLY];
    const { getByTestId } = await render(<TodayScreen />);
    fireEvent.press(getByTestId('today-skip-chore-1'));
    await waitFor(() => {
      expect(mockMarkOccurrence).toHaveBeenCalledTimes(1);
      expect(mockMarkOccurrence).toHaveBeenCalledWith('chore-1', OCC_EARLY.dueAt, 'skipped');
    });
  });
});

// ── 5. Final statuses hide action buttons ────────────────────────────────────
describe('TodayScreen – final status rows', () => {
  test('done row has no Done/Skip buttons', async () => {
    mockOccurrences = [OCC_DONE];
    const { queryByTestId } = await render(<TodayScreen />);
    expect(queryByTestId('today-done-chore-4')).toBeNull();
    expect(queryByTestId('today-skip-chore-4')).toBeNull();
  });

  test('skipped row has no Done/Skip buttons', async () => {
    mockOccurrences = [OCC_SKIPPED];
    const { queryByTestId } = await render(<TodayScreen />);
    expect(queryByTestId('today-done-chore-5')).toBeNull();
    expect(queryByTestId('today-skip-chore-5')).toBeNull();
  });
});

// ── 6. Tehran time display ────────────────────────────────────────────────────
describe('TodayScreen – Tehran time display', () => {
  test('shows Tehran wall-clock time HH:MM (not UTC)', async () => {
    // OCC_EARLY dueAt = 2024-06-21T03:00:00Z → Tehran +03:30 = 06:30
    mockOccurrences = [OCC_EARLY];
    const { getByText } = await render(<TodayScreen />);
    expect(getByText('06:30')).toBeTruthy(); // ASCII digits, matching utcIsoToTehranTime pattern
  });
});
