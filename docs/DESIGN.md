---
name: پت‌کر (PetCare)
description: Daily pet care companion for Persian-speaking families
colors:
  warm-paper: "#F6F5F1"
  white-surface: "#FFFFFF"
  sunken-well: "#EFEEE8"
  warm-ink: "#1A1A17"
  ink-muted: "#73726B"
  ink-faint: "#A8A79E"
  border-gentle: "#E4E2DA"
  border-firm: "#D2D0C6"
  garden-confident: "#1F7A55"
  garden-pressed: "#185F42"
  garden-soft: "#E7F1EB"
  on-garden: "#FFFFFF"
  alert-brick: "#B4231C"
  alert-soft: "#FBEAE8"
typography:
  display:
    fontFamily: "Vazirmatn-Bold"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "38px"
  title:
    fontFamily: "Vazirmatn-Bold"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "30px"
  body-lg:
    fontFamily: "Vazirmatn-Medium"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "26px"
  body:
    fontFamily: "Vazirmatn-Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Vazirmatn-SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
  caption:
    fontFamily: "Vazirmatn-Regular"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.garden-confident}"
    textColor: "{colors.on-garden}"
    rounded: "{rounded.md}"
    padding: "14px 24px"
    height: "54px"
  button-primary-pressed:
    backgroundColor: "{colors.garden-pressed}"
    textColor: "{colors.on-garden}"
    rounded: "{rounded.md}"
    height: "54px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.garden-confident}"
    rounded: "{rounded.md}"
    height: "54px"
  button-secondary-pressed:
    backgroundColor: "{colors.garden-soft}"
    textColor: "{colors.garden-confident}"
    rounded: "{rounded.md}"
    height: "54px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.garden-confident}"
    rounded: "{rounded.sm}"
    height: "44px"
  button-ghost-pressed:
    backgroundColor: "{colors.sunken-well}"
    textColor: "{colors.garden-confident}"
    rounded: "{rounded.sm}"
    height: "44px"
  text-field:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  text-field-focused:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  text-field-invalid:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
---

# Design System: پت‌کر (PetCare)

## 1. Overview

**Creative North Star: "The Quiet Garden"**

پت‌کر is a still, unhurried space — the kind of interface you return to without dread, like a pocket notebook you trust. The design aesthetic is "quiet warmth": a warm paper canvas holds everything together, a single confident emerald accent marks what matters, and Vazirmatn's clean curves speak Persian natively. Nothing competes. Nothing shouts. The UI earns the trust of someone who loves their animals and wants care to feel simple, not medical.

The system is Restrained in its color commitment: Garden Confident accent on no more than 10% of any screen, the rest held by warm neutrals that recede. This is a deliberate choice — the pets themselves (their photos, names, notes) supply the personality. The UI is the quiet frame around them.

This system explicitly rejects the three failure modes named in PRODUCT.md: the **sterile clinical palette** (cold white-and-blue, dense forms, heavy tables) that makes care feel like a doctor's office; the **loud gamified energy** (bright cartoon colors, bouncy motion, reward badges) that treats adults like children; and **corporate heaviness** (side nav, data tables, information density for its own sake) that obscures the personal and the small. The interface should disappear into the task.

**Key Characteristics:**
- Warm paper ground (Warm Paper, `#F6F5F1`) — the canvas, never competing with content
- Single emerald accent (Garden Confident, `#1F7A55`) used only on primary actions and active states
- Vazirmatn exclusively — one family, four weights; weight carries hierarchy before size
- Ambient elevation: surfaces rest close to the canvas; shadows are felt, not seen
- RTL-native: every layout decision assumes right-to-left; Persian is not a translation, it is the primary language

## 2. Colors: The Quiet Garden Palette

A warm-neutral body with a single confident emerald. The palette is Restrained by design — the rarity of the accent is the strategy.

### Primary

