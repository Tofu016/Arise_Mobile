import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../src/firebase";
import { friendlyAuthError } from "../src/utils/authErrors";
import { colors, typography, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import FormField from "../src/components/FormField";
import Button from "../src/components/Button";
import ErrorDialog from "../src/components/ErrorDialog";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      // Always navigate to "/" — if the account turns out to be pending,
      // the root layout's own auth guard notices the role and redirects to
      // /approval on its own, so there's no need to duplicate that check
      // here (matches how the web version's RequireAuth handles it too).
      router.replace("/");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding>
      <Text style={styles.title}>Sign in</Text>

      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@sdca.edu.ph"
      />

      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        label={submitting ? "Signing in…" : "Sign in"}
        onPress={handleSubmit}
        loading={submitting}
        style={styles.submit}
      />

      <View style={styles.linksRow}>
        <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
        <Text style={styles.linkSep}> · </Text>
        <Link href="/forgot-email" style={styles.link}>Forgot email?</Link>
      </View>
      <View style={styles.linksRow}>
        <Text style={styles.linkPlain}>Need an account? </Text>
        <Link href="/register" style={styles.link}>Register</Link>
      </View>

      <ErrorDialog
        visible={!!error}
        title="Couldn't sign in"
        message={error}
        onDismiss={() => setError("")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.hero, marginBottom: spacing.xxl, textAlign: "center" },
  submit: { marginTop: spacing.sm },
  linksRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  link: { ...typography.bodySmall, color: colors.textLink },
  linkSep: { ...typography.bodySmall, color: colors.textSubtle },
  linkPlain: { ...typography.bodySmall, color: colors.textMuted },
});
