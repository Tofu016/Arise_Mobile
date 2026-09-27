import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { colors, typography, radii, spacing } from "../theme";
import Icon, { isIconName } from "./Icon";

// The brand board's button: a full pill, bold tracked uppercase label,
// primary red fill ("+5% light for button"), darker on press. The board's
// hover gradient needs a native gradient module, so press uses the darker
// solid shade instead.
//
//   <Button label="Get directions" icon="directions" onPress={go} />
//   <Button label="360° view" variant="neutral" />
//   <Button label="Scan another" variant="outline" />
//
// variant: primary (default) | outline | neutral | ghost | gold | danger
// size:    sm | md (default) | lg
// icon / iconRight: an Icon name ("directions", "autoWalk", …) or any
// short text glyph.
const VARIANTS = {
  primary: {
    container: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
    pressed: { backgroundColor: colors.primaryPressed, borderColor: colors.primaryPressed },
    text: { color: colors.textOnPrimary },
  },
  // Red outline on white — the board's second button row.
  outline: {
    container: { backgroundColor: colors.surface, borderColor: colors.primaryButton },
    pressed: { backgroundColor: colors.primaryTint },
    text: { color: colors.primaryButton },
  },
  // Grey pill — "360° view", "Auto walk (every 3s)".
  neutral: {
    container: { backgroundColor: colors.neutralButton, borderColor: colors.neutralButton },
    pressed: { backgroundColor: colors.neutralButtonPressed, borderColor: colors.neutralButtonPressed },
    text: { color: colors.textOnPrimary },
  },
  ghost: {
    container: { backgroundColor: "transparent", borderColor: "transparent" },
    pressed: { backgroundColor: colors.primaryTint },
    text: { color: colors.primary },
  },
  gold: {
    container: { backgroundColor: colors.accent, borderColor: colors.accent },
    pressed: { backgroundColor: colors.accentPressed, borderColor: colors.accentPressed },
    text: { color: colors.textOnPrimary },
  },
  // Emergency evacuation — the board styles it in the brand red.
  danger: {
    container: { backgroundColor: colors.primary, borderColor: colors.primary },
    pressed: { backgroundColor: colors.primaryPressed, borderColor: colors.primaryPressed },
    text: { color: colors.textOnPrimary },
  },
};

const SIZES = {
  sm: { paddingVertical: spacing.sm + 1, paddingHorizontal: spacing.lg, fontSize: 11.5, iconSize: 13 },
  md: { paddingVertical: spacing.md + 1, paddingHorizontal: spacing.xl, fontSize: 13, iconSize: 15 },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl, fontSize: 14, iconSize: 17 },
};

function Glyph({ value, size, color, textStyle }) {
  if (value == null) return null;
  // A known icon name renders the vector icon; anything else is text.
  if (isIconName(value)) return <Icon name={value} size={size} color={color} />;
  return <Text style={[typography.button, { color, textTransform: "none" }, textStyle]}>{value}</Text>;
}

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
  const textColor = v.text.color;

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
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.content}>
          <Glyph value={icon} size={s.iconSize} color={textColor} textStyle={textStyle} />
          <Text style={[typography.button, { fontSize: s.fontSize }, v.text, textStyle]} numberOfLines={1}>
            {label}
          </Text>
          <Glyph value={iconRight} size={s.iconSize} color={textColor} textStyle={textStyle} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  disabled: { opacity: 0.45 },
});
