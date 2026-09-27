import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/useAuth";
import { colors, typography, radii, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import FormField from "../src/components/FormField";
import Button from "../src/components/Button";
import ErrorDialog from "../src/components/ErrorDialog";
import Icon from "../src/components/Icon";
import { AuthHeader, AuthLinks } from "../src/components/AuthParts";

// Always resolves successfully — the backend's own anti-enumeration
// protection (see Auth_API::forgotPassword), so there's no separate
// "user not found" case to special-case here anymore, unlike the
// Firebase version this replaces.
const GENERIC_SENT_MESSAGE =
  "If an account exists for that email, a password reset link has been sent. Check your inbox (and spam folder).";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send reset link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding>
      <AuthHeader
        icon="lock"
        title="Reset your password"
        subtitle="Enter the email you registered with and we'll send a link to reset your password."
      />

      {sent ? (
        <>
          <View style={styles.sentCard} accessibilityLiveRegion="polite">
            <Icon name="done" size={18} color={colors.success} />
            <Text style={styles.sentText}>{GENERIC_SENT_MESSAGE}</Text>
          </View>
          <Button label="Back to sign in" onPress={() => router.replace("/login")} />
        </>
      ) : (
        <>
          <FormField
            label="Email"
            icon="email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@sdca.edu.ph"
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            containerStyle={styles.field}
          />

          <ErrorDialog
            visible={!!error}
            title="Couldn't send reset link"
            message={error}
            onDismiss={() => setError("")}
          />

          <Button label={submitting ? "Sending…" : "Send reset link"} onPress={handleSubmit} loading={submitting} />
        </>
      )}

      <AuthLinks
        items={[
          { href: "/login", label: "Back to sign in" },
          "·",
          { href: "/forgot-email", label: "Forgot email?" },
        ]}
        style={styles.links}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.xl },
  sentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceField,
  },
  sentText: { ...typography.bodySmall, flex: 1, color: colors.textPrimary },
  links: { marginTop: spacing.xl },
});
