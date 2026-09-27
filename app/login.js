import { useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../src/context/useAuth";
import { colors, typography, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import FormField from "../src/components/FormField";
import Button from "../src/components/Button";
import ErrorDialog from "../src/components/ErrorDialog";
import { AuthHeader, AuthLinks } from "../src/components/AuthParts";
import ServerSetting from "../src/components/ServerSetting";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // Always navigate to "/" — if the account turns out to be pending,
      // the root layout's own auth guard notices the role and redirects to
      // /approval on its own, so there's no need to duplicate that check
      // here (matches how the web version's RequireAuth handles it too).
      router.replace("/");
    } catch (err) {
      setError(err.message || "Couldn't sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding>
      <AuthHeader logo title="Sign in" subtitle="Use your @sdca.edu.ph account to explore the campus." />

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
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />

      <FormField
        label="Password"
        icon="lock"
        inputRef={passwordRef}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        containerStyle={styles.passwordField}
      />
      <Link href="/forgot-password" style={styles.forgot}>
        Forgot password?
      </Link>

      <ErrorDialog visible={!!error} title="Couldn't sign in" message={error} onDismiss={() => setError("")} />

      <Button label={submitting ? "Signing in…" : "Sign in"} onPress={handleSubmit} loading={submitting} />

      <AuthLinks items={["Need an account?", { href: "/register", label: "Register" }]} style={styles.firstLinks} />
      <AuthLinks items={[{ href: "/forgot-email", label: "Forgot your email?" }]} style={styles.links} />

      {/* The development build only (renders nothing otherwise). */}
      <ServerSetting />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  passwordField: { marginBottom: spacing.sm },
  forgot: { ...typography.label, color: colors.textLink, alignSelf: "flex-end", marginBottom: spacing.xl },
  firstLinks: { marginTop: spacing.xl },
  links: { marginTop: spacing.md },
});
