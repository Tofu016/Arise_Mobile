// Elevation presets — cross-platform (`shadow*` for iOS, `elevation` for
// Android). Light-theme shadows: an ink-tinted, low-opacity lift, far
// subtler than the near-opaque black shadows the dark theme used.
//
// Spread a preset into a StyleSheet entry:
//   card: { ...shadows.floating, backgroundColor: colors.surface }

import { palette } from "./colors";

const SHADOW_COLOR = palette.ink;

export const shadows = {
  // Resting cards (news cards, result rows).
  card: {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  // Panels that float over content (top bar buttons, search panel, camera
  // overlays, building menu).
  floating: {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  // Bottom sheets — shadow cast upward from the bottom edge.
  sheet: {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 16,
  },
};
