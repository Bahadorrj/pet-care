# ADR-0005: JWT authentication via PyJWT

## Status
Accepted

## Date
2026-06-17

> **Diverges from the spec.** `docs/specs/01-foundation-layer.md` originally
> specified `python-jose` for JWT. This ADR records the switch to PyJWT and
> supersedes that choice. The spec has been reconciled to point here.

## Context
Auth is stateless JWT (no server-side sessions, no third-party identity
provider) — the right fit for a mobile client that stores a token and replays it.
The foundation spec named `python-jose`. During security hardening, `python-jose`
was found to be effectively unmaintained and to carry known CVE exposure in its
cryptography handling; PyJWT is actively maintained and the de-facto standard.

## Decision
Use **PyJWT** (`import jwt`) for token creation and verification. Tokens are
HS256, signed with `SECRET_KEY`, payload `{"sub": <user_uuid>, "exp": <unix_ts>}`,
expiring in `JWT_EXPIRE_DAYS` (default 30). Any invalid/expired/tampered token
raises `HTTPException(401)` with a uniform `invalid_token` detail (no enumeration).

## Alternatives Considered

### python-jose (original spec choice)
- Pros: JOSE/JWK breadth.
- Cons: Low maintenance activity; known CVE exposure; more surface than HS256 JWT
  needs.
- Rejected: Security and maintenance risk outweigh unused features.

### authlib
- Pros: Full-featured OAuth/OIDC.
- Cons: Far more than stateless first-party JWT requires.
- Rejected: Overkill for the MVP auth model.

## Consequences
- `SECRET_KEY` is mandatory and validated at startup (the placeholder value is
  rejected by `config.py`); it must come from env/`.env`, never the repo.
- Algorithm and expiry are config-driven (`JWT_ALGORITHM`, `JWT_EXPIRE_DAYS`).
- Token errors are uniform 401s to avoid account enumeration.

## Guardrails

**Always**
- Use PyJWT (`import jwt`) for all token handling.
- Read `SECRET_KEY` from environment/settings; keep startup validation that
  rejects the placeholder.
- Return a uniform 401 on any token failure — no distinct messages that leak
  whether a token vs. a user was the problem.

**Ask first**
- Before changing the JWT payload shape, algorithm, or expiry (see spec
  "Ask first").
- Before adding refresh tokens or rotating-key (JWK) support.

**Never**
- Never reintroduce `python-jose`.
- Never commit `SECRET_KEY` or fall back to a hardcoded signing key.
