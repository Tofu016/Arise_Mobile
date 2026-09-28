import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedKeyboard,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
  SlideOutDown,
} from "react-native-reanimated";
import { colors, radii, spacing, shadows } from "../theme";

// The draggable bottom sheet, styled as the brand board's floating card:
// white, 20px corners all round, lifted by a soft shadow, sitting above the
// floating bottom nav (bottomOffset) rather than touching the screen edge.
//
//   <BottomSheet onClose={close} resetKey={room} bottomOffset={navTop}>
//     <Header/><ScrollView>…</ScrollView>
//   </BottomSheet>
//
// props:
//   onClose           — if given, dragging down past the smallest snap point
//                       (or flicking down from it) dismisses the sheet
//   snapPoints        — ascending heights: a number <= 1 is a fraction of the
//                       screen, a larger one is pixels (for a "peek" size that
//                       fits a header exactly). Default peek/half/full.
//   initialSnap       — index into snapPoints to open at (default 0)
//   snapIndex         — controlled: glides to this snap point whenever it
//                       changes (e.g. expand the search sheet on focus)
//   resetKey          — glides back to initialSnap whenever this value changes
//   bottomOffset      — px from the screen bottom (room for the bottom nav)
//   topLimit          — px from the screen top the sheet may never cover
//                       (keeps the logo visible)
//   accentBorderColor — coloured top edge (e.g. emergency directions). Drawn
//                       as its own bar over the sheet, never as a border on
//                       the sheet: toggling a border on this clipped,
//                       rounded, shadowed view left Android drawing none of
//                       its children (a blank white sheet).
//   avoidKeyboard     — while the keyboard is up, the sheet rises to sit just
//                       above it (and shrinks to the room left), so the field
//                       being typed in stays visible. The app is edge-to-edge,
//                       so Android doesn't resize the screen for the keyboard
//                       on its own.
//   fitContent        — the sheet is never taller than its content (no empty
//                       space at the bottom); the caller measures that and
//   contentHeight       passes it as contentHeight (px below the handle).
//                       The sheet waits for the first measurement before
//                       sliding up, so it opens at the right size, and then
//                       follows the content as it grows or shrinks.
//   visibleHeight     — optional shared value (useSharedValue(0)) the sheet
//                       keeps set to how tall it shows above bottomOffset,
//                       frame by frame (slide-in and drags included), so a
//                       control can ride on top of it.
//
// Motion: the sheet slides up on mount and down on unmount (so switching
// sheets is a smooth hand-over), and settles
// on snap points with a critically damped spring — no wobble — that picks up
// the finger's release speed, so a flick carries on to the next snap point.
const DEFAULT_SNAP_POINTS = [0.3, 0.55, 0.85];
const SETTLE_SPRING = { damping: 34, stiffness: 300, mass: 1, overshootClamping: true };
const MIN_DRAG_HEIGHT = 48; // hard lower bound while dragging
const KEYBOARD_GAP = 8; // space between a lifted sheet and the keyboard
// How far (s) a release's speed projects the sheet when choosing where to settle.
const FLICK_PROJECTION = 0.12;
// Released this far (px) below the smallest snap point, the sheet closes.
const CLOSE_OVERSHOOT = 56;

const SLIDE_IN = { duration: 300, easing: Easing.out(Easing.cubic) };
export const SHEET_EXIT = SlideOutDown.duration(220).easing(Easing.in(Easing.cubic));

