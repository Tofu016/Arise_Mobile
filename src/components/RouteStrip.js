import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { floorLabel } from "../utils/constants";
import { colors, typography, radii, spacing, shadows } from "../theme";
import { SHEET_EXIT } from "./BottomSheet";
import Button from "./Button";
import Icon from "./Icon";
import { nextStepLabel } from "./MobileDirectionsSheet";

// The route in progress, once the visitor is walking it: a short card at
// the very bottom of the screen in place of the Directions sheet, which
// covered most of the panorama while the visitor was trying to follow it.
// The bottom nav is hidden meanwhile (see app/index.js), so this card sits
// where the nav was, and the screen's top-left back button brings the full
// Directions sheet (and the nav) back.
//
// It carries only what following the route needs: which stop is next and
// which way to turn, the step button (Start walking / Walk to ... / Take
// the elevator / the fire stairs), auto walk, and SKIP HALLWAY. Arrival
// swaps them for DONE.
//
// Getting out must never be harder mid-route than on the sheet, so:
// an ordinary route keeps a red NEAREST EXIT button here, and a Nearest
// exit route keeps "This way is blocked" and a call button that opens the
// full sheet, where the emergency contacts are. The route's red top edge
// matches the Nearest exit sheet's.

function RoundButton({ icon, label, onPress, tone = "neutral" }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.roundBtn,
        tone === "danger" && styles.roundBtnDanger,
        pressed && (tone === "danger" ? styles.roundBtnDangerPressed : styles.roundBtnPressed),
      ]}
    >
      <Icon name={icon} size={17} color={tone === "danger" ? colors.textOnPrimary : colors.textSecondary} />
    </Pressable>
  );
}

export default function RouteStrip({
  directions,
  currentId,
  arrived,
  nextStopName,
  turnInstruction,
  nextElevatorFloor = null,
  nextFireStairs = null,
  skip = null,
  autoWalking = false,
  onStartWalking,
  onWalkNext,
  onSkipAhead,
  onToggleAutoWalk,
  onNearestExit,
  onBlocked,
  onShowDetails,
  onDone,
  bottom,
}) {
  const isEmergency = !!directions.emergency;
  const notStarted = directions.stepIndex === 0 && currentId !== directions.path[0];

  return (
    <Animated.View entering={SlideInDown.duration(260)} exiting={SHEET_EXIT} style={[styles.strip, { bottom }]}>
      {arrived ? (
        <>
          <Text style={styles.arrivedText} numberOfLines={2}>
            You've arrived at <Text style={styles.bold}>{directions.toQuery}</Text>.
          </Text>
          <Button label="Done" onPress={onDone} size="sm" style={styles.doneBtn} />
        </>
      ) : (
        <>
          {nextFireStairs ? (
            <View style={styles.stairsBanner} accessibilityRole="alert">
              <Text style={styles.stairsBannerText} numberOfLines={3}>
                <Text style={styles.stairsBannerTitle}>Emergency Exit stairs ahead. </Text>
                Take them {nextFireStairs.goesDown ? "down" : "up"} to {floorLabel(nextFireStairs.floor)}, and tap the glowing
                Emergency Exit sign.
              </Text>
            </View>
          ) : (
            <View style={styles.info}>
              <Text style={styles.stopCount}>
                Stop {directions.stepIndex + 1} of {directions.path.length}
                {isEmergency ? "  |  Nearest exit" : ""}
              </Text>
              {!!nextStopName && (
                <Text style={styles.instruction} numberOfLines={2}>
                  {turnInstruction ? `${turnInstruction} ${nextStopName}` : `Next: ${nextStopName}`}
                </Text>
              )}
              {isEmergency && <Text style={styles.emergencyText}>Use the stairs, not elevators.</Text>}
            </View>
          )}

          <View style={styles.row}>
            {!autoWalking && (
              <Button
                label={notStarted ? "Start walking" : nextStepLabel({ nextElevatorFloor, nextFireStairs, nextStopName })}
                icon={notStarted ? "directions" : undefined}
                iconRight={notStarted ? undefined : "proceedNext"}
                onPress={notStarted ? onStartWalking : onWalkNext}
                size="sm"
                style={[styles.stepBtn, !notStarted && styles.walkBtn]}
              />
            )}
            {autoWalking && <Text style={[styles.autoWalkText, styles.stepBtn]}>Auto walking...</Text>}
            <RoundButton
              icon={autoWalking ? "pauseWalk" : "autoWalk"}
              label={autoWalking ? "Pause walk" : "Auto walk (every 3s)"}
              onPress={onToggleAutoWalk}
            />
            {isEmergency ? (
              <RoundButton icon="call" tone="danger" label="Emergency contacts" onPress={onShowDetails} />
            ) : (
              onNearestExit && (
                <RoundButton icon="exit" tone="danger" label="Directions to the nearest exit" onPress={onNearestExit} />
              )
            )}
          </View>

          {!autoWalking && (skip || (isEmergency && onBlocked)) && (
            <View style={styles.row}>
              {skip && (
                <Button
                  label={`Skip hallway (${skip.count})`}
                  iconRight="proceedNext"
                  variant="neutral"
                  size="sm"
                  onPress={onSkipAhead}
                  style={styles.stepBtn}
                />
              )}
              {isEmergency && onBlocked && (
                <Button label="Way blocked" variant="neutral" size="sm" onPress={onBlocked} style={styles.stepBtn} />
              )}
            </View>
          )}
        </>
      )}
      {isEmergency && <View pointerEvents="none" style={styles.accentBar} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: "hidden",
    ...shadows.floating,
  },
  accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.emergency },
  info: { gap: 2 },
  stopCount: { ...typography.sublabel },
  instruction: { ...typography.label, color: colors.textPrimary },
  emergencyText: { ...typography.caption, color: colors.danger },
  bold: { fontFamily: typography.bodySemiBold.fontFamily, color: colors.textPrimary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: { flex: 1 },
  // Extra room on the left of the "Walk to ..." label.
  walkBtn: { paddingLeft: spacing.xl + spacing.sm },
  autoWalkText: { ...typography.label, color: colors.textSecondary },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.iconButton,
  },
  roundBtnPressed: { backgroundColor: colors.borderStrong },
  roundBtnDanger: { backgroundColor: colors.emergency },
  roundBtnDangerPressed: { backgroundColor: colors.primaryPressed },
  stairsBanner: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.emergency },
  stairsBannerTitle: { fontFamily: typography.bodySemiBold.fontFamily },
  stairsBannerText: { ...typography.caption, color: colors.textOnPrimary },
  arrivedText: { ...typography.body, color: colors.textPrimary },
  doneBtn: { alignSelf: "stretch" },
});
