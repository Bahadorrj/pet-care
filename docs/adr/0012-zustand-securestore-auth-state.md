# ADR-0012: Zustand + expo-secure-store for mobile auth state

## Status
Accepted

## Date
2026-06-17

## Context
The mobile app needs one source of truth for auth state (`token`, `email`,
`isAuthenticated`) that screens read from, plus persistence of the JWT across app
restarts. The JWT is a credential, so it must be stored encrypted — not in
plaintext `AsyncStorage`. Session must restore *before first render* so the home
screen shows the correct guest/authenticated state immediately (ADR-0011).

## Decision
- **State:** a single **Zustand** store (`authStore.ts`) holding
  `{ token, email, isAuthenticated, login, logout }`. Screens read from it and do
  not keep local auth state.
- **Persistence:** the JWT is stored in **`expo-secure-store`** (encrypted).
  `login` persists the token; `logout` removes it.
- **Hydration:** the store reads the token from secure storage at
  initialization (store level, not a component lifecycle), so `isAuthenticated`
  is correct before the first render.
- **Transport:** the axios client attaches `Authorization: Bearer <token>` via a
  request interceptor when the store has a token.

## Alternatives Considered

### Redux Toolkit
- Pros: Powerful, well-known.
- Cons: Boilerplate-heavy for a tiny auth slice.
- Rejected: Zustand covers this with far less ceremony.

### React Context only
- Pros: No dependency.
- Cons: Awkward for non-component (store-level) hydration and for use outside the
  React tree (e.g. the axios interceptor).
- Rejected: Zustand reads cleanly from both component and non-component code.

### AsyncStorage for the token
- Pros: Simple.
- Cons: Plaintext — unacceptable for a credential.
- Rejected: JWT must be encrypted at rest.

## Consequences
- One store is the single source of auth truth; no scattered local state.
- Hydration-before-render keeps the home screen's guest/auth display correct on
  cold start (no re-login, no flash).
- The axios interceptor depends on the store, so the store must be initialized
  before requests fire.

## Guardrails

**Always**
- Keep `authStore` (Zustand) as the single source of auth state; screens read
  from it.
- Store the JWT in `expo-secure-store`; hydrate at store init, before first
  render.
- Attach the Bearer token via the axios interceptor from the store.

**Ask first**
- Before adding a second state manager, or storing additional sensitive data
  outside secure storage.
- Before adding a third-party/social auth SDK (see spec "Ask first").

**Never**
- Never store the JWT in plain `AsyncStorage`.
- Never hold auth state locally in components in a way that competes with the
  store.
