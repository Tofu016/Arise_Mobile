import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Icon from "./Icon";
import { colors, typography, radii, spacing, shadows } from "../theme";

// The controls laid over the live camera on the AR screens (ar-viewer,
// ar-portal), in the app's style: near-opaque white so they read over any
// scene.

// The round close button, top left — the same button as everywhere else.
export function ArCloseButton({ onPress, top }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Close AR"
      style={({ pressed }) => [styles.closeBtn, styles.closeBtnLeft, { top }, pressed && styles.closeBtnPressed]}
    >
      <Icon name="terminate" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// The round recalibrate button, top right: drops the door and spawns a new
// one ahead of the phone (for when AR tracking has drifted).
export function ArRecalibrateButton({ onPress, top }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Recalibrate: place a new portal"
      style={({ pressed }) => [styles.closeBtn, styles.recalibrateBtn, { top }, pressed && styles.closeBtnPressed]}
    >
      <Icon name="recalibrate" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// A short status line over the camera: a hint ("Move your phone slowly…"),
// loading (spinner) or an error (red text).
//   tone: "hint" | "loading" | "error"
export function ArStatusPill({ children, tone = "hint", style }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.pill, style]}>
      {tone === "loading" && <ActivityIndicator size="small" color={colors.primary} />}
      {tone === "hint" && <Icon name="arView" size={18} color={colors.primary} />}
      <Text style={[styles.pillText, tone === "error" && styles.pillTextError]}>{children}</Text>
    </Animated.View>
  );
}

// The label beside the close button (the room being previewed).
export function ArTitlePill({ children, top }) {
  return (
    <View style={[styles.titlePill, { top }]} pointerEvents="none">
      <Text style={styles.titleText} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlaySurface,
    ...shadows.floating,
  },
  closeBtnPressed: { backgroundColor: colors.iconButton },
  closeBtnLeft: { left: spacing.lg },
  recalibrateBtn: { right: spacing.lg },
  pill: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.overlaySurface,
    ...shadows.floating,
  },
  pillText: { ...typography.bodySmall, flexShrink: 1, textAlign: "center", color: colors.textPrimary },
  pillTextError: { color: colors.danger },
  titlePill: {
    position: "absolute",
    left: spacing.lg + 40 + spacing.sm,
    // Leaves room for the recalibrate button on the right.
    right: spacing.lg + 40 + spacing.sm,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.overlaySurface,
    ...shadows.floating,
  },
  titleText: { ...typography.label, color: colors.textPrimary },
});
