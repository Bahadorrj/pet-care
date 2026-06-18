export type Species = 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
export type Gender = 'male' | 'female';

export interface Pet {
  id: string; // uuid
  name: string;
  species: Species;
  gender: Gender | null;
  photoUri: string | null;
  notes: string | null;
  createdAt: string; // UTC ISO
  updatedAt: string; // UTC ISO
}
