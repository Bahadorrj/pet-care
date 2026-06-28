# No-Pets Task FAB Hint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the Tasks-tab add FAB is pressed with zero pets, show a neutral toast hinting that a pet must be added first; tapping the toast jumps to the Pets tab. With ≥1 pet the FAB is unchanged.

**Architecture:** A single `handleAdd` callback in `TasksScreen` branches on `pets.length`. Zero pets → `Toast.show({ type: "hint", onPress → parent.navigate("Pets") })`; otherwise → `navigation.navigate("TaskForm", {})`. A new neutral `hint` toast type is added to `toastConfig.tsx` (the existing `taskDone` toast is emerald/success-styled and cannot be reused without breaking the One Voice Rule).

**Tech Stack:** React Native (Expo SDK 56), TypeScript, react-native-toast-message, react-i18next, jest-expo + @testing-library/react-native.

## Global Constraints

- All user-facing strings live in `src/i18n/fa.json` as **flat** keys (no nesting); reference via `t("flat.key")`.
- Import design tokens from `src/theme/theme.ts` — never hard-code colors/spacing.
- One Voice Rule: emerald (`colors.primary` / `colors.primarySoft`) is reserved for success/primary. This informational hint uses neutral tokens only (`colors.surface`, `colors.border`, `colors.ink`).
- Hint copy is single-line, exact: `tasks.no_pets_hint` → «ابتدا یک حیوان اضافه کنید».
- Tests live in `src/__tests__/`; `render(...)` returns a Promise — always `await` it.
- Typecheck must stay at 0 errors: `npx tsc --noEmit`.

---

### Task 1: Add the `hint` toast type and i18n key

**Files:**
- Modify: `mobile/src/i18n/fa.json` (add one key near the other `tasks.*` keys)
- Modify: `mobile/src/components/toastConfig.tsx`

**Interfaces:**
- Produces: a toast config entry keyed `"hint"` that renders `text1` in a neutral surface. Consumers call `Toast.show({ type: "hint", text1, onPress })`.

- [ ] **Step 1: Add the i18n key**

In `mobile/src/i18n/fa.json`, add alongside the existing `tasks.add` line (`"tasks.add": "افزودن کار",`):

```json
  "tasks.no_pets_hint": "ابتدا یک حیوان اضافه کنید",
```

- [ ] **Step 2: Add the neutral `HintToast` component and register it**

In `mobile/src/components/toastConfig.tsx`, add the component above the `toastConfig` export:

```tsx
function HintToast({ text1 }: ToastConfigParams<unknown>) {
  return (
    <View style={hintStyles.container}>
      <Text style={hintStyles.text} numberOfLines={2}>
        {text1}
      </Text>
    </View>
  );
}
```

Then extend the export to register it:

```tsx
export const toastConfig: ToastConfig = {
  taskDone: (params) => <TaskDoneToast {...params} />,
  hint: (params) => <HintToast {...params} />,
};
```

- [ ] **Step 3: Add the neutral styles**

Append a second `StyleSheet.create` block at the end of `toastConfig.tsx` (keep the existing `styles` untouched):

```tsx
const hintStyles = StyleSheet.create({
  container: {
    width: "92%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    // Neutral, not emerald: White Surface + Border Gentle (One Voice Rule).
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  text: {
    ...typography.body,
    color: colors.ink,
  },
});
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/i18n/fa.json mobile/src/components/toastConfig.tsx
git commit -m "feat(tasks): neutral hint toast type + no-pets hint string"
```

---

### Task 2: Gate the Tasks FAB on pet count

**Files:**
- Modify: `mobile/src/screens/tasks/TasksScreen.tsx`
- Test: `mobile/src/__tests__/TasksScreen.test.tsx`

**Interfaces:**
- Consumes: `pets` (already selected at the top of `TasksScreen` via `usePetsStore`), `Toast.show` (already imported), `navigation` (`TasksNavigationProp`), `t`.
- Produces: a `handleAdd` callback wired to both FABs' `onPress`.

- [ ] **Step 1: Extend the navigation mock with `getParent` (test setup)**

In `mobile/src/__tests__/TasksScreen.test.tsx`, add a parent-navigate mock next to `const mockNavigate = jest.fn();` (line ~59):

```tsx
const mockParentNavigate = jest.fn();
```

Update the `useNavigation` mock (line ~69) to expose `getParent`:

