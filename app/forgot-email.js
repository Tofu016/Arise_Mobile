import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { colors, typography, radii, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";

// Deliberately not a self-service lookup — same reasoning as web's version:
// letting someone submit a name/detail and get back "here's the registered
// email" is an account-enumeration risk, and this app doesn't collect a
// separate recovery identifier at registration anyway (the @sdca.edu.ph
// email effectively *is* the identity here). An admin looking someone up by
// name in the Users panel is the safe equivalent.
export default function ForgotEmailScreen() {
  return (
    <ScreenContainer>
      <Text style={styles.title}>Forgot your email?</Text>

      <Text style={styles.paragraph}>
        Accounts here are registered with your own <Text style={styles.bold}>@sdca.edu.ph</Text> email
        — there's no separate username to look up. A few things that usually help:
      </Text>

      <View style={styles.list}>
        <Text style={styles.listItem}>• Check for a welcome or approval email from ARISE in your school inbox.</Text>
        <Text style={styles.listItem}>
          • Try the most likely variation of your name — e.g. <Text style={styles.code}>firstname.lastname@sdca.edu.ph</Text>.
        </Text>
        <Text style={styles.listItem}>• Check your school's webmail/portal for your official assigned address.</Text>
      </View>

      <Text style={styles.paragraph}>
        Still stuck? An administrator can look your account up by name from the admin Users
        panel — reach out to one directly, or contact your school's IT/registrar office if
        you're not sure who that is.
      </Text>

      <View style={styles.linksRow}>
        <Link href="/login" style={styles.link}>Back to sign in</Link>
        <Text style={styles.linkSep}> · </Text>
        <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, marginBottom: spacing.lg, textAlign: "center" },
  paragraph: { ...typography.body, marginBottom: spacing.md + 2 },
  bold: { ...typography.bodySemiBold },
  code: {
    fontFamily: typography.caption.fontFamily,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.sm,
  },
  list: { marginBottom: spacing.md + 2, gap: spacing.sm },
  listItem: { ...typography.body, marginBottom: 0 },
  linksRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  link: { ...typography.bodySmall, color: colors.textLink },
  linkSep: { ...typography.bodySmall, color: colors.textSubtle },
});
