import { View, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "../theme";

// A loading spinner for the middle of the screen: just the brand red
// spinner, with no backing plate. It is a plain View rather than a
// reanimated one with entering/exiting animations: those leave the spinner
// drawn in the wrong place (a bar along the bottom of the viewport) when its
// parent unmounts in the same render, as the tour's photo overlay does once
// the photo arrives. `label` is for screen readers only.
//
//   <LoadingSpinner label="Loading photo" />
export default function LoadingSpinner({ label = "Loading", style }) {
  return (
    <View style={[styles.wrap, style]} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
