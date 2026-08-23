import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAuth } from "../src/context/useAuth";

// Matches RequireAuth.jsx's "Awaiting approval" state on web, word for word
// — including showing the person's actual email so it's clear which account
// is pending. "Sign out" here has to actually sign the user out, not just
// navigate — they're still authenticated (just pending), so a plain
// navigation to /login would get immediately bounced right back here by the
// auth guard in _layout.js.
export default function ApprovalScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Awaiting approval</Text>
      <Text style={styles.body}>
        Your account (<Text style={styles.bold}>{user?.email}</Text>) has been created but hasn't
        been approved by an admin yet.
      </Text>
      <Text style={styles.hint}>Check back soon, or contact an administrator.</Text>

      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { color: "#e6e6e6", fontSize: 20, fontWeight: "700", marginBottom: 14, textAlign: "center" },
  body: { color: "#c7cad1", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8, maxWidth: 300 },
  bold: { fontWeight: "700", color: "#e6e6e6" },
  hint: { color: "#9aa0ac", fontSize: 12, textAlign: "center", marginBottom: 24 },
  button: { borderWidth: 1, borderColor: "#2a2d38", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  buttonText: { color: "#e6e6e6", fontSize: 14 },
});
