// Typographic system from the UI designer's brand board
// (sdca2026.my.canva.site/virtualtour), as React Native style presets.
//
// Century Gothic only, throughout: Bold headings, buttons and labels, Black
// section eyebrows, Regular body; mostly uppercase, tracked. (The board
// also used Optimus Princeps for headings; the app no longer does.)
//
// Fonts are loaded at runtime in app/_layout.js; the family names below are
// the keys registered there (files and licensing: assets/fonts/README.md).

import { colors } from "./colors";

export const fontFamily = {
  body: "CenturyGothic-Regular",
  bodyMedium: "CenturyGothic-Regular",
  bodySemiBold: "CenturyGothic-Bold",

  display: "CenturyGothic-Bold",
  displaySemiBold: "CenturyGothic-SemiBold",
  displayHeavy: "CenturyGothic-Black",
};

// Named presets — spread into a StyleSheet entry or a Text `style` prop.
// `color` is included so most text needs only the preset.
export const typography = {
  // Headings: Century Gothic Bold. Its capitals run wide, so they are
  // tracked less than the smaller labels.
  hero: {
    fontFamily: fontFamily.display,
    fontSize: 30,
    lineHeight: 38,
    color: colors.textPrimary,
  },
  // Screen / sheet titles: "DIRECTORY", "DIRECTIONS", a room's name.
  h1: {
    fontFamily: fontFamily.display,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: fontFamily.display,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textPrimary,
  },
  h3: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textPrimary,
  },

  body: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  bodySemiBold: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.4,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: 12.5,
    lineHeight: 18,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },

  // Section labels ("RECENT", "SUGGESTED ROOMS") — ink, bold, tracked.
  eyebrow: {
    fontFamily: fontFamily.displayHeavy,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.textPrimary,
  },
  // List-row titles ("ACCOUNTING OFFICE") and form labels.
  label: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  // List-row subtitles ("GD1 - FLOOR 1 > ACCOUNTING").
  sublabel: {
    fontFamily: fontFamily.body,
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textSubtle,
  },
  // Button text — no colour here (the Button component sets it per variant).
  button: {
    fontFamily: fontFamily.display,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
};
