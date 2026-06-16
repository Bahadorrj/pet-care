# ADR-0009: Offline-first knowledge base via bundled JSON

## Status
Accepted

## Date
2026-06-17

## Context
The core value of PetCare is preventing the "I didn't know" moment — the symptom
urgency guide and hazard awareness content must be available the instant a worried
owner opens the app, including at midnight with no/poor connectivity. Network
reliability in the target market cannot be assumed for core safety content.

## Decision
Ship the knowledge base (hazards, symptom urgency cards, care guides) as
**structured JSON bundled into the app at build time**, read directly on-device.
Authoring lives in `content/` (Farsi source) and is bundled into
`mobile/src/content/`. An **optional background sync** endpoint may update content
between releases, but the bundled copy is always the offline fallback and the
content is never gated behind a network call.

## Alternatives Considered

### Fetch content from the backend on demand
- Pros: Update content without an app release.
- Cons: Breaks the offline guarantee for the app's most critical feature.
- Rejected: Core safety content must never depend on the network.

### Bundle into the on-device SQLite database
- Pros: Queryable.
- Cons: Needs a seed/migration step; JSON files are simpler for read-mostly,
  version-with-the-app content.
- Rejected for now: Unnecessary complexity for read-only content.

## Consequences
- Symptom guide and hazards work fully offline (a hard success criterion).
- Content updates ship with app releases by default; background sync is an
  enhancement layered on top, not a dependency.
- The shape of content JSON (e.g. symptom card `{id, species, symptom, urgency,
  description, action}`) is a contract shared by `content/` authoring and the app.

## Guardrails

**Always**
- Keep symptom-guide and hazard content readable with no network connection.
- Author content as structured JSON in `content/`; bundle into the app at build.
- Keep the bundled copy authoritative as the offline fallback even when sync runs.

**Ask first**
- Before changing the content JSON schema (it's a shared contract).
- Before deciding the content-sync mechanism (still an open question in the PRD;
  it will get its own ADR when chosen).

**Never**
- Never make core knowledge content require a network request to display.
