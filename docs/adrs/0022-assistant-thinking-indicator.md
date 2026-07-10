# ADR-0022: Assistant "thinking" indicator — a scoped, opacity-only ambient pulse

## Status
Accepted

## Date
2026-07-10

## Context

`ChatScreen` currently shows nothing between the moment the user sends a message
and the arrival of the first streamed token. `streaming` only disables the
composer and the send button. On a slow network that gap can run for several
seconds, during which the app looks inert — the user cannot tell whether the
message was sent, whether the request failed, or whether the assistant is simply
slow. The one recovery affordance (`lastFailed` / `lastInterrupted` retry) only
appears *after* the request resolves.

DESIGN.md's motion rule reads:

> **Don't** add motion to list row entrances, tab transitions, or background
> section reveals. Motion in this system signals state (a press, a loading
> condition), not choreography.

A pending network request is exactly "a loading condition," so the rule already
nominally permits this. We record it anyway for two reasons:

1. It is the first piece of **ambient, self-running on-screen motion** in the
   app. Everything animated so far is a *direct* response to a finger — a press
   state, or the ADR-0018 tab swipe tracking the gesture. A pulse that animates
   on its own, with no finger on the screen, is a different category, and the
   distance from "a slow pulse" to "bouncy, decorative choreography" is one
   careless commit. PRODUCT.md's second anti-reference (loud gamified energy,
   bouncy motion) is what we are guarding against.
2. Without a written scope, the natural next asks are "make the dots bounce,"
   "animate the bubble in," "add a typing cursor." The point of this record is
   to make those a decision someone has to argue for, not a drift.

## Decision

Render a three-dot indicator in the message list while a send is in flight and
no assistant token has arrived, under these pinned constraints:

- **Opacity only.** The dots animate opacity and nothing else — no translation,
  no scale, no rotation, no spring, no overshoot. `Animated` from React Native
  core; no new dependency.
- **Ink Muted only.** No Garden Confident, no second color. The indicator is
  not a status accent.
- **Removed on the first token.** The moment the first assistant delta lands the
  indicator unmounts. It never coexists with streamed text.
- **Reduced motion renders it static.** When `AccessibilityInfo.isReduceMotionEnabled()`
  is true the three dots render at a fixed opacity with no animation. The
  indicator still appears — it carries information, so it must not vanish; only
  its motion does.
- **Scope is this indicator.** This ADR licenses no other animation. Message
  bubbles do not animate in; the list does not animate; nothing else pulses.

## Alternatives Considered

**A spinner (`ActivityIndicator`).** Rejected: it reads as a blocking system
state ("the app is busy") rather than "someone is composing a reply." The tone
is clinical — the first anti-reference in PRODUCT.md — and RN's spinner has its
own platform styling we would then be fighting.

**A static "…" with no motion at all.** Considered seriously; it needs no ADR.
Rejected because a static ellipsis is indistinguishable from a rendering
artifact or a truncated string. Motion is what says *in progress* rather than
*stuck*. This is exactly the "loading condition" the design rule carves out.

**Skeleton bubble.** Rejected: a grey placeholder implies known content shape
and length, which we do not have, and it is more visual weight than the moment
deserves.

**Nothing at all (status quo).** Rejected: the silent gap is the actual reported
flatness. A calm app is not the same as an unresponsive one.

## Consequences

- The user gets feedback within one frame of sending, and the failure mode
  ("nothing happened") disappears.
- The app gains its first ambient animation, and with it a precedent that must
  be policed. The guardrails below are the whole point of this record.
- Reduced-motion users get a static indicator — information preserved, motion
  dropped. This is the accessible default, not a degraded one.
- Tests assert presence/absence only (state before and after the first delta).
  Timing and easing are verified by eye on a device; a test that asserts frame
  timing would be testing `Animated`, not our code.

## Guardrails

- **Never** give the dots translation, scale, or a spring/elastic curve. If a
  future change wants bounce, it supersedes this ADR in writing first.
- **Never** color the indicator with Garden Confident or any second accent.
- **Never** let it remain on screen alongside streamed assistant text.
- **Never** generalize this into an animation utility, a `<Pulse>` component, or
  a motion token set. The scope is one indicator in one screen.
- Reduced motion always wins over the animation.
