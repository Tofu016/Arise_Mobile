import { useEffect } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { colors, radii, spacing, shadows } from "../theme";

// The draggable peek / half / full bottom sheet shell. This exact block
// (snap points, spring config, pan gesture, animated height, grab handle)
// was copy-pasted into MobileRoomSheet, MobileDirectionsSheet, and
// ar-viewer — it now lives here once.
//
//   <BottomSheet onClose={close} resetKey={room}>
//     <Header/><ScrollView>…</ScrollView>
//   </BottomSheet>
//
// props:
//   onClose          — if given, dragging down past the smallest snap point
//                      dismisses the sheet (omit for a sheet that only snaps)
//   snapPoints       — heights as fractions of the screen (default peek/half/full)
//   initialSnap      — index into snapPoints to open at (default 0)
//   resetKey         — springs back to initialSnap whenever this value changes
//   accentBorderColor — coloured top border (e.g. emergency directions)

const DEFAULT_SNAP_POINTS = [0.24, 0.5, 0.88];
const SPRING_CONFIG = { damping: 20, stiffness: 200 };
const DRAG_MIN = 0.08; // hard lower bound while dragging

export default function BottomSheet({
  children,
  onClose,
  snapPoints = DEFAULT_SNAP_POINTS,
  initialSnap = 0,
  resetKey,
  accentBorderColor,
  style,
}) {
  const { height: windowHeight } = useWindowDimensions();
  const initial = snapPoints[initialSnap] ?? snapPoints[0];
  const smallest = snapPoints[0];

  // Animated on the UI thread so the drag stays smooth while JS is busy.
  const heightFraction = useSharedValue(initial);
  const startFraction = useSharedValue(initial);

  // Spring back to the opening height whenever the caller's content
  // identity changes (e.g. a different room opens in the same sheet).
  useEffect(() => {
    if (resetKey === undefined) return;
    heightFraction.value = withSpring(initial, SPRING_CONFIG);
  }, [resetKey, initial, heightFraction]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startFraction.value = heightFraction.value;
    })
    .onUpdate((e) => {
      // Dragging up (negative translationY) grows the sheet.
      const delta = -e.translationY / windowHeight;
      heightFraction.value = Math.min(
        snapPoints[snapPoints.length - 1],
        Math.max(DRAG_MIN, startFraction.value + delta)
      );
    })
    .onEnd(() => {
      const current = heightFraction.value;
      if (onClose && current < smallest - 0.08) {
        runOnJS(onClose)();
        return;
      }
      const nearest = snapPoints.reduce(
        (best, p) => (Math.abs(current - p) < Math.abs(current - best) ? p : best),
        snapPoints[0]
      );
      heightFraction.value = withSpring(nearest, SPRING_CONFIG);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${heightFraction.value * 100}%`,
  }));

  return (
    <Animated.View
      style={[
        styles.sheet,
        accentBorderColor && { borderTopWidth: 2, borderColor: accentBorderColor },
        animatedStyle,
        style,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.sheet,
  },
  handleArea: { paddingVertical: spacing.md - 2, alignItems: "center" },
  handle: { width: 40, height: 4, borderRadius: radii.pill, backgroundColor: colors.border },
});
