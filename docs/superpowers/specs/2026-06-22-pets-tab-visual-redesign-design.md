# Pets Tab Visual Redesign

**Date:** 2026-06-22
**Scope:** `PetsListScreen` + `PetDetailScreen`
**Driver:** Visual polish — same data model, richer presentation
**New deps:** None
**Schema changes:** None

---

## Goals

Make the pets tab feel like a real app, not a form dump. Two screens:

1. **List screen** — replace flat divider rows with a 2-column card grid
2. **Detail screen** — replace sequential field dump with a hero zone, grouped info card, and visual chore stats

---

## List Screen

### Layout

`FlatList` with `numColumns={2}`. `columnWrapperStyle` provides horizontal gap. `contentContainerStyle` provides outer padding and vertical gap.

### Card anatomy

Each card is a `Pressable` with `shadow.card` and `radius.lg`, overflow hidden.

**Photo zone (height 160px, full card width):**
- If `pet.photoUri` exists: `Image` with `resizeMode="cover"`
- If no photo: `colors.surfaceSunken` fill + species emoji centered at 40px font size

**Scrim:** absolute-positioned `View` anchored to the bottom of the photo zone, height ~60px, `backgroundColor: rgba(0,0,0,0.45)`. No `expo-linear-gradient` needed.

**Name + species chip** sit inside the scrim:
- Name: `typography.bodyLg`, `fonts.semibold`, white, start-aligned
- Species chip: small pill (`colors.primarySoft` bg, `colors.primary` text, `radius.pill`), end-aligned
- Row uses `flexDirection: row`, `justifyContent: space-between` — RTL-safe

**Chore hint row** (below photo zone, on `colors.surface` bg):
- `typography.caption`, `colors.inkMuted`
- Content: `"X کار · بعدی HH:MM"` (active chore count + next occurrence in Tehran time)
- Next occurrence: call `expandOccurrences(chore, now, now + 7 days)` across all active chores, take the earliest result, format in Tehran (+03:30)
- Hidden if pet has no active chores

### Empty state

Unchanged — paw icon + text + add button.

### Header

Unchanged — "Add" text button in `headerRight`.

---

## Detail Screen

### Hero zone (full-width, 280px tall)

- `Image` with `resizeMode="cover"`, width = screen width, height 280, no border radius (edge-to-edge)
- No photo → `colors.surfaceSunken` zone + species emoji centered at 64px

**Scrim:** absolute bottom, height ~100px, `rgba(0,0,0,0.45)`

**Overlaid content inside scrim:**
- Start: pet name (`typography.title`, white, `fonts.bold`)
- End: species chip (pill, white border + white text, `radius.pill`)
- `flexDirection: row`, `justifyContent: space-between`, `alignItems: flex-end`, `padding: spacing.lg`
- RTL-safe — no hardcoded left/right

**Floating edit button:**
- `Ionicons` `pencil` icon, top-end corner of the hero zone, absolute positioned
- `colors.surface` circular background, `shadow.card`
- Replaces the bottom Edit `Button` (removed)

### Info card

`colors.surface` card with `shadow.card`, `radius.lg`, `padding: spacing.lg`, `marginHorizontal: spacing.xl`.

Fields: species, gender, notes.

- Species + gender: `flexDirection: row`, `justifyContent: space-between` — label (`colors.inkMuted`, `typography.label`) → value (`colors.ink`, `typography.body`)
- Notes: stacked (label above value) when present; hidden when null/empty
- `createdAt` / `updatedAt` removed from the card — noise for most users; available via edit form if needed

### Chores summary card

Sits at the top of the chores section, above the chore list. Hidden when pet has zero chores.

- `colors.primarySoft` background, `radius.md`, `padding: spacing.md`
- Single line: `📋 X کار فعال · بعدی HH:MM`
- Next occurrence: same `expandOccurrences` approach as list card — 7-day window, earliest result across all active chores
- Time in Tehran local (+03:30) — consistent with rest of the app
- "Add chore" button moves below this card (was top-right of section header)

### Per-chore stats (visual)

Replaces the current plain text `"🔥 X پیاپی · Y٪"` with:

- **Streak:** 🔥 emoji + count (unchanged visually, already works)
- **Adherence bar:** `View` bar — `colors.primarySoft` track, `colors.primary` fill at `width: adh * 100 + '%'`, fixed height 4px, `radius.pill`, with percentage text beside it

Implemented inside the existing `ChoreStats` component — no new component needed.

### Delete button

Unchanged — stays at the bottom of the scroll.

---

## RTL

All layout uses `flexDirection: row` with start/end semantics (`alignItems`, `justifyContent`). No hardcoded `left`/`right` margins. Consistent with existing codebase conventions.

---

## Testing impact

- `PetsListScreen` test: update snapshot / rendered structure for card layout
- `PetDetailScreen` test: hero zone renders, floating edit button accessible, info card fields present, `ChoreStats` adherence bar rendered
- No new store logic → no store test changes

---

## Out of scope

- New pet data fields (birthday, breed, weight)
- Grid sort / drag-to-reorder
- Swipe actions on list cards
- `expo-linear-gradient` gradient scrim (rgba overlay is sufficient)
- Stats ring / circular progress (bar is sufficient, avoids `react-native-svg`)
