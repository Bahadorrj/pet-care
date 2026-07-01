# ADR-0001: React Native, Android-first, for the mobile app

## Status
Accepted

## Date
2026-06-17

## Context
PetCare is a Farsi-first mobile app for Persian-speaking cat and dog owners in
Iran. The mobile client must:
- Render right-to-left (RTL) Farsi UI well.
- Ship to Iranian Android stores (Cafe Bazaar, Myket) — the realistic
  distribution channels; the App Store is not reachable for this audience at
  MVP.
- Reuse code toward a future iOS build if Android traction justifies it.
- Be built by a solo founder-developer who already knows the ecosystem.

The binding constraint is developer velocity by one developer who is fluent in
the JS/TS ecosystem, not raw native performance.

## Decision
Build the mobile client in **React Native with TypeScript (strict mode)**, and
ship **Android first**. iOS is deferred (see PRD "Out of MVP").

## Alternatives Considered

### Native Android (Kotlin)
- Pros: Best platform fidelity and performance; first-class RTL.
- Cons: Zero iOS reuse; the developer is more productive in TS than Kotlin.
- Rejected: No code reuse path and slower for this team.

### Flutter
- Pros: Single codebase, strong RTL, good performance.
- Cons: Dart is outside the developer's existing skill set; smaller hiring/help
  pool for this project; re-learning cost competes directly with the 3-month
  ship goal.
- Rejected: Loses the developer-familiarity advantage that drives the timeline.

## Consequences
- One TS/JS codebase serves Android now and iOS later with mostly shared logic.
- RTL must be handled deliberately — see ADR-0010 and the `start`/`end`
  StyleSheet rule.
- Native modules (secure storage, notifications) are needed; see ADR-0002 for
  how the toolchain provides them.

## Guardrails

**Always**
- Write TypeScript in `strict` mode — no `any`.
- Keep platform-specific code isolated so the future iOS port stays cheap.

**Ask first**
- Before adding a third-party native SDK (distribution / Iran-access risk — see
  PRD "Ask first").

**Never**
- Never assume iOS availability in MVP code paths or copy.
- Never hardcode user-facing strings in components (see ADR-0010).
