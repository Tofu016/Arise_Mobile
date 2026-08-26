// SDCA design tokens — single import point for screens and components.
//
//   import { colors, typography, spacing, radii, shadows } from "../theme";
//   import { theme } from "../theme";   // same tokens, grouped
//
// See colors.js for the semantic role → brand value mapping, and the
// SDCA Brand Style Guide for the source of every value here.

export { colors, palette } from "./colors";
export { typography, fontFamily } from "./typography";
export { spacing, radii } from "./spacing";
export { shadows } from "./shadows";

import { colors } from "./colors";
import { typography, fontFamily } from "./typography";
import { spacing, radii } from "./spacing";
import { shadows } from "./shadows";

export const theme = { colors, typography, fontFamily, spacing, radii, shadows };
