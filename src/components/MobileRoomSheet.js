import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";
import { buildingLabel, floorLabel } from "../utils/constants";
import { useSecurePhotoDataUri } from "../hooks/useSecurePhotoDataUri";

// Three snap heights, as fractions of the screen height — matches the
// wireframe's peek/half/full room-panel variants, mirroring real Google
// Maps' own mobile place-details sheet. Same values as the web PWA version.
const SNAP_PEEK = 0.24;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.88;
const SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

export default function MobileRoomSheet({ room, onClose, onGetDirections, onView360 }) {
  const { roomName, node, placard } = room;
  const { height: windowHeight } = useWindowDimensions();
  const { uri: photoUri } = useSecurePhotoDataUri(placard?.photo);

  // Animated on the UI thread (via Reanimated) so dragging feels smooth even
  // while JS is busy — this is the whole reason Reanimated exists rather
  // than just animating a plain React state value.
  const heightFraction = useSharedValue(SNAP_PEEK);
  const startFraction = useSharedValue(SNAP_PEEK);

  // Reset to the compact "peek" height every time a different room opens.
  useEffect(() => {
    heightFraction.value = withSpring(SNAP_PEEK, SPRING_CONFIG);
  }, [room, heightFraction]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startFraction.value = heightFraction.value;
    })
    .onUpdate((e) => {
      // Dragging UP (finger moves up, negative translationY) should
      // INCREASE the sheet's height.
      const delta = -e.translationY / windowHeight;
      const next = Math.min(SNAP_FULL, Math.max(0.08, startFraction.value + delta));
      heightFraction.value = next;
    })
    .onEnd(() => {
      const current = heightFraction.value;
      // Dragged well below the smallest snap point — dismiss entirely,
      // same as a real bottom sheet's drag-down-to-close gesture.
      if (current < SNAP_PEEK - 0.08) {
        runOnJS(onClose)();
        return;
      }
      const nearest = SNAP_POINTS.reduce(
        (best, p) => (Math.abs(current - p) < Math.abs(current - best) ? p : best),
        SNAP_POINTS[0]
      );
      heightFraction.value = withSpring(nearest, SPRING_CONFIG);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${heightFraction.value * 100}%`,
  }));

  return (
    <Animated.View style={[styles.sheet, animatedStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>

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
          <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={onGetDirections}>
            <Text style={styles.actionBtnPrimaryText}>➜ Get Directions</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onView360}>
            <Text style={styles.actionBtnText}>360° View</Text>
          </Pressable>
        </View>

        {placard?.roomDescription && <Text style={styles.description}>{placard.roomDescription}</Text>}
        {placard?.department && (
          <Text style={styles.department}>
            <Text style={styles.departmentLabel}>Department: </Text>
            {placard.department}
          </Text>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#191b22",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  handleArea: { paddingVertical: 10, alignItems: "center" },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: "#2a2d38" },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 16, paddingBottom: 24 },
  photoWrap: { marginHorizontal: -16, marginBottom: 14 },
  photo: { width: "100%", height: 160 },
  photoLoading: { backgroundColor: "#14161c", alignItems: "center", justifyContent: "center" },
  photoLoadingText: { color: "#6b7280", fontSize: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  title: { flex: 1, color: "#e6e6e6", fontSize: 18, fontWeight: "700", marginRight: 12 },
  closeX: { color: "#9aa0ac", fontSize: 18, paddingHorizontal: 4 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,158,255,0.15)",
    borderWidth: 1,
    borderColor: "#4a9eff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginBottom: 8,
  },
  badgeText: { color: "#4a9eff", fontSize: 11, fontWeight: "700" },
  location: { color: "#9aa0ac", fontSize: 12, marginBottom: 14 },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2a2d38",
    backgroundColor: "#262a35",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnPrimary: { backgroundColor: "#4a9eff", borderColor: "#4a9eff" },
  actionBtnText: { color: "#e6e6e6", fontSize: 13, fontWeight: "600" },
  actionBtnPrimaryText: { color: "#0f1115", fontSize: 13, fontWeight: "700" },
  description: { color: "#c7cad1", fontSize: 13, lineHeight: 19, marginBottom: 10 },
  department: { color: "#9aa0ac", fontSize: 12 },
  departmentLabel: { fontWeight: "700", color: "#e6e6e6" },
});
