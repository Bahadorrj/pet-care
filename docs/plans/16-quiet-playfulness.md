# Plan 16 — Quiet Playfulness

Implements `docs/specs/16-quiet-playfulness.md`, **excluding** the items marked
`[ignore]` in the spec (6, 7, 11, 14). In scope: **1, 2, 3, 4, 5, 8, 9, 10, 12, 13**.

Mobile-only. No backend, no new dependencies.

## Architecture decisions

- **fa.json is the only shared file.** Every task touches it, but on disjoint
  keys — no merge hazard, no ordering constraint between tasks beyond phases.
- **Item 1 extracts a pure `notifBody(type, petName)`** from `buildTaskNotification`
  so the per-type body selection is unit-testable without notifee (spec's
  Testing Strategy asks for exactly this).
- **Item 10 is zero code.** It records the decision that no "finale" haptic is
  added; it is folded into Task 3's acceptance criteria, not a task of its own.
- **Item 8 needs a route param.** `AssistantStackParamList["Chat"]` grows an
  optional `draft?: string`; `ChatScreen` seeds `draft` state from it. That is
  the whole mechanism — no new store field.
- **Items 12 and 13 are ADR-gated.** Each is two tasks: write the ADR, get it
  accepted, then code. Nothing lands before its ADR does.

## Discrepancy found while reading the code

Spec item 9 says "postpone («به فردا») and **the toast's undo** are silent."
There is no undo affordance on the toast — `toastConfig.tsx` renders a phrase
only. Undo is re-tapping the checkbox, and `TasksScreen.tsx:368` already fires
`hapticLight()` on that path. **Item 9 therefore reduces to one line on
postpone.** Nothing else is missing.

## Dependency graph

```
Task 1 (notif copy + channel + typo) ─┐
Task 2 (per-pet empty line)          ─┤
Task 3 (day-complete progress line)  ─┼─→ Checkpoint A (copy review)
Task 4 (postpone haptic)             ─┤
Task 5 (Profile pet count)           ─┘
                                        │
Task 6 (Assistant starter chips) ───────┴─→ Checkpoint B
                                        │
Task 7 (ADR-0022) → Task 8 (thinking dots)  ─┐
Task 9 (ADR-0023) → Task 10 (species glyph) ─┴─→ Checkpoint C
```

Tasks 1–5 are mutually independent and could be parallelized; they are ordered
lowest-risk-first instead, because the whole phase is under two hours.

---

## Phase 1 — Copy warmth (spec items 1, 2, 3, 4, 5, 10)

### Task 1: Notifications name the pet and the task type
**Spec items:** 1, 4, 5

Replace the one-size-fits-all notification body with a per-`TaskType` template,
localize the Android channel name, and fix the «راجب» typo (bundled here because
all three are pure `fa.json` + one-file changes).

**Acceptance criteria**
- [ ] A pure, exported `notifBody(type: TaskType, petName: string): string` selects
      `tasks.notif.body.<type>` when `petName` is non-empty, `tasks.notif.body_generic`
      otherwise. `buildTaskNotification` calls it.
- [ ] All seven `TaskType` values have a `tasks.notif.body.<type>` key; every string
      is تو register, pet-first, no exclamation mark.
