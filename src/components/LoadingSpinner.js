import { View, ActivityIndicator, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { colors, shadows } from "../theme";

// A loading spinner that reads over anything: the brand red spinner on a
// white round backing with a soft shadow, so it shows up over a dark or
// busy panorama as well as the plain grey backdrop. Grey "Loading…" text was
// too easy to miss. Fades in and out. `label` is for screen readers only.
//
//   <LoadingSpinner label="Loading photo" />
const SIZE = 64;

export default function LoadingSpinner({ label = "Loading", style }) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.backing, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View pointerEvents="none">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backing: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlaySurface,
    ...shadows.floating,
  },
});
