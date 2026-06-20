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
jest.mock('../store/choresStore', () => ({
  useChoresStore: (selector: (s: { chores: unknown[] }) => unknown) =>
    selector({ chores: [] }),
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
import type { Pet } from '../db/types';

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
