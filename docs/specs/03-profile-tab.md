# Spec: Profile Tab — Bottom Tabs + Relocated Auth Entry

Status: **DRAFT — awaiting approval**
Owner: mobile
Related ADR: `docs/ard/0014-bottom-tab-navigation.md` (to be added during implementation)

## Objective

Convert the app's navigation from a single native **Stack** to a bottom **Tab navigator**, and
move the sign-in / sign-up entry point off the Home screen into a dedicated **Profile** tab.
Profile becomes the only place auth is reachable.

**Target users:** Guest-first pet owners. Auth stays **optional** (PRD: knowledge features need
no login) — this layer only relocates the entry point, it does not gate anything.
**Core problem:** Auth currently lives on a `HomeScreen` button. Before feature tabs (symptoms,
hazards, reminders) get added, the app needs a proper tab shell and a single, predictable home
for the account/auth flow.
**Success at this layer:** App opens on a bottom tab bar `[Home, Profile]`; Home is brand-only
with no auth button; the Profile tab shows a sign-in entry when logged out and email + logout
when logged in; session persistence is unchanged.

---

## Scope

### In scope
- Bottom **Tab navigator** as the root, with two tabs: **Home** (first) and **Profile** (last).
- `HomeScreen`: **remove** the auth/profile footer button; it becomes brand-only (logo, name, tagline).
- New **`ProfileScreen`** with two states:
  - **Logged out:** one-line Farsi prompt + a "ورود / ثبت‌نام" button → pushes existing `SigninScreen`.
  - **Logged in:** the user's email + a "خروج" (logout) button calling `authStore.logout()`.
- `SigninScreen` / `SignupScreen` are **reused as-is**, relocated into a stack nested **inside the
  Profile tab** so they push over the Profile tab (and `Signin ↔ Signup` linking is unchanged).
- Farsi tab labels; minimal tab icons via `@expo/vector-icons` (Ionicons, bundled with Expo).
- Typed route contracts updated: a tab param list + a Profile stack param list.
- All new strings in `src/i18n/fa.json`.

