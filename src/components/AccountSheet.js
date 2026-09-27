import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import { colors, typography, spacing } from "../theme";

// The Account tab. The brand board shows the tab but doesn't draw this
// screen (its web view has an account prompt: greeting, admin panel, log
// out), so it follows the other sheets' style: initials, name, the admin
// note, and Sign out. Only ever as tall as its content (no empty space).
export default function AccountSheet({ name, email, isAdmin, onSignOut, onClose, bottomOffset, topLimit }) {
  const initials = (name || email || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // Measured, so the sheet fits its content exactly.
  const [contentHeight, setContentHeight] = useState(0);

  return (
    <BottomSheet
      onClose={onClose}
      snapPoints={[0.6]}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
      fitContent
      contentHeight={contentHeight || undefined}
    >
      <View style={styles.content} onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.greeting} numberOfLines={1}>
          Hi, {name || email}
        </Text>
        {!!name && !!email && (
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        )}
        {isAdmin && <Text style={styles.adminHint}>Admin account — manage the Admin Panel from a desktop browser.</Text>}
        <Button label="Log out" onPress={onSignOut} style={styles.signOut} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  avatarText: { ...typography.h3, color: colors.textOnPrimary },
  greeting: { ...typography.h3, textAlign: "center" },
  email: { ...typography.sublabel, marginTop: spacing.xs, textTransform: "none" },
  adminHint: { ...typography.caption, textAlign: "center", marginTop: spacing.md },
  signOut: { alignSelf: "stretch", marginTop: spacing.xl },
});
