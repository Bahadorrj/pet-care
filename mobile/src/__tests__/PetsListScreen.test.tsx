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

import React from "react";
import { Alert, BackHandler } from "react-native";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";

// petsStore calls listPets() (SQLite) at module load — mock the whole module.
// usePetsStore is called with a selector: usePetsStore((s) => s.pets) or
// usePetsStore((s) => s.removeMany). We intercept the selector call and
// return the controlled pets array + a jest.fn() for removeMany.
let mockPets: Pet[] = [];
const mockRemoveMany = jest.fn();

jest.mock("../store/petsStore", () => ({
  usePetsStore: (
    selector: (s: {
      pets: Pet[];
      removeMany: typeof mockRemoveMany;
    }) => unknown,
  ) => selector({ pets: mockPets, removeMany: mockRemoveMany }),
}));

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
}));

// Initialise i18n so t() returns real Farsi strings in the rendered component.
import i18n from "../i18n";
import PetsListScreen from "../screens/pets/PetsListScreen";
import type { Pet } from "../db/types";

const PET_DOG: Pet = {
  id: "pet-1",
  name: "رکسی",
  species: "dog",
  speciesOther: null,
  gender: "male",
  photoUri: null,
  notes: null,
  breed: null,
  weightValue: null,
  weightUnit: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const PET_CAT: Pet = {
  id: "pet-2",
  name: "ملوس",
  species: "cat",
  speciesOther: null,
  gender: "female",
  photoUri: null,
  notes: null,
  breed: null,
  weightValue: null,
  weightUnit: null,
  createdAt: "2024-01-02T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetOptions.mockClear();
  mockRemoveMany.mockClear();
  mockPets = [];
});

describe("PetsListScreen – empty store", () => {
  beforeEach(() => {
    mockPets = [];
  });

  test("renders the empty state message", async () => {
    await render(<PetsListScreen />);
    expect(screen.getByText(i18n.t("pets.empty_title"))).toBeTruthy();
  });

  test("does not render any pet names", async () => {
    await render(<PetsListScreen />);
    expect(screen.queryByText("رکسی")).toBeNull();
  });
});

describe("PetsListScreen – populated store", () => {
  beforeEach(() => {
    mockPets = [PET_DOG, PET_CAT];
  });

  test("renders pet names", async () => {
    await render(<PetsListScreen />);
    expect(screen.getByText("رکسی")).toBeTruthy();
    expect(screen.getByText("ملوس")).toBeTruthy();
  });

  test("renders translated species for each pet", async () => {
    await render(<PetsListScreen />);
    expect(screen.getByText(i18n.t("pets.species.dog"))).toBeTruthy();
    expect(screen.getByText(i18n.t("pets.species.cat"))).toBeTruthy();
  });

  test("does not render the empty state message", async () => {
    await render(<PetsListScreen />);
    expect(screen.queryByText(i18n.t("pets.empty_title"))).toBeNull();
  });
});

