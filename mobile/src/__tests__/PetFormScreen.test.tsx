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

import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  act as rnAct,
} from "@testing-library/react-native";

// ── Store mock ────────────────────────────────────────────────────────────────
// petsStore imports listPets() (SQLite) at module load — mock the whole module.
const mockAdd = jest.fn();
const mockUpdate = jest.fn();

jest.mock("../store/petsStore", () => ({
  usePetsStore: (
    selector: (s: {
      add: typeof mockAdd;
      update: typeof mockUpdate;
    }) => unknown,
  ) => selector({ add: mockAdd, update: mockUpdate }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockGetPet = jest.fn();
jest.mock("../db/pets", () => ({
  getPet: (...args: unknown[]) => mockGetPet(...args),
}));

// ── petPhoto mock ─────────────────────────────────────────────────────────────
const mockPickPhoto = jest.fn();
jest.mock("../lib/petPhoto", () => ({
  pickPhoto: () => mockPickPhoto(),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
let mockRouteParams: { petId?: string } = {};

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── Initialise i18n (real Farsi strings) ─────────────────────────────────────
import i18n from "../i18n";
import PetFormScreen from "../screens/pets/PetFormScreen";
import { toPersianDigits } from "../lib/jalali";
import type { Pet } from "../db/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
const EXISTING_PET: Pet = {
  id: "pet-edit-1",
  name: "رکسی",
  species: "dog",
  speciesOther: null,
  gender: "male",
  photoUri: null,
  notes: "یادداشت تست",
  breed: "گلدن رتریور",
  weightValue: 4.5,
  weightUnit: "kg",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

beforeEach(() => {
  mockAdd.mockReset();
  mockUpdate.mockReset();
  mockGetPet.mockReset();
  mockPickPhoto.mockReset();
  mockGoBack.mockClear();
  mockRouteParams = {};
});

// ── Top app bar ───────────────────────────────────────────────────────────────

describe("PetFormScreen – top app bar", () => {
  // Asserted via testID, not getByText: `pets.form.title_add` and `pets.add`
  // are the same string, and `pets.add` is the submit label — a text query
  // would match the button and pass with no app bar on screen.
  test("Add mode renders the add title", async () => {
    const { getByTestId } = await render(<PetFormScreen />);
    expect(getByTestId("petform-title").props.children).toBe(
      i18n.t("pets.form.title_add"),
    );
  });

  test("Edit mode renders the edit title", async () => {
    mockRouteParams = { petId: EXISTING_PET.id };
    mockGetPet.mockReturnValue(EXISTING_PET);

    const { getByTestId } = await render(<PetFormScreen />);
    expect(getByTestId("petform-title").props.children).toBe(
      i18n.t("pets.form.title_edit"),
    );
  });

  test("back button calls navigation.goBack", async () => {
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.press(getByTestId("petform-back"));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

// ── Basic-information card ────────────────────────────────────────────────────

describe("PetFormScreen – basic-information card", () => {
  test("renders the card heading", async () => {
    const { getByText } = await render(<PetFormScreen />);
    expect(getByText(i18n.t("pets.form.section_basic"))).toBeTruthy();
  });
});

// ── Required-field markers ────────────────────────────────────────────────────

describe("PetFormScreen – required-field asterisks", () => {
  // Assert the full rendered text, not `props.children`. Two earlier versions
  // of these tests were vacuous: `[text, expect.anything()]` also matches the
  // literal `false` that `required && <Text/>` yields when the marker is
  // absent, and `not.toHaveTextContent("*")` passes on "اسم *" because
  // toHaveTextContent matches strings exactly, not as substrings. Exact
  // whole-label matching is what actually pins the marker down.
  test("name and species labels are marked required", async () => {
    const { getByTestId } = await render(<PetFormScreen />);

    for (const field of ["name", "species"]) {
      expect(getByTestId(`petform-label-${field}`)).toHaveTextContent(
        `${i18n.t(`pets.field.${field}`)} *`,
      );
    }
  });

  test("optional labels carry no marker", async () => {
    const { getByTestId } = await render(<PetFormScreen />);

    for (const field of ["breed", "gender", "weight", "notes"]) {
      expect(getByTestId(`petform-label-${field}`)).toHaveTextContent(
        i18n.t(`pets.field.${field}`),
      );
    }
  });

  test("the species-other label is marked required, and only appears for «other»", async () => {
    const { getByTestId, queryByTestId } = await render(<PetFormScreen />);

    expect(queryByTestId("petform-label-species_other")).toBeNull();

    await fireEvent.press(getByTestId("petform-species-other"));

    expect(getByTestId("petform-label-species_other")).toHaveTextContent(
      `${i18n.t("pets.field.species_other")} *`,
    );
  });

  test("the marker is not announced to screen readers as part of the field name", async () => {
    const { getByTestId } = await render(<PetFormScreen />);
    expect(getByTestId("petform-label-name").props.accessibilityLabel).toBe(
      i18n.t("pets.field.name"),
    );
  });
});

// ── Avatar section ────────────────────────────────────────────────────────────

describe("PetFormScreen – avatar section", () => {
  test("with no photo, shows the camera placeholder and no preview image", async () => {
    const { getByTestId, queryByTestId } = await render(<PetFormScreen />);

    expect(getByTestId("petform-avatar-placeholder")).toBeTruthy();
    expect(queryByTestId("petform-avatar-image")).toBeNull();
  });

  test("pressing the floating edit button picks a photo and renders it", async () => {
    mockPickPhoto.mockResolvedValue("file:///picked.jpg");
    const { getByTestId, queryByTestId } = await render(<PetFormScreen />);

    await fireEvent.press(getByTestId("petform-photo"));

    await waitFor(() => {
      expect(mockPickPhoto).toHaveBeenCalledTimes(1);
      expect(getByTestId("petform-avatar-image").props.source).toEqual({
        uri: "file:///picked.jpg",
      });
      expect(queryByTestId("petform-avatar-placeholder")).toBeNull();
    });
  });

  test("pressing the circle itself also picks a photo", async () => {
    mockPickPhoto.mockResolvedValue(null);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.press(getByTestId("petform-avatar"));

    expect(mockPickPhoto).toHaveBeenCalledTimes(1);
  });

  test("Edit mode with an existing photo renders it in the circle", async () => {
    mockRouteParams = { petId: EXISTING_PET.id };
    mockGetPet.mockReturnValue({
      ...EXISTING_PET,
      photoUri: "file:///existing.jpg",
    });

    const { getByTestId, queryByTestId } = await render(<PetFormScreen />);

    expect(getByTestId("petform-avatar-image").props.source).toEqual({
      uri: "file:///existing.jpg",
    });
    expect(queryByTestId("petform-avatar-placeholder")).toBeNull();
    // The old standalone «عکس» preview must not survive alongside the avatar.
    expect(queryByTestId("petform-photo-preview")).toBeNull();
  });
});

// ── Add mode ──────────────────────────────────────────────────────────────────

describe("PetFormScreen – Add mode – validation", () => {
  test("blank name blocks save and shows name error; store.add not called", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    // Select species so only name is missing
    await fireEvent.press(getByTestId("petform-species-dog"));
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(getByText(i18n.t("pets.error.name_required"))).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test("whitespace-only name blocks save and shows name error", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "   ");
    await fireEvent.press(getByTestId("petform-species-cat"));
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(getByText(i18n.t("pets.error.name_required"))).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test("no species selected blocks save and shows species error; store.add not called", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(getByText(i18n.t("pets.error.species_required"))).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test('species "other" with blank description blocks save and shows species-other error', async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-species-other"));
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(
        getByText(i18n.t("pets.error.species_other_required")),
      ).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test("non-numeric weight blocks save and shows weight error", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId, getByText } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-species-dog"));
    await fireEvent.changeText(getByTestId("petform-weight"), "abc");
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(getByText(i18n.t("pets.error.weight_invalid"))).toBeTruthy();
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });
});

describe("PetFormScreen – Add mode – happy path", () => {
  test("valid form calls store.add and navigates back", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-species-rabbit"));
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: "مکس", species: "rabbit" }),
      );
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  test('species "other" with a description fills speciesOther and calls store.add', async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-species-other"));
    await fireEvent.changeText(
      getByTestId("petform-species-other-input"),
      "ماهی",
    );
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "مکس",
          species: "other",
          speciesOther: "ماهی",
        }),
      );
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  test("selecting species defaults the weight unit chip, and entering a weight submits it", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "توییتی");
    await fireEvent.press(getByTestId("petform-species-bird"));
    expect(
      getByTestId("petform-weight-unit-g").props.accessibilityState.selected,
    ).toBe(true);

    await fireEvent.changeText(getByTestId("petform-weight"), "35");
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          breed: null,
          weightValue: 35,
          weightUnit: "g",
        }),
      );
    });
  });

  test("weight displays Persian digits while still submitting a Latin number", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-species-dog"));

    // A decimal-pad keystroke arrives as a Latin digit…
    await fireEvent.changeText(getByTestId("petform-weight"), "4.2");
    // …but nothing Latin is ever rendered.
    expect(getByTestId("petform-weight").props.value).toBe(
      toPersianDigits("4.2"),
    );

    await fireEvent.press(getByTestId("petform-submit"));
    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ weightValue: 4.2, weightUnit: "kg" }),
      );
    });
  });

  test("weight typed as Persian digits parses back to a number", async () => {
    mockAdd.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-species-dog"));
    await fireEvent.changeText(
      getByTestId("petform-weight"),
      toPersianDigits("4.2"),
    );
    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ weightValue: 4.2 }),
      );
    });
  });
});

