# Spec: Pets Multi-Select & Delete

## Objective

Let a user delete multiple pets at once from the Pets tab grid, using the same
interaction language as a phone's photo gallery: long-press a card to enter
selection mode, tap cards to toggle selection, then delete the batch.

**Already exists:** single-pet delete on `PetDetailScreen` (`Alert.alert`
confirm → `usePetsStore().remove(id)`, which cleans up the pet's tasks and
photo file). The gap is a **batch** path reachable from the grid itself,
without drilling into each pet's detail screen.

**User:** anyone with 2+ pets who wants to remove several at once (e.g.
cleaning up test/duplicate entries) instead of repeating single-delete N times.

**Success looks like:** long-press a card in `PetsListScreen` → grid enters
selection mode (checkmark overlays, top toolbar replaces the FAB) → tap to
toggle more cards, or select-all → tap trash → one native confirm dialog →
selected pets (+ their tasks, task logs, photo files) are gone and the grid
re-renders once.

## Tech Stack

Mobile only (Expo SDK 56, React Native, TypeScript, Zustand). No backend
change — pets are local SQLite (ADR-0015). No new dependencies; reuse
`expo-haptics` (already used in `TasksScreen`) and `react-native`'s
`BackHandler`.

## Commands

```bash
cd mobile
npx jest src/__tests__/PetsListScreen.test.tsx   # affected test file
npx jest src/__tests__/petsStore.test.ts          # store test file (new)
npm test                                          # full jest suite
npx tsc --noEmit                                  # typecheck gate (must be 0 errors)
```

## Project Structure

```
mobile/src/screens/pets/PetsListScreen.tsx   → selection state, toolbar, card checkmark overlay
mobile/src/store/petsStore.ts                → new removeMany(ids) action
mobile/src/i18n/fa.json                       → selection-mode + batch-delete strings
mobile/src/__tests__/PetsListScreen.test.tsx  → selection mode + delete flow tests
mobile/src/__tests__/petsStore.test.ts        → removeMany tests (if file doesn't exist, create it)
```

No new files beyond tests. No new navigation routes, no new components file
— the toolbar and checkmark overlay are inline JSX in `PetsListScreen.tsx`,
consistent with the rest of that screen.

## Code Style

