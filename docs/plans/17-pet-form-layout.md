# Plan 17 — Pet Form layout

Implements `docs/specs/17-pet-form-layout.md` in full. Mobile-only. No backend,
no new dependencies, no ADR.

## Overview

Restructure `PetFormScreen` from a flat scroll of seven field groups into
app bar → avatar → one titled card, and mark the mandatory fields. The data
layer must not notice: `petsStore`, `db/pets.ts`, and the `Pet` type are
untouched, and the entire existing `PetFormScreen.test.tsx` suite must pass
**unmodified** at every checkpoint. That constraint is what turns "layout
change" from a claim into something the test runner enforces.

## Architecture decisions

- **No new `components/ui/` primitive.** The app bar, avatar, and `Label` each
  have exactly one call site. `Label` is a local function component inside
  `PetFormScreen.tsx`, not an export.
- **`petform-photo` testID is reused, not retired.** It moves from the old
  «عکس» `Button` onto the avatar's floating edit button. The picker contract
  (`pickPhoto()` → `setPhotoUri`) is unchanged, so the existing `mockPickPhoto`
  wiring keeps working. Nothing else in the suite references the photo group.
- **`fa.json` gets all five keys in one task.** It is the only file shared with
  the in-flight `16-quiet-playfulness` worktree; touching it once instead of
  four times shrinks the merge surface to a single hunk.
- **Task order is structural-first, cosmetic-last.** The app bar is the only
  task that touches a second file (`PetsStack.tsx`) and the only one that can
  break navigation, so it goes early — fail fast, on the riskiest thing.
- **Tasks 4 and 5 are split despite sharing a file.** They are independently
  revertible: the card is a container change, the asterisks are a label change.
  Splitting keeps each diff readable and each acceptance criterion falsifiable.

## Findings from reading the code

1. **`PetsListScreen` already imports `SPECIES_ICON`** (line 31, used at line
   156). It renders the species glyph as a *row accent*, not as a photo
   fallback. Plan 16's Task 10 (ADR-0023) is therefore about the **thumbnail**,
   which is a different element. This confirms spec 17's recorded divergence:
   the camera glyph in the form conflicts with nothing that exists today.

2. **`PetsListScreen` uses `edges={["top"]}`, PetForm uses `edges={["bottom"]}`.**
   With the native header hidden, PetForm needs both. `edges={["top","bottom"]}`
   is additive to current behaviour, not a change to it.

3. **The test suite never asserts on a field *label*** — only on `testID`s and
   on error strings via `i18n.t`. Adding a nested `<Text> *</Text>` inside a
   label therefore cannot break an existing assertion. `getByText` is used only
   for the four `pets.error.*` messages.

4. **`Button` takes `label`, not children**, and has `primary | secondary |
   ghost` variants. The avatar's floating edit button is a `Pressable` with an
   icon, not a `Button` — `Button` has no icon-only mode and adding one would
   be a primitive change nobody asked for.

## Dependency graph

```
Task 1 (i18n keys) ──┬──→ Task 2 (app bar + PetsStack)  ──┐
                     │                                     ├─→ Checkpoint A
                     └──→ Task 4 (card + heading)          │
                                                           │
Task 3 (avatar section) ───────────────────────────────────┤
                                                           │
Task 5 (required asterisks) ───────────────────────────────┴─→ Checkpoint B
```

Task 1 is a true prerequisite: tasks 2 and 4 render keys it creates. Tasks 3 and
5 depend only on Task 1's absence of conflict, not on its content — but every
task after 1 edits `PetFormScreen.tsx`, so they run **sequentially**. Nothing
here parallelizes; the whole plan is one screen and under two hours.

---

## Phase 1 — Structure

### Task 1: Add the five i18n keys
**Spec:** New i18n Keys

Add `pets.form.title_add`, `pets.form.title_edit`, `pets.form.back`,
`pets.form.photo_edit`, `pets.form.section_basic` to `fa.json`. No code reads
them yet.

**Acceptance criteria**
- [ ] All five keys exist with the exact strings from the spec.
- [ ] `pets.add` / `pets.edit` are **unchanged** — they remain the submit labels.
- [ ] Keys sit adjacent to the existing `pets.*` block (one contiguous hunk, to
      keep the worktree merge to a single conflict region).

**Verification**
- [ ] `node -e "JSON.parse(require('fs').readFileSync('src/i18n/fa.json'))"` — valid JSON.
- [ ] `npm test` green (nothing reads the keys yet; this proves no key collision).

