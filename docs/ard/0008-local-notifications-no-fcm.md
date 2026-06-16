# ADR-0008: Local notifications only (Notifee); no FCM

## Status
Accepted

## Date
2026-06-17

## Context
Reminders (feeding, medication, vaccination, grooming, vet appointments) are a
core MVP feature and must fire reliably for users in Iran. Google Firebase Cloud
Messaging (FCM) depends on Google Play Services, which is unreliable/unavailable
for the target audience and stores (Cafe Bazaar, Myket). Reminders are also
schedulable entirely on-device — they don't need a server round-trip.

## Decision
Use **on-device local notifications only**, scheduled with **Notifee**. No FCM,
no remote push service. Reminders are computed and scheduled locally from the
user's pet/reminder data and fire without any internet connection.

## Alternatives Considered

### FCM / Firebase Messaging
- Pros: Standard remote push; server-triggered.
- Cons: Requires Google Play Services — unreliable in Iran; adds a server
  dependency for something that is purely local.
- Rejected: Violates the offline-first, Iran-accessible requirement.

### Expo push notifications
- Pros: Easy in Expo.
- Cons: Routes through Expo/FCM infrastructure — same Play Services dependency.
- Rejected: Same reachability problem.

## Consequences
- Reminders work fully offline (a hard success criterion).
- No backend push infrastructure to build or host.
- Anything inherently server-initiated (e.g. future broadcast announcements)
  would need a different mechanism and its own ADR — it cannot lean on FCM.

## Guardrails

**Always**
- Schedule reminders as local notifications via Notifee.
- Keep reminder scheduling functional with no network connection.

**Ask first**
- Before adding any server-initiated notification capability (needs a non-FCM
  design and a new ADR).

**Never**
- Never use FCM, Firebase Messaging, or Expo push (Play Services dependency) — see
  PRD "Never".
