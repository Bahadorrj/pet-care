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
// PetDetailScreen uses useChoresStore to display a pet's chores section.
// mockChores is mutable so individual tests can inject chores and exercise
// the real useShallow selector path (Flag 1 fix coverage).
let mockChores: unknown[] = [];

jest.mock('../store/choresStore', () => ({
  useChoresStore: (selector: (s: { chores: unknown[] }) => unknown) =>
    selector({ chores: mockChores }),
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
  mockRouteParams = { petId: PET.id };
  mockPets = [PET];
  mockChores = []; // default: empty chores list
});

describe('PetDetailScreen – render', () => {
  test('renders pet name and translated species', async () => {
    const { getByText } = await render(<PetDetailScreen />);
    expect(getByText('رکسی')).toBeTruthy();
    expect(getByText('سگ')).toBeTruthy(); // pets.species.dog
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
// These tests exercise the REAL useShallow selector path (Flag 1).
// mockChores is fed directly to the selector; if useShallow is absent the
// identity check in zustand v5 would cause infinite re-renders and the test
// would time out / throw an act() loop error.

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
