import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { floorLabel } from "../utils/constants";
import { colors, typography, spacing } from "../theme";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";

// "Which floor?" after tapping an elevator landing that serves more than
// one other floor — like the web app's elevator picker. A sheet like the
// others (no dimmed backdrop), with the floors as round buttons laid out
// like a real elevator's panel: the floor you're on is marked (and can't be
// picked), and the floor the active route rides to is red, tagged YOUR
// ROUTE. Close with x or by dragging it down.
//
//   picker: { label, currentFloor, destinations: [{ node, floor, marker }] }

// An elevator panel's button text: "UG", "1", "2", …
function panelLabel(floor) {
  return floor === -1 ? "UG" : String(floor);
}

const BUTTON = 60;

export default function ElevatorPicker({ picker, routeFloor, onRide, onClose, bottomOffset, topLimit }) {
  const [contentHeight, setContentHeight] = useState(0);
  if (!picker) return null;

  // Every floor this elevator stops at, lowest first — the rides on offer
  // plus the one you're standing on.
  const byFloor = new Map(picker.destinations.map((d) => [d.floor, d]));
  const floors = [...new Set([picker.currentFloor, ...byFloor.keys()])].sort((a, b) => a - b);
  const routeOffered = routeFloor != null && byFloor.has(routeFloor);

  return (
    <BottomSheet
      onClose={onClose}
      snapPoints={[0.9]}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
      fitContent
      contentHeight={contentHeight || undefined}
    >
      <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="elevator-passenger" size={22} color={colors.textPrimary} />
          <Text style={styles.title} numberOfLines={1}>
            {picker.label || "Elevator"}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
            accessibilityLabel="Close"
          >
            <Icon name="terminate" size={15} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.where}>
          You're on <Text style={styles.whereStrong}>{floorLabel(picker.currentFloor)}</Text>. Choose a floor.
        </Text>

        <View style={styles.panel}>
          {floors.map((floor) => {
            const here = floor === picker.currentFloor;
            const onRoute = floor === routeFloor && !here;
            const dest = byFloor.get(floor);
            return (
              <View key={floor} style={styles.slot}>
                <Pressable
                  disabled={here || !dest}
                  onPress={() => dest && onRide(dest)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    here ? `${floorLabel(floor)}, you are here` : `Ride to ${floorLabel(floor)}${onRoute ? ", your route" : ""}`
                  }
                  style={({ pressed }) => [
                    styles.floorBtn,
                    onRoute && styles.floorBtnRoute,
                    here && styles.floorBtnHere,
                    pressed && !here && (onRoute ? styles.floorBtnRoutePressed : styles.floorBtnPressed),
                  ]}
                >
                  {({ pressed }) => (
                    <Text
                      style={[
                        styles.floorText,
                        (onRoute || (pressed && !here)) && styles.floorTextOnRed,
                        here && styles.floorTextHere,
                      ]}
                    >
                      {panelLabel(floor)}
                    </Text>
                  )}
                </Pressable>
                {here && (
                  <View style={styles.tag}>
                    <Icon name="location" size={9} color={colors.textMuted} />
                    <Text style={styles.tagText}>Here</Text>
                  </View>
                )}
                {onRoute && <Text style={[styles.tagText, styles.tagRoute]}>Your route</Text>}
              </View>
            );
          })}
        </View>

        {routeOffered && <Text style={styles.note}>Red is the floor your route goes to.</Text>}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // Same header as the Directions sheet.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: { ...typography.h3, flex: 1 },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.iconButton,
  },
  roundBtnPressed: { backgroundColor: colors.borderStrong },
  where: { ...typography.bodySmall, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  whereStrong: { ...typography.bodySemiBold, fontSize: 12.5 },

  panel: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  slot: { alignItems: "center", width: BUTTON + 8, minHeight: BUTTON + 18 },
  floorBtn: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceField,
  },
  floorBtnPressed: { backgroundColor: colors.primary },
  floorBtnRoute: { backgroundColor: colors.primary },
  floorBtnRoutePressed: { backgroundColor: colors.primaryPressed },
  // The floor you're on: an outline only, not a button to press.
  floorBtnHere: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.gray500 },
  floorText: { ...typography.h3, fontSize: 19, lineHeight: 24, letterSpacing: 0.5, color: colors.textPrimary },
  floorTextOnRed: { color: colors.textOnPrimary },
  floorTextHere: { color: colors.textMuted },
  tag: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  tagText: { ...typography.sublabel, fontSize: 9.5, lineHeight: 12, letterSpacing: 0.8 },
  tagRoute: { marginTop: 4, color: colors.primary },
  note: { ...typography.caption, textAlign: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
});
