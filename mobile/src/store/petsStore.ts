import { create } from "zustand";
import { insertPet, updatePet, deletePet, listPets, getPet } from "../db/pets";
import { deleteTasksForPet } from "../db/tasks";
import { savePhoto, deletePhoto } from "../lib/petPhoto";
import type { Pet, Species } from "../db/types";

type PetInput = Omit<Pet, "id" | "createdAt" | "updatedAt">;

interface PetsState {
  pets: Pet[];
  add: (input: PetInput) => Promise<void>;
  update: (id: string, input: PetInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const VALID_SPECIES: readonly Species[] = [
  "dog",
  "cat",
  "bird",
  "rabbit",
  "other",
];

// Validate before touching the db or filesystem so a rejected input leaves no
// orphaned photo file or partial row. Throws translation keys the UI surfaces.
function validate(input: PetInput): void {
  if (!input.name.trim()) throw new Error("pets.error.name_required");
  if (!VALID_SPECIES.includes(input.species))
    throw new Error("pets.error.species_required");
  if (input.species === "other" && !input.speciesOther?.trim()) {
    throw new Error("pets.error.species_other_required");
  }
}

export const usePetsStore = create<PetsState>((set) => ({
  // Read the persisted pets synchronously at module load.
  pets: listPets(),

  add: async (input) => {
    validate(input);

    // Copy the picked temp file into app storage; persist the stored path.
    const photoUri = input.photoUri ? await savePhoto(input.photoUri) : null;

    insertPet({ ...input, photoUri });
    set({ pets: listPets() });
  },

  update: async (id, input) => {
    validate(input);

    const prev = getPet(id);
    const prevPhoto = prev?.photoUri ?? null;

    let photoUri = input.photoUri;
    // The photo changed if the incoming uri differs from the stored path.
    if (photoUri !== prevPhoto) {
      // A non-null new uri is a freshly-picked temp file → copy into storage.
      photoUri = photoUri ? await savePhoto(photoUri) : null;
      // Remove the old stored file once the new one is in place.
      await deletePhoto(prevPhoto);
    }

    updatePet(id, { ...input, photoUri });
    set({ pets: listPets() });
  },

  remove: async (id) => {
    const p = getPet(id);
    deleteTasksForPet(id);
    deletePet(id);
    if (p?.photoUri) await deletePhoto(p.photoUri);
    set({ pets: listPets() });
  },
}));