### Explicitly out of scope
- **Delete-account** flow (deferred to a later spec; still required before store submission — PRD Q#5).
- Avatar, editable display name, any settings/preferences list, language toggle (app is Farsi-only).
- Any third feature tab (symptoms / hazards / reminders / pets) — those slot between Home and Profile later.
- Custom tab-bar styling beyond labels + a basic icon per tab.
- Password reset, email verification, onboarding (already out per foundation spec).
- iOS.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (SDK 56), TypeScript strict |
| Navigation | React Navigation v6 — **Native Stack + new `@react-navigation/bottom-tabs`** |
| Tab icons | `@expo/vector-icons` (Ionicons) — ships with Expo, **no new dependency** |
| Auth state | Zustand `authStore` (unchanged) |
| JWT storage | `expo-secure-store` (unchanged) |
| i18n | react-i18next + `src/i18n/fa.json` (flat keys) |

> **New dependency:** `@react-navigation/bottom-tabs` (same family as the already-installed
> `@react-navigation/native-stack`). No other deps. This is the only "ask first" item and is
> approved by this spec.

---

## Commands

```bash
cd mobile
npm install                       # picks up @react-navigation/bottom-tabs
npx expo run:android              # build + launch on emulator/device
npm test                          # jest
npx tsc --noEmit                  # typecheck gate (must be 0 errors)
```

---

## Project Structure

Files touched. Only navigation + Home + the new Profile screen change; auth screens move but
are not rewritten.

```
mobile/
  src/
    navigation/
      RootNavigator.tsx       → becomes a Bottom Tab navigator: [Home, Profile]   [CORE]
      ProfileStack.tsx        → NEW: native stack inside Profile tab (Profile, Signin, Signup)
    screens/
      HomeScreen.tsx          → remove auth footer button; brand-only
      ProfileScreen.tsx       → NEW: logged-out prompt+button / logged-in email+logout
      auth/
        SigninScreen.tsx      → unchanged (now hosted by ProfileStack)
        SignupScreen.tsx      → unchanged (now hosted by ProfileStack)
    i18n/
      fa.json                 → add tab + profile strings
  src/__tests__/
    RootNavigator.test.tsx    → NEW: renders both tabs
    ProfileScreen.test.tsx    → NEW: logged-out vs logged-in states
    HomeScreen.test.tsx       → update: assert no auth button
```

---

## Navigation Shape

```
RootNavigator  (Bottom Tab)
├── Home   tab → HomeScreen            (plain screen, no stack yet)
└── Profile tab → ProfileStack (Native Stack)
                  ├── Profile  → ProfileScreen   (headerShown: false)
                  ├── Signin   → SigninScreen
                  └── Signup   → SignupScreen
```

Typed contracts:

```ts
// RootNavigator.tsx
export type RootTabParamList = {
  Home: undefined;
  Profile: undefined;          // Profile tab = ProfileStack
};

// ProfileStack.tsx
export type ProfileStackParamList = {
  Profile: undefined;
  Signin: undefined;
  Signup: undefined;
};
export type ProfileNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;
```

> **RTL note:** Tab *order* is `[Home, Profile]`; "last" = Profile. React Navigation renders the
> tab bar RTL-aware automatically under `I18nManager.isRTL`, so Profile sits on the visual side
> that reads as "last" in Farsi. Do not hard-code left/right ordering.

> **`SigninScreen` / `SignupScreen` are not edited.** They currently type their navigation against
> `RootNavigationProp`; that type now lives on `ProfileStack` with the same `Signin`/`Signup`
> routes, so the route names they call stay valid. Update the import path/type alias only if `tsc`
> requires it — no behavioral change.

---

## Code Style

Tab navigator with Farsi labels and minimal icons (token-driven, RTL-safe):

```tsx
// RootNavigator.tsx
const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('tab.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: t('tab.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
```

```tsx
// ProfileScreen.tsx — two states, reuse Button primitive
export default function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ProfileNavigationProp>();
  const { isAuthenticated, email, logout } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.prompt}>{t('profile.signin_prompt')}</Text>
        <Button label={t('home.signin_signup')} onPress={() => navigation.navigate('Signin')} />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.email}>{email}</Text>
      <Button variant="secondary" label={t('profile.logout')} onPress={() => logout()} />
    </SafeAreaView>
  );
}
```

**Key conventions (unchanged from foundation spec):**
- TypeScript strict — no `any`.
- All Farsi strings in `src/i18n/fa.json`; flat keys; never inline.
- `start`/`end` in StyleSheet, never `left`/`right`.
- Import theme tokens (`colors`, `spacing`, …); reuse `components/ui/Button`.
- Select font weights by family name, not `fontWeight`.

---

## i18n Strings (this layer)

```json
{
  "tab.home": "خانه",
  "tab.profile": "پروفایل",
  "profile.signin_prompt": "برای ذخیره و همگام‌سازی وارد شوید",
  "profile.logout": "خروج"
}
```

> Reuses existing `home.signin_signup` ("ورود / ثبت‌نام") for the Profile sign-in button.
> Existing `home.profile` may become unused once the Home button is removed — leave it; do not
> delete pre-existing keys in this layer.

---

## Testing Strategy

Jest + jest-expo + @testing-library/react-native. No snapshot tests.

- **`RootNavigator`:** renders a tab bar with both `tab.home` and `tab.profile` labels; defaults
  to the Home tab.
- **`ProfileScreen` (logged out):** renders `profile.signin_prompt` + sign-in button; pressing it
  navigates to `Signin`. (auth store mocked: `isAuthenticated = false`.)
- **`ProfileScreen` (logged in):** renders the email and a logout button; pressing it calls
  `logout()`. (auth store mocked: `isAuthenticated = true`, `email` set.)
- **`HomeScreen`:** asserts the auth/profile button is **no longer present**; logo + app name still render.
- Existing `SigninScreen` / `SignupScreen` / `authStore` tests must stay green unchanged.

Coverage: cover both Profile states and the tab render. `npx tsc --noEmit` = 0 errors is the hard gate.

---

## Boundaries

**Always:**
- Keep auth **optional** — no tab or screen gates the app behind login (PRD).
- `start`/`end` in StyleSheet; all Farsi strings in `fa.json`.
- Reuse `SigninScreen`/`SignupScreen` as-is; only relocate them.
- Run `npx tsc --noEmit` and `npm test` green before declaring a task done.
- Add ADR-0014 (bottom-tab navigation) and reconcile this spec (project convention).
- Run `graphify update .` after code changes.

**Ask first:**
- Adding any dependency beyond `@react-navigation/bottom-tabs`.
- Adding a third tab, or any Profile row beyond email + logout.
- Changing `authStore`, the JWT payload, or auth screen behavior.

**Never:**
- Gate Home (or any knowledge feature) behind login.
- Hardcode Farsi strings in components, or use `left`/`right`.
- Add delete-account in this layer (deferred — separate spec).
- Remove or weaken a passing test to make the suite green.

---

## Success Criteria (testable)

- [ ] App launches to a bottom tab bar with exactly two tabs: **Home** (first) and **Profile** (last), Farsi labels.
- [ ] `HomeScreen` shows logo + app name + tagline and **no auth/profile button**.
- [ ] Profile tab while **logged out** shows the prompt + "ورود / ثبت‌نام"; tapping it opens `SigninScreen`, which still links to `SignupScreen`.
- [ ] Sign in / sign up from the Profile tab succeeds → Profile tab now shows the user's email + "خروج".
- [ ] Tapping "خروج" logs out → Profile tab returns to the logged-out prompt; no crash.
- [ ] App restart with a stored JWT → Profile tab shows email + logout (persistence intact).
- [ ] Auth is reachable **only** from the Profile tab — no auth entry remains on Home.
- [ ] `npx tsc --noEmit` returns 0 errors; `npm test` passes.
- [ ] ADR-0014 added; this spec committed under `docs/specs/`.

## Open Questions

None outstanding. (Resolved in interview: tabs = `[Home, Profile]`; auth nested in Profile stack;
delete-account deferred; logged-in Profile = email + logout; logged-out = prompt + reused Signin.)
