# Implementation Plan: Profile Tab — Bottom Tabs + Relocated Auth

Spec: `docs/specs/03-profile-tab.md`
Status: **DRAFT — awaiting approval**

## Overview

Swap the root native-stack navigator for a bottom **Tab** navigator `[Home, Profile]`, nest the
existing auth screens inside the Profile tab, add a `ProfileScreen` (logged-out prompt / logged-in
email+logout), and strip the auth button off `HomeScreen`. Pure navigation restructure + one new
screen; no backend, no auth-logic changes.

## Architecture Decisions

- **Tab over Drawer:** bottom tabs match the PRD's mobile patterns and "tab at the end" ask. (ADR-0014)
- **Auth nested inside the Profile tab** (a `ProfileStack`), not at root: keeps auth reachable only
  from Profile and lets `Signin ↔ Signup` push within the tab. Confirmed in interview.
- **Reuse `SigninScreen`/`SignupScreen` unchanged:** only the hosting navigator + nav type move.
  Same `Signin`/`Signup` route names, so no behavioral change.
- **Icons via `@expo/vector-icons`** (bundled) — only `@react-navigation/bottom-tabs` is new.
- **`@expo/vector-icons` Ionicons** placeholder icons; real iconography deferred.

## Dependency Graph

```
Task 1  deps + i18n + ADR  (foundation, no behavior)
   │
   ├── Task 2  ProfileStack types + ProfileScreen   (needs i18n keys)
   │       │
   │       └── Task 3  RootNavigator → bottom tabs   (needs ProfileStack + bottom-tabs dep)
   │               │
   │               └── Task 4  HomeScreen: remove auth button
   │
   └── (tests folded into Tasks 2–4; Task 5 = nav render test)
```

Bottom-up: foundation → Profile slice → tab shell → Home cleanup → nav test.

---

## Task List

### Phase 1: Foundation

## Task 1: Add bottom-tabs dep, i18n strings, and ADR-0014

**Description:** Install `@react-navigation/bottom-tabs`, add the new Farsi strings, and record the
navigation decision. No component changes yet.

**Acceptance criteria:**
- [ ] `@react-navigation/bottom-tabs` in `mobile/package.json` and installed.
- [ ] `tab.home`, `tab.profile`, `profile.signin_prompt`, `profile.logout` added to `src/i18n/fa.json`.
- [ ] `docs/ard/0014-bottom-tab-navigation.md` written.

**Verification:**
- [ ] `npx tsc --noEmit` → 0 errors; `npm test` still green (no behavior changed).
- [ ] Manual: keys resolve (no missing-key warnings) once used in Task 2/3.

**Dependencies:** None
**Files:** `mobile/package.json`, `mobile/package-lock.json`, `mobile/src/i18n/fa.json`, `docs/ard/0014-bottom-tab-navigation.md`
**Scope:** S

---

### Phase 2: Profile slice

## Task 2: ProfileStack + ProfileScreen (both auth states)

**Description:** Add `ProfileStack.tsx` (native stack: `Profile`, `Signin`, `Signup` with the
existing header chrome) and `ProfileScreen.tsx` rendering the logged-out prompt+button and the
logged-in email+logout. Write the screen tests alongside.

**Acceptance criteria:**
- [ ] `ProfileStackParamList` + `ProfileNavigationProp` exported from `ProfileStack.tsx`.
- [ ] Logged out: renders `profile.signin_prompt` + `home.signin_signup` button → `navigate('Signin')`.
- [ ] Logged in: renders `email` + `profile.logout` button → calls `authStore.logout()`.
- [ ] `Signin`/`Signup` reachable inside the stack with existing chrome and `Signin ↔ Signup` linking.

**Verification:**
- [ ] `ProfileScreen.test.tsx`: both states + button actions (authStore mocked) pass.
- [ ] `npx tsc --noEmit` → 0 errors.

