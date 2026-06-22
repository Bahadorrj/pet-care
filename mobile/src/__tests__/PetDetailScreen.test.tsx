/**
 * PetDetailScreen tests
 *
 * Verifies:
 * - Renders the pet name and translated species.
 * - Edit button navigates to PetForm with { petId }.
 * - Delete button fires Alert.alert; invoking the destructive confirm callback
 *   calls store.remove(petId) and navigation.goBack().
 * - Cancel path does NOT call store.remove.
 *
 * Mocks: Alert.alert, petsStore, getPet, navigation, i18n.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ── Store mock ────────────────────────────────────────────────────────────────
// petsStore imports listPets() (SQLite) at module load — mock the whole module.
const mockRemove = jest.fn();
let mockPets: unknown[] = [];

jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: unknown[]; remove: typeof mockRemove }) => unknown) =>
    selector({ pets: mockPets, remove: mockRemove }),
}));

// choresStore imports listChores() (SQLite) at module load — mock it too.
// This mock calls the selector directly, so it verifies the selector LOGIC
// (filter-by-petId), not the useShallow wrapper: the infinite-render guard
// lives in zustand's useSyncExternalStore, which is bypassed here. The
// useShallow fix itself is verified on device (see Flag 1).
let mockChores: unknown[] = [];
const mockGetLogsForChore = jest.fn().mockReturnValue([]);

jest.mock('../store/choresStore', () => ({
  useChoresStore: (selector: (s: { chores: unknown[]; getLogsForChore: typeof mockGetLogsForChore }) => unknown) =>
    selector({ chores: mockChores, getLogsForChore: mockGetLogsForChore }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockGetPet = jest.fn();
jest.mock('../db/pets', () => ({
  getPet: (...args: unknown[]) => mockGetPet(...args),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: { petId: string } = { petId: 'pet-1' };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── Initialise i18n (real Farsi strings) ─────────────────────────────────────
import '../i18n';
import PetDetailScreen from '../screens/pets/PetDetailScreen';
import type { Chore, Pet } from '../db/types';

const PET: Pet = {
  id: 'pet-1',
  name: 'رکسی',
  species: 'dog',
  gender: 'male',
  photoUri: null,
  notes: 'یادداشت تست',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-02-01T00:00:00Z',
};

beforeEach(() => {
  mockRemove.mockReset();
  mockGetPet.mockReset();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockGetLogsForChore.mockClear();
  mockRouteParams = { petId: PET.id };
  mockPets = [PET];
  mockChores = []; // default: empty chores list
});

describe('PetDetailScreen – render', () => {
  test('renders pet name and translated species', async () => {
    const { getByText, getAllByText } = await render(<PetDetailScreen />);
    expect(getByText('رکسی')).toBeTruthy();
    // species appears twice now: hero chip + info card value
    expect(getAllByText('سگ').length).toBeGreaterThanOrEqual(1); // pets.species.dog
  });

  test('renders hero photo and floating edit button', async () => {
    mockPets = [{ ...PET, photoUri: 'file:///rexi.jpg' }];
    const { getByTestId } = await render(<PetDetailScreen />);
    expect(getByTestId('petdetail-photo')).toBeTruthy();
    expect(getByTestId('petdetail-edit')).toBeTruthy();
  });
});

describe('PetDetailScreen – edit', () => {
  test('Edit navigates to PetForm with { petId }', async () => {
    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId('petdetail-edit'));
    expect(mockNavigate).toHaveBeenCalledWith('PetForm', { petId: PET.id });
  });
});

// ── Chores section ────────────────────────────────────────────────────────────
// These tests verify the selector logic (filter-by-petId) and the section's
// render/navigation. They do NOT prove the useShallow infinite-render guard —
// that path (zustand useSyncExternalStore) is bypassed by the store mock above.

const CHORE_FIXTURE: Chore = {
  id: 'chore-1',
  petId: PET.id,
  type: 'feeding',
  title: 'صبحانه',
  schedule: { kind: 'daily_times', times: ['08:00'] },
  endKind: 'never',
  endUntil: null,
  endCount: null,
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('PetDetailScreen – chores section (useShallow selector stability)', () => {
  test('renders chore rows for this pet when store has matching chores', async () => {
    // Inject chores for this pet AND a decoy for another pet
    mockChores = [
      CHORE_FIXTURE,
      { ...CHORE_FIXTURE, id: 'chore-other', petId: 'other-pet', title: 'مزاحم' },
    ];

    const { getByTestId, queryByTestId } = await render(<PetDetailScreen />);

    // Only the chore belonging to pet-1 appears
    expect(getByTestId('petdetail-chore-chore-1')).toBeTruthy();
    // Decoy chore for other-pet must NOT appear
    expect(queryByTestId('petdetail-chore-chore-other')).toBeNull();
  });

  test('shows empty state when no chores belong to this pet', async () => {
    mockChores = []; // default — already set in beforeEach but explicit for clarity
    const { getByText } = await render(<PetDetailScreen />);
    // chores.empty key
    expect(getByText('امروز کاری برای انجام ندارید')).toBeTruthy();
  });

  test('tapping a chore row navigates to ChoreForm with petId + choreId', async () => {
    mockChores = [CHORE_FIXTURE];
    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId('petdetail-chore-chore-1'));
    expect(mockNavigate).toHaveBeenCalledWith('ChoreForm', {
      petId: PET.id,
      choreId: CHORE_FIXTURE.id,
    });
  });
});

describe('PetDetailScreen – delete', () => {
  test('Delete fires Alert.alert; confirm callback removes pet and goes back', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRemove.mockResolvedValue(undefined);

    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId('petdetail-delete'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as { text: string; style?: string; onPress?: () => void }[];
    const confirm = buttons.find((b) => b.style === 'destructive');
    expect(confirm).toBeDefined();

    await confirm!.onPress!();

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockRemove).toHaveBeenCalledWith(PET.id);
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    alertSpy.mockRestore();
  });

  test('cancel button does NOT call remove', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId('petdetail-delete'));

    const buttons = alertSpy.mock.calls[0][2] as { text: string; style?: string; onPress?: () => void }[];
    const cancel = buttons.find((b) => b.style === 'cancel');
    expect(cancel).toBeDefined();
    cancel!.onPress?.();

    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
