# ADR-0014: Bottom Tab navigator as the root navigation shell

## Status
Accepted

## Date
2026-06-18

> Supersedes the single native-stack root introduced in the foundation spec.
> Implements `docs/specs/03-profile-tab.md`.

## Context
The app currently has one root `NativeStack` navigator covering three screens:
`Home`, `Signin`, and `Signup`. The sign-in / sign-up entry point lives on
`HomeScreen` as a footer button. Before feature tabs (symptoms, hazards,
reminders) are added, the app needs a proper tab shell and a single, predictable
home for the account/auth flow. Auth must remain **optional** — no knowledge
feature is gated behind login (ADR-0011).

## Decision
Replace the single native-stack root with a **bottom Tab navigator** (`@react-navigation/bottom-tabs`) containing two tabs: **Home** (first) and **Profile** (last).

- `HomeScreen` becomes brand-only: logo, name, tagline — **no auth button**.
- A new `ProfileScreen` lives at the root of the Profile tab, showing a
  sign-in prompt when logged out and email + logout when logged in.
- `SigninScreen` / `SignupScreen` are **relocated** (not rewritten) into a
  `ProfileStack` (native stack) nested inside the Profile tab. The `Signin ↔
  Signup` link is unchanged; auth screens push over the Profile tab.
- Tab icons come from `@expo/vector-icons` (Ionicons), which ships with Expo —
  **no new dependency** beyond `@react-navigation/bottom-tabs`.
- Tab labels are Farsi (`tab.home`, `tab.profile` in `fa.json`). React
  Navigation renders the tab bar RTL-aware under `I18nManager.isRTL`
  automatically; tab *order* is declared `[Home, Profile]` and visual placement
  follows the device direction without any hard-coded `left`/`right`.

Navigation shape after this change:

```
RootNavigator  (Bottom Tab)
├── Home    tab → HomeScreen
└── Profile tab → ProfileStack (Native Stack)
                  ├── Profile  → ProfileScreen   (headerShown: false)
                  ├── Signin   → SigninScreen
                  └── Signup   → SignupScreen
```

Typed route contracts:

```ts
// RootTabParamList
{ Home: undefined; Profile: undefined }

// ProfileStackParamList
{ Profile: undefined; Signin: undefined; Signup: undefined }
```

## Alternatives Considered

### Keep the single native stack; add a custom tab bar component
- Pros: Zero extra dependency; full control over tab rendering.
- Cons: Reimplements accessibility, keyboard-avoidance, and RTL tab ordering
  that `@react-navigation/bottom-tabs` already handles correctly.
- Rejected: The official library is already the standard for this stack (same
  React Navigation family as the installed `native-stack`).

### Modal-based auth (sheet over Home)
- Pros: No structural navigation change.
- Cons: Fights the product direction: auth should have its own home (Profile
  tab), not be a transient overlay on top of Home.
- Rejected: The spec is explicit that auth lives in the Profile tab.

### Add a third "Auth" tab visible only when logged out
- Pros: Keeps Home simple.
- Cons: Tab bar contents changing with auth state is disorienting and unusual
  on Android.
- Rejected: Auth screens nest inside Profile, not a separate top-level tab.

## Consequences
- The root of the navigation tree is now a Tab navigator; any future feature
  tab (symptoms, reminders, pets) slots between Home and Profile by index.
- `SigninScreen` / `SignupScreen` are now hosted by `ProfileStack`; their
  navigation prop types reference `ProfileStackParamList`. If the auth screens
  previously typed against `RootStackParamList`, the import path updates — no
  behavioral change.
- `home.profile` key in `fa.json` may become unreferenced once the Home button
  is removed; it is **not deleted** (project convention: never remove existing
  i18n keys in this layer).
- `@react-navigation/bottom-tabs` is added as a runtime dependency. It is the
  same React Navigation v6 family as the already-installed packages, so no
  peer-dependency conflict.

## Guardrails

**Always**
- Keep auth optional: no tab, screen, or route may gate knowledge features
  behind login (ADR-0011).
- Use `start`/`end` in StyleSheet (never `left`/`right`); rely on React
  Navigation's built-in RTL tab-order, not manual position overrides.
- All Farsi strings in `src/i18n/fa.json` (flat keys); none inline in
  components.
- Reuse `SigninScreen` / `SignupScreen` as-is inside `ProfileStack`; do not
  duplicate them.

**Ask first**
- Before adding any dependency beyond `@react-navigation/bottom-tabs`.
- Before adding a third tab or any Profile row beyond email + logout.
- Before changing `authStore`, the JWT payload, or auth screen behavior.

**Never**
- Gate `HomeScreen` (or any knowledge feature) behind login.
- Hard-code Farsi strings in components.
- Use `left`/`right` in StyleSheet.
- Add delete-account in this layer (deferred — separate spec per ADR-0011 /
  PRD Q#5).