export default function BottomSheet({
  children,
  onClose,
  snapPoints = DEFAULT_SNAP_POINTS,
  initialSnap = 0,
  snapIndex,
  resetKey,
  bottomOffset = 0,
  topLimit = 0,
  accentBorderColor,
  fitContent = false,
  avoidKeyboard = false,
  contentHeight,
  visibleHeight,
  style,
}) {
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.max(0, windowHeight - bottomOffset - topLimit);
  // The drag handle's own height, so contentHeight can be turned into the
  // sheet's full height.
  const [handleHeight, setHandleHeight] = useState(20);
  const fitHeight = contentHeight > 0 ? contentHeight + handleHeight : Infinity;

  // Every snap point in pixels, clamped to the room available (and to the
  // content, when it's measured).
  const snapKey = snapPoints.join(",");
  const heights = useMemo(
    () => snapPoints.map((p) => Math.min(maxHeight, fitHeight, p > 1 ? p : p * windowHeight)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapKey, windowHeight, maxHeight, fitHeight]
  );
  const initialHeight = heights[initialSnap] ?? heights[0];

  // Animated on the UI thread so the drag stays smooth while JS is busy.
  const height = useSharedValue(initialHeight);
  const startHeight = useSharedValue(initialHeight);
  // Which snap point the sheet is at (or heading to), so it can follow its
  // content when the heights change.
  const snapAt = useSharedValue(initialSnap);

  // Slide-in: the sheet starts a screen below its place, and rises once it
  // knows its size — at once for a normal sheet, after the first content
  // measurement (a frame or two, off-screen) for a fitContent one. (Not a
  // Reanimated `entering` animation: that starts on mount, at the
  // pre-measurement size, and ignores height changes until it's done.)
  const slide = useSharedValue(windowHeight);
  const ready = !fitContent || fitHeight !== Infinity;
  const shown = useRef(false);
  useEffect(() => {
    if (!ready || shown.current) return;
    shown.current = true;
    height.value = heights[Math.min(snapAt.value, heights.length - 1)];
    slide.value = withTiming(0, SLIDE_IN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const glideTo = (index) => {
    snapAt.value = index;
    height.value = withSpring(heights[index], SETTLE_SPRING);
  };

  // Glide back to the opening height whenever the caller's content
  // identity changes (e.g. a different room opens in the same sheet).
  useEffect(() => {
    if (resetKey === undefined) return;
    glideTo(initialSnap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (snapIndex === undefined || heights[snapIndex] === undefined) return;
    glideTo(snapIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapIndex]);

  // Content grew or shrank (or the screen turned): stay on the same snap
  // point at its new height. (Before the slide-in it's set by the effect
  // above instead.)
  useEffect(() => {
    if (!shown.current) return;
    const index = Math.min(snapAt.value, heights.length - 1);
    height.value = withSpring(heights[index], SETTLE_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heights]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startHeight.value = height.value;
    })
    .onUpdate((e) => {
      // Dragging up (negative translationY) grows the sheet.
      height.value = Math.min(heights[heights.length - 1], Math.max(MIN_DRAG_HEIGHT, startHeight.value - e.translationY));
    })
    .onEnd((e) => {
      const velocity = -e.velocityY; // px/s, positive = growing
      const projected = height.value + velocity * FLICK_PROJECTION;
      if (onClose && projected < heights[0] - CLOSE_OVERSHOOT) {
        runOnJS(onClose)();
        return;
      }
      let index = 0;
      heights.forEach((h, i) => {
        if (Math.abs(projected - h) < Math.abs(projected - heights[index])) index = i;
      });
      snapAt.value = index;
      height.value = withSpring(heights[index], { ...SETTLE_SPRING, velocity });
    });

  // The keyboard's height, frame by frame as it slides (UI thread), so the
  // sheet rises in step with it.
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });

  // Mirror how much of the sheet shows above bottomOffset, for a caller
  // that floats something on top of it.
  useAnimatedReaction(
    () => Math.max(0, Math.min(height.value, windowHeight - topLimit - bottomOffset) - slide.value),
    (shownHeight) => {
      if (visibleHeight) visibleHeight.value = shownHeight;
    }
  );

  const animatedStyle = useAnimatedStyle(() => {
    // How far to lift the sheet so its bottom clears the keyboard, and the
    // height left for it between the logo line and the keyboard.
    const lift = avoidKeyboard ? Math.max(0, keyboard.height.value + KEYBOARD_GAP - bottomOffset) : 0;
    const room = Math.max(MIN_DRAG_HEIGHT, windowHeight - topLimit - bottomOffset - lift);
    return {
      height: Math.min(height.value, room),
      transform: [{ translateY: slide.value - lift }],
    };
  });

  return (
    <Animated.View
      exiting={SHEET_EXIT}
      style={[
        styles.sheet,
        { bottom: bottomOffset },
        animatedStyle,
        style,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.handleArea} onLayout={(e) => setHandleHeight(e.nativeEvent.layout.height)}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>
      {children}
      {!!accentBorderColor && (
        <View pointerEvents="none" style={[styles.accentBar, { backgroundColor: accentBorderColor }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: "hidden",
    ...shadows.floating,
  },
  accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  handleArea: { paddingTop: spacing.md, paddingBottom: spacing.xs, alignItems: "center" },
  handle: { width: 44, height: 4, borderRadius: radii.pill, backgroundColor: colors.iconButton },
});
