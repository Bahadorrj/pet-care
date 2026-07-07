# ADR-0017: Task-done toast — a sanctioned side-stripe success accent

## Status
Superseded by ADR-0020 (cheer rotation replaced with a neutral confirmation; the toast component and emerald start-stripe survive)

## Date
2026-06-28

## Context
DESIGN.md lists, under Don'ts: **"Don't use gradient text, side-stripe borders
(>1px left/right accent), or glassmorphism"** — decorative flourishes from a
different aesthetic register. That keeps surfaces flat and notebook-like.

The task-done flow (`TasksScreen.tsx`, the toast shown after marking an
occurrence done — see `docs/specs/10-lively-task-done-toast.md`) used
`react-native-toast-message`'s **stock** success styling: green-and-white,
system font, generic check. It read as a foreign library widget, not part of
the app, and carried none of the product's warmth at the moment a user completes
a caring act.

An earlier draft of this work added a 🐾 paw with a Reanimated spring as the
"lively" beat. During review that was dropped: the paw + bouncy motion leaned
toward the gamified register PRODUCT.md rejects, and undo was redundant with the
row checkbox. What remained worth keeping was a quiet, on-brand success cue.

## Decision
Restyle the done toast as a custom toast type via the library's `config` seam,
as a **passive success cue**:

- **Garden Soft** (`colors.primarySoft`) surface, `radius.md`, `shadow.card` —
  all sanctioned tokens, no new color.
- **An emerald (`colors.primary`) 4px border stripe on the reading start**
  (`borderStartWidth` → right in RTL) as the completion signal. This is the one
  deliberate divergence from DESIGN.md's "no side-stripe borders >1px" rule.
- **Warm, pet-aware copy** — rotating Persian phrases naming the pet.
- No icon, no motion, no in-toast undo button. Undo is the row checkbox.

The stripe is a single, low-key accent on one transient surface — not a pattern
to repeat on cards, rows, or inputs.

## Alternatives Considered

### Keep the stock library toast
- Pros: zero work.
- Cons: reads as a foreign widget; no warmth at the completion moment. Rejected.

### Paw icon + Reanimated spring (the earlier draft)
- Pros: maximally "lively".
- Cons: bouncy motion + playful icon drift toward the gamified register
  PRODUCT.md rejects; more code (Reanimated, reduced-motion handling) for a beat
  that doesn't fit the calm brand. Rejected during review.

### On-brand restyle with no accent at all
- Pros: no divergence to document.
- Cons: a flat Garden Soft toast reads as a neutral notice, not a success. The
  emerald stripe is what makes "done" legible at a glance. Rejected in favor of
  a narrow, recorded exception.

### Bespoke overlay component (not the library config seam)
- Pros: total control.
- Cons: re-implements queue/timing/dismissal the installed library already owns;
  more code, no dependency saved. Rejected (the spec's approach A reuses the
  library).

## Consequences
- One transient surface in the app carries a >1px side-stripe accent. This is an
  exception, not a new license — the no-side-stripe rule still governs cards,
  rows, inputs, and every other surface.
- A one-line pointer to this ADR sits next to DESIGN.md's relevant "Don't" so the
  spec and code don't silently diverge.
- The toast lives in `mobile/src/components/toastConfig.tsx`; it has no
  animation and no interactive elements, so no Reanimated or reduced-motion
  handling is needed.
- Because the library reuses one mounted toast instance across shows, the cheer
  phrase is memoized on `petName` so it doesn't freeze to the first pet shown.

## Guardrails

**Always**
- Keep the side-stripe accent scoped to the **task-done** toast only.
- Use theme tokens and RTL-safe layout (`borderStartWidth`, not left/right);
  Garden Soft surface, emerald stays the single accent (One Voice Rule intact).

**Ask first**
- Before applying a side-stripe accent to any other surface (error/skip toasts,
  cards, rows) — that needs a new ADR or a DESIGN.md change.
- Before reintroducing motion or an icon to this toast.

**Never**
- Never read this ADR as blanket permission for side-stripe borders app-wide;
  DESIGN.md still governs everywhere else.