**Dependencies:** Task 1
**Files:** `mobile/src/navigation/ProfileStack.tsx`, `mobile/src/screens/ProfileScreen.tsx`, `mobile/src/__tests__/ProfileScreen.test.tsx`
**Scope:** M

---

### Phase 3: Shell + cleanup

## Task 3: Convert RootNavigator to bottom tabs

**Description:** Replace the root native stack with `createBottomTabNavigator` exposing `Home` and
`Profile` (= `ProfileStack`), Farsi labels, Ionicons icons, theme-token colors, `headerShown: false`.

**Acceptance criteria:**
- [ ] `RootTabParamList = { Home; Profile }` exported; old `RootStackParamList` removed/replaced.
- [ ] Tabs render in order `[Home, Profile]`; defaults to Home; RTL ordering left to React Navigation.
- [ ] `Signin`/`Signup` no longer top-level routes (now under ProfileStack).

**Verification:**
- [ ] `npx tsc --noEmit` → 0 errors (catches any stale `RootNavigationProp` references in auth screens).
- [ ] App launches to a two-tab bar (manual emulator check at checkpoint).

**Dependencies:** Task 2
**Files:** `mobile/src/navigation/RootNavigator.tsx` (+ minimal import/type fix in `auth/SigninScreen.tsx`/`SignupScreen.tsx` only if `tsc` requires)
**Scope:** S

---

## Task 4: Strip auth button from HomeScreen

**Description:** Remove the footer `Button` and its `navigation`/`isAuthenticated` wiring from
`HomeScreen`; it becomes brand-only (logo, name, tagline). Update its test.

**Acceptance criteria:**
- [ ] No auth/profile button renders on Home; logo + app name + tagline remain.
- [ ] Orphaned imports/handlers (`Button`, `useNavigation`, `useAuthStore`, `handleButtonPress`) removed.

**Verification:**
- [ ] `HomeScreen.test.tsx` updated: asserts no auth button, brand still present; passes.
- [ ] `npx tsc --noEmit` → 0 errors.

**Dependencies:** Task 3
**Files:** `mobile/src/screens/HomeScreen.tsx`, `mobile/src/__tests__/HomeScreen.test.tsx`
**Scope:** S

---

## Task 5: Navigator render test

**Description:** Add a test that the root navigator renders both tabs with Farsi labels and defaults
to Home.

**Acceptance criteria:**
- [ ] `RootNavigator.test.tsx` asserts `tab.home` + `tab.profile` present; Home active by default.

**Verification:**
- [ ] `npm test` full suite green; `npx tsc --noEmit` → 0 errors.

**Dependencies:** Task 3
**Files:** `mobile/src/__tests__/RootNavigator.test.tsx`
**Scope:** S

---

### Checkpoint: After Task 5 (all tasks)
- [ ] `npm test` passes; `npx tsc --noEmit` → 0 errors.
- [ ] Manual emulator: launch → `[Home, Profile]` tabs; Home has no auth button; Profile logged-out shows prompt+button → Signin→Signup; sign in → Profile shows email+logout; logout returns to prompt; restart keeps session.
- [ ] `graphify update .` run.
- [ ] Spec success criteria all checked; ready for review/commit.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `SigninScreen`/`SignupScreen` typed against old `RootNavigationProp` break on `tsc` | Med | Task 3 verification is `tsc`; fix is a one-line type/import swap (same route names) |
| One-line removal of Home button leaves orphan imports | Low | Task 4 acceptance explicitly removes orphans; `tsc` flags unused |
| bottom-tabs peer-dep mismatch with RN/Expo SDK 56 | Med | Install per Expo SDK 56 docs; `tsc` + launch at checkpoint catch it |
| RTL tab order surprises | Low | Don't hard-code; rely on React Navigation `I18nManager` handling; verify visually at checkpoint |

## Parallelization

Mostly sequential (each task depends on the previous). Task 5 (nav test) can run in parallel with
Task 4 once Task 3 lands. Not worth splitting across agents — total scope is S/M.

## Open Questions

None. (All resolved in interview + spec.)
