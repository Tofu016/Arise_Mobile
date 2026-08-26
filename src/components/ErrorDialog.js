import { Modal, View, Text, StyleSheet } from "react-native";
import { colors, typography, radii, spacing, shadows } from "../theme";
import Button from "./Button";

// The transparent fade dialog used for auth errors ("Couldn't sign in",
// "Couldn't register", …). Identical markup lived in three screens; this is
// the single source.
//
//   <ErrorDialog
//     visible={!!error}
//     title="Couldn't sign in"
//     message={error}
//     onDismiss={() => setError("")}
//   />

export default function ErrorDialog({
  visible,
  title,
  message,
  onDismiss,
  dismissLabel = "OK",
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {title != null && <Text style={styles.title}>{title}</Text>}
          {message != null && <Text style={styles.body}>{message}</Text>}
          <Button label={dismissLabel} onPress={onDismiss} size="sm" style={styles.button} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 340,
    ...shadows.floating,
  },
  title: { ...typography.h3, marginBottom: spacing.sm },
  body: { ...typography.body, marginBottom: spacing.lg },
  button: { alignSelf: "stretch" },
});
