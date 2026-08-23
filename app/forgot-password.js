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
import { Link } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../src/firebase";
import { friendlyAuthError } from "../src/utils/authErrors";

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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholderTextColor="#6b7280"
              />
            </View>

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>{submitting ? "Sending…" : "Send reset link"}</Text>
            </Pressable>
          </>
        )}

        <View style={styles.linksRow}>
          <Link href="/login" style={styles.link}>Back to sign in</Link>
          <Text style={styles.linkSep}> · </Text>
          <Link href="/forgot-email" style={styles.link}>Forgot email?</Link>
        </View>
      </ScrollView>

      <Modal visible={!!error} transparent animationType="fade" onRequestClose={() => setError("")}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Couldn't send reset link</Text>
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
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(74,158,255,0.15)",
    borderWidth: 1,
    borderColor: "#4a9eff",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  iconBadgeText: { fontSize: 20 },
  title: { color: "#e6e6e6", fontSize: 22, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  hint: { color: "#9aa0ac", fontSize: 13, textAlign: "center", marginBottom: 20, lineHeight: 18 },
  infoText: { color: "#c7cad1", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
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
  linksRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  link: { color: "#4a9eff", fontSize: 13 },
  linkSep: { color: "#6b7280", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#191b22", borderRadius: 10, borderWidth: 1, borderColor: "#2a2d38", padding: 20, width: "100%", maxWidth: 340 },
  modalTitle: { color: "#e6e6e6", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  modalBody: { color: "#c7cad1", fontSize: 14, marginBottom: 16 },
  modalButton: { backgroundColor: "#4a9eff", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  modalButtonText: { color: "#0f1115", fontWeight: "700" },
});
