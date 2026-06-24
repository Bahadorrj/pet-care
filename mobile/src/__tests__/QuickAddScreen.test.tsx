/**
 * QuickAddScreen tests
 *
 * Covers:
 * 1. Renders with 1 pet — pet pre-selected, Add enabled.
 * 2. Add button → addChore called with correct shape (one_off other, endKind:never).
 * 3. "More options →" → navigate to ChoreForm with petId + title.
 * 4. With 2 pets, no default selection — Add disabled until pet chosen.
 * 5. Invalid date → validation error shown, addChore not called.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// ── Store mocks ───────────────────────────────────────────────────────────────
const mockAddChore = jest.fn();

jest.mock('../store/choresStore', () => ({
  useChoresStore: (selector: (s: { addChore: typeof mockAddChore }) => unknown) =>
    selector({ addChore: mockAddChore }),
}));

let mockPets: { id: string; name: string }[] = [{ id: 'pet-1', name: 'رکسی' }];

jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: typeof mockPets }) => unknown) =>
    selector({ pets: mockPets }),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

// ── i18n ──────────────────────────────────────────────────────────────────────
import '../i18n';
import QuickAddScreen from '../screens/today/QuickAddScreen';

// ── Helpers ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const press = async (el: any) => { await act(async () => { fireEvent.press(el); }); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const changeText = async (el: any, value: string) => { await act(async () => { fireEvent.changeText(el, value); }); };

beforeEach(() => {
  mockAddChore.mockReset();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockPets = [{ id: 'pet-1', name: 'رکسی' }];
});

// ── 1. Single pet — pre-selected ─────────────────────────────────────────────
describe('QuickAddScreen – single pet pre-selected', () => {
  test('renders with pet chip pre-selected when exactly one pet exists', async () => {
    const { getByTestId } = await render(<QuickAddScreen />);
    const chip = getByTestId('quickadd-pet-pet-1');
    expect(chip.props.accessibilityState.selected).toBe(true);
  });

  test('Add button is enabled with pre-selected pet', async () => {
    const { getByTestId } = await render(<QuickAddScreen />);
    const btn = getByTestId('quickadd-submit');
    // Button is not disabled (disabled prop falsy)
    expect(btn.props.accessibilityState?.disabled).toBeFalsy();
  });
});

// ── 2. Add → addChore called with correct shape ───────────────────────────────
describe('QuickAddScreen – Add submission', () => {
  test('Add calls addChore once with one_off other chore, then goBack', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<QuickAddScreen />);

    // Fill title
    await changeText(getByTestId('quickadd-title'), 'ویزیت دامپزشک');

    // Set a known valid Jalali date + time (1405/04/10 = 2026-07-01)
    await changeText(getByTestId('quickadd-date'), '1405/04/10');
    await changeText(getByTestId('quickadd-time'), '10:00');

    await press(getByTestId('quickadd-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));

    const call = mockAddChore.mock.calls[0][0];
    expect(call).toMatchObject({
      petId: 'pet-1',
      type: 'other',
      endKind: 'never',
      endUntil: null,
      endCount: null,
      active: true,
      title: 'ویزیت دامپزشک',
      schedule: {
        kind: 'one_off',
        at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      },
    });
    // 1405/04/10 at 10:00 Tehran (+03:30) = 2026-07-01T06:30:00.000Z
    expect(call.schedule.at).toBe('2026-07-01T06:30:00.000Z');

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  });

  test('empty title → title field in addChore is null', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<QuickAddScreen />);

    await changeText(getByTestId('quickadd-date'), '1405/04/10');
    await changeText(getByTestId('quickadd-time'), '10:00');

    await press(getByTestId('quickadd-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));
    expect(mockAddChore.mock.calls[0][0].title).toBeNull();
  });
});

// ── 3. "More options →" navigation ────────────────────────────────────────────
describe('QuickAddScreen – More options', () => {
  test('More options → navigate ChoreForm with petId and title', async () => {
    const { getByTestId } = await render(<QuickAddScreen />);

    await changeText(getByTestId('quickadd-title'), 'حمام کردن');
    await press(getByTestId('quickadd-more'));

    expect(mockNavigate).toHaveBeenCalledWith(
      'ChoreForm',
      expect.objectContaining({ petId: 'pet-1', title: 'حمام کردن' }),
    );
  });

  test('More options with empty title → title omitted (undefined)', async () => {
    const { getByTestId } = await render(<QuickAddScreen />);

    await press(getByTestId('quickadd-more'));

    expect(mockNavigate).toHaveBeenCalledWith(
      'ChoreForm',
      expect.objectContaining({ petId: 'pet-1' }),
    );
    const args = mockNavigate.mock.calls[0][1];
    // title should be undefined (not empty string) when not typed
    expect(args.title).toBeUndefined();
  });
});

// ── 4. Multiple pets — requires selection ─────────────────────────────────────
describe('QuickAddScreen – multiple pets', () => {
  beforeEach(() => {
    mockPets = [
      { id: 'pet-1', name: 'رکسی' },
      { id: 'pet-2', name: 'گربه' },
    ];
  });

  test('no pet pre-selected when multiple pets', async () => {
    const { getByTestId } = await render(<QuickAddScreen />);
    expect(getByTestId('quickadd-pet-pet-1').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('quickadd-pet-pet-2').props.accessibilityState.selected).toBe(false);
  });

  test('selecting a pet enables Add and submits with that petId', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId } = await render(<QuickAddScreen />);

    await press(getByTestId('quickadd-pet-pet-2'));
    await changeText(getByTestId('quickadd-date'), '1405/04/10');
    await changeText(getByTestId('quickadd-time'), '10:00');
    await press(getByTestId('quickadd-submit'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));
    expect(mockAddChore.mock.calls[0][0].petId).toBe('pet-2');
  });
});

// ── 5. Validation ─────────────────────────────────────────────────────────────
describe('QuickAddScreen – validation', () => {
  test('invalid Jalali date → error shown, addChore not called', async () => {
    mockAddChore.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<QuickAddScreen />);

    await changeText(getByTestId('quickadd-date'), 'bad-date');
    await press(getByTestId('quickadd-submit'));

    await waitFor(() =>
      expect(getByText('تاریخ باید به شکل yyyy/MM/dd باشد')).toBeTruthy(),
    );
    expect(mockAddChore).not.toHaveBeenCalled();
  });
});