- [ ] `createChannel` name comes from `t("tasks.notif.channel_name")`; channel id
      stays `"tasks"` (changing it would orphan the user's existing channel settings).
- [ ] `chat.list.empty_subtitle` reads «راجع به», not «راجب».

**Verification**
- [ ] New test `src/__tests__/taskNotifications.test.ts` (or an added block in the
      existing suite) asserts `notifBody` per type + the empty-`petName` fallback,
      via `i18n.t(key, { pet })` — never a Persian literal.
- [ ] `npx jest src/__tests__` green; `npx tsc --noEmit` = 0 errors.
- [ ] Manual: Android Settings → Notifications shows the Persian channel name.

**Dependencies:** None · **Scope:** S (2 files + 1 test)
**Files:** `mobile/src/lib/taskNotifications.ts`, `mobile/src/i18n/fa.json`, `mobile/src/__tests__/`

---

### Task 2: Per-pet empty-tasks line on PetDetail
**Spec item:** 2

`PetDetailScreen.tsx:228` renders the global `tasks.empty` inside one pet's page.
Swap it for a name-interpolating key.

**Acceptance criteria**
- [ ] New key `pets.tasks_empty` = «امروز کاری برای {{name}} نیست».
- [ ] PetDetail renders it with the pet's name; the Tasks-tab whole-screen empty
      state (`tasks.empty_title` / `tasks.empty_subtitle`) is untouched.

**Verification**
- [ ] Existing PetDetail test (or a new one) asserts the line via
      `i18n.t("pets.tasks_empty", { name: fixture.name })`.
- [ ] `npm test` green; `npx tsc --noEmit` = 0 errors.

**Dependencies:** None · **Scope:** XS (2 files)
**Files:** `mobile/src/screens/pets/PetDetailScreen.tsx`, `mobile/src/i18n/fa.json`

---

### Task 3: "Day complete" variant of the progress line
**Spec items:** 3, 10

When `progress.done === progress.total`, the header text swaps to a declarative
completion statement. The dots row is unchanged. **No new haptic** — the last
done-tap's existing `NotificationFeedbackType.Success` is the only feedback, and
this task records that decision (item 10).

**Acceptance criteria**
- [ ] New key `tasks.progress_all_done` = «همه کارهای امروز انجام شد» — a statement,
      no exclamation, no praise (ADR-0020 guardrail).
- [ ] `TasksScreen.tsx:607` renders `tasks.progress_all_done` iff `done === total`,
      `tasks.progress` otherwise. Progress block still hidden when `total === 0`.
- [ ] Zero changes to `hapticSuccess` / `handleCheck`.

**Verification**
- [ ] `TasksScreen.test.tsx`: fixture with all today's occurrences done renders
      `i18n.t("tasks.progress_all_done")`; a partial fixture renders `i18n.t("tasks.progress", {...})`.
- [ ] `npx jest src/__tests__/TasksScreen.test.tsx` green; `npx tsc --noEmit` = 0.

**Dependencies:** None · **Scope:** XS (2 files + test)
**Files:** `mobile/src/screens/tasks/TasksScreen.tsx`, `mobile/src/i18n/fa.json`

---

### Task 4: Haptic on postpone
**Spec item:** 9 (reduced — see Discrepancy above)

Add `hapticLight()` to the postpone `onPress` in `handleMore`.

**Acceptance criteria**
- [ ] Postpone fires `Haptics.impactAsync(Light)` via the existing `hapticLight`
      helper — no new intensity, failure swallowed by the helper's `.catch(() => {})`.
- [ ] Undo (`unmarkOccurrence` branch) is left as-is; it already has `hapticLight()`.

**Verification**
- [ ] `TasksScreen.test.tsx`: spy on `expo-haptics`; selecting «به فردا» from the
      action sheet calls `impactAsync`, and a rejected `impactAsync` does not throw.
- [ ] `npm test` green; `npx tsc --noEmit` = 0.

**Dependencies:** None · **Scope:** XS (1 file + test)
**Files:** `mobile/src/screens/tasks/TasksScreen.tsx`

---

### Task 5: One ambient line of belonging on ProfileScreen
**Spec item:** 15

A factual count line above the handle in the signed-in state.

**Acceptance criteria**
- [ ] New key `profile.pet_count` = «مراقب {{count}} پت هستی»; count rendered via
      `toPersianDigits`.
- [ ] Line is hidden entirely when `pets.length === 0`.
- [ ] Caption typography, `colors.inkMuted`. No adherence %, no streak, no score.

**Verification**
- [ ] New/extended Profile test: 0 pets → line absent (`queryByTestId` null);
      2 pets → line present, asserted via `i18n.t("profile.pet_count", { count: … })`.
- [ ] `npm test` green; `npx tsc --noEmit` = 0.

**Dependencies:** None · **Scope:** S (2 files + test)
**Files:** `mobile/src/screens/profile/ProfileScreen.tsx`, `mobile/src/i18n/fa.json`

---

### ✅ Checkpoint A — after Tasks 1–5
- [ ] `npm test` and `npx tsc --noEmit` both green.
- [ ] **Human review of every new Persian string** in one pass (spec Open Question 1;
      you chose "implement with spec drafts, review at checkpoint"). Corrections land
      as a single `fix(mobile.i18n)` commit.
- [ ] Diff grep: no new `colors.primary` uses, no `colors.danger` outside errors,
      no animation code. (Spec Success Criteria #3.)
- [ ] Manual on device: fire a notification per task type; check the Persian channel name.

---

## Phase 2 — Assistant first-run (spec item 8)

### Task 6: Starter-question chips in the empty Assistant state
**Spec item:** 8

`ConversationListScreen`'s `ListEmptyComponent` gains 3–4 tappable example
questions built from the user's actual pets. Tapping one starts a conversation
and lands in `ChatScreen` with that text pre-filled in the composer.

**Acceptance criteria**
- [ ] `AssistantStackParamList["Chat"]` becomes `{ conversationId: string; draft?: string }`;
      `ChatScreen` seeds its `draft` state from `route.params.draft`.
- [ ] Chips render **only when `pets.length > 0`** and only in the empty state;
      questions come from `fa.json` templates interpolating a pet's name.
- [ ] Chip fill is `colors.surface` + `colors.border` — **not** `primarySoft`
      (One Voice Rule: no new Garden Confident use).
- [ ] ≥44pt touch target; `accessibilityRole="button"`.
- [ ] Tapping a chip calls the existing `startNewConversation()` and navigates
      with the draft; a failure surfaces the existing `chat.error.network` hint toast.

**Verification**
- [ ] Test: 0 pets → no chips; ≥1 pet → chips render, and pressing one calls
      `startNewConversation` and `navigate("Chat", { conversationId, draft })`.
      Chip text asserted via `i18n.t` with fixture pet name.
- [ ] `npm test` green; `npx tsc --noEmit` = 0.
- [ ] Manual: chip tap opens Chat with the question in the composer, **not sent**.

**Dependencies:** None (independent of Phase 1) · **Scope:** M (4 files + test)
**Files:** `mobile/src/screens/assistant/ConversationListScreen.tsx`,
`mobile/src/screens/assistant/ChatScreen.tsx`, `mobile/src/navigation/AssistantStack.tsx`,
`mobile/src/i18n/fa.json`

---

### ✅ Checkpoint B — after Task 6
- [ ] `npm test`, `npx tsc --noEmit` green.
- [ ] Confirm the chip draft is **pre-filled, not auto-sent** (user keeps the last word).
- [ ] Confirm chips do not appear once ≥1 conversation exists.

---

## Phase 3 — ADR-gated items (spec items 12, 13)

Per your decision: **both pursued, one ADR each.** Neither implementation task
starts until its ADR is `Accepted`.

### Task 7: ADR-0022 — Assistant "thinking" indicator
**Spec item:** 12 (ADR-lite)

**Acceptance criteria**
- [ ] `docs/adrs/0022-assistant-thinking-indicator.md` follows the repo ADR shape
      (Title / Status / Date / Context / Decision / Consequences), and pins:
      opacity-only animation (no translation, no scale), removed on the first
      streamed delta, `prefers-reduced-motion` renders it static, scope = this
      indicator only.
- [ ] Context section names the DESIGN.md rule it operates under ("motion signals
      a loading condition") and why an ambient on-screen pulse still warrants a record.
- [ ] `docs/adrs/README.md` gains its row.
- [ ] Reviewed and marked **Accepted** by the user before Task 8 starts.

**Verification** — Human review. No code, no tests.
**Dependencies:** None · **Scope:** XS (2 files)

---

### Task 8: Implement the thinking indicator
**Spec item:** 12 · **Blocked by Task 7**

**Acceptance criteria**
- [ ] Three `colors.inkMuted` dots render between send and the first streamed
      token; they disappear the moment `messages` gains the first assistant delta.
- [ ] Opacity-only pulse via `Animated` (RN core — no new dependency); static when
      `AccessibilityInfo.isReduceMotionEnabled()` is true.
- [ ] Nothing renders when `streaming === false`.

**Verification**
- [ ] Behaviour-level test only (spec Testing Strategy): indicator present while
      `streaming && no assistant delta`, absent otherwise. Timing verified manually.
- [ ] `npm test`, `npx tsc --noEmit` green.
- [ ] Manual on device: pulse is slow and calm, never bouncy.

**Dependencies:** Task 7 · **Scope:** S (1–2 files + test)
**Files:** `mobile/src/screens/assistant/ChatScreen.tsx`

---

### Task 9: ADR-0023 — Species-glyph thumbnail fallback
**Spec item:** 13 (weakest case — reverses a written DESIGN.md decision)

**Acceptance criteria**
- [ ] `docs/adrs/0023-species-glyph-thumbnail-fallback.md` states plainly that it
      **supersedes DESIGN.md's Pet List Row "no blank avatar fallback" call**, and
      why a monochrome species glyph is factual rather than invented personality.
- [ ] Context must answer spec Open Question 3 honestly: what evidence (if any)
      shows photo-less pets are common. If there is none, the ADR says so and the
      decision rests on the 11pets precedent alone — or the ADR is rejected.
- [ ] `docs/DESIGN.md`'s Pet List Row section is reconciled (not silently diverged).
- [ ] `docs/adrs/README.md` gains its row with "Reconciles: DESIGN.md".
- [ ] Reviewed and marked **Accepted** (or **Rejected** → Task 10 is dropped).

**Verification** — Human review. No code, no tests.
**Dependencies:** None · **Scope:** XS (3 files)

---

### Task 10: Implement the species-glyph fallback
**Spec item:** 13 · **Blocked by Task 9 being Accepted**

**Acceptance criteria**
- [ ] Photo-less pet rows show the `SPECIES_ICON` glyph from `src/theme/icons.ts`,
      `colors.inkMuted`, centred in a `colors.surfaceSunken` circle at the existing
      thumbnail size. No new icon set, no emoji.
- [ ] Pets **with** photos are visually unchanged.

**Verification**
- [ ] Test: pet fixture without `photoUri` renders the glyph; with `photoUri` renders `Image`.
- [ ] `npm test`, `npx tsc --noEmit` green.

**Dependencies:** Task 9 · **Scope:** S (1 file + test)
**Files:** `mobile/src/screens/pets/PetsListScreen.tsx`

---

### ✅ Checkpoint C — Complete
- [ ] Every spec Success Criterion met for in-scope items (1–5, 8, 9, 10, 12, 13).
- [ ] `npm test` + `npx tsc --noEmit` green.
- [ ] Diff grep clean: no Garden Confident outside ADR-0020's list, no Alert Brick
      outside errors, no animation code outside ADR-0022's scope.
- [ ] `docs/adrs/README.md` in sync; both new ADRs Accepted or explicitly Rejected.
- [ ] Spec 16 marked implemented; `[ignore]` items 6, 7, 11, 14 recorded as deferred,
      not lost.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Persian wording drifts from native register | Med | Checkpoint A gates all copy on your review before Phase 2 |
| Task 8's pulse drifts bouncy/decorative | Med | ADR-0022 pins opacity-only + no spring *before* code exists |
| Task 10 reverses a design call on thin evidence | Med | Task 9's ADR must state the evidence or be Rejected; Task 10 drops with it |
| Renaming the notification channel orphans user settings | Low | Only the *name* changes; id stays `"tasks"` (Task 1 criterion) |
| Chip draft auto-sends and surprises the user | Low | Checkpoint B explicitly verifies pre-fill, not send |

## Open questions carried from the spec

1. **(Answered)** Copy review happens in one pass at Checkpoint A.
2. **Spec Q3 — item 13 evidence.** Task 9's ADR must answer this or be Rejected.
   I have no data either way; this is a product call.
3. Spec Q2 (illustrations) and Q4 (gotcha day) belong to `[ignore]` items 7 and 14
   and are out of scope here.
