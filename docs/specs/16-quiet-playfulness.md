# 16 — Quiet Playfulness: warmth pass across copy, empty states, and feedback

**Status:** Draft for review · 2026-07-07
**Source:** playfulness audit (2026-07-07) of the mobile app against `docs/PRODUCT.md`
(anti-references) and `docs/DESIGN.md` (One Voice Rule, Ambient-Only Rule).
**Amends:** nothing yet — items 11–13 each **require a new ADR** before any code
(same pattern as ADR-0017/0018/0020: a small, specific, recorded exception).

## Objective

Make پت‌کر read *warmer and more delightful* without becoming louder or more
game-like. The audit found the calm register well-enforced; the flattest
surfaces are the **notification copy**, the **per-pet empty states**, and the
**Profile screen**. This spec turns the audit's 15 suggestions into scoped,
acceptance-tested work items, grouped by category and ranked within each.

"Playful" here is bounded by PRODUCT.md's second anti-reference: **no** bright
cartoon colors, bouncy/elastic motion, reward badges, streaks, or confetti —
and by ADR-0020's guardrails (no praise/exclamation copy, no randomized phrase
pools, Alert Brick stays error-only).

**Success looks like:** the app's most-seen surfaces (notifications, empty
states, task feedback) name the pet and the moment instead of reading like a
system log, while every DESIGN.md rule still holds — any divergence exists
only as a recorded ADR exception.

Real-app proof points behind the suggestions: PetNote+ ("Gotcha Day"), 11pets
(species avatars, calendar-first), Rover-class apps (pet-named notification
copy), Digitail (guided first asks in an assistant).

## Tech Stack

Mobile only (`mobile/` — Expo SDK 56, React Native, TypeScript). No backend
changes. New strings go in `src/i18n/fa.json` (flat keys); colors/spacing from
`src/theme/theme.ts`; icons from `src/theme/icons.ts`. No new dependencies —
`expo-haptics`, `react-native-toast-message`, and `@notifee/react-native` are
already installed and cover every item below.

## Work Items

### (a) Copy / microcopy warmth — do first, lowest risk

1. **Task-aware, pet-first notification copy.**
   Current: `taskNotifications.ts` `buildTaskNotification` renders body
   «یادآوری برای {{pet}}» (`tasks.notif.body`) for every task type.
   Change: per-type body templates keyed by task type, pet-first — e.g.
   «وقت غذای {{pet}} است» (feeding), «وقت داروی {{pet}} است» (meds) — with the
   current generic line as fallback for `other`/no-pet.
   - Acceptance: each `TaskType` maps to a distinct `tasks.notif.body.<type>`
     key; no exclamation marks; تو register; `body_generic` survives as fallback.
   - Effort: copy + small template change. Risk: low.

2. **Personalized per-pet empty-tasks line.**
   Current: `PetDetailScreen.tsx` reuses the global `tasks.empty`
   («امروز کاری برای انجام نداری») inside a specific pet's page.
   Change: new key `pets.tasks_empty` interpolating the pet's name
   («امروز کاری برای {{name}} نیست») — the same warmth pattern as
   `donePhrase` in `toastConfig.tsx`.
   - Acceptance: pet name appears in the line on PetDetail; Tasks tab
     whole-screen empty state unchanged.
   - Effort: copy tweak. Risk: low.

3. **"Day complete" variant of the progress line.**
   Current: `TasksScreen.tsx` progress header always renders
   `tasks.progress` («{{done}} از {{total}} کار امروز انجام شد»), even at n/n.
   Change: when `done === total`, render new key `tasks.progress_all_done`
   («همه کارهای امروز انجام شد») — declarative fact, not praise.
   - Acceptance: phrase is a statement with no exclamation; dots row unchanged;
     stays inside ADR-0020's "never reintroduce praise/exclamation" guardrail.
   - Effort: copy tweak. Risk: low (wording must stay declarative).

4. **Persian notification channel name.**
   Current: `taskNotifications.ts` `createChannel` hardcodes English
   `"Task Reminders"`, visible in Android's notification settings.
   Change: localized Persian name via `t(...)` (e.g. «یادآوری کارها»).
   - Acceptance: no English channel name; existing channel id `tasks` unchanged.
   - Effort: one line. Risk: none.

5. **Fix «راجب» typo.**
   Current: `chat.list.empty_subtitle` in `fa.json` contains «راجب» (correct:
   «راجع به»).
   - Acceptance: corrected string; tests keep passing (they assert via
     `i18n.t`, per repo convention).
   - Effort: one line. Risk: none.

### (b) Empty states & first-run moments

6. [Ignore] **Empty pet list gets its promised action.**
   Current: `PetsListScreen.tsx` `ListEmptyComponent` shows a 48px `paw` glyph
   plus two text lines — no action, though DESIGN.md's Do list says empty
   states should "teach the interface" with an action.
   Change: an inline secondary «افزودن پت» button under the subtitle, wired to
   the same handler as the FAB.
   - Acceptance: button uses the existing `Button` primitive (secondary
     variant); FAB unchanged; ≥44pt target.
   - Effort: small. Risk: low.