Selection state lives as local component state in `PetsListScreen` (not a
store) — it's ephemeral UI state scoped to one screen, not shared or
persisted.

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const selectionMode = selectedIds.size > 0 || selectionModeOverride;
// selectionModeOverride: true right after "select all" from zero, or set
// explicitly so an empty selection doesn't silently fall out of the mode —
// see Decisions below (deselect-to-zero stays in selection mode).
```

Card long-press enters the mode; tap behavior branches on whether the mode is
active:

```tsx
<Pressable
  onPress={() => {
    if (selectionMode) toggleSelected(item.id);
    else navigation.navigate("PetDetail", { petId: item.id });
  }}
  onLongPress={() => {
    if (selectionMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedIds(new Set([item.id]));
  }}
  accessibilityState={{ selected: selectedIds.has(item.id) }}
>
  {/* existing card content */}
  {selectionMode && (
    <View style={styles.checkOverlay}>
      <Ionicons
        name={selectedIds.has(item.id) ? "checkmark-circle" : "ellipse-outline"}
        size={24}
        color={selectedIds.has(item.id) ? colors.primary : "#FFFFFF"}
      />
    </View>
  )}
</Pressable>
```

Toolbar replaces the FAB while `selectionMode` is true (mirrors an Android
contextual action bar):

```tsx
{selectionMode ? (
  <View style={styles.selectionBar}>
    <Pressable onPress={exitSelection} accessibilityLabel={t("common.cancel")}>
      <Ionicons name="close" size={24} color={colors.ink} />
    </Pressable>
    <Text style={styles.selectionCount}>
      {t("pets.select_mode.selected_count", { count: selectedIds.size })}
    </Text>
    <Pressable onPress={toggleSelectAll} accessibilityLabel={t("pets.select_mode.select_all")}>
      <Ionicons name={allSelected ? "checkbox" : "checkbox-outline"} size={22} color={colors.ink} />
    </Pressable>
    <Pressable
      onPress={confirmDelete}
      disabled={selectedIds.size === 0}
      accessibilityLabel={t("pets.delete")}
    >
      <Ionicons name="trash" size={22} color={selectedIds.size === 0 ? colors.inkFaint : colors.danger} />
    </Pressable>
  </View>
) : (
  <Pressable style={styles.fab} /* existing add-pet FAB, unchanged */>...</Pressable>
)}
```

Android hardware back exits selection mode instead of leaving the tab, while
active:

```tsx
useEffect(() => {
  if (!selectionMode) return;
  const sub = BackHandler.addEventListener("hardwareBackPress", () => {
    exitSelection();
    return true; // handled — don't propagate to default back behavior
  });
  return () => sub.remove();
}, [selectionMode]);
```

`petsStore.ts` gets one new action, mirroring `remove` but with a single
`set()` at the end instead of one per pet:

```ts
removeMany: async (ids: string[]) => {
  for (const id of ids) {
    const p = getPet(id);
    deleteTasksForPet(id);
    deletePet(id);
    if (p?.photoUri) await deletePhoto(p.photoUri);
  }
  set({ pets: listPets() });
},
```

## Testing Strategy

jest-expo + @testing-library/react-native, in `src/__tests__/`, matching
existing `PetsListScreen`-adjacent test conventions (mock `usePetsStore`,
`useTasksStore`, navigation, i18n).

`PetsListScreen.test.tsx` covers:
- Long-press a card → enters selection mode, that card shows checked.
- Tap another card while in selection mode → toggles it (does not navigate).
- Tap a card while **not** in selection mode → navigates to `PetDetail`
  (no regression).
- Deselecting the only selected card → selection mode stays active with 0
  selected (per Decisions), trash icon disabled.
- Tap select-all → all cards checked; tap again → all unchecked (stays in
  selection mode).
- Tap trash with N selected → `Alert.alert` fires with a destructive button;
  invoking it calls `removeMany` with exactly the selected ids.
- Tap cancel (X) → selection mode exits, no store call.
- Android hardware back while in selection mode → exits selection mode,
  screen does not navigate away (mock `BackHandler`).

`petsStore.test.ts` covers `removeMany`:
- Deletes tasks + photo + row for every id passed.
- Calls `listPets()` (re-sync) exactly once regardless of batch size.
- A pet with no photo doesn't throw / doesn't call `deletePhoto`.

## Boundaries

- **Always:** run `tsc --noEmit` + jest before commit; reuse existing
  `Alert.alert` confirm pattern (no new confirmation UI); keep selection
  state local to `PetsListScreen` (no new store/context); swallow haptics
  failures (`.catch(() => {})`) per existing convention.
- **Ask first:** touching `PetDetailScreen`'s existing single-delete flow;
  adding a new dependency; changing the FAB's existing add-pet behavior;
  adding undo/soft-delete for pets.
- **Never:** materialize selection state to storage; add a backend endpoint
  (pets are local-only, ADR-0015); silently drop the tasks/photo cleanup that
  `remove`/`removeMany` perform.

## Success Criteria

1. Long-press any pet card → selection mode activates, that card is checked,
   FAB is replaced by the selection toolbar.
2. Tapping other cards toggles their checked state; tapping a card while
   **not** selecting still navigates to `PetDetail` — no regression.
3. Select-all checks every visible pet; tapping again unchecks all, staying
   in selection mode.
4. Trash icon is disabled when 0 selected, enabled otherwise; tapping it
   shows one `Alert.alert` confirm naming the count.
5. Confirming delete removes exactly the selected pets (+ their tasks/logs/
   photo files) in one batch, grid re-renders once, selection mode exits.
6. Cancel (X) or Android hardware back exits selection mode without deleting
   anything.
7. `npx tsc --noEmit` = 0 errors; jest suite green.

## Decisions (resolved)

- **Toolbar placement:** top bar replaces the FAB while selecting (not a
  bottom bar) — closest to the Android CAB / gallery pattern.
- **Select-all:** included, toggles all/none.
- **Deselect-to-zero:** selection mode does **not** auto-exit when the last
  checked card is unchecked (iOS Photos behavior) — user must tap cancel or
  back to leave. Trash icon just disables at 0.
- **Delete confirmation:** single `Alert.alert`, no undo/soft-delete — matches
  today's single-pet delete exactly, no new undo infrastructure.
- **Scope:** `PetsListScreen` grid only. `PetDetailScreen`'s existing
  single-delete is untouched.
- **Batch delete implementation:** new `removeMany(ids)` store action (one
  `listPets()` re-sync at the end) rather than looping `remove(id)` from the
  screen, to avoid N redundant re-renders/re-syncs.
- **Hardware back:** intercepted while selection mode is active, to feel
  native on Android (ADR-0001, Android-first).

## Open Questions

None — ready for Phase 2 (Plan).
