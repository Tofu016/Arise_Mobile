import { useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/useAuth";
import { spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import FormField from "../src/components/FormField";
import Button from "../src/components/Button";
import ErrorDialog from "../src/components/ErrorDialog";
import { AuthHeader, AuthLinks } from "../src/components/AuthParts";

const ALLOWED_DOMAIN = "@sdca.edu.ph";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    const trimmedEmail = email.trim().toLowerCase();

    // Client-side check for immediate feedback — the real enforcement is
    // server-side (register() in Auth_API), same domain rule, checked
    // again regardless of what happens here.
    if (!trimmedEmail.endsWith(ALLOWED_DOMAIN)) {
      setError(`Only ${ALLOWED_DOMAIN} email addresses can register.`);
      return;
    }
    // 8, not 6 — matches the backend's actual minimum exactly, so a
    // password that clears this check is guaranteed to clear the
    // server's too, rather than passing here and failing there with a
    // confusing, inconsistent error.
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      // New accounts start as "pending" — an admin has to approve/assign
      // a real role before this account can actually use anything.
      await register(trimmedEmail, password, name.trim());
      router.replace("/");
    } catch (err) {
      setError(err.message || "Couldn't register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding>
      <AuthHeader
        logo
        title="Create an account"
        subtitle={`Registration needs an ${ALLOWED_DOMAIN} email address. An admin approves new accounts.`}
      />

      <FormField
        label="Name"
        icon="person"
        value={name}
        onChangeText={setName}
        placeholder="Juan Dela Cruz"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />

      <FormField
        label="Email"
        icon="email"
        inputRef={emailRef}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        placeholder={`you${ALLOWED_DOMAIN}`}
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
        autoComplete="new-password"
        hint="At least 8 characters."
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />

      <FormField
        label="Confirm password"
        icon="lock"
        inputRef={confirmRef}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        containerStyle={styles.lastField}
      />

      <ErrorDialog visible={!!error} title="Couldn't register" message={error} onDismiss={() => setError("")} />

      <Button label={submitting ? "Creating account…" : "Register"} onPress={handleSubmit} loading={submitting} />

      <AuthLinks items={["Already have an account?", { href: "/login", label: "Sign in" }]} style={styles.links} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lastField: { marginBottom: spacing.xl },
  links: { marginTop: spacing.xl },
});
