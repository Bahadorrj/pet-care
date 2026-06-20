---
target: mobile username flow (Signup/Profile/ChangeUsername)
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T21-21-22Z
slug: mobile-src-screens-username-flow
---
# Critique — Mobile username flow (Signup · Profile · ChangeUsername)

Register: product. Brand: quiet warmth, calm/caring, Persian-native RTL, WCAG AA.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Button shows loading; change-username succeeds silently (goBack, no confirmation) |
| 2 | Match System / Real World | 3 | Persian + @handle convention good; some error copy misleads |
| 3 | User Control and Freedom | 3 | Native header back = cancel; no explicit Cancel on change screen |
| 4 | Consistency and Standards | 3 | ChangeUsername mirrors Signup well; relies on implicit header affordance |
| 5 | Error Prevention | 2 | No format hint (3–30, a-z0-9_) anywhere → users learn rules only by failing |
| 6 | Recognition Rather Than Recall | 2 | Rules must be recalled, never shown |
| 7 | Flexibility and Efficiency | 3 | Fine for the task scope |
| 8 | Aesthetic and Minimalist | 3 | Clean, on-brand; change screen a touch sparse/contextless |
| 9 | Error Recovery | 2 | 400 username-dup shows "email already registered"; 422 ambiguous |
| 10 | Help and Documentation | 2 | No inline guidance at the one point it's needed |
| **Total** | | **26/40** | **Acceptable — functional, needs error/prevention polish** |

## Anti-Patterns Verdict
Not AI slop. Detector clean (N/A for RN). Screens use the project's own theme tokens, "quiet warmth" holds, structure is consistent with existing auth screens. No generic-template tells.

## What's Working
- **Consistency:** ChangeUsernameScreen faithfully mirrors SignupScreen (SafeArea → KeyboardAvoiding → centered form → error banner → Button), reuses TextField/Button primitives, theme tokens, and the `useRef` in-flight guard. Learnable, predictable.
- **Truthful state:** mobile stores the server-returned (lowercased) username, so the displayed @handle never diverges from what's persisted.
- **Quiet, on-brand:** no clutter, warm paper canvas, single emerald accent. Fits "disappear into the task."

## Priority Issues

- **[P1] Wrong error message on duplicate username (Signup).** `SignupScreen` maps HTTP 400 only to `auth.error.email_taken`, but register returns 400 for a taken *username* too. A user who picks an existing @handle is told their *email* is already registered. **Why:** actively misleading at a high-friction moment — they'll edit the wrong field. **Fix:** branch on the response `detail` (`username_already_registered` vs `email_already_registered`) → distinct messages. **Command:** `/impeccable clarify`

- **[P1] No format guidance → blind 422s.** Neither Signup nor ChangeUsername shows the username rules (3–30 chars, letters/numbers/underscore). The only way to discover them is to fail validation. **Why:** pure extraneous load; violates error prevention at the exact decision point. **Fix:** one inline hint line under the field (caption, inkMuted): "۳ تا ۳۰ حرف انگلیسی، عدد یا زیرخط". **Command:** `/impeccable harden`

- **[P2] One error flag reds every field (Signup).** All three fields share `invalid={error !== ''}`, so any error (even a network failure) marks email + password + username invalid. **Why:** destroys the signal of *which* field failed. **Fix:** field-scoped error state, or drop `invalid` from fields and rely on the banner. (Pre-existing pattern — fix holistically.) **Command:** `/impeccable polish`

- **[P2] RTL × LTR @handle direction.** `@username` is always Latin rendered inside a forced-RTL layout. Without explicit direction, the `@` can detach to the wrong side / bidi-reorder. **Why:** the @handle is identity; mangled rendering reads as broken. **Fix:** wrap the handle with LTR isolation (`writingDirection: 'ltr'` / U+2066…U+2069 or a dedicated style). **Command:** `/impeccable adapt`

- **[P2] Ambiguous 422 copy (Signup).** 422 can mean weak password OR invalid username, but the message describes username rules only. **Why:** a password failure shows a username message. **Fix:** combined constraint message, or distinguish via `detail.loc`. **Command:** `/impeccable clarify`

## Persona Red Flags

**Jordan (First-Timer):** Picks "@ali" → 422 with no idea the minimum is 3 chars (no rules shown). On Signup, picks a taken handle → told "email already registered," edits a correct email in confusion. Two abandon points in one flow.

**Sam (Accessibility):** Invalid field is signalled by red border **color alone** (the banner text helps, but field-level state is color-only). Error banner is not announced — no `accessibilityLiveRegion="assertive"` / alert role, so a screen-reader user submits and hears nothing change. Button `accessibilityState` for disabled/busy not verified.

**Casey (Mobile, one-handed):** Centered form puts the submit button mid-screen — reachable. Local field state is lost if the app is backgrounded mid-edit (no draft retention) — minor for a single field.

## Minor Observations
- ChangeUsername succeeds silently (`goBack()`); the updated @handle on Profile is the only confirmation. A brief success toast/haptic would close the loop (peak-end).
- Submit is enabled when the field is empty or unchanged → a pointless round-trip / 422. Disable until the value is non-empty and differs from current.
- ChangeUsername screen has no subtitle/context; it's title + field + button in a large empty canvas. One line of context would warm it.

## Questions to Consider
- What confirms success — is the Profile @handle update enough, or does the moment deserve a beat of feedback?
- Should invalid input be *prevented* (live-filter to the allowed charset, length counter) rather than *reported* after the fact?
