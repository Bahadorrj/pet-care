import * as Crypto from "expo-crypto";
import { db } from "./index";
import type { Pet, Species, Gender, WeightUnit } from "./types";

interface PetRow {
  id: string;
  name: string;
  species: string;
  species_other: string | null;
  gender: string | null;
  photo_uri: string | null;
  notes: string | null;
  breed: string | null;
  weight_value: number | null;
  weight_unit: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species as Species,
    speciesOther: row.species_other,
    gender: row.gender as Gender | null,
    photoUri: row.photo_uri,
    notes: row.notes,
    breed: row.breed,
    weightValue: row.weight_value,
    weightUnit: row.weight_unit as WeightUnit | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertPet(
  data: Omit<Pet, "id" | "createdAt" | "updatedAt">,
): Pet {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO pets (id, name, species, species_other, gender, photo_uri, notes, breed, weight_value, weight_unit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.species,
      data.speciesOther ?? null,
      data.gender ?? null,
      data.photoUri ?? null,
      data.notes ?? null,
      data.breed ?? null,
      data.weightValue ?? null,
      data.weightUnit ?? null,
      now,
      now,
    ],
  );
  return {
    id,
    ...data,
    speciesOther: data.speciesOther ?? null,
    gender: data.gender ?? null,
    photoUri: data.photoUri ?? null,
    notes: data.notes ?? null,
    breed: data.breed ?? null,
    weightValue: data.weightValue ?? null,
    weightUnit: data.weightUnit ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function listPets(): Pet[] {
  const rows = db.getAllSync<PetRow>(
    "SELECT * FROM pets ORDER BY created_at DESC",
  );
  return rows.map(rowToPet);
}

export function getPet(id: string): Pet | null {
  const row = db.getFirstSync<PetRow>("SELECT * FROM pets WHERE id = ?", [id]);
  return row ? rowToPet(row) : null;
}

export function updatePet(
  id: string,
  data: Omit<Pet, "id" | "createdAt" | "updatedAt">,
): Pet {
  const now = new Date().toISOString();
  db.runSync(
    `UPDATE pets SET name = ?, species = ?, species_other = ?, gender = ?, photo_uri = ?, notes = ?, breed = ?, weight_value = ?, weight_unit = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.name,
      data.species,
      data.speciesOther ?? null,
      data.gender ?? null,
      data.photoUri ?? null,
      data.notes ?? null,
      data.breed ?? null,
      data.weightValue ?? null,
      data.weightUnit ?? null,
      now,
      id,
    ],
  );
  const row = db.getFirstSync<PetRow>("SELECT * FROM pets WHERE id = ?", [id]);
  if (!row) throw new Error(`Pet not found after update: ${id}`);
  return rowToPet(row);
}

export function deletePet(id: string): void {
  db.runSync("DELETE FROM pets WHERE id = ?", [id]);
}
