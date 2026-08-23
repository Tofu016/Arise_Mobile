import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../src/firebase";
import { friendlyAuthError } from "../src/utils/authErrors";

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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sign in</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@sdca.edu.ph"
            placeholderTextColor="#6b7280"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#6b7280"
          />
        </View>

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? "Signing in…" : "Sign in"}</Text>
        </Pressable>

        <View style={styles.linksRow}>
          <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
          <Text style={styles.linkSep}> · </Text>
          <Link href="/forgot-email" style={styles.link}>Forgot email?</Link>
        </View>
        <View style={styles.linksRow}>
          <Text style={styles.linkPlain}>Need an account? </Text>
          <Link href="/register" style={styles.link}>Register</Link>
        </View>
      </ScrollView>

      <Modal visible={!!error} transparent animationType="fade" onRequestClose={() => setError("")}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Couldn't sign in</Text>
            <Text style={styles.modalBody}>{error}</Text>
            <Pressable style={styles.modalButton} onPress={() => setError("")}>
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0f1115" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  title: { color: "#e6e6e6", fontSize: 24, fontWeight: "700", marginBottom: 24, textAlign: "center" },
  field: { marginBottom: 16 },
  label: { color: "#9aa0ac", fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: "#191b22",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#e6e6e6",
    fontSize: 15,
  },
  button: {
    backgroundColor: "#4a9eff",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0f1115", fontSize: 15, fontWeight: "700" },
  linksRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  link: { color: "#4a9eff", fontSize: 13 },
  linkSep: { color: "#6b7280", fontSize: 13 },
  linkPlain: { color: "#9aa0ac", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#191b22", borderRadius: 10, borderWidth: 1, borderColor: "#2a2d38", padding: 20, width: "100%", maxWidth: 340 },
  modalTitle: { color: "#e6e6e6", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  modalBody: { color: "#c7cad1", fontSize: 14, marginBottom: 16 },
  modalButton: { backgroundColor: "#4a9eff", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  modalButtonText: { color: "#0f1115", fontWeight: "700" },
});
