# Product

## Register

product

## Users

Persian-speaking pet owners — individuals and families with one or more pets (dogs, cats, birds, rabbits) in Iran and Persian-speaking regions. They use the app on their phone at home or on the go to track their animals' basic information, care notes, and history. They're adults managing real daily responsibilities; the app is a practical companion, not entertainment.

## Product Purpose

پت‌کر (PetCare) is a mobile app for managing pet profiles: name, species, gender, photo, notes, and care history. It keeps everything about a user's animals in one place, persisted locally with optional account sync. Success looks like: a user who just adopted a rabbit can add it in under a minute, and a family with three pets can find any pet's details without effort.

## Brand Personality

Calm · Caring · Warm

The app should feel like a trusted companion — gentle and reassuring, not clinical or childish. The tone is the same warmth you'd show a neighbor's dog: attentive, unhurried, real.

## Anti-references

- **Sterile / clinical** (veterinary record apps, medical UIs): cold white-and-blue palettes, dense tables, form-heavy layouts. Pets are loved, not patients.
- **Loud / gamified** (kids pet apps): bright cartoon energy, bouncy motion, reward badges. Users are adults managing care, not playing.
- **Corporate / enterprise heavy** (CRMs, dashboards): heavy navigation, information density, data-table defaults. Should feel light and personal.

## Design Principles

1. **Disappear into the task.** The UI should feel invisible — users are here to care for their pets, not to interact with software. No decorative friction.
2. **Warmth over wow.** Every design choice earns emotional trust, not attention or novelty. Quiet confidence over flashy moments.
3. **Persian-native, not translated.** RTL layout, Jalali calendar, Vazirmatn typography: the interface is built for Persian speakers, not adapted for them.
4. **Consistency is care.** Same vocabulary, same affordances, same interaction patterns screen to screen. Inconsistency in a care context reads as unreliable.
5. **Empty states earn their place.** An empty pet list is a first-run moment — it should encourage action, not just report absence.

## Accessibility & Inclusion

- WCAG 2.1 AA compliance: minimum 4.5:1 contrast for body text, 3:1 for large text, touch targets ≥ 44×44 pt.
- Full RTL support (Persian/Farsi is the sole language; `I18nManager.forceRTL` is already applied).
- Jalali (Persian Solar Hijri) calendar throughout — no Gregorian dates in the UI.
- `prefers-reduced-motion` respected for any future animations.
- Screen reader support via `accessibilityRole`, `accessibilityLabel`, and `accessibilityState` on all interactive elements.
