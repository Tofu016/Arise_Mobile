import { View, Text, StyleSheet } from "react-native";
import { colors, typography, radii, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import Icon from "../src/components/Icon";
import { AuthHeader, AuthLinks } from "../src/components/AuthParts";

// Deliberately not a self-service lookup — same reasoning as web's version:
// letting someone submit a name/detail and get back "here's the registered
// email" is an account-enumeration risk, and this app doesn't collect a
// separate recovery identifier at registration anyway (the @sdca.edu.ph
// email effectively *is* the identity here). An admin looking someone up by
// name in the Users panel is the safe equivalent.

const TIPS = [
  "Check for a welcome or approval email from ARISE in your school inbox.",
  "Try the most likely variation of your name, e.g. firstname.lastname@sdca.edu.ph.",
  "Check your school's webmail or portal for your official address.",
];

export default function ForgotEmailScreen() {
  return (
    <ScreenContainer>
      <AuthHeader
        icon="email"
        title="Forgot your email?"
        subtitle="Accounts here use your own @sdca.edu.ph email; there's no separate username to look up."
      />

      <Text style={styles.sectionLabel}>A few things that usually help</Text>
      <View style={styles.tips}>
        {TIPS.map((tip, i) => (
          <View key={i} style={styles.tip}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <View style={styles.stuck}>
        <Icon name="person" size={15} color={colors.textMuted} />
        <Text style={styles.stuckText}>
          <Text style={styles.stuckStrong}>Still stuck? </Text>
          An administrator can look your account up by name in the admin Users panel. Reach out to one directly,
          or contact your school's IT or registrar office if you're not sure who that is.
        </Text>
      </View>

      <AuthLinks
        items={[
          { href: "/login", label: "Back to sign in" },
          "·",
          { href: "/forgot-password", label: "Forgot password?" },
        ]}
        style={styles.links}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...typography.eyebrow, marginBottom: spacing.sm, marginLeft: spacing.xs },
  tips: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceField,
    marginBottom: spacing.lg,
  },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  tipNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginTop: 1,
  },
  tipNumberText: { ...typography.label, fontSize: 11, lineHeight: 14, letterSpacing: 0, color: colors.textOnPrimary },
  tipText: { ...typography.bodySmall, flex: 1, color: colors.textPrimary },
  stuck: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: spacing.xs },
  stuckText: { ...typography.bodySmall, flex: 1, color: colors.textMuted },
  stuckStrong: { ...typography.bodySemiBold, fontSize: 12.5, color: colors.textPrimary },
  links: { marginTop: spacing.xl },
});
