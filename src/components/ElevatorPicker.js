import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { floorLabel } from "../utils/constants";
import { colors, typography, radii, spacing, shadows } from "../theme";
import Button from "./Button";

// "Which floor?" after tapping an elevator landing that serves more than
// one other floor — like the web app's elevator picker. The floor the
// active route rides to (if any) is listed first and marked.
//
//   picker: { label, currentFloor, destinations: [{ node, floor, marker }] }

export default function ElevatorPicker({ picker, routeFloor, onRide, onClose }) {
  if (!picker) return null;
  const ordered = [...picker.destinations].sort((a, b) => {
    if (a.floor === routeFloor) return -1;
    if (b.floor === routeFloor) return 1;
    return a.floor - b.floor;
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Swallows taps on the card so only the backdrop closes it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>🛗 {picker.label}</Text>
          <Text style={styles.body}>You're on {floorLabel(picker.currentFloor)}. Ride to:</Text>
          <ScrollView style={styles.list}>
            {ordered.map((dest) => {
              const onRoute = dest.floor === routeFloor;
              return (
                <Pressable
                  key={dest.node.id}
                  style={[styles.floorRow, onRoute && styles.floorRowRoute]}
                  onPress={() => onRide(dest)}
                >
                  <Text style={styles.floorText}>{floorLabel(dest.floor)}</Text>
                  {onRoute && <Text style={styles.routeTag}>Your route</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
          <Button label="Cancel" variant="outline" onPress={onClose} size="sm" style={styles.button} />
        </Pressable>
      </Pressable>
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
    maxHeight: "80%",
    ...shadows.floating,
  },
  title: { ...typography.h3, marginBottom: spacing.sm },
  body: { ...typography.body, marginBottom: spacing.md },
  list: { marginBottom: spacing.lg },
  floorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  floorRowRoute: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  floorText: { ...typography.bodySemiBold, color: colors.textPrimary },
  routeTag: { ...typography.caption, color: colors.primary },
  button: { alignSelf: "stretch" },
});
