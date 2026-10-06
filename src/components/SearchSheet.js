import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import ListRow from "./ListRow";
import Icon from "./Icon";
import { buildingLabel, floorLabel } from "../utils/constants";
import { colors, typography, radii, spacing } from "../theme";

// The brand board's search sheet: a pill search field (back chevron, scan
// icon on the right), then RECENT (with SEE ALL) and SUGGESTED ROOMS; while
// typing, the matching rooms and places. Focusing the field expands the
// sheet toward full height, as on the board's keyboard mock-up. It's only
// ever as tall as its content (no empty space below the list), and rises
// above the keyboard while typing, so short result lists stay in view.
const RECENT_PREVIEW = 3;
// Peek: just the search field showing.
const PEEK_HEIGHT = 92;

export function roomSubtitle(room) {
  const where = `${buildingLabel(room.node.building)} - ${floorLabel(room.node.floor)}`;
  const what = room.placard?.department || room.roomName;
  return `${where} > ${what}`;
}

export default function SearchSheet({
  query,
  onChangeQuery,
  onClose,
  onScan,
  inputRef,
  recentRooms,
  onRemoveRecent,
  suggestions,
  placeSuggestions = [],
  roomResults,
  placeResults,
  onPickRoom,
  onPickPlace,
  bottomOffset,
  topLimit,
}) {
  const [focused, setFocused] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const typing = query.trim().length > 0;
  const recentShown = showAllRecent ? recentRooms : recentRooms.slice(0, RECENT_PREVIEW);
  // Search field + list, measured, so the sheet fits them exactly.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const contentHeight = headerHeight && listHeight ? headerHeight + listHeight : undefined;

  return (
    <BottomSheet
      onClose={onClose}
      snapPoints={[PEEK_HEIGHT, 0.55, 0.9]}
      initialSnap={1}
      snapIndex={focused || typing ? 2 : 1}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
      fitContent
      contentHeight={contentHeight}
      avoidKeyboard
    >
      <View style={styles.searchRowWrap} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <View style={styles.searchRow}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close search">
            <Icon name="proceedBack" size={16} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={onChangeQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search here"
            placeholderTextColor={colors.textSubtle}
            returnKeyType="search"
            autoCorrect={false}
          />
          <Pressable onPress={onScan} hitSlop={10} accessibilityLabel="Scan a placard">
            <Icon name="scanCode" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(_, h) => setListHeight(h)}
      >
        {!typing && recentRooms.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Recent</Text>
              {recentRooms.length > RECENT_PREVIEW && (
                <Pressable onPress={() => setShowAllRecent((v) => !v)} hitSlop={8}>
                  <Text style={styles.seeAll}>{showAllRecent ? "Show less" : "See all"}</Text>
                </Pressable>
              )}
            </View>
            {recentShown.map((r) => (
              <ListRow
                key={r.roomName}
                title={r.roomName}
                subtitle={roomSubtitle(r)}
                onPress={() => onPickRoom(r)}
                trailing="remove"
                onTrailingPress={() => onRemoveRecent(r.roomName)}
              />
            ))}
            <View style={styles.divider} />
          </>
        )}

        {!typing && suggestions.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelAlone]}>Suggested rooms</Text>
            {suggestions.map((r) => (
              <ListRow key={r.roomName} title={r.roomName} subtitle={roomSubtitle(r)} onPress={() => onPickRoom(r)} />
            ))}
          </>
        )}

        {/* Places fill whatever room suggestions didn't (see
            pickLocationSuggestions), so the list isn't empty before any
            room has details. */}
        {!typing && placeSuggestions.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelAlone]}>Suggested places</Text>
            {placeSuggestions.map((n) => (
              <ListRow
                key={n.id}
                title={n.name}
                subtitle={`${buildingLabel(n.building)} - ${floorLabel(n.floor)}`}
                onPress={() => onPickPlace(n)}
              />
            ))}
          </>
        )}

        {typing && roomResults.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelAlone]}>Rooms</Text>
            {roomResults.map((r) => (
              <ListRow key={r.roomName} title={r.roomName} subtitle={roomSubtitle(r)} onPress={() => onPickRoom(r)} />
            ))}
          </>
        )}

        {typing && placeResults.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelAlone]}>Places</Text>
            {placeResults.map((n) => (
              <ListRow
                key={n.id}
                title={n.name}
                subtitle={`${buildingLabel(n.building)} - ${floorLabel(n.floor)}`}
                onPress={() => onPickPlace(n)}
              />
            ))}
          </>
        )}

        {typing && roomResults.length === 0 && placeResults.length === 0 && (
          <Text style={styles.empty}>No room or place found for "{query.trim()}".</Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchRowWrap: { paddingTop: spacing.xs },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    height: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    letterSpacing: 1,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xs,
  },
  sectionLabel: { ...typography.eyebrow },
  sectionLabelAlone: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xs },
  seeAll: { ...typography.eyebrow, color: colors.primary },
  divider: { height: 1.5, backgroundColor: colors.divider, marginHorizontal: spacing.lg, marginTop: spacing.md },
  empty: { ...typography.body, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
});
