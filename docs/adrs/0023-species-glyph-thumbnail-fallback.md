# ADR-0023: Species-glyph thumbnail fallback for photo-less pets

## Status
Rejected — the omission stands. Spec 16 item 13 is dropped.

## Date
2026-07-10

## Context

DESIGN.md, Pet List Row, says:

> **Thumbnail:** 48×48px circle. Filled with the pet's photo when present.
> Omitted entirely when absent (no blank avatar fallback that invents personality).

`PetsListScreen.tsx` implements exactly that: `item.photoUri ? <Image/> : null`.
Spec 16 item 13 proposes reversing it — a monochrome `SPECIES_ICON` glyph in a
Sunken Well circle where the photo would be — on the grounds that a species
glyph states a fact the user already entered (this is a dog) rather than
inventing a personality the way a cartoon avatar or a coloured initials-circle
would.

**The evidence question, answered honestly: we have none, and cannot get any.**

Spec 16's own Open Question 3 asks whether photo-less pets are common enough to
justify the reversal. The app ships no analytics, telemetry, or crash reporting
of any kind — a deliberate consequence of ADR-0009 (offline-first, on-device
data) and ADR-0015 (pets live in local SQLite, never leaving the device). There
is no instrumentation to add short of introducing a tracking dependency, which
would be a far larger decision than this one and one the product's whole posture
argues against. So the honest position is:

- We do not know how many pets lack photos.
- We will not know unless we ask users directly.
- The 11pets precedent tells us a species avatar is *viable*, not that it is
  *needed here*.

That leaves the decision resting on judgement, not data. This ADR exists to make
that explicit rather than let the change slip in under the cover of a spec item.

## Decision

**Rejected.** The thumbnail stays omitted for photo-less pets. DESIGN.md's Pet
List Row section is unchanged. Spec 16 item 13 is dropped, which its Success
Criteria explicitly permit ("ADR-gated items either have an accepted ADR or are
explicitly dropped").

The reasoning: a written design decision should not be reversed on a hunch. The
argument *for* the glyph was aesthetic (a consistent left edge in mixed lists);
the argument *against* is a rule someone wrote deliberately, for a stated reason,
and no evidence was produced that the rule is hurting anyone. Absent data, the
existing decision wins. If photo-less rows later prove to be a real irritation in
daily use, that is new information and this ADR can be superseded — with the
observation named.

The considered alternative had been:

**Accept** — photo-less rows render the `SPECIES_ICON` glyph
(`src/theme/icons.ts`), Ink Muted, centred in a `colors.surfaceSunken` 48×48
circle, with DESIGN.md's Pet List Row bullet rewritten in the same commit.

## Alternatives Considered

**Initials circle («ر» for رکسی).** Rejected outright, under either branch. It is
the "invents personality" case DESIGN.md names — a coloured disc with a letter is
a social-app avatar, and it drags in a second colour to distinguish pets.

**Ask the user to add a photo (empty-thumbnail affordance).** A tappable camera
glyph that opens the photo picker. Rejected: it nags, and it puts an action in a
list row whose whole design is "the row itself is the tap target" (DESIGN.md).

**Keep the omission but tighten the row.** Status quo. The row already reads
fine without a thumbnail — the ragged left edge in a mixed list (some rows with
photos, some without) is the only real complaint, and it is aesthetic.

## Consequences

**If accepted:**
- Mixed lists gain a consistent left edge; a photo-less list stops looking
  half-built.
- A written design decision is reversed. DESIGN.md must be edited in the same
  commit or the two sources diverge — the exact failure this ADR process exists
  to prevent.
- The glyph is drawn from `SPECIES_ICON`, so a pet with `species: "other"`
  shows the generic paw. That is a factual statement about what the user told
  us, which is the entire argument for the change.

**Rejected, so in effect:**
- Nothing changes; the cost is one unshipped spec item.
- The next person who proposes this finds this ADR and the reasoning, rather
  than re-litigating it from scratch. Reopen it with an observation, not a
  preference.

## Guardrails (would have applied had this been Accepted)

- **Never** colour the glyph or its well with Garden Confident, or any accent.
  Ink Muted on Sunken Well, and nothing else.
- **Never** substitute an initials disc, an emoji, or an illustration.
- **Never** make the thumbnail an action (no tap-to-add-photo in the row).
- Pets **with** photos render exactly as they do today.
- DESIGN.md's Pet List Row section is updated in the same commit as the code.