- **Garden Confident** (`#1F7A55`): The app's single accent color. Used on primary buttons, active tab icons, focused input borders, and text actions. Named for a plant that knows where it stands. Never used decoratively; never more than ~10% of any given screen surface.
- **Garden Pressed** (`#185F42`): The pressed state of Garden Confident, ~15% darker in lightness. Appears only as a transient touch-response state on primary buttons.
- **Garden Soft** (`#E7F1EB`): A quiet tint of the accent hue. Used for secondary button press fills, selected chip fills, and soft accent backgrounds. Never for large surfaces.

### Neutral

- **Warm Paper** (`#F6F5F1`): The app canvas — the screen background on every view. Warm-tinted toward the emerald hue's complementary warmth rather than a default yellow-beige cast.
- **White Surface** (`#FFFFFF`): Raised elements — text inputs and modal sheets. One surface step above the canvas.
- **Sunken Well** (`#EFEEE8`): Pressed ghost states, logo halos, subtle inset surfaces. One step below the canvas.
- **Warm Ink** (`#1A1A17`): Primary text. A near-black with a slight warm shift — never pure black, which reads harsh on a warm canvas.
- **Ink Muted** (`#73726B`): Secondary text, inactive tab labels, subtitles, metadata values. Contrast: 4.9:1 on Warm Paper, 5.2:1 on White Surface — passes WCAG AA.
- **Ink Faint** (`#A8A79E`): Placeholder text and field hints only. Never for real content text.
- **Border Gentle** (`#E4E2DA`): Default dividers, input outlines at rest, list row separators.
- **Border Firm** (`#D2D0C6`): Stronger separators where additional visual weight is needed.

### Feedback

- **Alert Brick** (`#B4231C`): Error states and destructive action labels. Never repurposed for warnings or info.
- **Alert Soft** (`#FBEAE8`): The tinted background behind destructive buttons and inline error messages.

**The One Voice Rule.** Garden Confident appears on ≤10% of any given screen. Primary button fill, active tab icon, focused input border: that is the complete list. A section header, a card highlight, or a decorative list accent in Garden Confident breaks the rule. Its rarity is the signal.

**The Tonal Depth Rule.** Depth is expressed through surface steps (Sunken Well → Warm Paper → White Surface), not shadows. Shadows are atmospheric additions, not structural separators. If you're tempted to add a shadow to distinguish two surfaces, use a background step first.

## 3. Typography: Vazirmatn, One Voice

**Display / Body / Label Font:** Vazirmatn (Bold, SemiBold, Medium, Regular)

**Character:** One family, four weights. Vazirmatn is a humanist sans designed for Persian — its Latin letterforms follow from the Persian, not the other way around. Weight carries hierarchy here; the scale ratio between adjacent levels is modest (~1.19×), keeping the visual rhythm compact and avoiding size inflation. No secondary display font; the Bold weight at 30px is expressive enough for the app's single display moment (the home screen).

### Hierarchy

- **Display** (Bold, 30px / 38px): The app's largest text. Used once per view at most — the app name on HomeScreen. Never on interior screens.
- **Title** (Bold, 22px / 30px): Screen-level headings; the pet name in PetDetailScreen. One per screen.
- **Body Large** (Medium, 17px / 26px): Primary list content (pet names in list rows), button labels. The workhorse: most tap targets use this size.
- **Body** (Regular, 15px / 24px): Form labels, metadata values, secondary prose, screen taglines. The reading weight.
- **Label** (SemiBold, 13px / 18px): Field label keys above inputs and in detail views ("گونه", "جنسیت", "یادداشت"). Never in all-caps with wide tracking.
- **Caption** (Regular, 13px / 20px): Secondary metadata — species in list rows, timestamps. Always paired with Ink Muted color.

**The Weight-Over-Size Rule.** Reach for a heavier weight before reaching for a larger size. A 15px SemiBold reads as more authoritative than a 17px Regular on the same canvas. This keeps the scale compact.

**The Persian-Native Rule.** All user-facing strings use Vazirmatn. If a Latin string appears (an email address, an error code, a URL), Vazirmatn's built-in Latin glyphs handle it — no family switching. The app has one font and four weights, not one font per script.

## 4. Elevation

This system is ambient-first: surfaces rest close to the canvas. Shadows are felt as atmosphere rather than seen as structure. No surface uses a shadow to assert separation; surface-color stepping (Sunken Well → Warm Paper → White Surface) does that work.

