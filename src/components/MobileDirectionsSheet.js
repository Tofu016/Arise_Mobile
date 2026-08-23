import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { buildingLabel, floorLabel } from "../utils/constants";

// Fixed height, no drag gesture — unlike the room sheet, the wireframe only
// showed one variant of this screen, so there's no peek/half/full behavior
// to build here.
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

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Directions</Text>
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

        {!!directions.error && <Text style={styles.errorText}>{directions.error}</Text>}

        {!hasPath && (
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
              <Pressable style={styles.primaryBtn} onPress={onStartWalking}>
                <Text style={styles.primaryBtnText}>Start walking</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={onWalkNext}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "62%",
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
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
  primaryBtnText: { color: "#0f1115", fontSize: 14, fontWeight: "700" },
  progressBox: { marginTop: 6 },
  progressText: { color: "#e6e6e6", fontSize: 13, lineHeight: 19 },
  progressBold: { fontWeight: "700" },
});
