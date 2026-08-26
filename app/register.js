import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile as updateAuthProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { friendlyAuthError } from "../src/utils/authErrors";
import { colors, typography, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import FormField from "../src/components/FormField";
import Button from "../src/components/Button";
import ErrorDialog from "../src/components/ErrorDialog";

const ALLOWED_DOMAIN = "@sdca.edu.ph";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    const trimmedEmail = email.trim().toLowerCase();

    // Client-side check for immediate feedback — a UX convenience, not real
    // enforcement. The same server-side blocking Cloud Function
    // (enforceEmailDomain) already backs this up regardless of which client
    // is used to register, web or mobile.
    if (!trimmedEmail.endsWith(ALLOWED_DOMAIN)) {
      setError(`Only ${ALLOWED_DOMAIN} email addresses can register.`);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      if (name.trim()) {
        await updateAuthProfile(cred.user, { displayName: name.trim() });
      }
      // New accounts start as "pending" — same as web, an admin has to
      // approve/assign a real role before this account can use anything.
      await setDoc(doc(db, "users", cred.user.uid), {
        email: trimmedEmail,
        name: name.trim() || null,
        role: "pending",
        createdAt: serverTimestamp(),
      });
      router.replace("/");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer keyboardAvoiding>
      <Text style={styles.title}>Create an account</Text>
      <Text style={styles.hint}>Registration requires an {ALLOWED_DOMAIN} email address.</Text>

      <FormField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Juan Dela Cruz"
      />

      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder={`you${ALLOWED_DOMAIN}`}
      />

      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <FormField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <Button
        label={submitting ? "Creating account…" : "Register"}
        onPress={handleSubmit}
        loading={submitting}
        style={styles.submit}
      />

      <View style={styles.linksRow}>
        <Text style={styles.linkPlain}>Already have an account? </Text>
        <Link href="/login" style={styles.link}>Log in</Link>
      </View>

      <ErrorDialog
        visible={!!error}
        title="Couldn't register"
        message={error}
        onDismiss={() => setError("")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, marginBottom: spacing.xs + 2, textAlign: "center" },
  hint: { ...typography.caption, textAlign: "center", marginBottom: spacing.xl },
  submit: { marginTop: spacing.sm },
  linksRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  link: { ...typography.bodySmall, color: colors.textLink },
  linkPlain: { ...typography.bodySmall, color: colors.textMuted },
});
