import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Icon from "./Icon";
import { colors, typography, radii, spacing } from "../theme";

// The error for the sign-in screens ("Couldn't sign in", "Couldn't
// register", …), shown in the form itself — a red-tinted card just above
// the button — rather than a dark pop-up dialog over the screen. The x
// dismisses it; the next attempt replaces it anyway.
//
//   <ErrorDialog
//     visible={!!error}
//     title="Couldn't sign in"
//     message={error}
//     onDismiss={() => setError("")}
//   />
//
// (The name is kept so the screens' calls didn't have to change.)

export default function ErrorDialog({ visible, title, message, onDismiss }) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      style={styles.card}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Icon name="alert" size={18} color={colors.danger} />
      <View style={styles.text}>
        {title != null && <Text style={styles.title}>{title}</Text>}
        {message != null && <Text style={styles.body}>{message}</Text>}
      </View>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Icon name="terminate" size={13} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.primaryTint,
  },
  text: { flex: 1 },
  title: { ...typography.label, color: colors.danger, marginBottom: 2 },
  body: { ...typography.bodySmall, color: colors.textPrimary },
});
