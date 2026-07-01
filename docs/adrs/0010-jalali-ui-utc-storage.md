# ADR-0010: Jalali (Shamsi) dates in the UI, UTC in storage

## Status
Accepted

## Date
2026-06-17

## Context
The audience is Persian-speaking users in Iran, where the Jalali (Shamsi)
calendar is the everyday calendar. Showing Gregorian dates would feel foreign and
wrong. At the same time, storing localized/Jalali strings in the database makes
querying, sorting, and a future timezone-correct backend painful. Reminder times
additionally carry a wall-clock expectation in Tehran local time.

## Decision
Split calendar concerns by layer:
- **Display layer:** all user-facing dates are **Jalali**, converted with
  `date-fns-jalali`. No Gregorian dates are ever shown to users.
- **Storage layer:** all timestamps are stored as **timezone-aware UTC**
  (`DateTime(timezone=True)` on the backend; UTC in the on-device DB). Conversion
  to Jalali happens only at render time.
- **Reminder times** are authored by users as Tehran local wall-clock (UTC+03:30);
  the client converts to true UTC for storage/scheduling, and back to Jalali +
  local time for display.

## Alternatives Considered

### Store Jalali date strings directly
- Pros: No conversion on read.
- Cons: Hard to sort/query; breaks timezone math; couples storage to a locale.
- Rejected: Storage must stay locale- and timezone-neutral.

### Gregorian in the UI
- Pros: Simpler (no jalali lib).
- Cons: Wrong for the audience; violates a core product requirement.
- Rejected: Non-negotiable product constraint.

## Consequences
- A clean boundary: convert to Jalali at the edge, compute/store in UTC.
- `date-fns-jalali` is a dependency from day one (imported early even before
  first use) so the boundary is established.
- Jalali boundary cases (month/year transitions) must be unit-tested.

## Guardrails

**Always**
- Show Jalali dates in all user-facing UI; convert with `date-fns-jalali`.
- Store every timestamp as timezone-aware UTC; convert to Jalali only at display.
- Treat reminder input as Tehran local wall-clock; convert to UTC for storage.
- Use `start`/`end` (never `left`/`right`) in RTL StyleSheets; keep Farsi strings
  in `i18n/fa.json`, never inline.

**Ask first**
- Before introducing any second display calendar or changing the storage timezone
  convention.

**Never**
- Never show a Gregorian date to a user.
- Never store localized/Jalali date strings as the source of truth.