7. [Ignore] **Monochrome ink-line empty-state illustration.**
   Current: Pets (`paw`), Tasks (`leaf`), Assistant
   (`chatbubble-ellipses-outline`) each show a stock 48px icon in Ink Muted.
   Change: one shared hand-drawn-feeling static SVG per screen (e.g. a
   curled-up cat, a resting bird) using only Ink Muted / Ink Faint — warmth
   via drawing quality, not color or motion. No rule touched: static, neutral
   ink, no entrance animation.
   - Acceptance: SVG assets render at fixed size, no animation; colors limited
     to existing ink tokens; falls back cleanly if asset fails to load.
   - Effort: medium (needs real illustration quality). Risk: medium — ship
     only if the drawings don't read childish; otherwise keep glyphs.

8. **Starter-question chips in the empty Assistant state.**
   Current: `ConversationListScreen.tsx` empty state reports absence only.
   Change: 3–4 tappable example questions built from the user's actual pets
   («{{name}} چقدر باید آب بخوره؟»), tapping one starts a conversation with
   that draft.
   - Acceptance: chips only when ≥1 pet exists; copy from `fa.json` templates;
     chip styling reuses existing chip pattern (Garden Soft selected fill is
     NOT used here — neutral surface, One Voice Rule intact).
   - Effort: medium. Risk: low.

### (c) Haptic / feedback nuance

9. **Complete the task-action haptic vocabulary.**
   Current: `TasksScreen.tsx` fires Success on done, Light impact on skip;
   postpone («به فردا») and the toast's undo are silent.
   Change: `Haptics.impactAsync(Light)` on postpone and on undo, failures
   swallowed as everywhere else.
   - Acceptance: no new haptic intensities introduced; all wrapped in
     `.catch(() => {})`.
   - Effort: two lines. Risk: none.

10. **Existing Success haptic coincides with the "day complete" line.**
    No new haptic pattern — the last done-tap already fires
    `NotificationFeedbackType.Success`; item 3's copy variant simply lands at
    the same moment. Explicitly **not** a distinct celebratory buzz.
    - Acceptance: zero code beyond item 3; listed here to record the decision
      that no special "finale" haptic is added.
    - Effort: none. Risk: none.

### (d) Scoped exceptions — each REQUIRES a new ADR before implementation

11. [ignore] **Done-checkbox micro-transition** *(ADR required)*.
    Current: the Tasks done checkbox flips state instantly.
    Change: a single ~150ms ease-out fade/draw of the Garden Confident check.
    Rationale: DESIGN.md's motion rule already carves out "motion signals
    state (a press, a loading condition)"; this is the ADR-0018 pattern —
    direct state signal, not choreography.
    - ADR must pin: duration ≤150ms, ease-out only (no spring/overshoot),
      `prefers-reduced-motion` disables it, scope = this checkbox only.
    - Effort: small. Risk: medium (the ADR is what keeps it from drifting bouncy).

12. **Assistant "thinking" indicator** *(ADR-lite required)*.
    Current: `ChatScreen.tsx` shows nothing between send and the first
    streamed token (`streaming` only disables inputs).
    Change: three Ink Muted dots with a slow opacity pulse until the first
    delta arrives. Loading-condition motion DESIGN.md nominally allows, but
    it is ambient on-screen motion — record it.
    - ADR must pin: opacity-only (no translation/scale), removed on first
      token, `prefers-reduced-motion` renders it static.
    - Effort: small. Risk: low.

13. **Species-glyph thumbnail fallback** *(ADR required — weakest case)*.
    Current: DESIGN.md deliberately omits the pet-list thumbnail when no photo
    exists ("no blank avatar fallback that invents personality").
    Change: monochrome `SPECIES_ICON` glyph in a Sunken Well circle — factual,
    not invented (11pets pattern) — but it reverses a written decision.
    - Gate: only pursue if photo-less pets prove common in real use; the ADR
      must reconcile DESIGN.md's Pet List Row section.
    - Effort: small. Risk: medium (contradicts an explicit design call).

### (e) Other

14. [ignore] **Quiet "gotcha day" caption on PetDetail.**
    On the Jalali anniversary of the pet's `created_at`, one Caption/Ink Muted
    line in the existing info card («یک سال از آمدن {{name}} می‌گذرد»).
    Memory, not gamification — no badge, no streak, visible only on the day.
    - Caveat: `created_at` means "added to the app," not adoption date. The
      no-new-field version accepts that; an optional real date field is a
      separate product decision.
    - Effort: medium. Risk: low-medium (product-scope call — confirm first).

