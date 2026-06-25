/**
 * PetFormScreen tests
 *
 * Verifies:
 * - Add mode: blank Name blocks save (store.add never called); error shown.
 * - Add mode: no Species selected blocks save; error shown.
 * - Add mode: happy path calls store.add and goBack.
 * - Edit mode: pre-fills fields from getPet; submit calls store.update.
 * - In-flight guard: rapid double-submit triggers store action at most once.
 *
 * Mocks: petsStore, getPet, pickPhoto, navigation, i18n.
 */

import React from 'react';
import { render, fireEvent, waitFor, act as rnAct } from '@testing-library/react-native';

// ── Store mock ────────────────────────────────────────────────────────────────
// petsStore imports listPets() (SQLite) at module load — mock the whole module.
const mockAdd = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { add: typeof mockAdd; update: typeof mockUpdate }) => unknown) =>
    selector({ add: mockAdd, update: mockUpdate }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockGetPet = jest.fn();
jest.mock('../db/pets', () => ({
  getPet: (...args: unknown[]) => mockGetPet(...args),
}));

// ── petPhoto mock ─────────────────────────────────────────────────────────────
const mockPickPhoto = jest.fn();
jest.mock('../lib/petPhoto', () => ({
  pickPhoto: () => mockPickPhoto(),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
let mockRouteParams: { petId?: string } = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── Initialise i18n (real Farsi strings) ─────────────────────────────────────
import '../i18n';
import PetFormScreen from '../screens/pets/PetFormScreen';
import type { Pet } from '../db/types';

// ── Helpers ───────────────────────────────────────────────────────────────────
const EXISTING_PET: Pet = {
  id: 'pet-edit-1',
  name: 'رکسی',
  species: 'dog',
  gender: 'male',
  photoUri: null,
  notes: 'یادداشت تست',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  mockAdd.mockReset();
  mockUpdate.mockReset();
  mockGetPet.mockReset();
  mockPickPhoto.mockReset();
  mockGoBack.mockClear();
  mockRouteParams = {};
});

// ── Add mode ──────────────────────────────────────────────────────────────────

describe('PetFormScreen – Add mode – validation', () => {
  test('blank name blocks save and shows name error; store.add not called', async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    // Select species so only name is missing
    await fireEvent.press(getByTestId('petform-species-dog'));
    await fireEvent.press(getByTestId('petform-submit'));

    await waitFor(() => {
      expect(getByText('نام پت الزامی است')).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('whitespace-only name blocks save and shows name error', async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId('petform-name'), '   ');
    await fireEvent.press(getByTestId('petform-species-cat'));
    await fireEvent.press(getByTestId('petform-submit'));

    await waitFor(() => {
      expect(getByText('نام پت الزامی است')).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test('no species selected blocks save and shows species error; store.add not called', async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId('petform-name'), 'مکس');
    await fireEvent.press(getByTestId('petform-submit'));

    await waitFor(() => {
      expect(getByText('انتخاب گونه الزامی است')).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });
});

describe('PetFormScreen – Add mode – happy path', () => {
  test('valid form calls store.add and navigates back', async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId('petform-name'), 'مکس');
    await fireEvent.press(getByTestId('petform-species-rabbit'));
    await fireEvent.press(getByTestId('petform-submit'));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'مکس', species: 'rabbit' }),
      );
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});

// ── Edit mode ─────────────────────────────────────────────────────────────────

describe('PetFormScreen – Edit mode', () => {
  beforeEach(() => {
    mockRouteParams = { petId: EXISTING_PET.id };
    mockGetPet.mockReturnValue(EXISTING_PET);
  });

  test('pre-fills name from existing pet', async () => {
    const { getByTestId } = await render(<PetFormScreen />);
    const nameInput = getByTestId('petform-name');
    expect(nameInput.props.value).toBe('رکسی');
  });

  test('submit calls store.update (not add) and navigates back', async () => {
    mockUpdate.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.press(getByTestId('petform-submit'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        EXISTING_PET.id,
        expect.objectContaining({ name: 'رکسی', species: 'dog' }),
      );
      expect(mockAdd).not.toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});

// ── In-flight guard ───────────────────────────────────────────────────────────

describe('PetFormScreen – in-flight guard', () => {
  test('rapid double-submit triggers store.add at most once', async () => {
    let resolveAdd!: () => void;
    mockAdd.mockImplementation(
      () => new Promise<void>((resolve) => { resolveAdd = resolve; }),
    );

    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId('petform-name'), 'مکس');
    await fireEvent.press(getByTestId('petform-species-dog'));

    await rnAct(async () => {
      fireEvent.press(getByTestId('petform-submit'));
      fireEvent.press(getByTestId('petform-submit'));
      await Promise.resolve();
      expect(mockAdd).toHaveBeenCalledTimes(1);
      resolveAdd();
    });
  });
});
