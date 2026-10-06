import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import ListRow from "./ListRow";
import Icon from "./Icon";
import { allBuildings, floorLabel } from "../utils/constants";
import { campusOf } from "../utils/buildingStore";
import { listedRooms } from "../utils/directorySettings";
import { useDirectorySettings } from "../hooks/useDirectorySettings";
import { roomSubtitle } from "./SearchSheet";
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
// SAVED DIRECTORIES, as on web (DirectoryAccordion.jsx): the rooms
// bookmarked on this phone (see useSavedRooms), newest first, as a group
// above the buildings, collapsed to start, and only while at least one is
// saved and the admin's Directory settings show it (`showSaved`). Tap to
// open the room's card, x to remove (with UNDO, from the caller). A saved
// room the tour no longer lists (its details still exist, but no spot
// serves it) stays, greyed, rather than silently disappearing.
//
// Each room row shows the room's first photo (in the order an admin sorted
// them) fading in on the right, as web's directory cells do (see ListRow).
//
// The sheet is only ever as tall as its content (no empty space below the
// building list).

// "GD1" reads as "GD1 BUILDING" on the board; a name that already says what
// it is ("Digital Campus", "… Hall") is left alone.
function buildingHeading(label) {
  return /building|campus|hall|center|centre|annex|library|gym/i.test(label) ? label : `${label} Building`;
}

const firstPhoto = (room) => room?.placard?.photos?.[0]?.path;

// Peek: just the DIRECTORY title showing.
const PEEK_HEIGHT = 96;

export default function DirectorySheet({
  searchableRooms,
  currentNode,
  saved = [],
  savedLimit,
  savedReady = false,
  onRemoveSaved,
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
  const [savedOpen, setSavedOpen] = useState(false);

  // Each saved entry with the room as the tour knows it now (null if it's
  // no longer listed anywhere).
  const savedRows = useMemo(
    () =>
      saved.map((entry) => ({
        entry,
        room: searchableRooms.find((r) => Number(r.placard?.id) === entry.placard_dialog_id) || null,
      })),
    [saved, searchableRooms]
  );
  const showSaved = settings.showSaved && savedReady && saved.length > 0;

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
        {showSaved && (
          <View>
            <Pressable
              style={styles.buildingRow}
              onPress={() => setSavedOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: savedOpen }}
              accessibilityLabel="Saved Directories"
            >
              <View style={styles.buildingName}>
                <Icon name="save" size={13} color={savedOpen ? colors.primary : colors.textSecondary} />
                <Text style={[styles.buildingText, savedOpen && styles.buildingTextOpen]}>Saved Directories</Text>
                {!!savedLimit && (
                  <Text style={styles.savedCount}>
                    {saved.length} / {savedLimit}
                  </Text>
                )}
              </View>
              <Icon name={savedOpen ? "collapse" : "expand"} size={14} color={savedOpen ? colors.primary : colors.textSecondary} />
            </Pressable>
            {savedOpen &&
              savedRows.map(({ entry, room }) => (
                <ListRow
                  key={entry.placard_dialog_id}
                  title={room?.roomName ?? entry.room_name}
                  subtitle={room ? roomSubtitle(room) : "No longer in the tour"}
                  onPress={room ? () => onPickRoom(room) : undefined}
                  dimmed={!room}
                  indent={spacing.md}
                  photo={firstPhoto(room)}
                  trailing="remove"
                  trailingLabel={`Remove ${room?.roomName ?? entry.room_name} from saved`}
                  onTrailingPress={() => onRemoveSaved(entry, room)}
                />
              ))}
          </View>
        )}

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
                            photo={firstPhoto(r)}
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
  savedCount: { ...typography.sublabel, fontSize: 10 },
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
