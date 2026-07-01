# ADR-0002: Expo (bare workflow) as the React Native toolchain

## Status
Accepted

## Date
2026-06-17

## Context
React Native (ADR-0001) needs a toolchain for builds, native module linking, and
Android packaging. This layer requires `expo-secure-store` for encrypted JWT
storage and, later, local notifications and SQLite. The developer wants a working
Android build pipeline without hand-managing native module linking.

## Decision
Use **Expo (bare workflow)** with the `expo-template-blank-typescript` template.
Native dependencies are installed via `npx expo install` so Expo's autolinking
resolves them.

## Alternatives Considered

### Bare React Native CLI (no Expo)
- Pros: Maximum control over native config.
- Cons: Manual native module linking; more setup friction for `secure-store`,
  `screens`, and `safe-area-context`.
- Rejected: Setup cost competes with the 3-month timeline for no MVP benefit.

### Expo managed workflow (no native project checked in)
- Pros: Simplest possible workflow.
- Cons: Less control when a native tweak is needed for Iranian store builds;
  harder to drop down to native when required.
- Rejected: Bare workflow keeps the `android/` project available while still
  getting Expo's linking and packages.

## Consequences
- `expo-secure-store`, `react-native-screens`, and `react-native-safe-area-context`
  are linked via Expo autolinking — no manual `react-native link`.
- The `android/` native project is present and editable for store-specific builds.
- Native packages should be added with `npx expo install` (not bare `npm install`)
  so versions stay compatible with the Expo SDK.

## Guardrails

**Always**
- Install native modules with `npx expo install`, not `npm install`, so the
  resolved version matches the Expo SDK.
- Keep `expo-secure-store` as the JWT store (see ADR-0012).

**Ask first**
- Before ejecting away from Expo or switching to bare RN CLI.
- Before adding a native module that lacks Expo support.

**Never**
- Never reintroduce manual `react-native link` steps; rely on autolinking.
