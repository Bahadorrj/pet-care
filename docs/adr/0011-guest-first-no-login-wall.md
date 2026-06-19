# ADR-0011: Guest-first access; no login wall on knowledge features

## Status
Accepted

## Date
2026-06-17

## Context
The product exists for the "panic at midnight" moment: a worried owner needs the
symptom urgency guide and hazard content *immediately*, with no friction. Forcing
registration before that content would defeat the core purpose and lose exactly
the anxious first-time user the app is built for. Auth exists only to enable
personal features (pet profiles, reminders), not to gate knowledge.

## Decision
The app is **guest by default**. Knowledge features (symptom guide, hazards, care
guides) are fully usable **without an account**. Authentication is **optional**
and reached from a **non-aggressive** entry point (the bottom "ورود / ثبت‌نام"
button on the branded home screen). Registration is prompted only at the moment a
user opts into a personal feature (e.g. adding a pet). Auth is stateless JWT
(see ADR-0005); the home screen reflects authenticated vs. guest state but never
blocks on it.

## Alternatives Considered

### Require login on launch
- Pros: Simpler state model; every user is known.
- Cons: Kills the core "open it and get an answer now" value; loses anxious
  first-time users.
- Rejected: Directly contradicts the product's reason to exist.

### Anonymous account auto-provisioned on launch
- Pros: Unified data model.
- Cons: Hidden account creation; unnecessary backend writes for pure guests;
  privacy surprise.
- Rejected: True guest mode (no account, no server write) is simpler and honest.

## Consequences
- Knowledge content is local and works for guests with zero backend dependency
  (reinforces ADR-0009).
- The auth flow must be skippable and never a wall in front of the home screen.
- Account deletion (store-compliance requirement) applies only to registered
  users and remains an open item before store submission.

## Guardrails

**Always**
- Keep the branded home screen and all knowledge features reachable as a guest.
- Prompt registration only at the point a user opts into a personal feature.

**Ask first**
- Before adding any feature that requires internet for core *free* functionality
  (see PRD "Ask first").

**Never**
- Never gate the symptom urgency guide or hazard content behind a login or
  paywall (see PRD "Never").
- Never put a login wall in front of the home screen.
