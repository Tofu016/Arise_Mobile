import { View, Text, Pressable, StyleSheet, ScrollView, Image } from "react-native";
import { buildingLabel, floorLabel } from "../utils/constants";
import { useSecurePhotoDataUri } from "../hooks/useSecurePhotoDataUri";
import { colors, typography, radii, spacing } from "../theme";
import BottomSheet from "./BottomSheet";
import Button from "./Button";

// Google-Maps-style place-details sheet for a scanned/searched room. The
// draggable peek/half/full shell now lives in <BottomSheet> — this file is
// just the room content that rides inside it. Reopening the sheet for a
// different room springs it back to peek height (via BottomSheet's
// `resetKey`).

export default function MobileRoomSheet({ room, onClose, onGetDirections, onView360 }) {
  const { roomName, node, placard } = room;
  const { uri: photoUri } = useSecurePhotoDataUri(placard?.photo);

  return (
    <BottomSheet onClose={onClose} resetKey={room}>
      {/* Content lives in a ScrollView rather than being conditionally
          rendered by height — a short (peek-height) sheet naturally clips
          it, a tall (half/full) sheet naturally reveals more, without
          needing to track drag position separately just to decide what to
          show. */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {placard?.photo && (
          <View style={styles.photoWrap}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photo, styles.photoLoading]}>
                <Text style={styles.photoLoadingText}>Loading photo…</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={styles.title}>{roomName}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
        </View>

        {placard?.use && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{placard.use}</Text>
          </View>
        )}

        {node && (
          <Text style={styles.location}>
            📍 {buildingLabel(node.building)} · {floorLabel(node.floor)} · near {node.name}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <Button
            label="Get Directions"
            icon="➜"
            onPress={onGetDirections}
            size="sm"
            style={styles.actionBtn}
          />
          <Button
            label="360° View"
            variant="outline"
            onPress={onView360}
            size="sm"
            style={styles.actionBtn}
          />
        </View>

        {placard?.roomDescription && <Text style={styles.description}>{placard.roomDescription}</Text>}
        {placard?.department && (
          <Text style={styles.department}>
            <Text style={styles.departmentLabel}>Department: </Text>
            {placard.department}
          </Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentInner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  photoWrap: { marginHorizontal: -spacing.lg, marginBottom: spacing.md + 2 },
  photo: { width: "100%", height: 160 },
  photoLoading: { backgroundColor: colors.surfaceSunken, alignItems: "center", justifyContent: "center" },
  photoLoadingText: { ...typography.caption },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { flex: 1, ...typography.h3, marginRight: spacing.md },
  closeX: { color: colors.textMuted, fontSize: 18, paddingHorizontal: spacing.xs },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryTint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontFamily: typography.label.fontFamily,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.primary,
  },
  location: { ...typography.caption, marginBottom: spacing.md + 2 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md + 2 },
  actionBtn: { flex: 1 },
  description: { ...typography.bodySmall, marginBottom: spacing.md - 2 },
  department: { ...typography.caption },
  departmentLabel: { ...typography.bodySemiBold, fontSize: 12, color: colors.textPrimary },
});
