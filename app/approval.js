import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../src/context/useAuth";
import { colors, typography, radii, spacing } from "../src/theme";
import ScreenContainer from "../src/components/ScreenContainer";
import Button from "../src/components/Button";
import { AuthHeader } from "../src/components/AuthParts";

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
      <AuthHeader
        icon="pending"
        title="Awaiting approval"
        subtitle="Your account has been created but hasn't been approved by an admin yet."
      />

      {!!user?.email && (
        <View style={styles.account}>
          <Text style={styles.accountLabel}>Account</Text>
          <Text style={styles.accountEmail} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      )}

      <Text style={styles.hint}>Check back soon, or contact an administrator.</Text>

      <Button label="Sign out" onPress={signOut} variant="outline" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  account: {
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceField,
    marginBottom: spacing.md,
  },
  accountLabel: { ...typography.sublabel },
  accountEmail: { ...typography.bodySemiBold, marginTop: 2 },
  hint: { ...typography.caption, textAlign: "center", marginBottom: spacing.xxl },
});
