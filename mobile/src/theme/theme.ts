/**
 * Design tokens — the single source of truth for the app's visual language.
 *
 * Aesthetic: "quiet warmth" — a warm paper canvas, near-black warm ink, and a
 * single confident emerald accent. Dominant neutrals with one sharp accent read
 * as calm and intentional rather than busy.
 *
 * Import `theme` everywhere instead of hard-coding colours/spacing so the look
 * stays consistent and is trivial to retheme later.
 */

export const colors = {
  // Surfaces
  bg: '#F6F5F1', // warm paper — the app canvas
  surface: '#FFFFFF', // raised cards / inputs
  surfaceSunken: '#EFEEE8', // subtle wells (logo halo, pressed ghost)

  // Text
  ink: '#1A1A17', // primary text — warm near-black
  inkMuted: '#73726B', // secondary text, subtitles
  inkFaint: '#A8A79E', // placeholders, hints

  // Lines
  border: '#E4E2DA',
  borderStrong: '#D2D0C6',

  // Accent (emerald — calm, "care", nature)
  primary: '#1F7A55',
  primaryPressed: '#185F42',
  primarySoft: '#E7F1EB', // tinted fill for soft surfaces
  onPrimary: '#FFFFFF',

  // Feedback
  danger: '#B4231C',
  dangerSoft: '#FBEAE8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/**
 * Vazirmatn family names, one per weight. These must match the keys the fonts
 * are registered under in `useFonts` (see App.tsx).
 *
 * With custom fonts you select weight via the family name, not `fontWeight` —
 * Android ignores `fontWeight` on a custom family, and iOS would fake-bold it.
 */
export const fonts = {
  regular: 'Vazirmatn-Regular',
  medium: 'Vazirmatn-Medium',
  semibold: 'Vazirmatn-SemiBold',
  bold: 'Vazirmatn-Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30 },
  bodyLg: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
} as const;

/** Soft, cross-platform elevation for raised surfaces. */
export const shadow = {
  card: {
    shadowColor: '#1A1A17',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  button: {
    shadowColor: '#1F7A55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const theme = { colors, spacing, radius, fonts, typography, shadow } as const;

export default theme;
