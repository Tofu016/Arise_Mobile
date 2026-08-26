// Typographic system from the SDCA Brand Style Guide, expressed as
// React Native style presets.
//
// Three families, per the guide:
//   - Source Sans 3  — body copy (long-form, highly legible)
//   - Montserrat      — display / navigation / UI headings / buttons
//                       (bold, tracked-out, usually uppercase)
//   - Source Serif 4  — reserved for the ONE editorial hero moment
//
// The font FILES (.ttf/.otf) are embedded via the `expo-font` config plugin
// in app.json and referenced by the family names below. Until those files
// are added, React Native falls back to the system font (with a dev
// warning) — layout and weights still work, only the typeface differs.

import { colors } from "./colors";

// Family names must match the embedded font files (filename stem).
export const fontFamily = {
  body: "SourceSans3-Regular",
  bodyMedium: "SourceSans3-Medium",
  bodySemiBold: "SourceSans3-SemiBold",

  display: "Montserrat-Bold",
  displaySemiBold: "Montserrat-SemiBold",
  displayHeavy: "Montserrat-ExtraBold",

  serif: "SourceSerif4-SemiBold",
};

// Named presets — spread into a StyleSheet entry or a Text `style` prop.
// `color` is included so most text needs only the preset. Override per use
// where a different colour is intended (e.g. text on a maroon button).
export const typography = {
  // Editorial hero — the guide's sparing serif statement (login title only).
  hero: {
    fontFamily: fontFamily.serif,
    fontSize: 34,
    lineHeight: 40,
    color: colors.textPrimary,
  },
  h1: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  h3: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.textPrimary,
  },

  body: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  bodySemiBold: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // Uppercase Montserrat eyebrow — maroon, wide tracking (section labels).
  eyebrow: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.primary,
  },
  // Form / metadata label — same shape as eyebrow, muted colour.
  label: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  // Button text — no colour here (the Button component sets it per variant).
  button: {
    fontFamily: fontFamily.display,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
};
