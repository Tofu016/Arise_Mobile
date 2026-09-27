// Spacing scale + corner radii.
//
// The scale is the set of padding/margin/gap values the screens already
// use, named so intent is legible at the call site. Radii follow the guide
// (`--radius-sm` 4, `--radius-md` 8) plus the larger values the app's
// cards / sheets / pills already rely on.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// The board's mobile spec: "outer border radius 20px, inner border radius
// 15px" (floating cards / sheets, and the controls inside them); every
// button is a full pill.
export const radii = {
  sm: 6,
  md: 10,
  lg: 15, // board: inner radius — fields, info rows, wells, photo tiles
  xl: 20, // board: outer radius — sheets, floating cards
  pill: 999,
};
