import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { colors, typography, radii, spacing } from "../theme";

// Shared button, styled to the SDCA guide: uppercase Montserrat, tracked,
// with a maroon-led variant set. Replaces the per-screen button blocks
// (login/register/forgot, approval, the sheets, the placard scanner).
//
//   <Button label="Sign in" onPress={submit} loading={submitting} />
//   <Button label="Read more" variant="ghost" size="sm" />
//   <Button label="Get directions" variant="primary" icon="➜" />
//
// variant: primary (default) | outline | ghost | gold | danger
// size:    sm | md (default) | lg

const VARIANTS = {
  primary: {
    container: { backgroundColor: colors.primary, borderColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed, borderColor: colors.primaryPressed },
    text: { color: colors.textOnPrimary },
    spinner: colors.textOnPrimary,
  },
  outline: {
    container: { backgroundColor: "transparent", borderColor: colors.primary },
    pressed: { backgroundColor: colors.primaryTint },
    text: { color: colors.primary },
    spinner: colors.primary,
  },
  ghost: {
    container: { backgroundColor: "transparent", borderColor: "transparent" },
    pressed: { backgroundColor: colors.primaryTint },
    text: { color: colors.primary },
    spinner: colors.primary,
  },
  // On-maroon call to action — gold fill, dark-maroon text (guide's hero CTA).
  gold: {
    container: { backgroundColor: colors.accent, borderColor: colors.accent },
    pressed: { backgroundColor: colors.accentPressed, borderColor: colors.accentPressed },
    text: { color: colors.maroonDeeper },
    spinner: colors.maroonDeeper,
  },
  // Emergency evacuation affordance — deliberately not primary maroon.
  danger: {
    container: { backgroundColor: colors.emergency, borderColor: colors.emergency },
    pressed: { backgroundColor: colors.maroonDark, borderColor: colors.maroonDark },
    text: { color: colors.textOnPrimary },
    spinner: colors.textOnPrimary,
  },
};

const SIZES = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, fontSize: 12 },
  md: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl, fontSize: 13 },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl, fontSize: 14 },
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon = null,
  iconRight = null,
  style,
  textStyle,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
        v.container,
        pressed && !isDisabled && v.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.spinner} />
      ) : (
        <View style={styles.content}>
          {icon != null && <Text style={[styles.icon, typography.button, v.text, textStyle]}>{icon}</Text>}
          <Text style={[typography.button, { fontSize: s.fontSize }, v.text, textStyle]}>{label}</Text>
          {iconRight != null && (
            <Text style={[styles.icon, typography.button, v.text, textStyle]}>{iconRight}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm, // guide: buttons use the small radius
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { textTransform: "none" },
  disabled: { opacity: 0.45 },
});
