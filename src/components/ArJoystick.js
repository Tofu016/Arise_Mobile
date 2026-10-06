import { useMemo, useRef } from "react";
import { View, Animated, PanResponder, StyleSheet } from "react-native";
import Icon from "./Icon";
import { colors, shadows } from "../theme";

// The AR screens' joystick, drawn as a game thumbstick: a dark see-through
// ring with a chevron at each of the four directions, and a raised white
// knob you push. An analog stick: while it's held it reports how far and
// which way it's pushed, and { x: 0, y: 0 } when it's let go (the knob
// springs back).
//
//   <ArJoystick onMove={({ x, y }) => …} />
//
// x: -1 (left) … 1 (right); y: -1 (down) … 1 (up). Written for a ref, not
// state: it fires on every finger movement.
const SIZE = 132; // the base, dp
export const JOYSTICK_SIZE = SIZE;
const KNOB_SIZE = 60;
const CHEVRON_SIZE = 14;
const CHEVRON_INSET = 10; // from the base's edge
const TRAVEL = 26; // how far the knob moves (stops short of the chevrons) = full push
const DEAD_ZONE = 0.12; // a push under this share of TRAVEL counts as none

// Icon names for the chevron, each already turned to point its way.
const CHEVRONS = [
  { icon: "collapse", place: { top: CHEVRON_INSET, alignSelf: "center" } }, // up
  { icon: "expand", place: { bottom: CHEVRON_INSET, alignSelf: "center" } }, // down
  { icon: "proceedBack", place: { left: CHEVRON_INSET } },
  { icon: "proceedNext", place: { right: CHEVRON_INSET } },
];

export default function ArJoystick({ onMove, style }) {
  const knob = useRef(new Animated.ValueXY()).current;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const responder = useMemo(() => {
    const release = () => {
      onMoveRef.current?.({ x: 0, y: 0 });
      Animated.spring(knob, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 5, tension: 120 }).start();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, { dx, dy }) => {
        const dist = Math.hypot(dx, dy);
        const k = dist > TRAVEL ? TRAVEL / dist : 1;
        knob.setValue({ x: dx * k, y: dy * k });
        const push = Math.min(1, dist / TRAVEL);
        if (push < DEAD_ZONE) {
          onMoveRef.current?.({ x: 0, y: 0 });
          return;
        }
        // Past the dead zone, the push eases in from 0, so a light touch
        // creeps and a full one moves at full speed.
        const strength = (push - DEAD_ZONE) / (1 - DEAD_ZONE);
        onMoveRef.current?.({ x: (dx / dist) * strength, y: (-dy / dist) * strength });
      },
      onPanResponderRelease: release,
      onPanResponderTerminate: release,
    });
  }, [knob]);

  return (
    <View
      {...responder.panHandlers}
      style={[styles.pad, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Joystick: push to move through the space"
    >
      <View style={styles.base} pointerEvents="none">
        {CHEVRONS.map(({ icon, place }) => (
          <View key={icon} style={[styles.chevron, place]}>
            <Icon name={icon} size={CHEVRON_SIZE} color={colors.textOnDark} />
          </View>
        ))}
      </View>
      <Animated.View style={[styles.knob, { transform: knob.getTranslateTransform() }]} pointerEvents="none">
        <View style={styles.knobGrip} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { position: "absolute", width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  base: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: colors.overlaySurface,
    backgroundColor: colors.scrim,
    justifyContent: "center",
  },
  chevron: { position: "absolute" },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlaySurface,
    ...shadows.floating,
  },
  // The thumb's dip in the top of the stick.
  knobGrip: {
    width: KNOB_SIZE * 0.62,
    height: KNOB_SIZE * 0.62,
    borderRadius: KNOB_SIZE * 0.31,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