// ── Edit mode ─────────────────────────────────────────────────────────────────

describe("PetFormScreen – Edit mode", () => {
  beforeEach(() => {
    mockRouteParams = { petId: EXISTING_PET.id };
    mockGetPet.mockReturnValue(EXISTING_PET);
  });

  test("pre-fills name from existing pet", async () => {
    const { getByTestId } = await render(<PetFormScreen />);
    const nameInput = getByTestId("petform-name");
    expect(nameInput.props.value).toBe("رکسی");
  });

  test('pre-fills speciesOther and shows the field for an existing "other" pet', async () => {
    mockGetPet.mockReturnValue({
      ...EXISTING_PET,
      species: "other",
      speciesOther: "لاک‌پشت",
    });
    const { getByTestId } = await render(<PetFormScreen />);

    expect(getByTestId("petform-species-other-input").props.value).toBe(
      "لاک‌پشت",
    );
  });

  test("pre-fills breed and weight from existing pet", async () => {
    const { getByTestId } = await render(<PetFormScreen />);
    expect(getByTestId("petform-breed").props.value).toBe("گلدن رتریور");
    expect(getByTestId("petform-weight").props.value).toBe(
      toPersianDigits("4.5"),
    );
    expect(
      getByTestId("petform-weight-unit-kg").props.accessibilityState.selected,
    ).toBe(true);
  });

  test("submit calls store.update (not add) and navigates back", async () => {
    mockUpdate.mockResolvedValue(undefined);
    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.press(getByTestId("petform-submit"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        EXISTING_PET.id,
        expect.objectContaining({ name: "رکسی", species: "dog" }),
      );
      expect(mockAdd).not.toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});

// ── In-flight guard ───────────────────────────────────────────────────────────

describe("PetFormScreen – in-flight guard", () => {
  test("rapid double-submit triggers store.add at most once", async () => {
    let resolveAdd!: () => void;
    mockAdd.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        }),
    );

    const { getByTestId } = await render(<PetFormScreen />);

    await fireEvent.changeText(getByTestId("petform-name"), "مکس");
    await fireEvent.press(getByTestId("petform-species-dog"));

    await rnAct(async () => {
      fireEvent.press(getByTestId("petform-submit"));
      fireEvent.press(getByTestId("petform-submit"));
      await Promise.resolve();
      expect(mockAdd).toHaveBeenCalledTimes(1);
      resolveAdd();
    });
  });
});
