# 11 — "Add a pet first" hint on the Tasks FAB

## Problem

With zero pets there are no tasks, so the Tasks tab always renders its
`windowIsEmpty` branch. Its add FAB navigates to `TaskForm`, where the pet
picker is empty — a dead end the user must back out of. Nothing tells them a
pet must exist before a task can.

## Goal

When the Tasks-tab add FAB is tapped with no pets, hint that a pet must be
added first, and offer a path to do so. With ≥1 pet, the FAB behaves exactly
as today.

## Behavior

- **Zero pets:** FAB tap shows a transient toast — «ابتدا یک حیوان اضافه کنید».
  Tapping the toast navigates to the **Pets tab**, whose own empty state
  already invites adding a pet.
- **≥1 pet:** FAB tap navigates to `TaskForm` (unchanged).

A single `handleAdd` callback holds this rule. Both FABs (the `windowIsEmpty`
branch and the main-list branch) route through it. In practice only the
empty-branch FAB can be tapped with zero pets, but sharing the handler keeps
the rule in one place and keeps the main-list FAB correct if pets ever exist
without tasks.

```
handleAdd():
  pets.length === 0 → Toast.show({ type: "hint", onPress: → parent.navigate("Pets") })
  else              → navigation.navigate("TaskForm", {})
```

Cross-tab navigation uses `navigation.getParent()?.navigate("Pets")` — the
Tasks stack's parent is the root tab navigator.

## Toast styling — new `hint` type

The existing `taskDone` toast is emerald/success-styled; reusing it here would
break the One Voice Rule (emerald = success/primary only). Add a second,
neutral toast type in `toastConfig.tsx`:

- White Surface background, Border Gentle outline, Warm Ink text. No emerald.
- Single line of hint text (no CTA affordance line). The whole toast is
  tappable via `Toast.show`'s `onPress`.

## i18n

New flat key in `fa.json`:

- `tasks.no_pets_hint` → «ابتدا یک حیوان اضافه کنید»

## Out of scope

The `windowIsEmpty` caption still reads «امروز کاری برای انجام ندارید» even at
true first-run with no pets. Tailoring that copy is deliberately left out of
this change.

## Test

One test in `TasksScreen.test.tsx`:

- Empty pets store → press `tasks-fab` → assert `Toast.show` called with the
  `hint` type, and `navigation.navigate("TaskForm")` **not** called.
- One pet present → press `tasks-fab` → assert `navigation.navigate("TaskForm")`
  called.
