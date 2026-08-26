import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { buildingLabel, floorLabel } from "../utils/constants";
import { colors, typography, radii, spacing } from "../theme";
import BottomSheet from "./BottomSheet";
import FormField from "./FormField";
import Button from "./Button";

// Directions content for the shared <BottomSheet> — From/To pickers, route
// progress, and the emergency "nearest exit" variant (which auto-picks its
// destination and gets a red accent border).

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

  return (
    <BottomSheet onClose={onClose} accentBorderColor={isEmergency ? colors.emergency : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isEmergency ? "🚨 Nearest Exit" : "Directions"}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormField
          label="From"
          value={directions.fromQuery}
          onChangeText={onChangeFrom}
          onFocus={onFocusFrom}
          placeholder="Starting point"
          containerStyle={styles.field}
        />
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
            <FormField
              label="To"
              value={directions.toQuery}
              onChangeText={onChangeTo}
              onFocus={onFocusTo}
              placeholder="Destination"
              containerStyle={styles.field}
            />
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
            <Text style={styles.readoutLabel}>To (nearest assembly point)</Text>
            <Text style={styles.destinationReadout}>{directions.toQuery}</Text>
          </View>
        )}

        {!!directions.error && <Text style={styles.errorText}>{directions.error}</Text>}

        {!hasPath && !isEmergency && (
          <Button label="Get directions" onPress={onGetDirections} style={styles.actionBtn} />
        )}

        {hasPath && !arrived && (
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>
              Stop {directions.stepIndex + 1} of {directions.path.length}
              {nextStopName ? <Text style={styles.progressBold}> — next: {nextStopName}</Text> : null}
            </Text>
            {directions.stepIndex === 0 && currentId !== directions.path[0] ? (
              <Button
                label="Start walking"
                variant={isEmergency ? "danger" : "primary"}
                onPress={onStartWalking}
                style={styles.actionBtn}
              />
            ) : (
              <Button
                label={`Walk to ${nextStopName}`}
                iconRight="→"
                variant={isEmergency ? "danger" : "primary"}
                onPress={onWalkNext}
                style={styles.actionBtn}
              />
            )}
          </View>
        )}

        {hasPath && arrived && (
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>
              🎉 You've arrived at <Text style={styles.progressBold}>{directions.toQuery}</Text>.
            </Text>
            <Button label="Done" onPress={onClose} style={styles.actionBtn} />
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md - 2,
  },
  headerTitle: { ...typography.h3 },
  closeX: { color: colors.textMuted, fontSize: 18, paddingHorizontal: spacing.xs },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  field: { marginBottom: spacing.xs },
  readoutLabel: { ...typography.label, marginBottom: spacing.xs + 2 },
  destinationReadout: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md - 2,
    overflow: "hidden",
  },
  suggestionRow: {
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  suggestionName: { ...typography.bodySmall, color: colors.textPrimary },
  suggestionSub: { ...typography.caption, marginTop: 1 },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.md - 2, marginTop: spacing.xs + 2 },
  actionBtn: { marginTop: spacing.md, alignSelf: "stretch" },
  progressBox: { marginTop: spacing.xs + 2 },
  progressText: { ...typography.bodySmall, color: colors.textPrimary },
  progressBold: { ...typography.bodySemiBold, fontSize: 13 },
});