**Dependencies:** None · **Scope:** XS (1 file)
**Files:** `mobile/src/i18n/fa.json`

---

### Task 2: Custom top app bar; hide the native header
**Spec:** Target layout → Top App Bar; Behaviour Decisions → App bar

`PetForm` gets `headerShown: false`. The screen renders its own bar: a back
`Pressable` (`chevron-right`, RTL) plus the mode-dependent title. SafeArea
`edges` becomes `["top","bottom"]`.

**Acceptance criteria**
- [ ] `PetsStack.tsx`: `PetForm` screen gains `options={{ headerShown: false }}`.
      No other screen's options change.
- [ ] App bar renders `pets.form.title_add` in Add mode, `pets.form.title_edit`
      in Edit mode.
- [ ] Back button has `testID="petform-back"`, `accessibilityRole="button"`,
      `accessibilityLabel={t("pets.form.back")}`, ≥44pt target, and calls
      `navigation.goBack()`.
- [ ] `SafeAreaView edges={["top","bottom"]}`.

**Verification**
- [ ] New test: Add mode renders `i18n.t("pets.form.title_add")`; Edit mode
      (with `mockRouteParams = { petId }`) renders `i18n.t("pets.form.title_edit")`.
- [ ] New test: pressing `petform-back` calls `mockGoBack` once.
- [ ] **All 11 pre-existing tests pass unmodified.**
- [ ] `npx tsc --noEmit` = 0.
- [ ] Manual: the Android back gesture still pops the screen.

**Dependencies:** Task 1 · **Scope:** S (2 files + test)
**Files:** `mobile/src/screens/pets/PetFormScreen.tsx`,
`mobile/src/navigation/PetsStack.tsx`, `mobile/src/__tests__/PetFormScreen.test.tsx`

---

### Task 3: Avatar section replaces the «عکس» field group
**Spec:** Target layout → Pet Avatar Section; Behaviour Decisions → Empty avatar

A 96px `radius.pill` circle between the app bar and the ScrollView. Shows
`photoUri` when set, else a `camera-outline` glyph in `colors.inkFaint` on
`colors.surfaceSunken`. A floating edit button overlaps its bottom-`end` corner.
Both the circle and the button call `pickPhoto()`. The old «عکس» `Button` +
`petform-photo-preview` `Image` are deleted.

**Acceptance criteria**
- [ ] The floating edit button carries `testID="petform-photo"` and calls
      `pickPhoto()`; a picked URI renders in the circle.
- [ ] The circle itself is pressable and calls the same handler.
- [ ] No «عکس» label, `Button`, or standalone preview `Image` remains.
- [ ] Positioned with `start`/`end`, never `left`/`right`.
- [ ] Camera glyph does **not** react to the species chips (spec's recorded
      divergence from plan 16 Task 10).

**Acceptance criteria — a11y**
- [ ] Both targets ≥44pt; edit button `accessibilityLabel={t("pets.form.photo_edit")}`.

**Verification**
- [ ] New test: no photo → camera glyph present, `petform-photo-preview` absent.
- [ ] New test: pressing `petform-photo` calls `mockPickPhoto`; resolving it with
      a URI renders the image.
- [ ] New test: Edit mode with `photoUri` set renders the image, not the glyph.
- [ ] **All pre-existing tests pass unmodified.**
- [ ] `npx tsc --noEmit` = 0.

**Dependencies:** Task 1 · **Scope:** S (1 file + test)
**Files:** `mobile/src/screens/pets/PetFormScreen.tsx`, `mobile/src/__tests__/PetFormScreen.test.tsx`

---

### ✅ Checkpoint A — after Tasks 1–3
- [ ] `npm test` and `npx tsc --noEmit` both green.
- [ ] The 11 pre-existing `PetFormScreen` tests are **byte-identical** to `main`
      (`git diff main -- src/__tests__/PetFormScreen.test.tsx` shows additions only).
- [ ] Manual on device: app bar title correct in both modes; back works; tapping
      the circle and the button both open the picker; picked photo appears.
- [ ] Diff grep: no hex colours, no magic spacing numbers, no `left:`/`right:`.
- [ ] **Human review** — the screen is structurally right before it is styled.

---

## Phase 2 — The card

### Task 4: Wrap the fields in a titled Basic Information card
**Spec:** Target layout → ScrollView; Behaviour Decisions → Card heading

The six field groups move inside one `colors.surface` card (`radius.lg`,
`shadow.card`, `padding: spacing.xl`) headed by `pets.form.section_basic`. The
submit `Button` stays **below** the card, inside the ScrollView.

