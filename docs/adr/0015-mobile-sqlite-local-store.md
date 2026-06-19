# ADR-0015: On-device SQLite for user-generated app data (mobile)

## Status
Accepted

## Date
2026-06-18

## Context
The "My Pets" feature (`docs/specs/04-my-pets-tab-spec.md`) is the first **mutable,
user-generated** data the mobile app owns: full local CRUD that must work with
zero connectivity and survive restarts, with no backend table or sync in v1
(guest-first, ADR-0011). Read-only knowledge content already ships as bundled
JSON (ADR-0009), which deliberately rejected SQLite for *read-only* content. The
backend already uses SQLite for now (ADR-0004), but the mobile client has had no
local relational store until now — auth state lives in SecureStore (ADR-0012),
which is for small secrets, not queryable records.

## Decision
Use **`expo-sqlite`** as the on-device store for user-generated relational app
data on mobile, starting with the `pets` table. A thin typed data-access module
(`src/db/`) owns schema creation (`CREATE TABLE IF NOT EXISTS` on app init) and
CRUD; a Zustand store layers in-memory state and actions on top (mirroring
`authStore`). Timestamps follow ADR-0010 (UTC stored, Jalali displayed). No
migration framework in v1 — a single idempotent create statement, gated in
`App.tsx` before first render.

## Alternatives Considered

### Keep using SecureStore / AsyncStorage (JSON blob)
- Pros: No new dependency; already used for auth.
- Cons: Not queryable/sortable; whole-blob rewrites; SecureStore is for secrets
  and has size limits.
- Rejected: Pets are queryable records, not a small secret blob.

### Bundled JSON (as ADR-0009)
- Pros: Consistent with content storage.
- Cons: JSON bundling is for read-only, ships-with-release content; pets are
  user-mutable per-device.
- Rejected: Wrong tool for mutable user data.

### Wait for a `/pets` backend + sync
- Pros: Cross-device.
- Cons: Breaks the offline-first, guest-first, zero-connectivity requirement.
- Rejected: Out of scope for v1 by explicit product constraint.

## Consequences
- Mobile gains a real local relational store; future user-data features reuse
  the `src/db/` + Zustand pattern.
- A schema-migration story will be needed once the schema evolves post-release;
  v1 defers it (single `CREATE TABLE IF NOT EXISTS`). Adding columns later that
  must populate existing rows is the first thing that forces a migration step.
- Native module → photo picker and DB need a real device/emulator build; some
  tests must mock `expo-sqlite`.

## Guardrails

**Always**
- Put user-generated relational data in `expo-sqlite` via the `src/db/` module;
  keep DB access typed and isolated from screens (screens talk to the store).
- Store timestamps UTC, display Jalali (ADR-0010).
- Keep the feature fully functional offline.

**Ask first**
- Before changing the `pets` schema after merge (needs a migration plan).
- Before introducing a migration framework or a second DB.
- Before adding a backend `/pets` table or sync (changes the storage contract).

**Never**
- Never store mutable user records in SecureStore or as bundled JSON.
- Never gate pet CRUD behind a network call or a login.
