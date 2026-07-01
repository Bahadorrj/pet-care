# ADR-0018: Swipeable bottom tabs via material-top-tabs pinned to the bottom

## Status
Accepted

## Date
2026-06-28

> Supersedes ADR-0014 (bottom Tab navigator as the root shell). The two-tab,
> RTL-aware, auth-optional shell from ADR-0014 is unchanged in shape — only the
> underlying navigator and the gesture affordance change.

## Context
Users asked to switch between the root tabs (Pets ↔ Tasks) with a horizontal
swipe, not only by tapping the tab bar. The root navigator
(`src/navigation/RootNavigator.tsx`) used `@react-navigation/bottom-tabs`, which
renders a tap-only tab bar — it has **no swipe-between-tabs option**. There is no
configuration flag that adds the gesture; the navigator itself has to change.

In the React Navigation family, the standard way to get finger-following swipe
between tabs is `createMaterialTopTabNavigator`, which is backed by
`react-native-pager-view`. It normally sits at the top, but `tabBarPosition="bottom"`
moves it down so the app keeps a bottom tab shell.

## Decision
Replace `createBottomTabNavigator` with `createMaterialTopTabNavigator`,
`tabBarPosition="bottom"`, swipe enabled (the default), and a **custom tab bar**.

- **Custom bar (`src/navigation/BottomTabBar.tsx`).** material-top-tabs' default
  bar is Material-styled (top indicator, ripple) and does not match the design.
  A ~70-line custom bar (`MaterialTopTabBarProps`) replicates the flat "Quiet
  Garden" look the old bottom-tabs bar gave for free: Warm Paper canvas, no top
  border or shadow, Ionicons outline icons, emerald active tint / Ink Muted
  inactive, bottom safe-area inset, 44×44 touch targets, and the standard
  `tabPress`-emit + `navigate` press behavior. Accessibility (`role="button"`,
  `state.selected`, label) is set explicitly since the default bar no longer
  provides it.
- **Icons** are mapped by `route.name` inside the bar, because material-top-tabs
  has no `tabBarIcon` screen option (unlike bottom-tabs). Labels stay in `fa.json`
  (`tab.pets`, `tab.tasks`) and are passed via the `title` screen option.
- **Swipe scope: everywhere.** The gesture is active even on pushed Detail/Form
  screens. Switching tabs preserves each stack's state (no data loss), and the
  return swipe restores the pushed screen. Android is the primary target, where
  the native back-gesture is not edge-swipe by default, so the conflict is
  minimal.
- **RTL.** `react-native-tab-view` flips swipe direction under `I18nManager.isRTL`
  automatically; the bar row follows device direction via flexbox. No hard-coded
  `left`/`right`.
- **Two new dependencies**, both installed via `expo install` (SDK-56-pinned):
  `@react-navigation/material-top-tabs` and `react-native-pager-view`.
  `react-native-tab-view` ships inside material-top-tabs; reanimated and
  gesture-handler were already present.

The hidden Profile tab stays hidden (commented `<Tab.Screen>` + retained
`ProfileStack` import), exactly as before.

## Alternatives Considered

### Keep bottom-tabs; hand-roll a PanGesture that navigates on swipe
- Pros: No new dependency.
- Cons: No page-follow (the screen would jump, not track the finger), and a
  hand-rolled horizontal pan conflicts with native-stack and scroll gestures and
  has to special-case RTL and per-screen enablement. Reimplements, badly, what
  the pager already does.
- Rejected: more fragile code for a worse result than the first-party library.

### material-top-tabs at the top (default position)
- Pros: Zero custom bar.
- Cons: Moves navigation to the top and adopts the Material indicator/ripple look
  — a different visual register that breaks the design system.
- Rejected: the app's shell is a bottom bar; only the gesture was requested.

## Consequences
- The exported `RootTabNavigationProp` changes from `BottomTabNavigationProp` to
  `MaterialTopTabNavigationProp`. The `RootTabParamList` contract and route names
  are unchanged, so `navRef` typing and `taskNotifications`' navigate-by-name to
  the `Tasks` tab keep working.
- **DESIGN.md is reconciled** (same commit): the "Don't add motion to tab
  transitions" Don't-rule gains a scoped exception for the swipe page-follow,
  which is direct manipulation that signals the gesture — not decorative
  choreography. This mirrors the ADR-0017 toast-stripe carve-out.
- A small custom component (`BottomTabBar.tsx`) now owns tab-bar rendering and its
  own accessibility; future tab-bar tweaks live there, not in `screenOptions`.
- `react-native-pager-view` is a native module — a fresh dev build is required
  after install (`npx expo run:android`).

## Guardrails

**Always**
- Keep the bar flat: Warm Paper background, no top border or shadow (Ambient-Only
  rule). Active state = emerald tint only; inactive = Ink Muted.
- Keep auth optional and the Profile tab's hidden-but-intact state (ADR-0011,
  ADR-0014); restore it by uncommenting the `<Tab.Screen>`.
- Use `start`/`end`, never `left`/`right`; rely on the pager's built-in RTL.
- Tab labels stay in `src/i18n/fa.json` (flat keys); never inline in components.

**Ask first**
- Before adding navigation dependencies beyond material-top-tabs / pager-view.
- Before restricting swipe scope (e.g. disabling it inside pushed screens) or
  changing the tab set.

**Never**
- Re-introduce the Material indicator/ripple bar or move tabs to the top.
- Add decorative motion to tab transitions beyond the sanctioned swipe
  page-follow.
- Hard-code Farsi strings or `left`/`right` positions in the tab bar.
