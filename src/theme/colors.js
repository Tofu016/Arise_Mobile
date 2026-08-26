// SDCA brand palette + semantic colour roles.
//
// Ported from the SDCA Brand Style Guide. The app is a *full light rebrand*:
// white / warm-neutral surfaces with SDCA Maroon as the lead colour and
// Dominican Gold as a sparing accent. Every screen — including overlays that
// sit on top of the live camera / 360° panoramas — uses these light values.
//
// Screens reference the SEMANTIC roles below (`background`, `primary`,
// `textMuted`, …), not the raw `palette`, so a future re-theme is a
// single-file change.

// Raw brand values — verified against the style guide's CSS custom properties.
export const palette = {
  maroon: "#A12124",
  maroonDark: "#7A171A", // hover / pressed
  maroonDeeper: "#5C1113", // dark-maroon panels, splash
  maroonTint: "#F4E1E1",
  maroonTint2: "#FBF0F0",

  gold: "#C9A24B",
  goldDark: "#A3812F",

  ink: "#201B1B",
  gray900: "#2B2626",
  gray700: "#5B5252",
  gray500: "#8C8180",
  gray300: "#D8CFCD",
  gray100: "#F4F0EE",
  white: "#FFFFFF",

  success: "#2E7D46",
  warning: "#B4791A",
  info: "#2C5F8A",

  // A brighter alert red than brand maroon — used ONLY for the emergency
  // evacuation affordance (nearest-exit button / route), so it stays
  // visually separable from ordinary primary-maroon buttons. Taken from the
  // guide's "don't" marker swatch.
  emergency: "#D6484B",
  emergencyTint: "#FBEDED",
};

export const colors = {
  ...palette,

  // ----- Surfaces -----
  background: palette.white,
  surface: palette.white, // cards / sheets / panels — separated by border + shadow
  surfaceSunken: palette.gray100, // inset inputs, panorama loading backdrop, list wells
  surfaceInverse: palette.maroonDeeper, // dark-maroon panels, splash background

  // Near-opaque white for cards that sit over the live camera / AR feed —
  // solid rather than translucent so text stays legible over a bright scene.
  overlaySurface: "rgba(255,255,255,0.95)",
  scrim: "rgba(32,27,27,0.45)", // modal / panel backdrop (ink-based, not pure black)

  // ----- Borders -----
  border: palette.gray300,
  borderStrong: palette.gray500,
  hairline: palette.gray100,

  // ----- Text -----
  textPrimary: palette.ink, // headings, key text
  textSecondary: palette.gray900, // body copy
  textMuted: palette.gray700, // labels, secondary metadata (AA on white)
  textSubtle: palette.gray500, // placeholders, disabled, faint captions only
  textOnPrimary: palette.white, // text on a maroon fill
  textOnDark: palette.white, // text on maroonDeeper / camera scrims
  textLink: palette.maroon, // links are maroon, never gold

  // ----- Brand roles -----
  primary: palette.maroon,
  primaryPressed: palette.maroonDark,
  primaryTint: palette.maroonTint, // faint maroon wash (badges, focus wells)
  accent: palette.gold, // dividers, large display flourishes, on-maroon CTAs ONLY
  accentPressed: palette.goldDark,
  focusRing: palette.maroon,

  // ----- Functional -----
  success: palette.success,
  warning: palette.warning,
  info: palette.info,
  danger: palette.maroon, // form errors reuse brand maroon, per the guide
  emergency: palette.emergency,
  emergencyTint: palette.emergencyTint,
};
