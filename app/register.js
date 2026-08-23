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
import { createUserWithEmailAndPassword, updateProfile as updateAuthProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { friendlyAuthError } from "../src/utils/authErrors";

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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.hint}>Registration requires an {ALLOWED_DOMAIN} email address.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Juan Dela Cruz"
            placeholderTextColor="#6b7280"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={`you${ALLOWED_DOMAIN}`}
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

        <View style={styles.field}>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor="#6b7280"
          />
        </View>

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? "Creating account…" : "Register"}</Text>
        </Pressable>

        <View style={styles.linksRow}>
          <Text style={styles.linkPlain}>Already have an account? </Text>
          <Link href="/login" style={styles.link}>Log in</Link>
        </View>
      </ScrollView>

      <Modal visible={!!error} transparent animationType="fade" onRequestClose={() => setError("")}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Couldn't register</Text>
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
  title: { color: "#e6e6e6", fontSize: 24, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  hint: { color: "#9aa0ac", fontSize: 12, textAlign: "center", marginBottom: 20 },
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
  linkPlain: { color: "#9aa0ac", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#191b22", borderRadius: 10, borderWidth: 1, borderColor: "#2a2d38", padding: 20, width: "100%", maxWidth: 340 },
  modalTitle: { color: "#e6e6e6", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  modalBody: { color: "#c7cad1", fontSize: 14, marginBottom: 16 },
  modalButton: { backgroundColor: "#4a9eff", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  modalButtonText: { color: "#0f1115", fontWeight: "700" },
});
