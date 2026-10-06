import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import Icon from "./Icon";
import { allBuildings, floorLabel } from "../utils/constants";
import { campusOf } from "../utils/buildingStore";
import { findKioskEntranceShortcuts, findMainCampusEntrance, floorsForBuilding } from "../utils/navigation";
import { colors, typography, radii, spacing } from "../theme";

// The Building tab: web's "Choose a building" (the Compact layout's Building
// dialog, MainPage.jsx renderBuildingList), as a sheet. A MAIN CAMPUS
// ENTRANCE shortcut on top, then every building as a row; tapping one opens
// its entrance shortcuts and a grid of its floors (UG, 1, 2…). A floor lands
// on that floor's starting node (pickFloorStart), an entrance on the
// entrance itself. Either is a jump, as on web.
//
// "You are here": your building has a red badge (and starts open), your
// floor's button is filled red. A building with no nodes yet can't be
// opened.
//
// Main Campus's shared entrance has its own entry on top, so it isn't
// repeated under GD1, GD2 and GD3; a solo-building campus (Digital Campus)
// has no such entry, so its campus entrance stays under the building.
//
// The sheet is only ever as tall as its content.

// Peek: just the title showing.
const PEEK_HEIGHT = 96;

export default function BuildingSheet({ nodes, currentNode, onPickNode, onPickFloor, onClose, bottomOffset, topLimit }) {
  const hereBuilding = currentNode?.building ?? null;
  const hereFloor = currentNode ? Number(currentNode.floor) : null;
  const [openId, setOpenId] = useState(hereBuilding);
  // Title + list, measured, so the sheet fits them exactly.
  const [titleHeight, setTitleHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const contentHeight = titleHeight && listHeight ? titleHeight + listHeight : undefined;

  const mainCampusEntrance = useMemo(() => findMainCampusEntrance(nodes, campusOf), [nodes]);
  const buildings = useMemo(
    () =>
      allBuildings().map((b) => ({
        ...b,
        floors: floorsForBuilding(nodes, b.id),
        entrances: findKioskEntranceShortcuts(nodes, b.id, campusOf).filter(
          (s) => !(s.key === "campus" && campusOf(b.id) === "main")
        ),
      })),
    [nodes]
  );

  return (
    <BottomSheet
      onClose={onClose}
      snapPoints={[PEEK_HEIGHT, 0.5, 0.85]}
      initialSnap={1}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
      fitContent
      contentHeight={contentHeight}
    >
      <Text style={styles.title} onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)}>
        Choose a building
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(_, h) => setListHeight(h)}
      >
        {mainCampusEntrance && (
          <View style={styles.topShortcut}>
            <Button
              label="Main Campus Entrance"
              icon="location"
              variant="outline"
              size="sm"
              onPress={() => onPickNode(mainCampusEntrance.id)}
            />
          </View>
        )}

        {buildings.map((b) => {
          const open = openId === b.id;
          const here = b.id === hereBuilding;
          const empty = b.floors.length === 0;
          return (
            <View key={b.id}>
              <Pressable
                style={[styles.buildingRow, empty && styles.buildingRowEmpty]}
                onPress={() => setOpenId(open ? null : b.id)}
                disabled={empty}
                accessibilityRole="button"
                accessibilityState={{ expanded: open, disabled: empty }}
                accessibilityLabel={here ? `${b.label}, you are here` : b.label}
              >
                <View style={styles.buildingName}>
                  <Text style={[styles.buildingText, open && styles.buildingTextOpen]}>{b.label}</Text>
                  {here && (
                    <View style={styles.hereBadge}>
                      <Icon name="location" size={10} color={colors.textOnPrimary} />
                      <Text style={styles.hereBadgeText}>You are here</Text>
                    </View>
                  )}
                </View>
                {!empty && (
                  <Icon name={open ? "collapse" : "expand"} size={14} color={open ? colors.primary : colors.textSecondary} />
                )}
              </Pressable>

              {open && (
                <View style={styles.openBody}>
                  {b.entrances.length > 0 && (
                    <View style={styles.entrances}>
                      {b.entrances.map((s) => (
                        <Button
                          key={s.key}
                          label={s.label}
                          variant="outline"
                          size="sm"
                          onPress={() => onPickNode(s.nodeId)}
                          style={styles.entranceBtn}
                        />
                      ))}
                    </View>
                  )}
                  <Text style={styles.floorSubtitle}>Floor</Text>
                  <View style={styles.floorGrid}>
                    {b.floors.map((f) => {
                      const hereFloorBtn = here && f === hereFloor;
                      return (
                        <Pressable
                          key={f}
                          onPress={() => onPickFloor(b.id, f)}
                          accessibilityRole="button"
                          accessibilityLabel={hereFloorBtn ? `${floorLabel(f)}, you are here` : floorLabel(f)}
                          style={({ pressed }) => [
                            styles.floorBtn,
                            hereFloorBtn && styles.floorBtnHere,
                            pressed && (hereFloorBtn ? styles.floorBtnHerePressed : styles.floorBtnPressed),
                          ]}
                        >
                          <Text style={[styles.floorBtnText, hereFloorBtn && styles.floorBtnTextHere]}>
                            {f === -1 ? "UG" : f}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const FLOOR_BTN = 48;

const styles = StyleSheet.create({
  title: { ...typography.h3, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  topShortcut: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  buildingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
  },
  buildingRowEmpty: { opacity: 0.45 },
  buildingName: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  buildingText: { ...typography.eyebrow, color: colors.textSecondary, flexShrink: 1 },
  buildingTextOpen: { color: colors.primary },
  hereBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  hereBadgeText: { ...typography.sublabel, fontSize: 9.5, lineHeight: 13, letterSpacing: 0.8, color: colors.textOnPrimary },
  openBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceSunken,
  },
  entrances: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.sm },
  entranceBtn: { flexGrow: 1 },
  floorSubtitle: { ...typography.sublabel, color: colors.textSecondary, paddingTop: spacing.md, paddingBottom: spacing.sm },
  floorGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  floorBtn: {
    width: FLOOR_BTN,
    height: FLOOR_BTN,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  floorBtnPressed: { backgroundColor: colors.primaryTint },
  floorBtnHere: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  floorBtnHerePressed: { backgroundColor: colors.primaryPressed, borderColor: colors.primaryPressed },
  floorBtnText: { ...typography.label, color: colors.textSecondary },
  floorBtnTextHere: { color: colors.textOnPrimary },
});
