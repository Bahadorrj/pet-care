/**
 * PetDetailScreen tests
 *
 * Verifies:
 * - Renders the pet name and translated species.
 * - Edit button navigates to PetForm with { petId }.
 * - Delete button opens the ConfirmDialog; pressing confirm calls
 *   store.remove(petId) and navigation.goBack().
 * - Cancel path does NOT call store.remove.
 *
 * Mocks: petsStore, getPet, navigation, i18n.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// ── Store mock ────────────────────────────────────────────────────────────────
// petsStore imports listPets() (SQLite) at module load — mock the whole module.
const mockRemove = jest.fn();
let mockPets: unknown[] = [];

jest.mock("../store/petsStore", () => ({
  usePetsStore: (
    selector: (s: { pets: unknown[]; remove: typeof mockRemove }) => unknown,
  ) => selector({ pets: mockPets, remove: mockRemove }),
}));

// tasksStore imports listTasks() (SQLite) at module load — mock it too.
// This mock calls the selector directly, so it verifies the selector LOGIC
// (filter-by-petId), not the useShallow wrapper: the infinite-render guard
// lives in zustand's useSyncExternalStore, which is bypassed here. The
// useShallow fix itself is verified on device (see Flag 1).
let mockTasks: unknown[] = [];
const mockGetLogsForTask = jest.fn().mockReturnValue([]);

jest.mock("../store/tasksStore", () => ({
  useTasksStore: (
    selector: (s: {
      tasks: unknown[];
      getLogsForTask: typeof mockGetLogsForTask;
    }) => unknown,
  ) => selector({ tasks: mockTasks, getLogsForTask: mockGetLogsForTask }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockGetPet = jest.fn();
jest.mock("../db/pets", () => ({
  getPet: (...args: unknown[]) => mockGetPet(...args),
}));

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: { petId: string } = { petId: "pet-1" };

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── Initialise i18n (real Farsi strings) ─────────────────────────────────────
import i18n from "../i18n";
import PetDetailScreen from "../screens/pets/PetDetailScreen";
import type { Task, Pet } from "../db/types";

const PET: Pet = {
  id: "pet-1",
  name: "رکسی",
  species: "dog",
  speciesOther: null,
  gender: "male",
  photoUri: null,
  notes: "یادداشت تست",
  breed: null,
  weightValue: null,
  weightUnit: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-02-01T00:00:00Z",
};

beforeEach(() => {
  mockRemove.mockReset();
  mockGetPet.mockReset();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockGetLogsForTask.mockClear();
  mockRouteParams = { petId: PET.id };
  mockPets = [PET];
  mockTasks = []; // default: empty tasks list
});

describe("PetDetailScreen – render", () => {
  test("renders pet name and translated species", async () => {
    const { getByText, getAllByText } = await render(<PetDetailScreen />);
    expect(getByText("رکسی")).toBeTruthy();
    // species appears twice now: hero chip + info card value
    expect(
      getAllByText(i18n.t("pets.species.dog")).length,
    ).toBeGreaterThanOrEqual(1);
  });

  test("renders hero photo and edit button", async () => {
    mockPets = [{ ...PET, photoUri: "file:///rexi.jpg" }];
    const { getByTestId } = await render(<PetDetailScreen />);
    expect(getByTestId("petdetail-photo")).toBeTruthy();
    expect(getByTestId("petdetail-edit")).toBeTruthy();
  });

  test("renders breed and weight when set, and omits them when null", async () => {
    mockPets = [
      { ...PET, breed: "گلدن رتریور", weightValue: 4.5, weightUnit: "kg" },
    ];
    const { getByText } = await render(<PetDetailScreen />);
    expect(getByText("گلدن رتریور")).toBeTruthy();
    expect(getByText(`4.5 ${i18n.t("pets.unit.kg")}`)).toBeTruthy();

    mockPets = [PET]; // breed/weight null on the base fixture
    const { queryByText } = await render(<PetDetailScreen />);
    expect(queryByText("گلدن رتریور")).toBeNull();
  });
});

describe("PetDetailScreen – edit", () => {
  test("Edit navigates to PetForm with { petId }", async () => {
    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId("petdetail-edit"));
    expect(mockNavigate).toHaveBeenCalledWith("PetForm", { petId: PET.id });
  });
});

// ── Tasks section ────────────────────────────────────────────────────────────
// These tests verify the selector logic (filter-by-petId) and the section's
// render/navigation. They do NOT prove the useShallow infinite-render guard —
// that path (zustand useSyncExternalStore) is bypassed by the store mock above.

const TASK_FIXTURE: Task = {
  id: "task-1",
  petId: PET.id,
  type: "feeding",
  title: "صبحانه",
  schedule: { kind: "daily_times", times: ["08:00"] },
  endKind: "never",
  endUntil: null,
  endCount: null,
  active: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("PetDetailScreen – add-task button removed", () => {
  test("petdetail-add-task button is not rendered", async () => {
    const { queryByTestId } = await render(<PetDetailScreen />);
    expect(queryByTestId("petdetail-add-task")).toBeNull();
  });

  test("task list still renders when pet has tasks", async () => {
    mockTasks = [TASK_FIXTURE];
    const { getByTestId } = await render(<PetDetailScreen />);
    expect(getByTestId("petdetail-task-task-1")).toBeTruthy();
  });

  test("empty state renders when pet has no tasks", async () => {
    mockTasks = [];
    const { getByText } = await render(<PetDetailScreen />);
    expect(getByText(i18n.t("tasks.empty"))).toBeTruthy();
  });
});

describe("PetDetailScreen – tasks section (useShallow selector stability)", () => {
  test("renders task rows for this pet when store has matching tasks", async () => {
    // Inject tasks for this pet AND a decoy for another pet
    mockTasks = [
      TASK_FIXTURE,
      { ...TASK_FIXTURE, id: "task-other", petId: "other-pet", title: "مزاحم" },
    ];

    const { getByTestId, queryByTestId } = await render(<PetDetailScreen />);

    // Only the task belonging to pet-1 appears
    expect(getByTestId("petdetail-task-task-1")).toBeTruthy();
    // Decoy task for other-pet must NOT appear
    expect(queryByTestId("petdetail-task-task-other")).toBeNull();
  });

  test("shows empty state when no tasks belong to this pet", async () => {
    mockTasks = []; // default — already set in beforeEach but explicit for clarity
    const { getByText } = await render(<PetDetailScreen />);
    // tasks.empty key
    expect(getByText(i18n.t("tasks.empty"))).toBeTruthy();
  });

  test("tapping a task row navigates to TaskForm with petId + taskId", async () => {
    mockTasks = [TASK_FIXTURE];
    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId("petdetail-task-task-1"));
    expect(mockNavigate).toHaveBeenCalledWith("TaskForm", {
      petId: PET.id,
      taskId: TASK_FIXTURE.id,
    });
  });
});

describe("PetDetailScreen – delete", () => {
  test("Delete opens the ConfirmDialog; confirm removes pet and goes back", async () => {
    mockRemove.mockResolvedValue(undefined);

    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId("petdetail-delete"));

    await waitFor(() => expect(getByTestId("pet-delete-confirm")).toBeTruthy());

    fireEvent.press(getByTestId("pet-delete-confirm-confirm"));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockRemove).toHaveBeenCalledWith(PET.id);
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  test("cancel button does NOT call remove", async () => {
    const { getByTestId } = await render(<PetDetailScreen />);
    fireEvent.press(getByTestId("petdetail-delete"));

    await waitFor(() => expect(getByTestId("pet-delete-confirm")).toBeTruthy());

    fireEvent.press(getByTestId("pet-delete-confirm-cancel"));

    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
