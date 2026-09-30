import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import BrandLogo, { BRAND_LOGO_WIDTH, BRAND_LOGO_ASPECT } from "./BrandLogo";
import AriseLogo, { ARISE_LOGO_REWIND_MS } from "./AriseLogo";

// The tour's top-centre logo: the SDCA logo and the ARISE logo take turns,
// SWITCH_MS each, cross-fading while the box (and the white pill around it,
// in app/index.js) eases to the new logo's size, so it always fits snugly.
// Each time ARISE comes round it plays its startup animation — the square
// with the AR button opening up and typing A-R-I-S-E — and at the end of
// its turn plays it backwards, folding back to the square, before SDCA
// fades in (the rewind is part of its SWITCH_MS).
const SWITCH_MS = 30000;
const FADE_MS = 350;
const SDCA = { width: BRAND_LOGO_WIDTH, height: BRAND_LOGO_WIDTH / BRAND_LOGO_ASPECT };
// ARISE is taller than SDCA; this is as big as it gets while the pill still
// clears the tour's sheets (their topLimit is 76dp below the safe area).
const ARISE_WIDTH = 130;
const ARISE = { width: ARISE_WIDTH, height: (ARISE_WIDTH * 601.4) / 1470.5 }; // AriseLogo's 1470.5 × 601.4 units

// Each phase: what comes next, and after how long.
const PHASES = {
  sdca: { next: "arise", wait: SWITCH_MS },
  arise: { next: "rewind", wait: SWITCH_MS - ARISE_LOGO_REWIND_MS },
  rewind: { next: "sdca", wait: ARISE_LOGO_REWIND_MS },
};

export default function TopLogo() {
  // "sdca" → "arise" (plays) → "rewind" (plays backwards) → "sdca" …
  const [phase, setPhase] = useState("sdca");
  useEffect(() => {
    const { next, wait } = PHASES[phase];
    const timer = setTimeout(() => setPhase(next), wait);
    return () => clearTimeout(timer);
  }, [phase]);
  const showArise = phase !== "sdca";

  const size = showArise ? ARISE : SDCA;
  const boxStyle = useAnimatedStyle(() => {
    const timing = { duration: FADE_MS, easing: Easing.inOut(Easing.cubic) };
    return { width: withTiming(size.width, timing), height: withTiming(size.height, timing) };
  });

  return (
    <Animated.View style={[SDCA, boxStyle]}>
      {showArise ? (
        // Remounted each turn, so the animation plays from the start.
        <Animated.View key="arise" entering={FadeIn.duration(FADE_MS)} exiting={FadeOut.duration(FADE_MS)} style={styles.fill}>
          <AriseLogo width={ARISE.width} play rewind={phase === "rewind"} />
        </Animated.View>
      ) : (
        <Animated.View key="sdca" entering={FadeIn.duration(FADE_MS)} exiting={FadeOut.duration(FADE_MS)} style={styles.fill}>
          <BrandLogo />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Centred in the box whatever its size mid-change; overflow shows (the
  // outgoing logo may be wider than the box it's fading out of).
  fill: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
