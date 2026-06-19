# Implementation Plan: My Pets Tab (حیوانات من)

Spec: `docs/specs/04-my-pets-tab-spec.md`
Status: **DRAFT — awaiting approval**

## Overview

A third bottom tab giving every user (guests included) offline-first **local** CRUD over
their pets, backed by on-device SQLite. No backend, no sync, no account tie-in. Layered:
`db` (schema + typed CRUD) → `lib/petPhoto` (file ops) → `petsStore` (Zustand) →
`PetsStack` screens (list / detail / form) → tab wired into `RootNavigator`.

## Architecture Decisions

- **SQLite via `expo-sqlite` sync API** (`getAllSync`/`runSync`) — `db/pets.ts` stays thin,
  synchronous, typed; no async plumbing in the store. (ADR-0015)
- **Single `pets` table, `CREATE TABLE IF NOT EXISTS` on module import** — schema lives in
  `db/index.ts`, ready before first render with no migration system (deferred, per [[db-sqlite-for-now]]).
- **Store mirrors `authStore`**: Zustand, in-memory `pets[]` list as the render source of
  truth; actions call `db/pets` then re-`set` the list. No persistence middleware — SQLite *is*
  the persistence.
- **One `PetFormScreen` for Add + Edit**, mode chosen by a `petId?` route param. Avoids two
  near-identical screens.
- **Species as stable enum key**, rendered Farsi via `pets.species.*` i18n keys; timestamps
  stored UTC ISO, displayed Jalali (`date-fns-jalali`, ADR-0010). Per [[reminders-tehran-time]] /
  ADR-0010 conventions.
- **Photo:** copied into `documentDirectory` on save; DB stores the path. Delete (row or photo
  swap) removes the old file. No camera/crop (out of scope).

## Open Question — App.tsx gate (confirm before Task 4)

Spec decision 3 says gate first render on DB init alongside `hasHydrated`/`fontsLoaded`.
But `openDatabaseSync` + `CREATE TABLE` run **synchronously at import** — they finish before
`App` renders, so there is nothing async to await. **Recommendation:** import `db/index.ts`
for side effects in `App.tsx` (like `./src/i18n`) and add **no** new gate flag. Add a gate
only if we later move DB open off the import path. Flagging because "touch App.tsx render
gating" is an **Ask-first** boundary in the spec.

## Dependency Graph

```
Task 1  deps + types + i18n + ADR-0015        (foundation, no behavior)
   │
   ├── Task 2  db/index.ts + db/pets.ts        (schema + typed CRUD)
   │       │
   │       ├── Task 3  lib/petPhoto.ts          (pick / copy / delete file)
   │       │       │
   │       │       └── Task 4  store/petsStore.ts (wraps db + petPhoto)  +  App.tsx import
   │       │               │
   │       │               ├── Task 5  PetsStack + RootNavigator tab + PetsListScreen
   │       │               ├── Task 6  PetFormScreen (Add + Edit)
   │       │               └── Task 7  PetDetailScreen (+ delete confirm)
```

Bottom-up: data layer → file layer → store → navigation shell + list → form → detail.

---

## Task List

### Phase 1: Foundation

## Task 1: Add deps, TS types, i18n keys, ADR-0015

**Description:** Install the four approved deps at SDK 56 pins, add the `Pet`/`Species`/`Gender`
types, add all new Farsi strings, and write ADR-0015. No components yet.

**Acceptance criteria:**
- [ ] `expo-sqlite`, `expo-image-picker`, `expo-file-system`, `expo-crypto` in `package.json` at
      versions from the v56.0.0 docs (not memory).
- [ ] `tab.pets`, `pets.empty`, `pets.add`, `pets.edit`, `pets.delete`, `pets.delete_confirm`,
      `pets.field.name`/`species`/`gender`/`notes`/`photo`, `pets.species.{dog,cat,bird,rabbit,other}`,
      `pets.gender.{male,female}`, `pets.error.name_required`, `pets.error.species_required`
      added to `fa.json`.
- [ ] `docs/adr/0015-mobile-sqlite-local-store.md` written (file already stubbed at repo root).

**Verification:**
- [ ] `npx tsc --noEmit` → 0 errors; `npm test` still green.
- [ ] `npx expo install` used for the deps so pins match SDK 56.

**Dependencies:** None
**Files:** `mobile/package.json`, `mobile/package-lock.json`, `mobile/src/i18n/fa.json`,
`mobile/src/db/pets.ts` (type exports) or a `types.ts`, `docs/adr/0015-mobile-sqlite-local-store.md`
**Scope:** S

