# Spec: Unified Task-Add Route

## Objective

Today a task can be created from **two** places: the Tasks-tab FAB (opens the
lightweight `QuickAddScreen` sheet, which itself links into the full
`TaskFormScreen`) and the pet-detail page's "افزودن کار" button. Two competing
flows is non-atomic and confusing.

**Goal:** one creation route. The Tasks-tab FAB opens the full `TaskFormScreen`,
which gains a **multi-select pet picker** at the top. Selecting N pets creates N
independent tasks. Pet-detail loses its add button (keeps its task list).

**Success looks like:** a user creates a task only one way; a multi-pet household
can apply one task to several pets in a single submit.

## Tech Stack

Existing only — Expo SDK 56 / React Native / TypeScript / Zustand. No new deps.
`addTask(input)` (single `petId`) and the `tasks` table stay as-is.

## Commands

```bash
cd mobile
npx tsc --noEmit                              # gate: 0 errors
npm test                                      # jest
npx jest src/__tests__/TaskFormScreen.test.tsx
```

## Project Structure (touched files)

```
mobile/src/screens/tasks/TaskFormScreen.tsx   → add pet picker (add mode), read-only name (edit)
mobile/src/screens/tasks/QuickAddScreen.tsx   → DELETE
mobile/src/screens/tasks/TasksScreen.tsx      → FAB → TaskForm (2 callsites)
mobile/src/screens/pets/PetDetailScreen.tsx   → remove add-task button (keep list)
mobile/src/navigation/TasksStack.tsx          → drop QuickAdd screen + param; petId optional
mobile/src/navigation/PetsStack.tsx           → petId optional on TaskForm param
mobile/src/i18n/fa.json                        → +tasks.field.pet, +tasks.error.pet_required, −tasks.quick.*
mobile/src/__tests__/QuickAddScreen.test.tsx   → DELETE
mobile/src/__tests__/{TaskFormScreen,TasksScreen,PetDetailScreen}.test.tsx → update
```

## Behaviour

### Add mode (`taskId` absent)
- Pet picker is the **first** field: multi-select chips (reuse `styles.chip` /
  `chipSelected`), one per pet from `usePetsStore`.
- Default: if exactly one pet, pre-select it. Require **≥1** selected — else
  `tasks.error.pet_required`.
- On submit: build the one `input` (type/title/schedule/end) once, then
  **loop selected pet ids**, `await addTask({ ...input, petId })` per pet. On any
  throw, surface the existing schedule/generic error; no partial rollback.

### Edit mode (`taskId` present)
- **No picker.** Show the owning pet's name as read-only text (look up
  `existing.petId` in `usePetsStore`). Editing touches only that one task.

### Param change
- `TaskForm` param `petId` becomes **optional** in both stacks:
  `{ petId?: string; taskId?: string; title?: string }`.
- FAB (`TasksScreen`, both callsites) → `navigate('TaskForm')` with no params.
- Pet-detail task-row tap (`navigate('TaskForm', { petId, taskId })`) unchanged.

## Code Style

Match `TaskFormScreen` patterns already in file: chip rows, `useRef` in-flight
guard, translated inline errors, theme tokens, `Start`/`End` RTL styles. Picker
state mirrors `weekdays` multi-select:

```ts
const pets = usePetsStore(useShallow((s) => s.pets));
const [petIds, setPetIds] = useState<string[]>(
  !isEdit && pets.length === 1 ? [pets[0].id] : [],
);
const togglePet = (id: string) =>
  setPetIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
```

## Testing Strategy

jest-expo + @testing-library/react-native, tests in `src/__tests__/`.
- `TaskFormScreen.test`: add — multi-select 2 pets → `addTask` called twice with
  distinct `petId`, same payload; empty selection → `pet_required` error, no
  `addTask`; edit — picker absent, pet name rendered.
- `TasksScreen.test`: FAB navigates to `TaskForm` (not `QuickAdd`).
- `PetDetailScreen.test`: no `petdetail-add-task`; task list still renders.
- Delete `QuickAddScreen.test`.

## Boundaries

- **Always:** `tsc --noEmit` 0 errors + `npm test` green before done; reuse
  existing chip styles and `addTask`.
- **Ask first:** any change to `addTask` / `tasks` schema; any new dependency.
- **Never:** introduce a task-group/link model; bulk-edit; backend changes;
  remove the pet-detail task list.

## Success Criteria

- [ ] `QuickAddScreen.tsx` + its route/param + its test are gone.
- [ ] FAB opens full `TaskForm` in add mode (both callsites).
- [ ] Add mode shows multi-select pet picker on top; ≥1 required; sole pet
      pre-selected.
- [ ] Submitting with N pets creates N independent tasks (N `addTask` calls).
- [ ] Edit mode shows pet name read-only, no picker.
- [ ] Pet-detail page has no add button but still lists the pet's tasks.
- [ ] `tasks.quick.*` keys removed; `tasks.field.pet` + `tasks.error.pet_required` added.
- [ ] `tsc --noEmit` clean, `npm test` green.

## Out of Scope

Linked/grouped tasks, edit-reassigns-pet, bulk edit, new schedule features,
backend/API changes.

## Open Questions

None — intent confirmed via interview (2026-06-25).
