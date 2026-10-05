import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { buildingLabel, floorLabel } from "../utils/constants";
import { colors, typography, radii, spacing } from "../theme";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import ListRow from "./ListRow";
import { fireStairsAction } from "../utils/emergencyExits";
import Icon from "./Icon";

// The brand board's DIRECTIONS card: a From → To timeline (grey dot, dotted
// line, red pin) with grey rounded fields, GET DIRECTIONS in red and AUTO
// WALK (EVERY 3S) in grey; then route progress. The red NEAREST EXIT pill
// in the header (reachable even with the sheet at its peek size) switches
// to the emergency variant: titled NEAREST EXIT, destination auto-picked,
// red top edge — whose header has a DIRECTIONS pill to switch back. The
// sheet is only ever as tall as its content (no empty space below).

function RouteField({ value, onChangeText, onFocus, placeholder, editable = true }) {
  return (
    <TextInput
      style={[styles.field, !editable && styles.fieldReadOnly]}
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      placeholder={placeholder}
      placeholderTextColor={colors.textSubtle}
      editable={editable}
      autoCorrect={false}
    />
  );
}

// Peek: just the DIRECTIONS / NEAREST EXIT title showing.
const PEEK_HEIGHT = 84;

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
  autoWalking = false,
  onToggleAutoWalk,
  onNearestExit,
  onDirections,
  arrived,
  nextStopName,
  nextElevatorFloor = null,
  nextFireStairs = null,
  onBlocked,
  currentId,
  bottomOffset,
  topLimit,
}) {
  // Header + scrolling content, measured, so the sheet fits them exactly.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const contentHeight = headerHeight && bodyHeight ? headerHeight + bodyHeight : undefined;

  const hasPath = !!directions.path;
  const isEmergency = directions.kind === "exit";
  const notStarted = hasPath && directions.stepIndex === 0 && currentId !== directions.path[0];

  const matches = (field, onPick) =>
    directions.editingField === field &&
    fieldMatches.length > 0 && (
      <View style={styles.suggestions}>
        {fieldMatches.map((n) => (
          <ListRow
            key={n.id}
            title={n.name}
            subtitle={`${buildingLabel(n.building)} - ${floorLabel(n.floor)}`}
            onPress={() => onPick(n)}
            trailing="none"
          />
        ))}
      </View>
    );

  return (
    <BottomSheet
      onClose={onClose}
      snapPoints={[PEEK_HEIGHT, 0.5, 0.85]}
      initialSnap={1}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
      accentBorderColor={isEmergency ? colors.emergency : undefined}
      fitContent
      contentHeight={contentHeight}
      avoidKeyboard
    >
      <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <Text style={[styles.headerTitle, isEmergency && styles.headerTitleEmergency]} numberOfLines={1}>
          {isEmergency ? "Nearest exit" : "Directions"}
        </Text>
        {!isEmergency && onNearestExit && (
          <Pressable
            onPress={onNearestExit}
            hitSlop={6}
            style={({ pressed }) => [styles.exitPill, pressed && styles.exitPillPressed]}
            accessibilityRole="button"
            accessibilityLabel="Directions to the nearest exit"
          >
            <Icon name="exit" size={15} color={colors.textOnPrimary} />
            <Text style={styles.exitPillText}>Nearest exit</Text>
          </Pressable>
        )}
        {isEmergency && onDirections && (
          <Pressable
            onPress={onDirections}
            hitSlop={6}
            style={({ pressed }) => [styles.exitPill, styles.directionsPill, pressed && styles.directionsPillPressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to directions"
          >
            <Icon name="directions" size={15} color={colors.textOnPrimary} />
            <Text style={styles.exitPillText}>Directions</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
          accessibilityLabel="Close directions"
        >
          <Icon name="terminate" size={15} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* A fresh scroll view per mode: switching Directions <-> Nearest exit
          swaps in shorter or longer content, and Android kept the old
          scroll offset, leaving the view scrolled past the new content
          (an empty white sheet). Remounting starts it at the top and
          re-measures it. */}
      <ScrollView
        key={directions.kind}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_, h) => setBodyHeight(h)}
      >
        <View style={styles.route}>
          <View style={styles.timeline}>
            <View style={styles.fromDot} />
            <View style={styles.dots} />
            <Icon name="location" size={17} color={colors.primary} />
          </View>
          <View style={styles.fields}>
            <RouteField value={directions.fromQuery} onChangeText={onChangeFrom} onFocus={onFocusFrom} placeholder="Starting point" />
            {matches("from", onPickFrom)}
            {/* Emergency routing auto-picks the destination — no editable
                "To" field, since second-guessing the computed nearest exit
                isn't something to invite in an actual emergency. */}
            <RouteField
              value={directions.toQuery}
              onChangeText={onChangeTo}
              onFocus={onFocusTo}
              placeholder={isEmergency ? "Nearest exit" : "Choose destination..."}
              editable={!isEmergency}
            />
            {!isEmergency && matches("to", onPickTo)}
          </View>
        </View>

        {!!directions.error && <Text style={styles.errorText}>{directions.error}</Text>}

        {isEmergency && hasPath && !arrived && (
          <Text style={styles.emergencyText}>
            <Text style={styles.progressBold}>Use the stairs, not elevators.</Text>
            {directions.emergency?.ascends ? " This route goes up: no level or downward way was found. Call for help." : ""}
            {" "}Emergency hotline: <Text style={styles.progressBold}>161</Text>
          </Text>
        )}

        {nextFireStairs && !arrived && (
          <View style={styles.stairsBanner} accessibilityRole="alert">
            <Text style={styles.stairsBannerTitle}>Emergency Exit stairs ahead</Text>
            <Text style={styles.stairsBannerText}>
              Take them {nextFireStairs.goesDown ? "down" : "up"} to {floorLabel(nextFireStairs.floor)}. Look for the
              glowing Emergency Exit sign, and tap it.
            </Text>
          </View>
        )}

        {hasPath && !arrived && (
          <Text style={styles.progressText}>
            Stop {directions.stepIndex + 1} of {directions.path.length}
            {nextStopName ? <Text style={styles.progressBold}>{"  ·  "}Next: {nextStopName}</Text> : null}
          </Text>
        )}

        {hasPath && arrived ? (
          <>
            <Text style={styles.arrivedText}>
              You've arrived at <Text style={styles.progressBold}>{directions.toQuery}</Text>.
            </Text>
            <Button label="Done" onPress={onClose} style={styles.actionBtn} />
          </>
        ) : (
          <>
            {!hasPath && !isEmergency && (
              <Button label="Get directions" icon="directions" onPress={onGetDirections} style={styles.actionBtn} />
            )}
            {hasPath && notStarted && !autoWalking && (
              <Button label="Start walking" icon="directions" onPress={onStartWalking} style={styles.actionBtn} />
            )}
            {hasPath && !notStarted && !autoWalking && (
              <Button
                label={
                  nextElevatorFloor != null
                    ? `Take the elevator to ${floorLabel(nextElevatorFloor)}`
                    : nextFireStairs
                      ? fireStairsAction(nextFireStairs)
                      : `Walk to ${nextStopName}`
                }
                iconRight="proceedNext"
                onPress={onWalkNext}
                style={styles.actionBtn}
              />
            )}
            {isEmergency && hasPath && onBlocked && (
              <Button label="This way is blocked" variant="neutral" onPress={onBlocked} style={styles.actionBtn} />
            )}
            <Button
              label={autoWalking ? "Pause walk" : "Auto walk (every 3s)"}
              icon={autoWalking ? "pauseWalk" : "autoWalk"}
              variant="neutral"
              onPress={onToggleAutoWalk}
              disabled={isEmergency && !hasPath}
              style={styles.actionBtn}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: { ...typography.h2, flex: 1 },
  exitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    height: 36,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.emergency,
  },
  exitPillPressed: { backgroundColor: colors.primaryPressed },
  directionsPill: { backgroundColor: colors.neutralButton },
  directionsPillPressed: { backgroundColor: colors.neutralButtonPressed },
  exitPillText: { ...typography.button, fontSize: 11.5, letterSpacing: 1.2, color: colors.textOnPrimary },
  headerTitleEmergency: { color: colors.emergency },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.iconButton,
  },
  roundBtnPressed: { backgroundColor: colors.borderStrong },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  route: { flexDirection: "row", gap: spacing.md },
  timeline: { width: 20, alignItems: "center", paddingTop: 19 },
  fromDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray500,
    borderWidth: 3,
    borderColor: colors.iconButton,
  },
  dots: {
    width: 0,
    height: 30,
    marginVertical: 4,
    borderLeftWidth: 1.5,
    borderStyle: "dotted",
    borderColor: colors.gray500,
  },
  fields: { flex: 1, gap: spacing.sm },
  field: {
    backgroundColor: colors.surfaceField,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  fieldReadOnly: { color: colors.textPrimary },
  suggestions: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.md },
  progressText: { ...typography.label, marginTop: spacing.lg },
  progressBold: { color: colors.textPrimary },
  emergencyText: { ...typography.caption, color: colors.danger, marginTop: spacing.md },
  stairsBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.emergency,
  },
  stairsBannerTitle: { ...typography.button, color: colors.textOnPrimary },
  stairsBannerText: { ...typography.caption, color: colors.textOnPrimary, marginTop: 2 },
  arrivedText: { ...typography.body, color: colors.textPrimary, marginTop: spacing.lg },
  actionBtn: { marginTop: spacing.md, alignSelf: "stretch" },
});