```tsx
    useNavigation: () => ({
      navigate: mockNavigate,
      getParent: () => ({ navigate: mockParentNavigate }),
    }),
```

Add to `beforeEach` (alongside `mockNavigate.mockClear();`, line ~131):

```tsx
  mockParentNavigate.mockClear();
```

- [ ] **Step 2: Write the failing tests**

In the `describe("TasksScreen – FAB", ...)` block (line ~678), add two tests:

```tsx
  test("pressing fab with no pets shows the hint toast and does NOT open TaskForm", async () => {
    mockPets = [];
    mockWindowOccurrences = [];
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-fab"));

    expect(Toast.show).toHaveBeenCalledTimes(1);
    const args = (Toast.show as jest.Mock).mock.calls[0][0];
    expect(args.type).toBe("hint");
    expect(mockNavigate).not.toHaveBeenCalledWith("TaskForm", {});
  });

  test("tapping the no-pets hint toast navigates to the Pets tab", async () => {
    mockPets = [];
    mockWindowOccurrences = [];
    const { getByTestId } = await render(<TasksScreen />);

    fireEvent.press(getByTestId("tasks-fab"));
    const args = (Toast.show as jest.Mock).mock.calls[0][0];
    args.onPress();

    expect(mockParentNavigate).toHaveBeenCalledWith("Pets");
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd mobile && npx jest src/__tests__/TasksScreen.test.tsx -t "no pets"`
Expected: FAIL — the FAB currently calls `navigate("TaskForm", {})` regardless of pet count, so `Toast.show` is not called and `type` is undefined.

- [ ] **Step 4: Add the `handleAdd` callback**

In `mobile/src/screens/tasks/TasksScreen.tsx`, add this **before** the `windowIsEmpty` early return — place it right after `handleMore` (ends ~line 387), so it exists for both FABs:

```tsx
  // Adding a task needs a pet. With none, hint instead of dead-ending in an
  // empty TaskForm picker; tapping the toast jumps to the Pets tab.
  const handleAdd = React.useCallback(() => {
    if (pets.length === 0) {
      Toast.show({
        type: "hint",
        text1: t("tasks.no_pets_hint"),
        onPress: () => {
          Toast.hide();
          navigation.getParent()?.navigate("Pets");
        },
      });
      return;
    }
    navigation.navigate("TaskForm", {});
  }, [pets.length, navigation, t]);
```

- [ ] **Step 5: Wire both FABs to `handleAdd`**

Replace the empty-branch FAB `onPress` (line ~455):

```tsx
          onPress={() => navigation.navigate("TaskForm", {})}
```

with:

```tsx
          onPress={handleAdd}
```

Replace the main-list FAB `onPress` (line ~595) identically:

```tsx
        onPress={handleAdd}
```

- [ ] **Step 6: Run the new tests to verify they pass**

Run: `cd mobile && npx jest src/__tests__/TasksScreen.test.tsx -t "no pets"`
Expected: PASS (both).

- [ ] **Step 7: Run the full TasksScreen suite (no regressions)**

Run: `cd mobile && npx jest src/__tests__/TasksScreen.test.tsx`
Expected: PASS. The pre-existing empty-state FAB test stays green because `beforeEach` resets `mockPets` to `[{ id: "pet-1", ... }]`, so that case still navigates to `TaskForm`.

- [ ] **Step 8: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/screens/tasks/TasksScreen.tsx mobile/src/__tests__/TasksScreen.test.tsx
git commit -m "feat(tasks): hint to add a pet first when the FAB is tapped with no pets"
```

---

## Self-Review

**Spec coverage:**
- Zero-pets toast hint → Task 2 (`handleAdd`) + Task 1 (string). ✓
- Tap toast → Pets tab → Task 2 `onPress` + getParent. ✓
- ≥1 pet unchanged → Task 2 `else` branch + regression test (Step 7). ✓
- Neutral `hint` toast type (One Voice Rule) → Task 1. ✓
- `tasks.no_pets_hint` key → Task 1 Step 1. ✓
- Out-of-scope caption left untouched → no task touches the empty caption. ✓

**Placeholder scan:** none — all code shown in full.

**Type consistency:** `handleAdd` referenced in Steps 5/6 matches its definition in Step 4; `mockParentNavigate` defined in Step 1 and asserted in Step 2; toast `type: "hint"` matches the `toastConfig` key registered in Task 1 Step 2.
