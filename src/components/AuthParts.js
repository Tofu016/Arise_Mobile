import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { colors, typography, radii, spacing } from "../theme";

// Shared pieces of the sign-in screens (login, register, forgot-*,
// approval), so all five read as one set.

// The top of a screen: the SDCA logo (sign in / register) or a round icon
// badge (the help screens), then the title in the heading serif and an
// optional line under it.
//   <AuthHeader logo title="Sign in" subtitle="…" />
//   <AuthHeader icon="lock" title="Reset your password" subtitle="…" />
export function AuthHeader({ logo = false, icon, title, subtitle }) {
  return (
    <View style={styles.header}>
      {logo && <BrandLogo scale={1.6} style={styles.logo} />}
      {!logo && icon && (
        <View style={styles.badge}>
          <Icon name={icon} size={22} color={colors.primary} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

// A row of links under a form: plain text and red tracked links, e.g.
//   <AuthLinks items={["Need an account?", { href: "/register", label: "Register" }]} />
export function AuthLinks({ items, style }) {
  return (
    <View style={[styles.links, style]}>
      {items.map((item, i) =>
        typeof item === "string" ? (
          <Text key={i} style={styles.linkPlain}>
            {item}
          </Text>
        ) : (
          <Link key={i} href={item.href} style={styles.link} accessibilityRole="link">
            {item.label}
          </Link>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: spacing.xxl },
  logo: { marginBottom: spacing.xl },
  badge: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, textAlign: "center" },
  subtitle: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: spacing.sm,
    rowGap: spacing.xs,
    marginTop: spacing.lg,
  },
  link: { ...typography.label, color: colors.textLink },
  linkPlain: { ...typography.bodySmall, color: colors.textMuted },
});
