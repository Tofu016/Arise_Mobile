import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import ListRow from "./ListRow";
import Icon from "./Icon";
import { roomSubtitle } from "./SearchSheet";
import { colors, typography, spacing } from "../theme";

// The Saved tab: the rooms bookmarked on this phone (see useSavedRooms),
// newest first, in the same style as Recent in the search sheet — tap to
// open the room's card, x to remove (with UNDO, from the caller). A saved
// room the tour no longer lists (its details still exist, but no spot
// serves it) stays, greyed, rather than silently disappearing.
//
// The sheet is only ever as tall as its content.

// Peek: just the SAVED title showing.
const PEEK_HEIGHT = 96;

export default function SavedSheet({
  saved,
  limit,
  status,
  searchableRooms,
  onPickRoom,
  onRemove,
  onRetry,
  onClose,
  bottomOffset,
  topLimit,
}) {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const contentHeight = headerHeight && bodyHeight ? headerHeight + bodyHeight : undefined;

  // Each saved entry with the room as the tour knows it now (null if it's
  // no longer listed anywhere).
  const rows = saved.map((entry) => ({
    entry,
    room: searchableRooms.find((r) => Number(r.placard?.id) === entry.placard_dialog_id) || null,
  }));

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
      <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <Text style={styles.title}>Saved</Text>
        {status === "ready" && saved.length > 0 && (
          <Text style={styles.count}>
            {saved.length} / {limit}
          </Text>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content} onContentSizeChange={(_, h) => setBodyHeight(h)}>
        {(status === "loading" || status === "idle") && <Text style={styles.note}>Loading your saved rooms…</Text>}

        {status === "error" && (
          <View style={styles.empty}>
            <Text style={styles.note}>Couldn't load your saved rooms.</Text>
            <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        )}

        {status === "ready" && saved.length === 0 && (
          <View style={styles.empty}>
            <Icon name="save" size={26} color={colors.gray500} />
            <Text style={styles.note}>No saved rooms yet. Tap the bookmark on a room's card to save it here. Saved rooms stay on this phone.</Text>
          </View>
        )}

        {status === "ready" &&
          rows.map(({ entry, room }) => (
            <ListRow
              key={entry.placard_dialog_id}
              title={room?.roomName ?? entry.room_name}
              subtitle={room ? roomSubtitle(room) : "No longer in the tour"}
              onPress={room ? () => onPickRoom(room) : undefined}
              dimmed={!room}
              trailing="remove"
              trailingLabel={`Remove ${room?.roomName ?? entry.room_name} from saved`}
              onTrailingPress={() => onRemove(entry, room)}
            />
          ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.h3 },
  count: { ...typography.sublabel },
  content: { paddingBottom: spacing.md },
  empty: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  note: { ...typography.bodySmall, textAlign: "center", color: colors.textMuted },
  retry: { ...typography.button, fontSize: 12, color: colors.primary },
});
