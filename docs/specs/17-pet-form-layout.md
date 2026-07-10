# 17 — Pet Form layout: app bar, avatar section, basic-information card

**Status:** Draft for review · 2026-07-10
**Scope:** `mobile/src/screens/pets/PetFormScreen.tsx` (+ `PetsStack.tsx`, `fa.json`)
**Amends:** nothing. No ADR required — this is a screen-local layout change, not an
architectural decision. ADR-0018 (swipeable bottom tabs) is untouched; PetForm
already sits inside a native stack and keeps doing so.

## Objective

Restructure the Add/Edit Pet screen from a flat scroll of seven field groups into
three legible regions: a **top app bar**, a **pet avatar section**, and a
**scrollable form** holding a single "Basic Information" card. Mark the mandatory
fields so the user knows what blocks submission before they hit the button.

**User:** someone adding their first pet, or correcting a detail on an existing one.

**Success looks like:** the screen announces what it is (title), shows the pet
before it shows the paperwork (avatar), and groups the inputs into one card
instead of letting them float on the canvas. Nothing about validation, storage,
or navigation behaviour changes.

### Target layout

```
SafeArea (edges: top, bottom)
│
├── Top App Bar
│   ├── Back button (chevron, RTL-aware)
│   └── Title — «افزودن پت» / «ویرایش پت»
│
├── Pet Avatar Section
│   ├── Circular image (photo, or camera glyph when unset)
│   └── Floating edit button (bottom-corner, opens the picker)
│
└── ScrollView
    └── Basic Information card
        ├── «اطلاعات پایه»  ← card heading
        ├── اسم *
        ├── گونه *   (+ نوع گونه * when «سایر»)
        ├── نژاد
        ├── جنسیت
        ├── وزن
        └── یادداشت
    └── Submit button (below the card, scrolls with content)
```

The «عکس» field group is **removed** — the avatar section replaces it as the only
way to pick a photo.

The card carries a visible heading («اطلاعات پایه») even though it is currently
the only card, because a later spec adds a second one for medical information.
A heading that only earns its keep once a sibling exists is still cheaper to add
now than to retrofit into a card users have already learned to read as untitled.

## Interaction with spec 16 (in flight)

Spec 16 is being implemented in the `16-quiet-playfulness` worktree. Checked as of
2026-07-10:

- **No source-file overlap**, now or at plan-16 completion. Plan 16's remaining
  tasks touch `PetsListScreen`, `ChatScreen`, `ConversationListScreen`, and
  `AssistantStack`; this spec touches `PetFormScreen` and `PetsStack`.
- **`fa.json` is shared, keys are disjoint** (`pets.form.*` is unused there).
  A positional merge conflict is possible; resolve by keeping both sides.
- **ADR numbering:** plan 16 claims 0022 and 0023. This spec adds no ADR.

**Deliberate divergence from plan 16 Task 10.** That task (gated behind ADR-0023)
gives photo-less pets a **species glyph** in `PetsListScreen`. This spec gives the
photo-less avatar a **camera glyph**. Both are correct, because the two circles
mean different things: the list row *displays* a pet, so a species glyph is
factual; the form circle is an *input affordance*, so a camera glyph names the
action available. Neither should adopt the other's glyph.

For the same reason, `DESIGN.md`'s "no blank avatar fallback that invents
personality" rule (Pet List Row, Signature) does **not** govern this placeholder —
it is scoped to the list row, and a camera glyph invents no personality. If
ADR-0023 lands and reconciles that DESIGN.md section, it must not be read as
also settling the form's empty state.

## Tech Stack

Mobile only (`mobile/` — Expo SDK 56, React Native, TypeScript). No backend, no
schema, no new dependencies. `@expo/vector-icons` (MaterialCommunityIcons),
`react-native-safe-area-context`, and `expo-image-picker` (via
`src/lib/petPhoto.ts`) are all already installed.

## Commands

```bash
cd mobile
npx tsc --noEmit                              # must be 0 errors
npx jest src/__tests__/PetFormScreen.test.tsx # the screen's suite
npm test                                      # full suite
npx expo run:android                          # visual check
```

## Project Structure

Only these files change:

```
mobile/src/screens/pets/PetFormScreen.tsx  → the rewrite (app bar, avatar, card)
mobile/src/navigation/PetsStack.tsx        → PetForm gets headerShown: false
mobile/src/i18n/fa.json                    → new title + a11y keys
mobile/src/__tests__/PetFormScreen.test.tsx → new assertions for the above
```

