# Spec: My Pets Tab (حیوانات من)

> Source intent: `docs/design-ideas/04-my-pets-tab.md` (intent confirmed via interview).
> Status: **SPECIFY phase — awaiting human review before PLAN.**

## Objective

A new offline-first bottom tab **حیوانات من** giving any app user (guests
included) full **local** CRUD over their pets: add, list, view detail, edit,
delete. Records live only on-device in SQLite and survive restarts/reboots. No
`/pets` backend, no sync, not tied to an account — v1 is purely local.

**Success criteria (testable):**

1. User adds a pet (Name + Species required) → it appears in the list.
2. List renders newest-first; shows empty state when there are none.
3. Tapping a pet opens a detail screen with all fields + Edit/Delete actions.
4. Edit persists changes; `updatedAt` advances.
5. Delete asks for confirmation, then hard-deletes the row **and** the photo file.
6. All records survive an app restart (close + reopen, cold start).
7. Works with airplane mode on (zero network).
8. Saving with blank/whitespace-only Name or no Species is rejected with a
   translated error; no row written.

## Tech Stack

- Expo SDK 56 / React Native 0.85 / TypeScript (existing).
- **New deps (approved):**
  - `expo-sqlite` — local persistence.
  - `expo-image-picker` — gallery photo pick.
  - `expo-file-system` — copy picked photo into app document dir.
  - `expo-crypto` — `randomUUID()` for pet ids.
- Existing: `zustand` (state), `date-fns-jalali` (display), `react-i18next`
  (`fa` only, flat keys), `@react-navigation/*`, theme tokens, `ui/` primitives.

Install pins are documented at the **versioned** SDK 56 docs (per `mobile/CLAUDE.md`),
not from memory.

## Commands

```bash
cd mobile
npm install
npx expo run:android       # build + launch (photo picker needs a real build, not just Metro)
npm start                  # Metro dev server
npm test                   # jest --passWithNoTests
npx jest src/__tests__/petsStore.test.ts   # single file
npx tsc --noEmit           # typecheck gate (must be 0 errors; no lint script)
```

## Project Structure

New files (mirror existing patterns — `authStore`, `ProfileStack`):

```
mobile/src/
  db/
    index.ts            → openDatabaseSync + CREATE TABLE IF NOT EXISTS on import
    pets.ts             → typed CRUD: insertPet / listPets / getPet / updatePet / deletePet
  store/
    petsStore.ts        → Zustand store wrapping db/pets; in-memory list + actions
  navigation/
    PetsStack.tsx       → native stack: PetsList → PetDetail → PetForm
  screens/pets/
    PetsListScreen.tsx
    PetDetailScreen.tsx
    PetFormScreen.tsx   → one form for both Add and Edit (param decides mode)
  lib/
    petPhoto.ts         → pick from gallery, copy into documentDirectory, delete file
  __tests__/
    petsStore.test.ts
    PetsListScreen.test.tsx
    PetFormScreen.test.tsx
```

Edited: `navigation/RootNavigator.tsx` (insert tab between Home and Profile),
`i18n/fa.json` (new keys), `App.tsx` (gate first render on DB init alongside
`hasHydrated`/`fontsLoaded`).
New ADR: `docs/adr/0015-mobile-sqlite-local-store.md` (write in PLAN phase).

## Data Model

Single table, created on first run:

```sql
CREATE TABLE IF NOT EXISTS pets (
  id         TEXT    PRIMARY KEY,         -- uuid via expo-crypto randomUUID()
  name       TEXT    NOT NULL,
  species    TEXT    NOT NULL,            -- stable enum key: dog|cat|bird|rabbit|other
  gender     TEXT,                        -- 'male' | 'female' | NULL
  photo_uri  TEXT,                        -- path under documentDirectory, or NULL
  notes      TEXT,
  created_at TEXT    NOT NULL,            -- ISO-8601 UTC
  updated_at TEXT    NOT NULL             -- ISO-8601 UTC
);
```

- **Species** stored as stable enum key, rendered Farsi via i18n (`pets.species.dog` …).
- **Timestamps** stored UTC ISO, displayed Jalali via `date-fns-jalali` (ADR-0010).
- **Photo** copied into `documentDirectory` on save; DB stores its path. Delete
  removes both row and file. Editing the photo deletes the old file.
- List `ORDER BY created_at DESC` (newest-first).

### TS shape

```ts
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
```

## Code Style

Mirror `authStore.ts` (Zustand) and `ProfileStack.tsx` (typed stack). No inline
Farsi — keys in `fa.json`. Theme tokens, not hard-coded colors. `start`/`end`
in RTL styles, never `left`/`right`. Async submit guarded by a `useRef`
in-flight ref (existing convention).

```ts
// db/pets.ts — thin, synchronous (expo-sqlite sync API), typed mapping
export function listPets(): Pet[] {
  return db
    .getAllSync<PetRow>('SELECT * FROM pets ORDER BY created_at DESC')
    .map(rowToPet);
}
```

## Testing Strategy

- Framework: `jest-expo` + `@testing-library/react-native`, tests in `src/__tests__/`.
- `expo-sqlite`, `expo-image-picker`, `expo-file-system` are **mocked** in tests
  (jest mock); DB logic verified against an in-memory fake or mocked driver.
- Cover:
  - `petsStore`: insert→list newest-first, update bumps `updatedAt`, delete
    removes row + calls file delete, validation rejects blank name / missing species.
  - `PetFormScreen`: required-field validation blocks save; in-flight guard.
  - `PetsListScreen`: empty state vs populated list.
- Jalali boundary rendering is already covered by ADR-0010 patterns; reuse.
- Gate: `npx tsc --noEmit` 0 errors + `npm test` green before commit.

## Boundaries

- **Always:** run `tsc --noEmit` + `npm test` before commit; Farsi strings in
  `fa.json`; theme tokens; `start`/`end` RTL; store UTC, display Jalali.
- **Ask first:** adding the 3 new deps (`expo-sqlite`, `expo-image-picker`,
  `expo-file-system`); any DB schema change after merge; touching `App.tsx`
  render gating.
- **Never:** add a `/pets` backend / sync (out of scope v1); store Jalali
  strings as source of truth; commit secrets; soft-delete/archive; show a
  Gregorian date.

## Out of Scope (v1)

Backend sync / `/pets` API; soft-delete/archive/undo; camera capture & cropping;
birthdate/age or any field beyond the table above; multi-photo galleries.

## Resolved Decisions

1. **New deps approved:** `expo-sqlite`, `expo-image-picker`, `expo-file-system`,
   `expo-crypto`.
2. **id = UUID** (`expo-crypto.randomUUID()`), stored as `TEXT PRIMARY KEY`.
3. **DB init gated in `App.tsx`** — open DB + create table before first render,
   alongside `hasHydrated`/`fontsLoaded`.
4. **ADR-0015** (`docs/adr/0015-mobile-sqlite-local-store.md`) to be written in
   the PLAN phase, then referenced from `mobile/CLAUDE.md`.
```

