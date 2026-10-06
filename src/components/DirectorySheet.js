import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import ListRow from "./ListRow";
import Icon from "./Icon";
import { allBuildings, floorLabel } from "../utils/constants";
import { campusOf } from "../utils/buildingStore";
import { listedRooms } from "../utils/directorySettings";
import { useDirectorySettings } from "../hooks/useDirectorySettings";
import { colors, typography, radii, spacing } from "../theme";

// The brand board's DIRECTORY sheet (the Location tab): every building as
// an accordion row ("GD1 BUILDING ⌄"), opening to all its rooms grouped
// under floor headings (UG, FLOOR 1, FLOOR 2…); an open building's name
// turns red. One building open at a time.
//
// Lists the rooms and facilities the admin chose for the Directory on the
// web app's Directory page (hidden campuses and buildings, and each
// building's listed rooms, see utils/directorySettings.js), the same list
// web's sidebar Directory shows. Every room opens its room card, which says
// so when the room has no details yet. Search still finds every room.
//
// "You are here": the building you're standing in gets a red badge and
// starts open, and your floor's heading gets a pin.
//
// The sheet is only ever as tall as its content (no empty space below the
// building list).

// "GD1" reads as "GD1 BUILDING" on the board; a name that already says what
// it is ("Digital Campus", "… Hall") is left alone.
function buildingHeading(label) {
  return /building|campus|hall|center|centre|annex|library|gym/i.test(label) ? label : `${label} Building`;
}

// Peek: just the DIRECTORY title showing.
const PEEK_HEIGHT = 96;

export default function DirectorySheet({
  searchableRooms,
  currentNode,
  onPickRoom,
  onClose,
  bottomOffset,
  topLimit,
}) {
  const hereBuilding = currentNode?.building ?? null;
  const hereFloor = currentNode?.floor ?? null;
  const [openId, setOpenId] = useState(hereBuilding);
  // Title + list, measured, so the sheet fits them exactly.
  const [titleHeight, setTitleHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const contentHeight = titleHeight && listHeight ? titleHeight + listHeight : undefined;

  const settings = useDirectorySettings();

  const sections = useMemo(
    () =>
      allBuildings()
        .filter((b) => !settings.hiddenCampuses.includes(campusOf(b.id)) && !settings.hiddenBuildings.includes(b.id))
        .map((b) => {
          const floors = new Map(); // floor -> rooms
          for (const room of listedRooms(settings, b.id, searchableRooms)) {
            const floor = room.node.floor;
            if (!floors.has(floor)) floors.set(floor, []);
            floors.get(floor).push(room);
          }
          return {
            id: b.id,
            heading: buildingHeading(b.label),
            floors: [...floors.entries()]
              .sort(([a], [z]) => a - z) // UG (-1) first, then up
              .map(([floor, rooms]) => ({
                floor,
                rooms: rooms.sort((a, z) => a.roomName.localeCompare(z.roomName, undefined, { numeric: true })),
              })),
          };
        }),
    [searchableRooms, settings]
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
        Directory
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(_, h) => setListHeight(h)}
      >
        {sections.map((section) => {
          const open = openId === section.id;
          const here = section.id === hereBuilding;
          return (
            <View key={section.id}>
              <Pressable
                style={styles.buildingRow}
                onPress={() => setOpenId(open ? null : section.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={here ? `${section.heading}, you are here` : section.heading}
              >
                <View style={styles.buildingName}>
                  <Text style={[styles.buildingText, open && styles.buildingTextOpen]}>{section.heading}</Text>
                  {here && (
                    <View style={styles.hereBadge}>
                      <Icon name="location" size={10} color={colors.textOnPrimary} />
                      <Text style={styles.hereBadgeText}>You are here</Text>
                    </View>
                  )}
                </View>
                <Icon name={open ? "collapse" : "expand"} size={14} color={open ? colors.primary : colors.textSecondary} />
              </Pressable>

              {open &&
                (section.floors.length > 0 ? (
                  section.floors.map(({ floor, rooms }) => {
                    const hereOnFloor = here && floor === hereFloor;
                    return (
                      <View key={floor}>
                        <View style={styles.floorHeading}>
                          <Text style={[styles.floorText, hereOnFloor && styles.floorTextHere]}>{floorLabel(floor)}</Text>
                          {hereOnFloor && (
                            <View style={styles.floorHere}>
                              <Icon name="location" size={11} color={colors.primary} />
                              <Text style={styles.floorHereText}>You are here</Text>
                            </View>
                          )}
                        </View>
                        {rooms.map((r) => (
                          <ListRow
                            key={r.roomName}
                            title={r.roomName}
                            onPress={() => onPickRoom(r)}
                            indent={spacing.md}
                          />
                        ))}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.empty}>No rooms listed here yet.</Text>
                ))}
            </View>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  buildingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
  },
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
  // Floor headings inside an open building: a small tracked label on a
  // light band, like the floor lines of a building directory board.
  floorHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingLeft: spacing.xl + spacing.md,
    paddingRight: spacing.xl,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surfaceSunken,
  },
  floorText: { ...typography.sublabel, color: colors.textSecondary },
  floorTextHere: { color: colors.primary },
  floorHere: { flexDirection: "row", alignItems: "center", gap: 3 },
  floorHereText: { ...typography.sublabel, fontSize: 10, color: colors.primary },
  empty: { ...typography.sublabel, paddingHorizontal: spacing.xl + spacing.md, paddingVertical: spacing.sm },
});
