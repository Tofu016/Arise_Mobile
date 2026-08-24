import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";
import { buildingLabel, floorLabel } from "../utils/constants";

// Same three snap heights and spring config as MobileRoomSheet — draggable
// peek/half/full, instead of the old fixed 62% height that covered a large
// fixed chunk of the screen regardless of what was actually being shown.
const SNAP_PEEK = 0.24;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.88;
const SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

export default function MobileDirectionsSheet({
  directions,
  fieldMatches,
  onClose,
  onChangeFrom,
  onChangeTo,
  onFocusFrom,
  onFocusTo,
  onPickFrom,
  onPickTo,
  onGetDirections,
  onStartWalking,
  onWalkNext,
  arrived,
  nextStopName,
  currentId,
}) {
  const hasPath = !!directions.path;
  const isEmergency = directions.kind === "exit";
  const { height: windowHeight } = useWindowDimensions();

  const heightFraction = useSharedValue(SNAP_PEEK);
  const startFraction = useSharedValue(SNAP_PEEK);

  const pan = Gesture.Pan()
    .onStart(() => {
      startFraction.value = heightFraction.value;
    })
    .onUpdate((e) => {
      const delta = -e.translationY / windowHeight;
      const next = Math.min(SNAP_FULL, Math.max(0.08, startFraction.value + delta));
      heightFraction.value = next;
    })
    .onEnd(() => {
      const current = heightFraction.value;
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
    <Animated.View style={[styles.sheet, isEmergency && styles.sheetEmergency, animatedStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isEmergency ? "🚨 Nearest Exit" : "Directions"}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>From</Text>
          <TextInput
            style={styles.input}
            value={directions.fromQuery}
            onChangeText={onChangeFrom}
            onFocus={onFocusFrom}
            placeholder="Starting point"
            placeholderTextColor="#6b7280"
          />
        </View>
        {directions.editingField === "from" && fieldMatches.length > 0 && (
          <View style={styles.suggestions}>
            {fieldMatches.map((n) => (
              <Pressable key={n.id} style={styles.suggestionRow} onPress={() => onPickFrom(n)}>
                <Text style={styles.suggestionName}>{n.name}</Text>
                <Text style={styles.suggestionSub}>{buildingLabel(n.building)} · {floorLabel(n.floor)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Emergency routing auto-picks the destination — no "To" field to
            edit, since second-guessing the computed nearest exit isn't
            something you want to invite in an actual emergency. */}
        {!isEmergency && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                value={directions.toQuery}
                onChangeText={onChangeTo}
                onFocus={onFocusTo}
                placeholder="Destination"
                placeholderTextColor="#6b7280"
              />
            </View>
            {directions.editingField === "to" && fieldMatches.length > 0 && (
              <View style={styles.suggestions}>
                {fieldMatches.map((n) => (
                  <Pressable key={n.id} style={styles.suggestionRow} onPress={() => onPickTo(n)}>
                    <Text style={styles.suggestionName}>{n.name}</Text>
                    <Text style={styles.suggestionSub}>{buildingLabel(n.building)} · {floorLabel(n.floor)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
        {isEmergency && !!directions.toQuery && (
          <View style={styles.field}>
            <Text style={styles.label}>To (nearest assembly point)</Text>
            <Text style={styles.destinationReadout}>{directions.toQuery}</Text>
          </View>
        )}

        {!!directions.error && <Text style={styles.errorText}>{directions.error}</Text>}

        {!hasPath && !isEmergency && (
          <Pressable style={styles.primaryBtn} onPress={onGetDirections}>
            <Text style={styles.primaryBtnText}>Get directions</Text>
          </Pressable>
        )}

        {hasPath && !arrived && (
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>
              Stop {directions.stepIndex + 1} of {directions.path.length}
              {nextStopName ? <Text style={styles.progressBold}> — next: {nextStopName}</Text> : null}
            </Text>
            {directions.stepIndex === 0 && currentId !== directions.path[0] ? (
              <Pressable
                style={[styles.primaryBtn, isEmergency && styles.primaryBtnEmergency]}
                onPress={onStartWalking}
              >
                <Text style={styles.primaryBtnText}>Start walking</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryBtn, isEmergency && styles.primaryBtnEmergency]}
                onPress={onWalkNext}
              >
                <Text style={styles.primaryBtnText}>Walk to {nextStopName} →</Text>
              </Pressable>
            )}
          </View>
        )}

        {hasPath && arrived && (
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>
              🎉 You've arrived at <Text style={styles.progressBold}>{directions.toQuery}</Text>.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
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
  sheetEmergency: { borderTopWidth: 2, borderColor: "#ff4a4a" },
  handleArea: { paddingVertical: 10, alignItems: "center" },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: "#2a2d38" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: { color: "#e6e6e6", fontSize: 16, fontWeight: "700" },
  closeX: { color: "#9aa0ac", fontSize: 18, paddingHorizontal: 4 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  field: { marginBottom: 4 },
  label: { color: "#9aa0ac", fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: "#14161c",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e6e6e6",
    fontSize: 14,
  },
  destinationReadout: {
    backgroundColor: "#14161c",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e6e6e6",
    fontSize: 14,
  },
  suggestions: {
    backgroundColor: "#14161c",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 10,
    overflow: "hidden",
  },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#20232d" },
  suggestionName: { color: "#e6e6e6", fontSize: 13 },
  suggestionSub: { color: "#9aa0ac", fontSize: 11, marginTop: 1 },
  errorText: { color: "#ff9a9a", fontSize: 12, marginBottom: 10, marginTop: 6 },
  primaryBtn: { backgroundColor: "#4a9eff", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  primaryBtnEmergency: { backgroundColor: "#ff4a4a" },
  primaryBtnText: { color: "#0f1115", fontSize: 14, fontWeight: "700" },
  progressBox: { marginTop: 6 },
  progressText: { color: "#e6e6e6", fontSize: 13, lineHeight: 19 },
  progressBold: { fontWeight: "700" },
});