15. [ignore] **One ambient line of belonging on ProfileScreen.**
    Current: `ProfileScreen.tsx` signed-in state is handle + email + two
    buttons — the flattest screen in the app.
    Change: one factual line above the handle: «مراقب {{count}} پت هستی»
    (hidden at 0 pets). A count, never an adherence metric or score.
    - Acceptance: Persian digits via `toPersianDigits`; Caption/Ink Muted; no
      stats beyond the count.
    - Effort: small. Risk: low.

**Suggested order:** 1 → 2 → 6 → 4+5 (bundle) → 3+10 → 9 → 15, then decide
per-item whether 7, 8, 14 are worth their effort and whether any of 11–13
earns its ADR.

## Commands

```bash
cd mobile
npm test                                   # jest --passWithNoTests
npx jest src/__tests__/TasksScreen.test.tsx  # single file
npx tsc --noEmit                           # must be 0 errors
npx expo run:android                       # manual verification on device
```

## Project Structure (touchpoints)

```
mobile/src/i18n/fa.json                     → all new/changed strings (flat keys)
mobile/src/lib/taskNotifications.ts         → items 1, 4
mobile/src/screens/pets/PetDetailScreen.tsx → items 2, 14
mobile/src/screens/tasks/TasksScreen.tsx    → items 3, 9, 11
mobile/src/screens/pets/PetsListScreen.tsx  → items 6, 7, 13
mobile/src/screens/assistant/*              → items 7, 8, 12
mobile/src/screens/profile/ProfileScreen.tsx→ item 15
mobile/src/components/toastConfig.tsx       → untouched (ADR-0020 governs it)
docs/adrs/                                  → new ADRs for 11/12/13 if pursued
mobile/src/__tests__/                       → tests beside existing suites
```

## Code Style

Follow the repo's existing patterns exactly; the reference snippet is the
haptics convention every feedback item must copy:

```ts
// Haptics are a delight, never load-bearing — swallow failures.
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
```

Key conventions: strings only via `fa.json` keys (flat, `"a.b.c"` literal);
theme tokens from `theme.ts`, never hard-coded values; icons from
`theme/icons.ts` maps, never ad-hoc emoji; RTL-safe layout (`start`/`end`);
Persian digits via `toPersianDigits`; تو register in all user-addressed copy.

## Testing Strategy

jest-expo + @testing-library/react-native, tests in `mobile/src/__tests__/`.

- Copy items (1–5, 15): assert via `i18n.t("key")` or fixture data — never a
  hardcoded Persian literal (repo convention).
- Item 1: unit-test the notification body selection per `TaskType` including
  the generic fallback (pure function, extractable from `buildTaskNotification`).
- Item 3: TasksScreen renders `tasks.progress_all_done` when done === total,
  `tasks.progress` otherwise.
- Item 6: empty pets list renders the add button; tapping navigates to PetForm.
- Haptics (9): spy on `expo-haptics`, assert calls fire and failures don't throw.
- Motion items (11–12): behavior-level tests only (state before/after);
  animation timing is verified manually on device.
- Every item lands with `npx tsc --noEmit` at 0 errors and the full suite green.

## Boundaries

**Always**
- تو voice; declarative copy; no exclamation marks in feedback strings.
- One Voice Rule intact: no new Garden Confident use beyond ADR-0020's list.
- Neutral ink for anything overdue-adjacent; Alert Brick stays error-only.
- Swallow haptic failures; keep haptics never load-bearing.
- Reuse installed libraries only — no new dependencies.

**Ask first**
- Items 11, 12, 13: write and get the ADR accepted **before** any code.
- Item 14: confirm the `created_at`-as-anniversary semantics with the user.
- Item 7: review illustration drafts before wiring them in.
- Any new Persian copy: final wording is the user's call (native speaker).

**Never**
- Praise/cheer copy, randomized phrase pools, streaks, badges, confetti
  (ADR-0020 "Never" guardrails).
- Motion on list entrances, tab transitions, or section reveals.
- A second accent color, or side-stripe accents beyond the ADR-0017 toast.
- Touching `toastConfig.tsx`'s deterministic done phrase.

## Success Criteria

- Items 1–6, 9, 15 shipped: notifications name the pet and the task type; the
  per-pet empty line names the pet; the empty pet list has a working add
  button; channel name and typo fixed; postpone/undo have haptics; Profile
  shows the pet count.
- `npm test` and `npx tsc --noEmit` green after every item.
- Zero undocumented DESIGN.md divergences: grep of the diff shows no new
  Garden Confident uses, no Alert Brick outside errors, no animation code
  outside items 11–12's ADR scope.
- ADR-gated items either have an accepted ADR or are explicitly dropped.

## Open Questions

1. Final Persian wording for every new string (proposals above are drafts).
2. Item 7: who produces the illustrations, and at what quality bar do we
   accept vs. keep the current glyphs?
3. Item 13: do we have evidence photo-less pets are common enough to justify
   reversing DESIGN.md's explicit no-fallback decision?
4. Item 14: is `created_at` acceptable as the anniversary anchor, or should a
   real (optional) adoption-date field be a follow-up spec?
