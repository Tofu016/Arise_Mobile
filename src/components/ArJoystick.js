import { useMemo, useRef } from "react";
import { View, Image, Animated, PanResponder, StyleSheet } from "react-native";

// The AR screen's joystick: the gyro toggle's artwork taken apart — the
// four chevrons are the base, the compass is the knob you push. An analog
// stick: while it's held it reports how far and which way it's pushed, and
// { x: 0, y: 0 } when it's let go (the knob springs back).
//
//   <ArJoystick onMove={({ x, y }) => …} />
//
// x: -1 (left) … 1 (right); y: -1 (down) … 1 (up). Written for a ref, not
// state: it fires on every finger movement.
const BASE = require("../../assets/icons/color/joystick-base.png");
const KNOB = require("../../assets/icons/color/joystick-knob.png");
const SIZE = 132; // the base, dp (the artwork is 240px: chevrons to the edge)
export const JOYSTICK_SIZE = SIZE;
const KNOB_SIZE = (SIZE * 108) / 240; // the compass, at the same scale
const TRAVEL = 26; // how far the knob moves (stops short of the chevrons) = full push
const DEAD_ZONE = 0.12; // a push under this share of TRAVEL counts as none

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
      <Image source={BASE} style={styles.base} resizeMode="contain" />
      <Animated.Image source={KNOB} resizeMode="contain" style={[styles.knob, { transform: knob.getTranslateTransform() }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { position: "absolute", width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  base: { position: "absolute", width: SIZE, height: SIZE },
  knob: { width: KNOB_SIZE, height: KNOB_SIZE },
});
