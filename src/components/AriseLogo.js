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

// The ARISE logo, animated through its designed keyframes (assets/logos/
// arise/, cut from the designer's "Neutral State" and "Animation Start /
// in between / end" SVGs):
//   0. neutral — the AR-scan button alone in a square grey frame (the app
//      icon's shape; the native splash shows this);
//   1. start   — the frame widens a little, the button slides left, and a
//      dot and a text cursor appear;
//   2. expand  — the frame stretches wide, the cursor slides out;
//   3. type    — A, R, I, S, E appear one after another.
// The frame, dot and cursor are drawn here (so they can stretch and slide);
// the button and letters are the designer's own artwork as images.
//
//   <AriseLogo width={300} play={ready} onLoad={…} />
//   <AriseLogo width={300} still />        // the finished logo, no animation
//
// width: the EXPANDED logo's width; the neutral square is 600.8/1470.5 of it.
// play:  start the animation (it holds on the neutral square until then).
// onLoad: the button image is ready — the neutral square can be shown.

// Every position below is in the SVGs' own units, relative to the expanded
// frame's top-left corner (276.3, 699.4).
const BOX_W = 1470.5;
const BOX_H = 601.4;
const STROKE = 37;
const RADIUS = 104;
const FRAME_FILL = "#625C5E";
const FRAME = {
  neutral: { left: 423.2, width: 600.8 },
  compact: { left: 376.0, width: 695.2 },
  expanded: { left: 0, width: BOX_W },
};
const BUTTON = {
  size: 419.8, // the padded crop of the button (black ring included)
  neutral: { x: 722.7, y: 299.9 },
  compact: { x: 683.2, y: 300.6 },
  expanded: { x: 304.1, y: 299.4 },
};
// The dot and cursor only exist from "start" on (they fade in on the way).
const DOT = { r: 21.5, compact: { x: 926.0, y: 300.0 }, expanded: { x: 550.0, y: 299.6 } };
const CURSOR = { w: 21, h: 160, compact: { x: 977.7, y: 220.6 }, expanded: { x: 1283.7, y: 227.6 } };
// [left, top, width, height] of each letter (padded crops), expanded only.
const LETTERS = [
  { src: require("../../assets/logos/arise/letter-a.png"), box: [591.2, 225.0, 154, 164.6] },
  { src: require("../../assets/logos/arise/letter-r.png"), box: [764.7, 225.6, 125, 164] },
  { src: require("../../assets/logos/arise/letter-i.png"), box: [913.7, 225.6, 36, 164] },
  { src: require("../../assets/logos/arise/letter-s.png"), box: [973.7, 223.1, 126.9, 168.8] },
  { src: require("../../assets/logos/arise/letter-e.png"), box: [1124.7, 225.6, 112, 164] },
];
const BUTTON_SRC = require("../../assets/logos/arise/button.png");

// Timeline (ms from `play`).
const HOLD_MS = 300; // the neutral square, as the splash left it
const INTRO_MS = 380; // neutral → start
const START_HOLD_MS = 250; // the cursor blinks once
const EXPAND_MS = 650;
const EXPAND_START_MS = HOLD_MS + INTRO_MS + START_HOLD_MS;
const TYPE_START_MS = EXPAND_START_MS + EXPAND_MS + 120;
const LETTER_GAP_MS = 110;
const LETTER_MS = 200;
export const ARISE_LOGO_DURATION_MS = TYPE_START_MS + LETTER_GAP_MS * (LETTERS.length - 1) + LETTER_MS;
// The neutral square's share of the expanded width — the native splash
// shows it at LOGO_WIDTH × this (see StartupScreen / app.json).
export const NEUTRAL_WIDTH_RATIO = FRAME.neutral.width / BOX_W;

// Called from the animated styles, which run on the UI thread — so it must
// be a worklet itself (a plain function there is a "Remote Function" error).
function lerp(a, b, t) {
  "worklet";
  return a + (b - a) * t;
}

// A position through all three keyframes: neutral → compact by `intro`,
// then compact → expanded by `expand`.
function place(key, part, intro, expand) {
  "worklet";
  return lerp(lerp(part.neutral[key], part.compact[key], intro), part.expanded[key], expand);
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
  const intro = useSharedValue(still ? 1 : 0);
  const expand = useSharedValue(still ? 1 : 0);
  const typed = useSharedValue(still ? LETTERS.length : 0); // letters shown, fractional while one fades in
  const blink = useSharedValue(1);

  useEffect(() => {
    if (still) return;
    // A text cursor's blink, throughout (it's invisible until "start").
    blink.value = withRepeat(
      withSequence(withDelay(420, withTiming(0, { duration: 0 })), withDelay(380, withTiming(1, { duration: 0 }))),
      -1
    );
  }, [still, blink]);

  useEffect(() => {
    if (still || !play) return;
    const ease = Easing.inOut(Easing.cubic);
    intro.value = withDelay(HOLD_MS, withTiming(1, { duration: INTRO_MS, easing: ease }));
    expand.value = withDelay(EXPAND_START_MS, withTiming(1, { duration: EXPAND_MS, easing: ease }));
    typed.value = withDelay(
      TYPE_START_MS,
      withTiming(LETTERS.length, {
        duration: LETTER_GAP_MS * (LETTERS.length - 1) + LETTER_MS,
        easing: Easing.linear,
      })
    );
  }, [play, still, intro, expand, typed]);

  const frameStyle = useAnimatedStyle(() => ({
    left: place("left", FRAME, intro.value, expand.value) * s,
    width: place("width", FRAME, intro.value, expand.value) * s,
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    left: (place("x", BUTTON, intro.value, expand.value) - BUTTON.size / 2) * s,
    top: (place("y", BUTTON, intro.value, expand.value) - BUTTON.size / 2) * s,
  }));
  // The dot and cursor fade in over the second half of "start", from where
  // they sit in the start keyframe.
  const dotStyle = useAnimatedStyle(() => ({
    left: (lerp(DOT.compact.x, DOT.expanded.x, expand.value) - DOT.r) * s,
    top: (lerp(DOT.compact.y, DOT.expanded.y, expand.value) - DOT.r) * s,
    opacity: interpolate(intro.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const cursorStyle = useAnimatedStyle(() => ({
    left: lerp(CURSOR.compact.x, CURSOR.expanded.x, expand.value) * s,
    top: lerp(CURSOR.compact.y, CURSOR.expanded.y, expand.value) * s,
    opacity: interpolate(intro.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) * blink.value,
  }));

  return (
    <View style={[{ width, height: BOX_H * s }, style]} accessibilityRole="image" accessibilityLabel="ARISE">
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
  frame: { position: "absolute", borderColor: "#000000", backgroundColor: FRAME_FILL },
  ink: { position: "absolute", backgroundColor: "#010101" },
});