### Shadow Vocabulary

- **Card Lift** (shadowColor `#1A1A17`, offset 0 8px, opacity 6%, blur 16px / Android elevation 3): Applied wherever a surface needs to read as gently raised — the home screen logo halo, floating action buttons (Tasks, Pets list), toast banners, and boxed content cards (pet grid cards, the pet detail info card). Very diffuse — contributes a sense of air without competing with content.
- **Button Glow** (shadowColor `#1F7A55`, offset 0 6px, opacity 18%, blur 12px / Android elevation 4): Applied only to primary action buttons. The emerald shadow tint connects button shadows to the accent color — a small branded detail. This is the most visible shadow in the system and is intentionally reserved for the highest-priority interactive element.

**The Ambient-Only Rule.** No drop shadows on list rows, nav bars, section dividers, or screen headers — those surfaces sit flat on the canvas by default, and surface-color stepping (Sunken Well → Warm Paper → White Surface) does that work instead. Shadows (Card Lift) are reserved for surfaces that are genuinely raised: floating buttons, toasts, and boxed content cards that need to separate from the canvas.

## 5. Components

Components in this system are warm and approachable: generously sized touch targets, softly rounded corners, calm at rest. Nothing competes for attention before the user arrives at their task.

### Buttons

- **Shape:** Softly rounded, 14px (`rounded.md`). Ghost variant uses 10px (`rounded.sm`).
- **Primary:** Garden Confident fill (`#1F7A55`), white label (Body Large, SemiBold). 54px minimum height. Button Glow shadow active. Press: darkens to Garden Pressed (`#185F42`) + 98% scale. Disabled: 45% opacity across all variants.
- **Secondary:** Transparent fill, 1.5px Garden Confident border, Garden Confident label. Same height as primary. Press: fills with Garden Soft (`#E7F1EB`). Used for reversible actions (Edit, Go Back).
- **Ghost:** No fill, no border, Garden Confident label text. 44px minimum height, 10px radius. Press: fills with Sunken Well. Used for tertiary links and in-flow text actions.
- **Loading state:** ActivityIndicator replaces the label in-place. Primary: white spinner. Secondary/Ghost: Garden Confident spinner.

### Inputs / Text Fields

- **Style:** White Surface background, Border Gentle outline (1.5px), 14px radius. Comfortable vertical padding (14px top and bottom — equivalent to `md + 2` from the spacing scale).
- **Focus:** Border lifts to Garden Confident. No glow, no size change — the color shift is the sole signal.
- **Invalid:** Border lifts to Alert Brick (`#B4231C`). Pair with an inline error message below the field in Alert Brick color on Alert Soft background.
- **Placeholder:** Ink Faint (`#A8A79E`). Content text uses Warm Ink for full 4.5:1 contrast.
- **Cursor / Selection highlight:** Garden Confident (`selectionColor`).

### Navigation

- **Style:** Bottom tab bar, three tabs (خانه / حیوانات من / پروفایل). React Navigation material top-tab navigator pinned to the bottom (`tabBarPosition="bottom"`) with a custom flat tab bar, so tabs are **swipeable** — a horizontal swipe switches tabs and the page tracks the finger (ADR-0018).
- **Background:** Warm Paper (`#F6F5F1`) — the tab bar reads as an extension of the screen, not a separate layer.
- **Active:** Garden Confident tint on both icon and label text.
- **Inactive:** Ink Muted tint on both icon and label text.
- **Icons:** Ionicons outline set. No filled icons — the tint color is the active signal; icon fill would double-encode it.
- **No top border, no shadow** on the tab bar. It sits flat.

### Pet List Row (Signature)

The primary repeating unit in the app. A single 1px Border Gentle separator divides rows rather than boxing them in cards — the list reads like a handwritten notebook, not a card deck.

- **Thumbnail:** 48×48px circle. Filled with the pet's photo when present. Omitted entirely when absent (no blank avatar fallback that invents personality).
- **Name text:** Body Large / Medium weight / Warm Ink.
- **Species text:** Caption / Regular / Ink Muted. 4px gap below the name.
- **Full-row pressable area.** No visual affordance at rest beyond row boundaries — the separator and name are the affordance. The row itself is the tap target.

