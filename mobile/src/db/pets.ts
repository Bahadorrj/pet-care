import * as Crypto from 'expo-crypto';
import { db } from './index';
import type { Pet, Species, Gender } from './types';

interface PetRow {
  id: string;
  name: string;
  species: string;
  gender: string | null;
  photo_uri: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species as Species,
    gender: row.gender as Gender | null,
    photoUri: row.photo_uri,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertPet(data: Omit<Pet, 'id' | 'createdAt' | 'updatedAt'>): Pet {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO pets (id, name, species, gender, photo_uri, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.species, data.gender ?? null, data.photoUri ?? null, data.notes ?? null, now, now]
  );
  return { id, ...data, gender: data.gender ?? null, photoUri: data.photoUri ?? null, notes: data.notes ?? null, createdAt: now, updatedAt: now };
}

export function listPets(): Pet[] {
  const rows = db.getAllSync<PetRow>('SELECT * FROM pets ORDER BY created_at DESC');
  return rows.map(rowToPet);
}

export function getPet(id: string): Pet | null {
  const row = db.getFirstSync<PetRow>('SELECT * FROM pets WHERE id = ?', [id]);
  return row ? rowToPet(row) : null;
}

export function updatePet(id: string, data: Omit<Pet, 'id' | 'createdAt' | 'updatedAt'>): Pet {
  const now = new Date().toISOString();
  db.runSync(
    `UPDATE pets SET name = ?, species = ?, gender = ?, photo_uri = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [data.name, data.species, data.gender ?? null, data.photoUri ?? null, data.notes ?? null, now, id]
  );
  const row = db.getFirstSync<PetRow>('SELECT * FROM pets WHERE id = ?', [id]);
  if (!row) throw new Error(`Pet not found after update: ${id}`);
  return rowToPet(row);
}

export function deletePet(id: string): void {
  db.runSync('DELETE FROM pets WHERE id = ?', [id]);
}
