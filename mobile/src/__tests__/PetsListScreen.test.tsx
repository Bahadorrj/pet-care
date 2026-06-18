/**
 * PetsListScreen tests
 *
 * Verifies:
 * - Empty store: renders pets.empty message; no list rows.
 * - Populated store: renders pet names + translated species; no empty message.
 *
 * petsStore is mocked to drive state without touching SQLite.
 * Navigation is mocked so we can assert navigate() calls without a real Navigator.
 * i18n is imported to initialise the i18n instance before rendering.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

// petsStore calls listPets() (SQLite) at module load — mock the whole module.
// usePetsStore is called with a selector: usePetsStore((s) => s.pets).
// We intercept the selector call and return the controlled pets array.
let mockPets: Pet[] = [];

jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: Pet[] }) => Pet[]) => selector({ pets: mockPets }),
}));

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
}));

// Initialise i18n so t() returns real Farsi strings in the rendered component.
import '../i18n';
import PetsListScreen from '../screens/pets/PetsListScreen';
import type { Pet } from '../db/types';

const PET_DOG: Pet = {
  id: 'pet-1',
  name: 'رکسی',
  species: 'dog',
  gender: 'male',
  photoUri: null,
  notes: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const PET_CAT: Pet = {
  id: 'pet-2',
  name: 'ملوس',
  species: 'cat',
  gender: 'female',
  photoUri: null,
  notes: null,
  createdAt: '2024-01-02T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetOptions.mockClear();
  mockPets = [];
});

describe('PetsListScreen – empty store', () => {
  beforeEach(() => {
    mockPets = [];
  });

  test('renders the empty state message', async () => {
    await render(<PetsListScreen />);
    expect(screen.getByText('هنوز حیوان خانگی‌ای اضافه نشده است')).toBeTruthy();
  });

  test('does not render any pet names', async () => {
    await render(<PetsListScreen />);
    expect(screen.queryByText('رکسی')).toBeNull();
  });
});

describe('PetsListScreen – populated store', () => {
  beforeEach(() => {
    mockPets = [PET_DOG, PET_CAT];
  });

  test('renders pet names', async () => {
    await render(<PetsListScreen />);
    expect(screen.getByText('رکسی')).toBeTruthy();
    expect(screen.getByText('ملوس')).toBeTruthy();
  });

  test('renders translated species for each pet', async () => {
    await render(<PetsListScreen />);
    expect(screen.getByText('سگ')).toBeTruthy();   // pets.species.dog
    expect(screen.getByText('گربه')).toBeTruthy(); // pets.species.cat
  });

  test('does not render the empty state message', async () => {
    await render(<PetsListScreen />);
    expect(screen.queryByText('هنوز حیوان خانگی‌ای اضافه نشده است')).toBeNull();
  });
});
