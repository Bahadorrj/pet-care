# ADR-0016: Chores — rule + completion log (approach B); first Notifee realization

## Status
Accepted

## Date
2026-06-20

## Context
The chores feature (`docs/specs/06-chores-spec.md`) is the first feature to
require **recurring scheduled reminders** — feeding, meds, play, grooming, vet,
and other user-defined tasks per pet. Two broad storage strategies were
considered:

- **Approach A — Materialise occurrences:** expand future occurrences into a
  table at creation time (one row per future fire-time). Simple to query ("what's
  due today?"), but future rows go stale on edits, accumulate unboundedly, and
  represent a truth that hasn't happened yet — violating offline-first simplicity.
- **Approach B — Rule + completion log:** store only the *rule* (the `Schedule`
  discriminated union as one `schedule_json` TEXT column) and a `chore_logs` table
  of what *actually* happened (done/skipped). Every derived view — today's agenda,
  notification fire-times, "missed", streak, adherence — is computed on demand by
  a pure engine (`lib/choreSchedule.ts`). Nothing future is ever written to
  storage.

Additionally, this feature is the **first concrete realisation** of ADR-0008
(local-only notifications via Notifee). ADR-0008 approved the dependency in
principle; this ADR records its first installation and usage.

## Decision

Use **approach B** (rule + completion log) for chore storage.

- Two tables: `chores` (rule) and `chore_logs` (one row per Done/Skipped action).
- `schedule_json` is a discriminated-union TEXT column; never queried into
  by SQL — always decoded in TypeScript.
- Future occurrences, "pending", and "missed" are **always derived**, never
  stored.
- Install **`@notifee/react-native`** (v9, pinned `^9.1.3`) as the notification
  scheduler. `syncNotifications()` cancels all and re-registers Notifee
  `TimestampTrigger` notifications for the next 60 days (cap: 200) on each app
  launch and after any chore mutation.
- Tehran time is a fixed **+03:30** offset constant (Iran dropped DST in 2022).

## Alternatives Considered

### Approach A — Materialise future occurrences
- Pros: Simple SQL queries for "what's due today".
- Cons: Rows go stale on rule edits; unbounded growth; materialising the future
  breaks the "store only truth" principle; reschedule on edit is error-prone.
- Rejected: Approach B's pure engine is cleaner and equally fast for a personal app.

### Expo Notifications (`expo-notifications`)
- Pros: Expo-native, no extra native dependency.
- Cons: Fewer features (no action buttons, limited scheduling options); ADR-0008
  already mandated Notifee.
- Rejected: Already resolved by ADR-0008.

## Consequences

- A pure, thoroughly-tested `lib/choreSchedule.ts` engine is the heart of the
  feature — all derived views (`Occurrence[]`, streak, adherence) go through it.
- Notifee is a native module: tests must mock `@notifee/react-native`; a real
  `expo run:android` build is required for notification verification.
- Full reschedule on every launch is O(chores × 60-day window) — acceptable for
  a personal app; revisit past ~hundreds of active chores.
  `// ponytail: full reschedule on each launch is O(chores×window); fine for a personal app, revisit past ~hundreds of chores`
- Schema follows ADR-0015 (additive `CREATE TABLE IF NOT EXISTS`, no migration
  framework in v1). Adding columns that need backfill triggers a migration story.
- Pet delete cascades to chores + logs in app code (no SQLite FK enforcement
  assumed, per ADR-0015).

## Guardrails

**Always**
- Derive occurrences, today's agenda, missed status, streak, and adherence from
  the rule + logs at query time — never materialise future occurrences to storage.
- Store `schedule_json` as a TEXT column (discriminated union); decode in TS only.
- Register notification triggers via Notifee `TimestampTrigger`; keep scheduling
  fully offline (ADR-0008).
- Store timestamps UTC, display Jalali + Tehran time (ADR-0010).
- Use the fixed **+03:30** offset for Tehran; do not introduce DST logic without
  a new ADR.

**Ask first**
- Before changing the `chores` or `chore_logs` schema after merge (needs a
  migration plan per ADR-0015).
- Before changing the 60-day / 200-trigger notification window constants.
- Before adding server-side chore sync or push (violates offline-first; new ADR
  required).
- Before reinstating a DST offset for Tehran.

**Never**
- Never materialise future occurrences as storage rows (breaks approach B).
- Never use FCM, Firebase, or Expo push for chore reminders (ADR-0008).
- Never store Jalali strings as the source of truth for timestamps.