---

### Phase 2: Data + file layer

## Task 2: db/index.ts + db/pets.ts (schema + typed CRUD)

**Description:** `db/index.ts` opens the DB with `openDatabaseSync` and runs
`CREATE TABLE IF NOT EXISTS pets (...)` on import. `db/pets.ts` exports synchronous typed CRUD —
`insertPet`, `listPets` (`ORDER BY created_at DESC`), `getPet`, `updatePet`, `deletePet` — with a
`rowToPet` mapper (snake_case row → camelCase `Pet`).

**Acceptance criteria:**
- [ ] Table created with the exact schema in the spec; id = `expo-crypto.randomUUID()`.
- [ ] `insertPet` sets `created_at`/`updated_at` to UTC ISO; `updatePet` advances `updated_at`.
- [ ] `listPets` returns newest-first; `rowToPet` maps null columns to `null`.

**Verification:**
- [ ] Covered by Task 4 store tests (driver mocked / in-memory fake).
- [ ] `npx tsc --noEmit` → 0 errors.

**Dependencies:** Task 1
**Files:** `mobile/src/db/index.ts`, `mobile/src/db/pets.ts`
**Scope:** M

---

## Task 3: lib/petPhoto.ts (pick / copy / delete)

**Description:** Three helpers: `pickPhoto()` (launch `expo-image-picker` gallery, return picked
uri or null), `savePhoto(uri)` (copy into `documentDirectory`, return stored path), `deletePhoto(path)`
(remove file, no-op if missing).

**Acceptance criteria:**
- [ ] `savePhoto` copies into `documentDirectory` and returns the new path (not the cache uri).
- [ ] `deletePhoto` tolerates a missing/null path without throwing.
- [ ] `pickPhoto` returns `null` on user-cancel.

**Verification:**
- [ ] Exercised via Task 4 store tests (image-picker + file-system mocked).
- [ ] `npx tsc --noEmit` → 0 errors.

**Dependencies:** Task 2
**Files:** `mobile/src/lib/petPhoto.ts`
**Scope:** S

---

## Task 4: store/petsStore.ts + App.tsx db import

**Description:** Zustand store mirroring `authStore`: in-memory `pets[]` + `add`/`update`/`remove`/
`refresh` actions that call `db/pets` (and `petPhoto` for file lifecycle), then re-set the list.
Validation (blank/whitespace name, missing species) rejects before any DB write. Add `import './src/db'`
(side effect) to `App.tsx` per the Open Question above — **no new gate flag unless approved**.

**Acceptance criteria:**
- [ ] `add` validates → inserts → list shows it newest-first; blank/whitespace name or missing
      species throws/returns an error key and writes no row.
- [ ] `update` bumps `updatedAt`; swapping a photo deletes the old file.
- [ ] `remove` deletes the row **and** calls `deletePhoto`.

**Verification:**
- [ ] `petsStore.test.ts`: insert→list order, update bumps `updatedAt`, delete removes row +
      calls file delete, validation rejects blank name / missing species. All green.
- [ ] `npx tsc --noEmit` → 0 errors.

**Dependencies:** Task 3
**Files:** `mobile/src/store/petsStore.ts`, `mobile/App.tsx`, `mobile/src/__tests__/petsStore.test.ts`
**Scope:** M

### Checkpoint: After Task 4 (data layer complete)
- [ ] `npm test` green; `npx tsc --noEmit` → 0 errors.
- [ ] App.tsx gate decision confirmed with human (Ask-first boundary).
- [ ] Store CRUD + validation + photo lifecycle proven by tests before any UI is built.

---

### Phase 3: UI slices

## Task 5: PetsStack + RootNavigator tab + PetsListScreen

**Description:** `PetsStack.tsx` (native stack: `PetsList` → `PetDetail` → `PetForm`, mirroring
`ProfileStack` chrome + typed `PetsStackParamList`/`PetsNavigationProp`). Insert a `Pets` tab in
`RootNavigator` between Home and Profile (Farsi label `tab.pets`, Ionicons, theme tokens).
`PetsListScreen`: empty state vs `FlatList` newest-first, each row → `PetDetail`, a header/FAB →
`PetForm` (add mode).

**Acceptance criteria:**
- [ ] Three tabs render in order `[Home, Pets, Profile]`.
- [ ] Empty list shows `pets.empty`; populated list renders rows newest-first.
- [ ] Tapping a row navigates to `PetDetail` with `petId`; add control opens `PetForm` (no param).

