# 10 — Lively task-done toast

**Status:** Draft · **Date:** 2026-06-28

## Problem

When a task occurrence is marked done in the Tasks tab, the app shows a toast
(`TasksScreen.tsx`, `Toast.show({ type: "success", ... })`) using
`react-native-toast-message`'s **stock** styling — green-and-white, default
slide, system font. `App.tsx` renders a bare `<Toast />` with no custom config.
The result reads as a foreign library widget, not part of the app. It should
feel like it belongs and carry a little warmth and character.

## Decision

Restyle the done toast as a custom toast type rendered through the library's
`config` seam (approach A — reuse the installed `react-native-toast-message`,
no new dependency, no re-implementing queue/timing/dismissal). The toast gets
four "lively" ingredients, deliberately pushing past DESIGN.md's
"no bouncy motion / no gamification" stance for this one success moment:

1. **Motion** — a small Reanimated spring on the paw icon at mount.
2. **Playful icon** — a 🐾 paw instead of the generic green check.
3. **Warmer copy** — rotating, friendly Persian phrases.
4. **Pet-aware** — the phrase names the pet.

This divergence from DESIGN.md is recorded in a new ADR (see "Docs" below).

## Scope

In scope: the **done** toast only (the undo prompt shown after marking an
occurrence done). Out of scope: the skip flow (action sheet, unchanged), error
toasts, and any other toast usage.

## Design

### Files

- **New** `mobile/src/components/toastConfig.tsx` — holds both the
  `TaskDoneToast` presentational component and the exported `toastConfig` map
  (`{ taskDone: (params) => <TaskDoneToast ... /> }`). One file: the two are
  co-dependent and small.
- `mobile/App.tsx` — `<Toast config={toastConfig} />` (was bare `<Toast />`).
- `mobile/src/screens/tasks/TasksScreen.tsx` — `handleCheck` changes the
  `Toast.show` call (see Data flow).
- `mobile/src/i18n/fa.json` — new cheer phrase keys.

### Visual (RTL)

```
┌──────────────────────────────────────────────┐
│ 🐾  آفرین! به میلو رسیدی          لغو   │   ← Garden Soft (#E7F1EB) fill
└──────────────────────────────────────────────┘     emerald paw + text, undo at end
```

- **Surface:** `colors.primarySoft` (#E7F1EB) fill, `radius.md` (14),
  `shadow.card` (Card Lift) so it genuinely floats. Garden Soft is an
  already-sanctioned success/selected tint, so the warm-but-on-brand look adds
  no new color and keeps emerald as the one voice.
- **Paw:** 🐾 emoji, ~22px, at the reading start (right in RTL).
- **Text:** `typography.bodyLg`, `colors.ink`.
- **Undo:** ghost-style `Pressable`, `colors.primary` label
  (`typography.label`), at the end (left in RTL), tap target ≥ 44×44.
- Horizontal layout follows RTL automatically; no hard-coded left/right.

### Motion

- Container: keep the library's default fade/translateY entrance — do not fight
  it.
- **Paw pop:** Reanimated spring on mount — `scale 0.6 → 1` with a small
  overshoot plus a few degrees of rotation. This is the character beat.
- **Reduced motion:** `useReducedMotion()` (Reanimated) → render the paw static
  when enabled, honoring PRODUCT.md's `prefers-reduced-motion` requirement.

### Copy — warm + pet-aware

3–4 rotating phrases in `fa.json`, interpolating `{{name}}`, one picked at
random per show. i18next interpolation works with the flat-key config. Example
keys/values:

- `tasks.done.cheer.0` → «آفرین! به ‌{{name}} رسیدی»
- `tasks.done.cheer.1` → «ایول! کارِ {{name}} انجام شد»
- `tasks.done.cheer.2` → «{{name}} مراقبت شد»

Fallback to the existing `tasks.undo.done` («انجام شد») when `petName` is
absent. Undo label stays `tasks.undo.action` («لغو»). The component owns phrase
selection.

### Data flow

`handleCheck` already resolves the pet via `petNameById[task.petId]`. It passes
`petName` and an `onUndo` closure through `props`; the closure is the existing
undo behavior:

```ts
Toast.show({
  type: "taskDone",
  props: {
    petName: petNameById[task.petId],
    onUndo: () => {
      unmarkOccurrence(task.id, dueAt);
      Toast.hide();
    },
  },
  visibilityTime: 4000,
});
```

`visibilityTime` stays 4000ms. Undo moves from a full-toast `onPress` to the
explicit undo button inside the component. `petNameById` must be added to
`handleCheck`'s dependency array.

### Accessibility

- Undo button: `accessibilityRole="button"`, `accessibilityLabel` =
  `tasks.undo.action`.
- The toast text is the live announcement; no extra live region needed beyond
  the library default.

## Testing

- **Update** `TasksScreen.test.tsx` (§3 checkbox): it currently asserts
  `toastArgs.type === "success"` and calls `toastArgs.onPress()`. After the
  change: assert `type === "taskDone"` and invoke `toastArgs.props.onUndo()`,
  still expecting `unmarkOccurrence` + `Toast.hide`.
- **New** small unit test for the phrase picker: random index stays in range,
  and missing `petName` falls back to «انجام شد».

## Docs

- **New ADR `docs/adr/0017-*.md`** recording the deliberate divergence from
  DESIGN.md's "no bouncy motion / no gamification" rule for the task-done
  success moment, with rationale (a single, brief, state-signaling beat — not
  pervasive choreography).
- One-line note in `docs/DESIGN.md` pointing to ADR-0017 so the spec and code
  don't silently diverge.

## Non-goals / YAGNI

- No animation library beyond the already-installed Reanimated.
- No new toast types, no theming of error/skip toasts.
- No persisted "last phrase" state — random per show is enough.