No new components. The app bar and avatar live inside `PetFormScreen.tsx` — they
have exactly one call site, and `src/components/ui/` is for primitives with
several.

## Code Style

Tokens from `src/theme/theme.ts`, never literals. Required marker is a themed
`<Text>` span inside the label, not a string concat — the asterisk must be able
to carry `colors.danger` on its own:

```tsx
function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {text}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
  );
}

// styles
label:        { ...typography.label, color: colors.inkMuted },
requiredMark: { color: colors.danger },
card:         {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  padding: spacing.xl,
  gap: spacing.lg,
  ...shadow.card,
},
cardHeading:  { ...typography.bodyLg, color: colors.ink },
```

RTL: the back chevron uses `chevron-right` (the app is `fa` only and
`I18nManager` forces RTL at import), and the floating edit button is positioned
with `start`/`end`, never `left`/`right`.

## Behaviour Decisions

| Decision | Choice |
|---|---|
| Required marker | On the **field label** (`اسم *`), not the placeholder — species is a chip row with no placeholder |
| Which fields are marked | `name`, `species`, and `speciesOther` (only while species = «سایر») |
| App bar | Custom, in-screen; `PetForm` gets `headerShown: false`. Matches `PetsListScreen`. |
| Subtitle | None |
| Card heading | Visible («اطلاعات پایه») — a medical-information card follows in a later spec |
| Avatar diameter | 96px, `radius.pill` |
| Empty avatar | Static camera glyph (`camera-outline`, `colors.inkFaint`) — does not react to the species chips |
| Avatar tap target | Both the circle and the floating button open the picker |
| Submit button | Bottom of the scroll, below the card, as today |

## Testing Strategy

jest-expo + `@testing-library/react-native`, in `mobile/src/__tests__/`.
Assertions against user-facing text use `i18n.t("key")` — **never** a Persian
literal (project rule).

The existing `PetFormScreen.test.tsx` suite is the regression net: validation,
happy path, edit prefill, and species-other must all still pass **unmodified**,
except where a `testID` genuinely moved. Add:

- Required labels render `*` for name and species; breed/gender/weight/notes do not.
- `*` appears on «نوع گونه» only after «سایر» is chosen.
- App bar renders the add title in Add mode, the edit title in Edit mode.
- The avatar's edit button carries `testID="petform-photo"` and calls `pickPhoto`
  — reusing the old testID keeps any existing photo assertion honest.
- Back button calls `navigation.goBack()`.

## Boundaries

- **Always:** import tokens from `theme.ts`; keep every existing `testID` that
  still has a home; run `npx tsc --noEmit` and the jest suite before committing;
  put new strings in `fa.json` as flat keys.
- **Ask first:** removing or renaming a `testID`; adding a `src/components/ui/`
  primitive; changing validation rules or the submit payload; touching any pets
  screen other than `PetFormScreen`.
- **Never:** hardcode a Persian string in a test or a component; hardcode a hex
  colour or a spacing number; change `src/db/pets.ts`, `petsStore.ts`, or the
  `Pet` type — this is a layout change and the data layer must not notice.

## Success Criteria

1. `npx tsc --noEmit` → 0 errors.
2. `npm test` → green, with the pre-existing `PetFormScreen` validation /
   happy-path / edit-prefill tests passing **unchanged**.
3. Add mode renders: app bar with `pets.form.title_add`, a 96px circular
   camera-glyph placeholder with a floating edit button, and one card headed
   `pets.form.section_basic` containing name, species, breed, gender, weight,
   notes — in that order.
4. Edit mode prefills every field and shows the existing photo in the circle.
5. `اسم` and `گونه` labels end in a `colors.danger` asterisk; `نژاد`, `جنسیت`,
   `وزن`, `یادداشت` do not. `نوع گونه` gains one only when «سایر» is selected.
6. Tapping the circle or the floating button opens the picker; a picked photo
   appears in the circle. There is no standalone «عکس» button left on screen.
7. Submitting with an empty name still surfaces `pets.error.name_required` and
   does not navigate.

## New i18n Keys

```json
"pets.form.title_add":     "افزودن پت",
"pets.form.title_edit":    "ویرایش پت",
"pets.form.back":          "بازگشت",
"pets.form.photo_edit":    "تغییر عکس",
"pets.form.section_basic": "اطلاعات پایه"
```

`pets.add` / `pets.edit` stay as the **submit button** labels — the app bar needs
its own keys because «ویرایش» alone is not a screen title.

## Open Questions

None.
