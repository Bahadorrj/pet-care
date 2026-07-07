# 10 — Lively task-done toast

**Status:** Accepted · **Date:** 2026-06-28

> Reconciled after build: the paw icon, paw spring motion, and the in-toast undo
> button were dropped during review. The toast is now a passive, on-brand success
> cue — pet-aware copy on a Garden Soft surface with an emerald start-side accent
> stripe. Undo is the row checkbox, not a toast button.
>
> Superseded in part by ADR-0020 — the randomized cheer copy was replaced with
> a neutral `tasks.done.confirm`; component structure, `taskDone` type, and
> success stripe unchanged.

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
its warmth from two on-brand ingredients plus an emerald success accent:

1. **Warmer copy** — rotating, friendly Persian phrases.
2. **Pet-aware** — the phrase names the pet.
3. **Success accent** — an emerald start-side border stripe signals completion.

The toast is a passive cue: no icon, no motion, no in-toast action. The single
divergence from DESIGN.md is the side-stripe accent border (DESIGN.md's
"no side-stripe borders >1px" Don't), recorded in a new ADR (see "Docs").

## Scope

In scope: the **done** toast only (the confirmation shown after marking an
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
┃──────────────────────────────────────────────┐
┃ آفرین! به میلو رسیدی                          │   ← Garden Soft (#E7F1EB) fill
┃──────────────────────────────────────────────┘     emerald accent stripe at start (right)
```

- **Surface:** `colors.primarySoft` (#E7F1EB) fill, `radius.md` (14),
  `shadow.card` (Card Lift) so it genuinely floats. Garden Soft is an
  already-sanctioned success/selected tint, so the warm-but-on-brand look adds
  no new color and keeps emerald as the one voice.
- **Success accent:** a 4px `colors.primary` border on the reading start
  (`borderStartWidth` → right in RTL) — the completion signal.
- **Text:** `typography.bodyLg`, `colors.ink`.
- Horizontal layout follows RTL automatically; no hard-coded left/right.

### Motion

None. The toast keeps the library's default fade/translateY entrance and adds no
animation of its own — consistent with DESIGN.md's "motion signals state, not
choreography".

### Copy — warm + pet-aware

3 rotating phrases in `fa.json`, interpolating `{{name}}`, one picked at random
per show. i18next interpolation works with the flat-key config. Keys:

- `tasks.done.cheer.0` → «آفرین! به ‌{{name}} رسیدی»
- `tasks.done.cheer.1` → «حواست به {{name}} هستا!»
- `tasks.done.cheer.2` → «خیلی خوب از {{name}} مراقبت می کنی»

Fallback to the existing `tasks.undo.done` («انجام شد») when `petName` is
absent. The component owns phrase selection. Because the library reuses one
mounted toast instance across shows, the phrase is memoized on `petName` (not
`[]`) so it doesn't freeze to the first pet shown.

### Data flow

`handleCheck` resolves the pet via `petNameById[task.petId]` and passes only
`petName` through `props`. There is no undo closure — undo is the row checkbox.

```ts
Toast.show({
  type: "taskDone",
  props: { petName: petNameById[task.petId] },
  visibilityTime: 4000,
});
```

`visibilityTime` stays 4000ms. `petNameById` must be in `handleCheck`'s
dependency array.

### Undo

Marking done is reverted by tapping the row's checkbox again (the existing
`unmarkOccurrence` path) — no in-toast button. The toast is informational only.

### Accessibility

- The toast text is the live announcement; the library default live region
  handles it. No interactive elements in the toast.

## Testing

- **Update** `TasksScreen.test.tsx` (§3 checkbox): assert `type === "taskDone"`
  and `props.petName` is the pet's name. (No undo button to exercise.)
- **New** small unit test for the phrase picker: random index stays in range,
  and missing `petName` falls back to «انجام شد».

## Docs

- **New ADR `docs/adr/0017-*.md`** recording the deliberate divergence from
  DESIGN.md's "no side-stripe borders (>1px left/right accent)" rule for the
  task-done success cue, with rationale.
- One-line note in `docs/DESIGN.md` pointing to ADR-0017 so the spec and code
  don't silently diverge.

## Non-goals / YAGNI

- No animation, no paw/icon, no in-toast undo button.
- No new toast types, no theming of error/skip toasts.
- No persisted "last phrase" state — random per show is enough.
