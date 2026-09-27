// SDCA brand palette + semantic colour roles.
//
// From the UI designer's brand board (sdca2026.my.canva.site/virtualtour):
// the five palette swatches, the button rules ("+5% light for button, use
// the primary colour"; darker on press), the mobile nav colours, and the
// greys sampled directly from the mobile mock-ups (fields, wells, circle
// buttons, dividers).
//
// Screens reference the SEMANTIC roles below (`background`, `primary`,
// `textMuted`, …), not the raw `palette`, so a future re-theme is a
// single-file change.

export const palette = {
  // The board's five swatches.
  offWhite: "#F2F1EC",
  warmGray: "#635D5F",
  gold: "#B8812E",
  red: "#A41D22",
  ink: "#1A1A1A",

  // Button shades of the primary red: the board's "+5% light" fill, and
  // the darker pressed tone.
  redButton: "#B1252A",
  redDark: "#82181C",
  redTint: "#F6E4E5",
  // Secondary text on a red highlight (the selected-row subtitle).
  redOnRedSubtle: "#E3B3B5",

  goldDark: "#966A26",

  // Greys sampled from the mobile mock-ups.
  gray700: "#726C6E", // grey pill buttons ("360° view"), dark nav bar
  gray500: "#A6A6A6", // placeholders, faint captions
  gray300: "#D8D6D7", // round icon buttons (close / save)
  navLight: "#DBD9DA", // bottom nav bar (board: #E0DFDF at 20% over white)
  field: "#E8E7E7", // info rows, directions fields
  well: "#EFEEEF", // search bar, description box
  divider: "#E0DEDF",
  white: "#FFFFFF",

  success: "#2E7D46",
  warning: "#B4791A",
  info: "#2C5F8A",
};

export const colors = {
  ...palette,

  // Older names still used by some screens — kept as aliases so nothing
  // has to be renamed at once.
  maroon: palette.red,
  maroonDark: palette.redDark,
  maroonDeeper: palette.redDark,
  maroonTint: palette.redTint,
  maroonTint2: palette.redTint,
  gray900: palette.ink,
  gray100: palette.well,

  // ----- Surfaces -----
  background: palette.white,
  surface: palette.white, // cards / sheets / panels
  surfaceSunken: palette.well, // search bar, description box, loading backdrop
  surfaceField: palette.field, // info rows, form fields
  surfaceInverse: palette.ink,

  // Near-opaque white for cards that sit over the live camera / AR feed —
  // solid rather than translucent so text stays legible over a bright scene.
  overlaySurface: "rgba(255,255,255,0.96)",
  scrim: "rgba(26,26,26,0.45)",

  // ----- Borders -----
  border: palette.divider,
  borderStrong: palette.gray500,
  hairline: palette.divider,

  // ----- Text -----
  textPrimary: palette.ink, // headings, key text
  textSecondary: palette.warmGray, // body copy, list titles
  textMuted: palette.warmGray, // labels, secondary metadata
  textSubtle: palette.gray500, // placeholders, disabled, faint captions only
  textOnPrimary: palette.white, // text on a red fill
  textOnDark: palette.white,
  textLink: palette.red,

  // ----- Brand roles -----
  primary: palette.red,
  primaryButton: palette.redButton,
  primaryPressed: palette.redDark,
  primaryTint: palette.redTint,
  accent: palette.gold,
  accentPressed: palette.goldDark,
  focusRing: palette.red,

  // ----- Controls -----
  neutralButton: palette.warmGray, // "Auto walk", secondary pills
  neutralButtonPressed: palette.ink,
  iconButton: palette.gray300, // round close / save buttons
  navBar: palette.navLight,
  navIcon: palette.warmGray,

  // ----- Functional -----
  success: palette.success,
  warning: palette.warning,
  info: palette.info,
  danger: palette.red,
  // The board styles emergency exits in the brand red, not a separate
  // alert red.
  emergency: palette.red,
  emergencyTint: palette.redTint,
};
