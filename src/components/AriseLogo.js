import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

// The ARISE logo, animated through its three designed keyframes
// (assets/logos/arise/, cut from the designer's "Arise Logo (1)-(3).svg"):
//   1. compact — the AR-scan button, a dot and a text cursor in a small
//      rounded frame (Logo 1; also the app icon and the native splash);
//   2. expand  — the frame stretches wide, the cursor slides out (Logo 2);
//   3. type    — A, R, I, S, E appear one after another (Logo 3).
// The frame, dot and cursor are drawn here (so they can stretch and slide);
// the button and letters are the designer's own artwork as images.
//
//   <AriseLogo width={300} play={ready} onLoad={…} />
//   <AriseLogo width={300} still />        // the finished logo, no animation
//
// width: the EXPANDED logo's width; the compact logo is 695/1470 of it.
// play:  start the animation (it holds on the compact logo until then).
// onLoad: the button image is ready — the compact logo can be shown.

// Every position below is in the SVGs' own units, relative to the expanded
// frame's top-left corner (276.4, 699.4).
const BOX_W = 1470.3;
const BOX_H = 601.4;
const STROKE = 37;
const RADIUS = 104;
const FRAME = { compact: { left: 376.3, width: 695 }, expanded: { left: 0, width: BOX_W } };
const BUTTON = { size: 411.7, compact: { x: 685.2, y: 301.5 }, expanded: { x: 307.2, y: 298.6 } };
const DOT = { r: 21.5, compact: { x: 925.8, y: 299.9 }, expanded: { x: 549.9, y: 299.6 } };
const CURSOR = { w: 21, h: 160, compact: { x: 977.6, y: 220.6 }, expanded: { x: 1283.6, y: 227.6 } };
// [left, top, width, height] of each letter (padded crops), expanded only.
const LETTERS = [
  { src: require("../../assets/logos/arise/letter-a.png"), box: [590.6, 225.1, 155, 164.5] },
  { src: require("../../assets/logos/arise/letter-r.png"), box: [764.6, 225.6, 125, 164] },
  { src: require("../../assets/logos/arise/letter-i.png"), box: [913.6, 225.6, 36, 164] },
  { src: require("../../assets/logos/arise/letter-s.png"), box: [973.6, 223.1, 126.8, 168.7] },
  { src: require("../../assets/logos/arise/letter-e.png"), box: [1124.6, 225.6, 112, 164] },
];
const BUTTON_SRC = require("../../assets/logos/arise/button.png");

// Timeline (ms from `play`).
const HOLD_MS = 350; // the compact logo, as the splash left it
const EXPAND_MS = 650;
const TYPE_START_MS = HOLD_MS + EXPAND_MS + 120;
const LETTER_GAP_MS = 110;
const LETTER_MS = 200;
export const ARISE_LOGO_DURATION_MS = TYPE_START_MS + LETTER_GAP_MS * (LETTERS.length - 1) + LETTER_MS;

// Called from the animated styles, which run on the UI thread — so it must
// be a worklet itself (a plain function there is a "Remote Function" error).
function lerp(a, b, t) {
  "worklet";
  return a + (b - a) * t;
}

function Letter({ letter, index, typed, s }) {
  const [left, top, width, height] = letter.box;
  const style = useAnimatedStyle(() => {
    const t = interpolate(typed.value, [index, index + 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (1 - t) * 18 * s }] };
  });
  return (
    <Animated.Image
      source={letter.src}
      resizeMode="stretch"
      style={[{ position: "absolute", left: left * s, top: top * s, width: width * s, height: height * s }, style]}
    />
  );
}

export default function AriseLogo({ width = 300, play = false, still = false, onLoad, style }) {
  const s = width / BOX_W; // dp per SVG unit
  const expand = useSharedValue(still ? 1 : 0);
  const typed = useSharedValue(still ? LETTERS.length : 0); // letters shown, fractional while one fades in
  const blink = useSharedValue(1);

  useEffect(() => {
    if (still) return;
    // A text cursor's blink, throughout.
    blink.value = withRepeat(
      withSequence(withDelay(420, withTiming(0, { duration: 0 })), withDelay(380, withTiming(1, { duration: 0 }))),
      -1
    );
  }, [still, blink]);

  useEffect(() => {
    if (still || !play) return;
    expand.value = withDelay(HOLD_MS, withTiming(1, { duration: EXPAND_MS, easing: Easing.inOut(Easing.cubic) }));
    typed.value = withDelay(
      TYPE_START_MS,
      withTiming(LETTERS.length, {
        duration: LETTER_GAP_MS * (LETTERS.length - 1) + LETTER_MS,
        easing: Easing.linear,
      })
    );
  }, [play, still, expand, typed]);

  const frameStyle = useAnimatedStyle(() => ({
    left: lerp(FRAME.compact.left, FRAME.expanded.left, expand.value) * s,
    width: lerp(FRAME.compact.width, FRAME.expanded.width, expand.value) * s,
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    left: (lerp(BUTTON.compact.x, BUTTON.expanded.x, expand.value) - BUTTON.size / 2) * s,
    top: (lerp(BUTTON.compact.y, BUTTON.expanded.y, expand.value) - BUTTON.size / 2) * s,
  }));
  const dotStyle = useAnimatedStyle(() => ({
    left: (lerp(DOT.compact.x, DOT.expanded.x, expand.value) - DOT.r) * s,
    top: (lerp(DOT.compact.y, DOT.expanded.y, expand.value) - DOT.r) * s,
  }));
  const cursorStyle = useAnimatedStyle(() => ({
    left: lerp(CURSOR.compact.x, CURSOR.expanded.x, expand.value) * s,
    top: lerp(CURSOR.compact.y, CURSOR.expanded.y, expand.value) * s,
    opacity: blink.value,
  }));

  return (
    <View
      style={[{ width, height: BOX_H * s }, style]}
      accessibilityRole="image"
      accessibilityLabel="ARISE"
    >
      <Animated.View
        style={[
          styles.frame,
          { top: 0, height: BOX_H * s, borderWidth: STROKE * s, borderRadius: RADIUS * s },
          frameStyle,
        ]}
      />
      {LETTERS.map((letter, i) => (
        <Letter key={i} letter={letter} index={i} typed={typed} s={s} />
      ))}
      <Animated.View
        style={[styles.ink, { width: DOT.r * 2 * s, height: DOT.r * 2 * s, borderRadius: DOT.r * s }, dotStyle]}
      />
      <Animated.View style={[styles.ink, { width: CURSOR.w * s, height: CURSOR.h * s }, cursorStyle]} />
      <Animated.Image
        source={BUTTON_SRC}
        onLoad={onLoad}
        onError={onLoad}
        resizeMode="stretch"
        style={[{ position: "absolute", width: BUTTON.size * s, height: BUTTON.size * s }, buttonStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: "absolute", borderColor: "#010101", backgroundColor: "#FEFEFE" },
  ink: { position: "absolute", backgroundColor: "#020202" },
});
