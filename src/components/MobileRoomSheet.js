import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Linking } from "react-native";
import { buildingLabel, floorLabel } from "../utils/constants";
import { photoUrl } from "../api/client";
import { colors, typography, radii, spacing } from "../theme";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import Icon from "./Icon";

// The brand board's room card: title with round save/close buttons, a grey
// location row, DIRECTIONS / 360° VIEW pills, a collapsible description,
// and a photo carousel. Swipe up to expand, down to close. Reopening it for
// a different room springs it back to its opening height (resetKey).
//
// The bookmark saves the room on this phone (see useSavedRooms): grey
// when not saved, red when it is. Saving is keyed on the room's details
// record, so a room without one (placard null) has no bookmark.
//
// The room's link and contact number, when an admin set them, are tappable
// rows: the link opens in the browser, the number in the phone's dialer.
// The carousel shows every flat photo in the order an admin sorted them;
// 360 photos are left out, since 360° VIEW already covers the panorama.
// A room with no details at all says "No information.", as on web.

// Admins may type a URL without a protocol ("example.com"), so one is added
// for opening it; the row shows the link exactly as typed. Same as web.
function linkHref(link) {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

// A number field can hold more than one ("161 or (046) 417-0207"): the
// dialer gets the first, digits (and a leading +) only.
function telHref(number) {
  const first = number.split(/\bor\b|[/,;]/i)[0];
  return `tel:${first.replace(/[^\d+]/g, "")}`;
}

// Loaded straight from the serve URL — React Native's <Image> fetches,
// decodes and caches it natively, WebP included. Keyed by photo by the
// caller, so the loading state starts fresh for each new room.
function RoomPhoto({ photo }) {
  const [status, setStatus] = useState("loading"); // loading | loaded | error

  return (
    <View style={styles.photoTile}>
      <Image
        source={{ uri: photoUrl(photo) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
      {status !== "loaded" && (
        <View style={[StyleSheet.absoluteFill, styles.photoLoading]}>
          <Text style={styles.photoLoadingText}>{status === "error" ? "Couldn't load photo" : "Loading photo…"}</Text>
        </View>
      )}
    </View>
  );
}

// `active`: filled brand red with a white icon (a saved room's bookmark).
function RoundButton({ icon, onPress, label, active = false, accessibilityState }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [
        styles.roundBtn,
        active && styles.roundBtnActive,
        pressed && (active ? styles.roundBtnActivePressed : styles.roundBtnPressed),
      ]}
    >
      <Icon name={icon} size={15} color={active ? colors.textOnPrimary : colors.textSecondary} />
    </Pressable>
  );
}

// Peek: the room's name and where it is.
const PEEK_HEIGHT = 150;

export default function MobileRoomSheet({
  room,
  saved = false,
  onToggleSave,
  onClose,
  onGetDirections,
  onView360,
  bottomOffset,
  topLimit,
}) {
  const { roomName, node, placard } = room;
  const [expanded, setExpanded] = useState(false);
  const photos = (placard?.photos || []).filter((p) => p.kind === "flat").map((p) => p.path);
  const about = [placard?.department, placard?.roomDescription].filter(Boolean).join(", ");
  const link = placard?.link || "";
  const contactNumber = placard?.contactNumber || "";
  const hasInfo = !!(about || link || contactNumber || photos.length > 0);

  return (
    <BottomSheet
      onClose={onClose}
      resetKey={room}
      snapPoints={[PEEK_HEIGHT, 0.45, 0.85]}
      initialSnap={1}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{roomName}</Text>
          <View style={styles.titleActions}>
            {placard && (
              <RoundButton
                icon="save"
                label={saved ? `Remove ${roomName} from saved` : `Save ${roomName}`}
                accessibilityState={{ selected: saved }}
                active={saved}
                onPress={onToggleSave}
              />
            )}
            <RoundButton icon="terminate" label="Close" onPress={onClose} />
          </View>
        </View>

        {node && (
          <View style={styles.infoRow}>
            <Icon name="location" size={16} color={colors.gray500} />
            <Text style={styles.infoText} numberOfLines={2}>
              <Text style={styles.infoStrong}>
                {buildingLabel(node.building)} - {floorLabel(node.floor)}
              </Text>
              {"  |  "}near {node.name}
            </Text>
          </View>
        )}

        {!!contactNumber && (
          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && styles.infoRowPressed]}
            onPress={() => Linking.openURL(telHref(contactNumber)).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`Call ${contactNumber}`}
          >
            <Icon name="call" size={16} color={colors.gray500} />
            <Text style={[styles.infoText, styles.infoStrong]} numberOfLines={2}>
              {contactNumber}
            </Text>
          </Pressable>
        )}

        {!!link && (
          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && styles.infoRowPressed]}
            onPress={() => Linking.openURL(linkHref(link)).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`Open ${link}`}
          >
            <Icon name="link" size={16} color={colors.gray500} />
            <Text style={[styles.infoText, styles.infoStrong]} numberOfLines={1}>
              {link}
            </Text>
          </Pressable>
        )}

        <View style={styles.actionsRow}>
          <Button label="Directions" icon="directions" onPress={onGetDirections} size="sm" style={styles.actionBtn} />
          <Button label="360° View" variant="neutral" onPress={onView360} size="sm" style={styles.actionBtn} />
        </View>

        {!hasInfo && <Text style={styles.noInfo}>No information.</Text>}

        {!!about && (
          <View style={styles.aboutBox}>
            <Text style={styles.aboutText} numberOfLines={expanded ? undefined : 4}>
              {about}
            </Text>
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              hitSlop={6}
              style={styles.aboutToggle}
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Show less" : "Show more"}
            >
              <Icon name={expanded ? "collapse" : "expand"} size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {photos.map((p) => (
              <RoomPhoto key={p} photo={p} />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentInner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { flex: 1, ...typography.h2 },
  titleActions: { flexDirection: "row", gap: spacing.sm },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.iconButton,
  },
  roundBtnPressed: { backgroundColor: colors.borderStrong },
  roundBtnActive: { backgroundColor: colors.primary },
  roundBtnActivePressed: { backgroundColor: colors.primaryPressed },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceField,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  infoRowPressed: { backgroundColor: colors.borderStrong },
  infoText: { flex: 1, ...typography.bodySmall, letterSpacing: 1 },
  noInfo: { ...typography.bodySmall, paddingHorizontal: spacing.xs, marginBottom: spacing.md },
  infoStrong: { fontFamily: typography.bodySemiBold.fontFamily, color: colors.textSecondary },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { flex: 1 },
  aboutBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  aboutText: { flex: 1, ...typography.bodySmall },
  aboutToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.iconButton,
  },
  carousel: { gap: spacing.sm },
  photoTile: {
    width: 240,
    height: 170,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceField,
  },
  photoLoading: { alignItems: "center", justifyContent: "center" },
  photoLoadingText: { ...typography.caption },
});
