import { Image } from "react-native";

// The official SDCA logo (assets/logos/sdca-logo-horizontal.png: globe +
// wordmark side by side, in colour) — top-centre on the tour (brand board:
// "logo placement in nav-menu — avoid placing it on the right") and on the
// Sign in / Register screens.
//
//   scale: multiplies the default 150dp width.
const LOGO = require("../../assets/logos/sdca-logo-horizontal.png");
const WIDTH = 150;
const ASPECT = 1200 / 341;

export default function BrandLogo({ scale = 1, style }) {
  const width = WIDTH * scale;
  return (
    <Image
      source={LOGO}
      resizeMode="contain"
      style={[{ width, height: width / ASPECT, alignSelf: "center" }, style]}
      accessibilityRole="image"
      accessibilityLabel="St. Dominic College of Asia"
    />
  );
}
