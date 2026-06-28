# Implementation Plan: Lively task-done toast

Spec: `docs/specs/10-lively-task-done-toast.md`

## Overview

Replace the stock `react-native-toast-message` "success" toast shown after
marking a task done with a custom, on-brand-but-lively toast: Garden Soft
surface, a paw that springs in (Reanimated), warm pet-aware rotating copy, and
an explicit undo button. Reuse the installed library via its `config` seam — no
new dependency.

## Architecture Decisions

- **Custom toast type, not a bespoke overlay** — register a `taskDone` renderer
  in `<Toast config={...} />`; the library keeps owning queue/timing/dismissal.
- **One new file** `mobile/src/components/toastConfig.tsx` holds both
  `TaskDoneToast` and the `toastConfig` map (small + co-dependent).
- **Garden Soft (#E7F1EB) surface** — a sanctioned tint, so no new color and
  emerald stays the single accent.
- **Motion scoped to the paw only** — container keeps the library's default
  entrance; the spring is one local beat, honoring `useReducedMotion()`.

## Task List

### Phase 1: Strings + component

- [ ] **Task 1: Add cheer phrase + keys to `fa.json`** (XS)
  - **Description:** Add `tasks.done.cheer.0..2` with `{{name}}` interpolation
    (per spec). Leave `tasks.undo.done` / `tasks.undo.action` as-is (fallback +
    undo label).
  - **Acceptance criteria:**
    - [ ] 3 flat `tasks.done.cheer.N` keys exist with the spec's Persian copy.
    - [ ] Keys use `{{name}}` (i18next interpolation), not concatenation.
  - **Verification:** `npx tsc --noEmit` clean; `npm test` still green.
  - **Dependencies:** None
  - **Files:** `mobile/src/i18n/fa.json`
  - **Scope:** XS

- [ ] **Task 2: Build `TaskDoneToast` + `toastConfig`** (S)
  - **Description:** New `mobile/src/components/toastConfig.tsx`. Component
    reads `props.petName` + `props.onUndo`, picks a random cheer phrase
    (fallback to `tasks.undo.done` when no name), renders Garden Soft surface
    (`radius.md`, `shadow.card`), 🐾 paw at reading start, `bodyLg`/`ink` text,
    and a ghost undo `Pressable` (`primary` label, ≥44×44, `accessibilityRole`
    /`accessibilityLabel`) at the end. Export `toastConfig = { taskDone: ... }`.
    Motion/a11y-reduced-motion handled in Task 5 — render paw static for now.
  - **Acceptance criteria:**
    - [ ] Component renders phrase with pet name, undo button calls
      `props.onUndo`.
    - [ ] Uses theme tokens only (no hard-coded colors/spacing, no left/right).
    - [ ] Missing `petName` → «انجام شد».
  - **Verification:** `npx tsc --noEmit` clean.
  - **Dependencies:** Task 1
  - **Files:** `mobile/src/components/toastConfig.tsx`
  - **Scope:** S

### Checkpoint: component compiles

- [ ] `npx tsc --noEmit` clean; component renders in isolation (paw static).

### Phase 2: Wire-up (vertical slice — the toast actually shows)

- [ ] **Task 3: Register config in `App.tsx`** (XS)
  - **Description:** `<Toast config={toastConfig} />` (was bare `<Toast />`),
    import from `./src/components/toastConfig`. Keep it last child.
  - **Acceptance criteria:**
    - [ ] `toastConfig` passed to `<Toast>`; import added.
  - **Verification:** `npx tsc --noEmit` clean; app boots in Metro.
  - **Dependencies:** Task 2
  - **Files:** `mobile/App.tsx`
  - **Scope:** XS

- [ ] **Task 4: Switch `handleCheck` to the new toast** (S)
  - **Description:** In `TasksScreen.tsx`, change `Toast.show` to
    `type: "taskDone"` with `props: { petName: petNameById[task.petId],
    onUndo: () => { unmarkOccurrence(task.id, dueAt); Toast.hide(); } }`,
    `visibilityTime: 4000`. Drop the old `text1/text2/onPress`. Add
    `petNameById` to the `useCallback` dependency array.
  - **Acceptance criteria:**
    - [ ] Marking done shows the new toast with the pet's name.
    - [ ] Undo button reverts the occurrence and hides the toast.
    - [ ] `petNameById` is in the dependency array.
  - **Verification:** `npx tsc --noEmit` clean; manual: mark a pet's task done →
    paw toast names the pet; tap undo → reverts.
  - **Dependencies:** Task 3
  - **Files:** `mobile/src/screens/tasks/TasksScreen.tsx`
  - **Scope:** S

### Checkpoint: end-to-end works

- [ ] Mark done → on-brand toast with pet name; undo works. (Paw still static.)

### Phase 3: Motion + tests + docs

- [ ] **Task 5: Paw spring + reduced-motion** (S)
  - **Description:** Add Reanimated mount spring to the paw (`scale 0.6 → 1`
    overshoot + slight rotation). Gate on `useReducedMotion()` → static when on.
  - **Acceptance criteria:**
    - [ ] Paw springs in on show; static when reduced motion is enabled.
    - [ ] No container-animation changes (library default kept).
  - **Verification:** `npx tsc --noEmit` clean; manual on device: paw pops;
    toggle OS reduce-motion → static.
  - **Dependencies:** Task 4
  - **Files:** `mobile/src/components/toastConfig.tsx`
  - **Scope:** S

- [ ] **Task 6: Tests** (S)
  - **Description:** Update `TasksScreen.test.tsx` §3 to assert
    `type === "taskDone"` and invoke `toastArgs.props.onUndo()` (still expects
    `unmarkOccurrence` + `Toast.hide`). Add a small test for the phrase picker:
    index in range + missing-name fallback to «انجام شد».
  - **Acceptance criteria:**
    - [ ] Updated checkbox test passes against the new shape.
    - [ ] Phrase-picker test covers in-range pick and fallback.
  - **Verification:** `npm test` green.
  - **Dependencies:** Task 4 (test), Task 2 (picker)
  - **Files:** `mobile/src/__tests__/TasksScreen.test.tsx`,
    `mobile/src/__tests__/toastConfig.test.tsx` (new)
  - **Scope:** S

- [ ] **Task 7: ADR + DESIGN.md note** (XS)
  - **Description:** Add `docs/adr/0017-lively-task-done-toast.md` recording the
    deliberate divergence from DESIGN.md's "no bouncy motion / no gamification"
    rule for this single success beat (rationale: one brief state-signaling
    moment, not pervasive choreography). Add a one-line pointer to ADR-0017 in
    `docs/DESIGN.md`.
  - **Acceptance criteria:**
    - [ ] ADR-0017 exists, follows the existing ADR format.
    - [ ] DESIGN.md references ADR-0017 near the motion/Don't rules.
  - **Verification:** Manual read.
  - **Dependencies:** None (do last)
  - **Files:** `docs/adr/0017-lively-task-done-toast.md`, `docs/DESIGN.md`
  - **Scope:** XS

### Checkpoint: complete

- [ ] `npx tsc --noEmit` + `npm test` green; manual flow verified on device;
  ADR + spec + DESIGN.md reconciled. Ready for review.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Function in `Toast.show` `props` doesn't survive the library's state | Med | Verify in Task 4 manual check; if it strips functions, pass IDs via `props` and resolve the closure in the renderer using a ref/registry. |
| Reanimated `entering`/mount spring doesn't fire inside the library's mounted child | Low | Drive the spring with a `useSharedValue` + `useEffect` on mount instead of an `entering` animation. |
| Emoji paw renders inconsistently across Android versions | Low | Acceptable; if poor, swap to an Ionicons `paw-outline` in `primary` (no new dep). |

## Open Questions

- None blocking. Phrase wording can be tuned during Task 1 review.