**Acceptance criteria**
- [ ] Card renders the heading; field order is name, species, breed, gender,
      weight, notes.
- [ ] Submit button is a sibling of the card, not a child — it scrolls with the
      content and sits outside the surface.
- [ ] `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"` behaviour
      is preserved verbatim.
- [ ] Card is a plain `View` in this screen — **not** extracted to
      `components/ui/`. (The medical card in a later spec earns that extraction,
      if it ever does.)

**Verification**
- [ ] New test: `i18n.t("pets.form.section_basic")` is rendered.
- [ ] **All pre-existing tests pass unmodified.**
- [ ] `npx tsc --noEmit` = 0.
- [ ] Manual: focus the notes field on a small screen — the keyboard does not
      cover it, and the submit button is reachable by scrolling.

**Dependencies:** Task 1, Task 2 · **Scope:** S (1 file + test)
**Files:** `mobile/src/screens/pets/PetFormScreen.tsx`, `mobile/src/__tests__/PetFormScreen.test.tsx`

---

### Task 5: Required-field asterisks
**Spec:** Code Style → `Label`; Behaviour Decisions → Required marker

Introduce the local `Label({ text, required })` component and route all six
labels through it. `name` and `species` are always required; `speciesOther` is
required only while `species === "other"`.

**Acceptance criteria**
- [ ] The `*` is a nested `<Text>` carrying `colors.danger`, not a string concat.
- [ ] `اسم` and `گونه` are marked; `نژاد`, `جنسیت`, `وزن`, `یادداشت` are not.
- [ ] `نوع گونه` is marked only when «سایر» is selected (it only renders then).
- [ ] The marker is not announced as text: the label `<Text>` carries an
      explicit `accessibilityLabel={text}`, so a screen reader says «اسم», not
      «اسم ستاره». Required-ness is conveyed on the *input* via `aria-required`
      (RN ≥0.71 maps it to the platform trait).

**Verification**
- [ ] New test: name and species labels match `/\*/`; breed/gender/weight/notes
      labels do not. Label text sourced from `i18n.t("pets.field.*")`, never a
      Persian literal.
- [ ] New test: `نوع گونه` label appears with `*` only after pressing
      `petform-species-other`.
- [ ] **All pre-existing tests pass unmodified.**
- [ ] `npx tsc --noEmit` = 0.

**Dependencies:** Task 1, Task 4 · **Scope:** S (1 file + test)
**Files:** `mobile/src/screens/pets/PetFormScreen.tsx`, `mobile/src/__tests__/PetFormScreen.test.tsx`

---

### ✅ Checkpoint B — Complete
- [ ] All seven spec Success Criteria met, checked one by one.
- [ ] `npm test` + `npx tsc --noEmit` green.
- [ ] `git diff main -- src/db/ src/store/` is **empty** — the data layer never noticed.
- [ ] Pre-existing tests still additions-only.
- [ ] Manual, Add mode: app bar, camera circle, titled card, `اسم *`, `گونه *`,
      submit at the bottom of the scroll.
- [ ] Manual, Edit mode: every field prefilled, photo in the circle, submit updates.
- [ ] Manual: empty name → `pets.error.name_required`, no navigation.
- [ ] Spec 17 marked implemented.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `headerShown: false` loses the Android hardware-back / swipe-back gesture | Med | Task 2 verification includes a manual back-gesture check; the gesture is a stack property, not a header one, so it should survive — but it is checked, not assumed |
| Reusing `petform-photo` on a different element hides a real regression | Med | Task 3 adds explicit assertions for both the glyph and the picked image, so the testID cannot pass vacuously |
| `fa.json` merge conflict with the `16-quiet-playfulness` worktree | Low | Task 1 lands all five keys in one contiguous hunk; keys are disjoint, so resolution is "keep both" |
| Card padding + `TextField` padding compound into a cramped form | Low | Checkpoint A is a human visual review before styling hardens |
| The asterisk is read aloud as part of the field name | Low | Task 5 makes the marker decorative and moves required-ness onto the input's a11y props |

## Open questions

None. The spec's two open questions were closed before this plan was written
(card heading: yes; avatar: 96px).

## Not doing

- No `Card` primitive in `components/ui/` — one call site. Extract when the
  medical card lands and there are two.
- No pinned/sticky submit footer — you chose bottom-of-scroll.
- No species-reactive avatar glyph — see spec 17's divergence note.
- No changes to validation, the submit payload, or navigation targets.
