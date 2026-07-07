# ADR-0020: Quiet Tasks tone — تو voice, calm overdue, neutral done toast, completion-state accent exception

## Status
Accepted

## Date
2026-07-06

## Context
A design audit of the Tasks tab against `docs/PRODUCT.md`'s calm/caring/no-guilt
principle (principle 6, anti-gamification) found several tone inconsistencies
that had accumulated across earlier work:

- Mixed شما/تو copy across Tasks strings — no single register.
- **Alert Brick** (the reserved error/destructive red) rendered on overdue
  occurrence times, violating `docs/DESIGN.md`'s rule that Alert Brick is
  "never repurposed for warnings."
- Praise-register **cheer toasts** on task completion (ADR-0017) — rotating
  «آفرین!» / «حواست به... هستا!» phrases that read as coach-like/childish for
  an adult, calm-register app.
- Tasks sections (Overdue / Today / Upcoming) always rendered, even when
  empty, leading the hub with lateness-adjacent headers that had nothing
  under them.
- **Garden Confident** (the app's one saturated "reward" tint) already used
  on the completion checkbox and the today-progress dots, but absent from
  `docs/DESIGN.md`'s One Voice Rule permitted-uses list — an undocumented
  divergence.

## Decision

1. **تو voice.** All user-addressed Tasks copy uses the intimate تو register,
   not شما — matching the rest of the app.
2. **Calm overdue.** Overdue occurrence times render in neutral ink, not Alert
   Brick. Wording is neutral — «مانده از قبل» (section title) / «انجام نشده»
   (status label) — not alarmed. The Overdue section keeps its position and
   count; it is not hidden or demoted, just de-escalated in color and words.
3. **Neutral done toast.** The done toast (`mobile/src/components/toastConfig.tsx`)
   shows a single deterministic phrase, `tasks.done.confirm`, replacing
   ADR-0017's randomized cheer rotation. The toast component, the `taskDone`
   config type, and the emerald start-side accent stripe are unchanged —
   only the copy source (random cheer → one neutral confirmation) changes.
4. **Hidden empty sections.** A section (Overdue / Today / Upcoming) that has
   no items does not render at all — no empty-state row per section. The
   gate is **bucket-based and genuine**: a section is considered empty only
   when its underlying bucket has zero occurrences, not merely when active
   filters narrow it to zero (a filter-emptied section still renders, with
   a "no match" affordance, so filter state stays legible). The existing
   whole-screen empty state is unchanged.
5. **Completion-state exception to the One Voice Rule.** Garden Confident is
   additionally permitted on completion indicators — the done checkbox and
   the today-progress dots — because completion is an "active state" in
   spirit, even though it isn't literally a primary button, active tab icon,
   or focused input border. The exception covers exactly these two uses; it
   is not a license to extend Garden Confident elsewhere.

## Alternatives Considered

### Keep the cheer rotation (ADR-0017)
- Pros: no copy work; already shipped and tested.
- Cons: praise register reads coach/childish for adult users and sits at odds
  with the calm, no-guilt register `docs/PRODUCT.md` asks for. Rejected.

### Recolor the completion UI neutral (drop the Garden Confident exception)
- Pros: no exception to document; One Voice Rule stays literally exception-free.
- Cons: loses the tab's one quiet reward moment; creates a checkbox/dots
  inconsistency if only one of the two is recolored. Rejected — the
  exception is narrow and worth documenting rather than flattening away.

### Day-part agenda relayout (re-bucket into morning/afternoon/evening/night)
- Pros: finer-grained "when" grouping.
- Cons: the 3-section Overdue/Today/Upcoming window was confirmed as the
  intended structure (spec 07); a day-part relayout was a stale description,
  not a live requirement. Rejected — no relayout, just the tone/visibility
  fixes above.

## Consequences
- `mobile/src/i18n/fa.json`'s `tasks.done.cheer.*` keys are removed from use
  in favor of `tasks.done.confirm`; `mobile/src/components/toastConfig.tsx`
  picks the phrase deterministically instead of at random.
- Overdue styling drops any Alert Brick usage; overdue times use the same
  neutral ink as other rows, distinguished only by section and status label.
- `mobile/src/screens/tasks/TasksScreen.tsx`'s section list only pushes a
  section when its bucket (post-genuine-empty-gate) is non-empty; filtered
  (but not genuinely empty) sections still render with a no-match affordance.
- `docs/DESIGN.md`'s One Voice Rule now documents one scoped exception
  (completion state) instead of silently diverging from it.
- ADR-0017 is superseded in part: its toast component, `taskDone` type, and
  emerald start-stripe survive; only the cheer-rotation copy is replaced.

## Guardrails

**Always**
- Keep Tasks copy in تو voice.
- Keep overdue rows in neutral ink; reserve Alert Brick for errors and
  destructive-action labels only.
- Use the deterministic `tasks.done.confirm` (or the `tasks.undo.done`
  fallback when no pet name is available) for the done toast — no randomized
  phrase pools.
- Hide a section only when its bucket is genuinely empty (zero occurrences),
  not merely filtered to zero.

**Ask first**
- Before adding any new Garden Confident use beyond the done checkbox,
  today-progress dots, primary button fill, active tab icon, and focused
  input border.
- Before reintroducing multiple rotating phrases for the done toast.

**Never**
- Never reintroduce praise/exclamation copy in task feedback (cheer toasts,
  congratulatory banners, streak callouts).
- Never use Alert Brick outside errors or destructive-action labels.