### Detail Field Group (Signature)

Used in PetDetailScreen for each data pair (species, gender, breed, weight, notes), inside a single elevated info card (Card Lift shadow — see §4).

- **Field row:** Label at the reading start, value at the reading end, on one row (space-between; RTL puts the label on the right).
- **Label:** Label style (SemiBold, 13px) / Ink Muted — identifies the field key.
- **Value:** Body style (Regular, 15px) / Warm Ink — the content.
- **Row gap:** 12px (`md`) between consecutive rows.
- **Notes exception:** the notes field stacks instead of running as a row (label above value, 4px/`xs` gap), since notes can run to multiple lines.

## 6. Do's and Don'ts

### Do:
- **Do** use Garden Confident only for primary button fills, active tab states, focused input borders, and text links. Its rarity is the signal. Every additional use dilutes it.
- **Do** set all user-facing text in Vazirmatn. Use Bold / SemiBold / Medium / Regular weights to carry hierarchy before increasing font size.
- **Do** respect RTL layout at every level: margins, padding, icon placement, text alignment, and gesture direction all follow Persian's right-to-left reading direction. Start and end replace left and right everywhere.
- **Do** display all dates in the Jalali (Persian Solar Hijri) calendar. Never show Gregorian dates in the UI.
- **Do** use 1px Border Gentle separator lines for list items rather than wrapping them in cards. Lists are notebook-like, not deck-like.
- **Do** keep all interactive touch targets at 44×44px minimum (WCAG 2.1 AA, mobile).
- **Do** use the three surface steps (Sunken Well → Warm Paper → White Surface) to express depth on flat surfaces. Reserve shadows for genuinely raised elements — floating buttons, toasts, and boxed content cards (Card Lift) — and primary buttons (Button Glow). Never on list rows, nav bars, or dividers.
- **Do** give empty states an action that teaches the interface, not just a message that reports absence. An empty pet list is an invitation, not a dead end.
- **Do** use Ink Muted (`#73726B`) for secondary text. Never use Ink Faint (`#A8A79E`) for readable content — it exists only for placeholder text.

### Don't:
- **Don't** use a cold white-and-blue palette, dense form layouts, or clinical data tables. This is not a veterinary records system. Pets are loved, not patients. This is the anti-reference named in PRODUCT.md.
- **Don't** use bright cartoon colors, bouncy or elastic motion, or gamification elements (badges, streaks, confetti). The users are adults managing daily care. This is the second anti-reference in PRODUCT.md.
- **Don't** add heavy navigation patterns: side nav, breadcrumbs, flyout menus, toolbar rows, or dense information panels. The interface should feel light and personal. This is the third anti-reference in PRODUCT.md.
- **Don't** introduce a second accent color. The system is Restrained by design. A second accent breaks the One Voice Rule and signals the wrong register.
- **Don't** use gradient text, side-stripe borders (>1px left/right accent), or glassmorphism. These are decorative flourishes from a different aesthetic register. (One scoped exception: the task-done toast's emerald start-side success stripe — see ADR-0017.)
- **Don't** use uppercase tracked eyebrow labels above sections. Labels in this system are field identifiers (Label style, Ink Muted), not section headers. Section eyebrows with all-caps tracking are not part of this vocabulary.
- **Don't** show Gregorian calendar dates anywhere in the UI. Jalali only, formatted as `yyyy/MM/dd` via `date-fns-jalali`.
- **Don't** use Ink Faint (`#A8A79E`) for real content text. Its contrast (~2.5:1 on Warm Paper) passes only for non-text elements. Placeholder text is the one permitted use.
- **Don't** add motion to list row entrances, tab transitions, or background section reveals. Motion in this system signals state (a press, a loading condition), not choreography. (One scoped exception: the bottom tabs are swipeable and the page tracks the finger during the swipe — direct manipulation that signals the gesture, not decorative choreography. See ADR-0018.)