**Verification:**
- [ ] `PetsListScreen.test.tsx`: empty state vs populated list (store mocked). Green.
- [ ] `npx tsc --noEmit` → 0 errors; tab bar shows 3 tabs (manual at final checkpoint).

**Dependencies:** Task 4
**Files:** `mobile/src/navigation/PetsStack.tsx`, `mobile/src/navigation/RootNavigator.tsx`,
`mobile/src/screens/pets/PetsListScreen.tsx`, `mobile/src/__tests__/PetsListScreen.test.tsx`
**Scope:** M

---

## Task 6: PetFormScreen (Add + Edit)

**Description:** One form for both modes (mode from `petId?` param). Fields: Name (`TextField`),
Species (required picker over the 5 enum keys), Gender (optional), Photo (pick via `petPhoto`),
Notes. Required-field validation surfaces translated errors; submit guarded by a `useRef` in-flight
ref; on success calls `add`/`update` then `goBack`. `start`/`end` RTL styles, theme tokens.

**Acceptance criteria:**
- [ ] Add mode: empty form; Edit mode: pre-filled from `getPet(petId)`.
- [ ] Blank/whitespace Name or unselected Species blocks save with `pets.error.*`; no DB write.
- [ ] Duplicate submit blocked by in-flight ref; photo pick stores path via `petPhoto`.

**Verification:**
- [ ] `PetFormScreen.test.tsx`: required-field validation blocks save; in-flight guard. Green.
- [ ] `npx tsc --noEmit` → 0 errors.

**Dependencies:** Task 5
**Files:** `mobile/src/screens/pets/PetFormScreen.tsx`, `mobile/src/__tests__/PetFormScreen.test.tsx`
**Scope:** M

---

## Task 7: PetDetailScreen (+ delete confirm)

**Description:** Detail screen showing all fields (species/gender via i18n, dates Jalali, photo if
present) with Edit (→ `PetForm` with `petId`) and Delete actions. Delete shows a confirm
(`Alert.alert` / `pets.delete_confirm`), then `remove(petId)` (hard-deletes row + photo) and
`goBack`.

**Acceptance criteria:**
- [ ] Renders all fields; species/gender localized; dates Jal*ali*, never Gregorian.
- [ ] Edit navigates to `PetForm` with `petId`; reflects saved changes on return.
- [ ] Delete confirms first, then removes row + photo and returns to the list.

**Verification:**
- [ ] `npx tsc --noEmit` → 0 errors; `npm test` full suite green.
- [ ] Manual: detail → edit → save → values update; delete → confirm → row + photo gone.

**Dependencies:** Task 5 (Task 6 for the Edit round-trip)
**Files:** `mobile/src/screens/pets/PetDetailScreen.tsx`
**Scope:** M

---

### Checkpoint: Complete (after Task 7)
- [ ] `npm test` green; `npx tsc --noEmit` → 0 errors.
- [ ] Manual on a **real build** (`npx expo run:android` — picker needs it): add pet (Name+Species)
      → appears newest-first; detail shows all fields; edit persists + bumps date; delete confirms
      then removes row+photo; **airplane mode** add/list works; **cold restart** keeps all records.
- [ ] All 8 spec success criteria checked.
- [ ] `graphify update .` run; ADR-0015 referenced from `mobile/CLAUDE.md`.
- [ ] Ready for review/commit.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `expo-image-picker` needs a real build, not Metro | Med | Final checkpoint runs `expo run:android`; unit tests mock the picker so dev loop stays green |
| App.tsx gate disagreement (spec says gate, sync import needs none) | Low | Resolved at Task 4 checkpoint before touching `App.tsx`; default = side-effect import, no flag |
| Mocking `expo-sqlite` sync driver in jest | Med | Use an in-memory fake (`getAllSync`/`runSync`) per spec testing strategy; store tested against it |
| Photo file leak (orphaned files on edit/delete) | Med | `remove` + photo-swap path both call `deletePhoto`; asserted in `petsStore.test.ts` |
| SDK 56 dep pins from memory drift | Low | Install via `npx expo install`, never hand-pin |

## Parallelization

Tasks 1→4 are a sequential chain (data foundation). After Task 4, Tasks 5/6/7 share the
`PetsStack` route contract — define `PetsStackParamList` in Task 5 first, then 6 and 7 can proceed
in parallel. Total scope is S/M; not worth splitting across agents.

## Open Questions

1. **App.tsx gate** (see section above) — confirm side-effect import vs explicit gate flag before Task 4.
