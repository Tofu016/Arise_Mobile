import { View, Text, Pressable, StyleSheet } from "react-native";
import Icon from "./Icon";
import { colors, typography, spacing } from "../theme";

// A list row from the brand board's search/directory sheets: uppercase
// title, optional uppercase subtitle ("GD1 - FLOOR 1 > ACCOUNTING"), and a
// trailing chevron (open) or × (remove). While pressed — and when
// `selected` — it fills with the brand red edge to edge, as the board's
// "once pressed, a highlight will occupy the whole row" shows.
//
//   <ListRow title="Accounting office" subtitle="GD1 - Floor 1 > Accounting"
//            onPress={open} trailing="chevron" />
//   <ListRow title="Cashier office" onPress={open} trailing="remove" onTrailingPress={forget} />
//
// dimmed: greyed out (e.g. a saved room the tour no longer lists); with no
// onPress the row itself doesn't respond, but its trailing button still does.
export default function ListRow({
  title,
  subtitle,
  onPress,
  trailing = "chevron",
  onTrailingPress,
  trailingLabel,
  selected = false,
  indent = 0,
  dimmed = false,
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button">
      {({ pressed }) => {
        const lit = (pressed && !!onPress) || selected;
        return (
          <View style={[styles.row, { paddingLeft: spacing.xl + indent }, lit && styles.rowLit, dimmed && styles.rowDimmed]}>
            <View style={styles.text}>
              <Text style={[styles.title, lit && styles.titleLit]} numberOfLines={2}>
                {title}
              </Text>
              {!!subtitle && (
                <Text style={[styles.subtitle, lit && styles.subtitleLit]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
            {trailing === "chevron" && (
              <Icon name="proceedNext" size={14} color={lit ? colors.textOnPrimary : colors.primary} />
            )}
            {trailing === "remove" && (
              <Pressable onPress={onTrailingPress} hitSlop={12} accessibilityLabel={trailingLabel || `Remove ${title} from recent`}>
                <Icon name="terminate" size={16} color={lit ? colors.textOnPrimary : colors.textSecondary} />
              </Pressable>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingRight: spacing.xl,
    paddingVertical: spacing.md,
  },
  rowLit: { backgroundColor: colors.primary },
  rowDimmed: { opacity: 0.5 },
  text: { flex: 1 },
  title: { ...typography.label, color: colors.textSecondary },
  titleLit: { color: colors.textOnPrimary },
  subtitle: { ...typography.sublabel, marginTop: 3, marginLeft: spacing.lg },
  subtitleLit: { color: colors.redOnRedSubtle },
});
