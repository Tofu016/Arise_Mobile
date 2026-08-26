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

export const radii = {
  sm: 4, // guide --radius-sm
  md: 8, // guide --radius-md
  lg: 12, // cards, floating panels
  xl: 16, // bottom sheets
  pill: 999,
};
