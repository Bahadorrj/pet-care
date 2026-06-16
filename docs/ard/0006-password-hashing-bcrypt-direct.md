# ADR-0006: Password hashing with bcrypt directly (not passlib)

## Status
Accepted

## Date
2026-06-17

> **Diverges from the spec.** `docs/specs/01-foundation-layer.md` originally
> specified `passlib` (bcrypt via passlib). This ADR records the switch to the
> `bcrypt` library directly and supersedes that choice. The spec has been
> reconciled to point here.

## Context
Passwords must be hashed with bcrypt (cost 12) before storage — never plaintext.
The spec assumed `passlib` as the wrapper. In practice, `passlib` 1.7.4 is
incompatible with `bcrypt >= 4.1`: passlib reads `bcrypt.__about__.__version__`
(removed in bcrypt 4.1) and relies on a wrap-bug detection API that changed,
producing errors/warnings at hashing time.

## Decision
Use the **`bcrypt` library directly**:
- `hash_password` → `bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12))`,
  stored as a UTF-8 string.
- `verify_password` → `bcrypt.checkpw(...)`.

The login path also verifies against a module-level dummy hash when the email is
not found, so login does a constant-time bcrypt comparison either way and does
not leak (via timing) whether an account exists.

## Alternatives Considered

### passlib (original spec choice)
- Pros: Algorithm-agnostic API; easy future migration to argon2.
- Cons: Broken against current bcrypt; effectively low-maintenance.
- Rejected: Incompatible with the bcrypt version in use.

### argon2-cffi
- Pros: Modern, memory-hard.
- Cons: Adds a native dependency; bcrypt cost-12 is sufficient for MVP and is what
  the spec mandated.
- Rejected for now: No MVP need to change the algorithm.

## Consequences
- One direct dependency (`bcrypt`), no wrapper layer to break on upgrades.
- Cost factor is explicit in code (`rounds=12`).
- A future move to argon2 would be a new ADR and a rehash-on-login strategy.

## Guardrails

**Always**
- Hash with `bcrypt` directly at cost 12 before storing; store the UTF-8 hash.
- Keep the constant-time dummy-hash verify on the login path (anti-enumeration).

**Ask first**
- Before changing the hashing algorithm or cost factor (affects every stored
  hash and login latency).

**Never**
- Never reintroduce `passlib`.
- Never store or log plaintext passwords.
