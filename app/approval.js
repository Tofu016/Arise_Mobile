import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../src/context/useAuth";
import { typography, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import Button from "../src/components/Button";

// Matches RequireAuth.jsx's "Awaiting approval" state on web, word for word
// — including showing the person's actual email so it's clear which account
// is pending. "Sign out" here has to actually sign the user out, not just
// navigate — they're still authenticated (just pending), so a plain
// navigation to /login would get immediately bounced right back here by the
// auth guard in _layout.js.
export default function ApprovalScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.inner}>
        <Text style={styles.title}>Awaiting approval</Text>
        <Text style={styles.body}>
          Your account (<Text style={styles.bold}>{user?.email}</Text>) has been created but hasn't
          been approved by an admin yet.
        </Text>
        <Text style={styles.hint}>Check back soon, or contact an administrator.</Text>

        <Button label="Sign out" onPress={signOut} variant="outline" size="sm" style={styles.button} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inner: { alignItems: "center" },
  title: { ...typography.h2, marginBottom: spacing.md + 2, textAlign: "center" },
  body: { ...typography.body, textAlign: "center", marginBottom: spacing.sm, maxWidth: 300 },
  bold: { ...typography.bodySemiBold },
  hint: { ...typography.caption, textAlign: "center", marginBottom: spacing.xxl },
  button: { minWidth: 160 },
});
