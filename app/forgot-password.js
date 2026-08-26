import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../src/firebase";
import { friendlyAuthError } from "../src/utils/authErrors";
import { colors, typography, radii, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import FormField from "../src/components/FormField";
import Button from "../src/components/Button";
import ErrorDialog from "../src/components/ErrorDialog";

// Same account-enumeration protection as web: a generic, identical
// confirmation message regardless of whether the email actually has an
// account — revealing "no account with that email" would let anyone probe
// for which addresses are registered. auth/user-not-found is deliberately
// swallowed below; genuine problems (bad email format, network issues)
// still surface normally.
const GENERIC_SENT_MESSAGE =
  "If an account exists for that email, a password reset link has been sent. Check your inbox (and spam folder).";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      if (err?.code === "auth/user-not-found") {
        setSent(true);
      } else {
        setError(friendlyAuthError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding>
      <View style={styles.iconBadge}>
        <Text style={styles.iconBadgeText}>🔑</Text>
      </View>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.hint}>
        Enter the email you registered with and we'll send a link to reset your password.
      </Text>

      {sent ? (
        <Text style={styles.infoText}>{GENERIC_SENT_MESSAGE}</Text>
      ) : (
        <>
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Button
            label={submitting ? "Sending…" : "Send reset link"}
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submit}
          />
        </>
      )}

      <View style={styles.linksRow}>
        <Link href="/login" style={styles.link}>Back to sign in</Link>
        <Text style={styles.linkSep}> · </Text>
        <Link href="/forgot-email" style={styles.link}>Forgot email?</Link>
      </View>

      <ErrorDialog
        visible={!!error}
        title="Couldn't send reset link"
        message={error}
        onDismiss={() => setError("")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  iconBadgeText: { fontSize: 20 },
  title: { ...typography.h2, marginBottom: spacing.sm, textAlign: "center" },
  hint: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", marginBottom: spacing.xl },
  infoText: { ...typography.body, textAlign: "center", marginBottom: spacing.sm },
  submit: { marginTop: spacing.sm },
  linksRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  link: { ...typography.bodySmall, color: colors.textLink },
  linkSep: { ...typography.bodySmall, color: colors.textSubtle },
});