describe("PetsListScreen – selection mode", () => {
  beforeEach(() => {
    mockPets = [PET_DOG, PET_CAT];
  });

  test("tapping a card while not in selection mode navigates to PetDetail", async () => {
    await render(<PetsListScreen />);

    fireEvent.press(screen.getByTestId(`pet-card-${PET_DOG.id}`));

    expect(mockNavigate).toHaveBeenCalledWith("PetDetail", {
      petId: PET_DOG.id,
    });
  });

  test("long-pressing an unselected card enters selection mode and selects it", async () => {
    await render(<PetsListScreen />);

    fireEvent(screen.getByTestId(`pet-card-${PET_DOG.id}`), "longPress");

    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_DOG.id}`).props.accessibilityState
          ?.selected,
      ).toBe(true),
    );
  });

  test("tapping another card while in selection mode toggles it instead of navigating", async () => {
    await render(<PetsListScreen />);
    fireEvent(screen.getByTestId(`pet-card-${PET_DOG.id}`), "longPress");
    // VirtualizedList defers cell re-render to a timer (_updateCellsToRender);
    // wait for it so the CAT cell's onPress closure picks up the new
    // selection mode before we tap it.
    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_DOG.id}`).props.accessibilityState
          ?.selected,
      ).toBe(true),
    );
    mockNavigate.mockClear();

    fireEvent.press(screen.getByTestId(`pet-card-${PET_CAT.id}`));

    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_CAT.id}`).props.accessibilityState
          ?.selected,
      ).toBe(true),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("tapping an already-selected card while in selection mode deselects it", async () => {
    await render(<PetsListScreen />);
    fireEvent(screen.getByTestId(`pet-card-${PET_DOG.id}`), "longPress");
    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_DOG.id}`).props.accessibilityState
          ?.selected,
      ).toBe(true),
    );

    fireEvent.press(screen.getByTestId(`pet-card-${PET_DOG.id}`));

    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_DOG.id}`).props.accessibilityState
          ?.selected,
      ).toBe(false),
    );
  });
});

describe("PetsListScreen – selection toolbar & delete", () => {
  beforeEach(() => {
    mockPets = [PET_DOG, PET_CAT];
  });

  async function enterSelectionWith(id: string) {
    fireEvent(screen.getByTestId(`pet-card-${id}`), "longPress");
    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${id}`).props.accessibilityState?.selected,
      ).toBe(true),
    );
  }

  test("long-press shows the selection toolbar with a 1-selected count", async () => {
    await render(<PetsListScreen />);

    await enterSelectionWith(PET_DOG.id);

    expect(
      screen.getByText(i18n.t("pets.select_mode.selected_count", { count: 1 })),
    ).toBeTruthy();
  });

  test("cancel exits selection mode without calling the store", async () => {
    await render(<PetsListScreen />);
    await enterSelectionWith(PET_DOG.id);

    fireEvent.press(screen.getByTestId("selection-cancel"));

    await waitFor(() =>
      expect(screen.queryByTestId("selection-cancel")).toBeNull(),
    );
    expect(mockRemoveMany).not.toHaveBeenCalled();
  });

  test("select-all selects every pet; tapping again deselects all and stays in selection mode", async () => {
    await render(<PetsListScreen />);
    await enterSelectionWith(PET_DOG.id);

    fireEvent.press(screen.getByTestId("selection-select-all"));
    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_CAT.id}`).props.accessibilityState
          ?.selected,
      ).toBe(true),
    );

    fireEvent.press(screen.getByTestId("selection-select-all"));
    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_DOG.id}`).props.accessibilityState
          ?.selected,
      ).toBe(false),
    );
    // still in selection mode — toolbar stays up (spec decision).
    expect(screen.getByTestId("selection-cancel")).toBeTruthy();
  });

  test("deselecting the only selected card stays in selection mode with delete disabled", async () => {
    await render(<PetsListScreen />);
    await enterSelectionWith(PET_DOG.id);

    fireEvent.press(screen.getByTestId(`pet-card-${PET_DOG.id}`)); // deselect

    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${PET_DOG.id}`).props.accessibilityState
          ?.selected,
      ).toBe(false),
    );
    expect(screen.getByTestId("selection-cancel")).toBeTruthy();
    expect(
      screen.getByTestId("selection-delete").props.accessibilityState?.disabled,
    ).toBe(true);
  });

  test("trash confirms via Alert.alert naming the count, and confirming calls removeMany with the selected ids", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<PetsListScreen />);
    await enterSelectionWith(PET_DOG.id);

    fireEvent.press(screen.getByTestId("selection-delete"));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [, message, buttons] = alertSpy.mock.calls[0];
    expect(message).toBe(i18n.t("pets.delete_confirm_many", { count: 1 }));
    const confirmBtn = buttons?.find((b) => b.style === "destructive");
    expect(confirmBtn).toBeDefined();

    await confirmBtn!.onPress!();

    expect(mockRemoveMany).toHaveBeenCalledWith([PET_DOG.id]);
    alertSpy.mockRestore();
  });

  test("canceling the delete Alert does not call removeMany", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<PetsListScreen />);
    await enterSelectionWith(PET_DOG.id);

    fireEvent.press(screen.getByTestId("selection-delete"));

    const [, , buttons] = alertSpy.mock.calls[0];
    const cancelBtn = buttons?.find((b) => b.style === "cancel");
    expect(cancelBtn).toBeDefined();
    expect(mockRemoveMany).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe("PetsListScreen – Android hardware back", () => {
  beforeEach(() => {
    mockPets = [PET_DOG, PET_CAT];
  });

  async function enterSelectionWith(id: string) {
    fireEvent(screen.getByTestId(`pet-card-${id}`), "longPress");
    await waitFor(() =>
      expect(
        screen.getByTestId(`pet-card-${id}`).props.accessibilityState?.selected,
      ).toBe(true),
    );
  }

  test("exits selection mode instead of navigating away when selecting", async () => {
    const removeFn = jest.fn();
    const addSpy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove: removeFn });

    await render(<PetsListScreen />);
    await enterSelectionWith(PET_DOG.id);

    expect(addSpy).toHaveBeenCalledWith(
      "hardwareBackPress",
      expect.any(Function),
    );
    const handler = addSpy.mock.calls[0][1] as () => boolean;
    const handled = handler();

    expect(handled).toBe(true);
    await waitFor(() =>
      expect(screen.queryByTestId("selection-cancel")).toBeNull(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();

    addSpy.mockRestore();
  });

  test("listener is only registered while selecting, and is cleaned up on exit", async () => {
    const removeFn = jest.fn();
    const addSpy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove: removeFn });

    await render(<PetsListScreen />);
    expect(addSpy).not.toHaveBeenCalled();

    await enterSelectionWith(PET_DOG.id);
    expect(addSpy).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId("selection-cancel"));
    await waitFor(() => expect(removeFn).toHaveBeenCalledTimes(1));

    addSpy.mockRestore();
  });
});
