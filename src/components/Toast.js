import { useEffect, useSyncExternalStore } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { colors, typography, radii, spacing, shadows } from "../theme";

// A short message that appears for a few seconds ("Saved", "Removed" with
// UNDO, an error), from anywhere:
//   showToast("Saved to your rooms");
//   showToast("Removed Drawing Room", { actionLabel: "Undo", onAction: restore });
// One at a time — a new one replaces the current. <ToastHost top={…} />
// renders it, once, over the screen.

let current = null;
const listeners = new Set();

function set(next) {
  current = next;
  listeners.forEach((fn) => fn());
}

export function showToast(message, { actionLabel, onAction, duration = 3000 } = {}) {
  set({ key: Date.now(), message, actionLabel, onAction, duration });
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export default function ToastHost({ top = 0 }) {
  const toast = useSyncExternalStore(subscribe, () => current);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => {
      if (current === toast) set(null);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.key}
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(150)}
      style={[styles.toast, { top }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>
        {toast.message}
      </Text>
      {!!toast.actionLabel && (
        <Pressable
          onPress={() => {
            set(null);
            toast.onAction?.();
          }}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.action}>{toast.actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.ink,
    ...shadows.floating,
  },
  message: { ...typography.bodySmall, flex: 1, color: colors.textOnDark },
  action: { ...typography.button, fontSize: 12, color: colors.accent },
});
