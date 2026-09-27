import { Image } from "react-native";
// Each icon set imported on its own: importing from "@expo/vector-icons"
// itself pulls every set's font (19 of them, ~2 MB) into the app.
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors } from "../theme";

// The brand board's iconography set ("use these for consistent usage on all
// platforms"), by the names the board gives them.
//
//   <Icon name="location" size={18} color={colors.textOnPrimary} />
//
// Most are the designer's own icons (assets/icons/, exported from the
// designer's SVGs — see its README). They're white single-colour PNGs, so any
// `color` tints them exactly. The board has no search or exit icon, nor
// the sign-in screens' ones, so those come from the vector icon fonts.
const ICONS = {
  location: { image: require("../../assets/icons/location.png") },
  exit: { font: [MaterialCommunityIcons, "exit-run"] },
  search: { font: [FontAwesome6, "magnifying-glass"] },
  save: { image: require("../../assets/icons/bookmark.png") },
  account: { image: require("../../assets/icons/account.png") },
  directions: { image: require("../../assets/icons/directions.png") },
  proceedNext: { image: require("../../assets/icons/chevron.png") },
  proceedBack: { image: require("../../assets/icons/chevron.png"), rotate: "180deg" },
  expand: { image: require("../../assets/icons/chevron.png"), rotate: "90deg" },
  collapse: { image: require("../../assets/icons/chevron.png"), rotate: "-90deg" },
  terminate: { image: require("../../assets/icons/close.png") },
  scanCode: { image: require("../../assets/icons/scan.png") },
  arView: { image: require("../../assets/icons/ar-view.png") },
  scanLandscape: { image: require("../../assets/icons/scan-landscape.png") },
  scanPortrait: { image: require("../../assets/icons/scan-portrait.png") },
  autoWalk: { image: require("../../assets/icons/play.png") },
  pauseWalk: { image: require("../../assets/icons/pause.png") },
  // Sign-in and account screens (not in the board's set).
  email: { font: [FontAwesome6, "envelope"] },
  lock: { font: [FontAwesome6, "lock"] },
  showPassword: { font: [FontAwesome6, "eye"] },
  hidePassword: { font: [FontAwesome6, "eye-slash"] },
  person: { font: [FontAwesome6, "user"] },
  pending: { font: [FontAwesome6, "hourglass-half"] },
  alert: { font: [FontAwesome6, "circle-exclamation"] },
  done: { font: [FontAwesome6, "circle-check"] },
  server: { font: [FontAwesome6, "server"] },
};

// The gyro toggle's two images, shown as-is (not tinted): compass inside
// the four arrows (the designer's gyro-map + gyro-arrowkeys combined), with
// a soft white outline. The active half is dark: `off` = black chevrons +
// grey compass (drag to look), `on` = grey chevrons + dark compass (move the
// phone to look).
//   <Image source={COLOR_ICONS.gyroControl.on} style={{ width: 76, height: 76 }} />
export const COLOR_ICONS = {
  gyroControl: {
    on: require("../../assets/icons/color/gyro-control-on.png"),
    off: require("../../assets/icons/color/gyro-control-off.png"),
  },
};

export function isIconName(name) {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(ICONS, name);
}

export default function Icon({ name, size = 18, color = colors.navIcon, style }) {
  const entry = ICONS[name];
  if (!entry) return null;

  if (entry.image) {
    // A size x size box, like a font glyph, with the icon fitted inside it.
    return (
      <Image
        source={entry.image}
        resizeMode="contain"
        style={[
          { width: size, height: size, tintColor: color },
          entry.rotate && { transform: [{ rotate: entry.rotate }] },
          style,
        ]}
      />
    );
  }

  const [IconSet, glyph] = entry.font;
  // FontAwesome6 defaults to its outline ("regular") style, which lacks most
  // of these glyphs; the board's icons are the solid ones.
  const solid = IconSet === FontAwesome6 ? { solid: true } : null;
  return <IconSet name={glyph} size={size} color={color} style={style} {...solid} />;
}
