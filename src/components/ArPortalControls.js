import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { ViroTrackingStateConstants, ViroARTrackingReasonConstants } from "@reactvision/react-viro";
import Icon from "./Icon";
import ArJoystick, { JOYSTICK_SIZE } from "./ArJoystick";
import { colors, spacing, shadows } from "../theme";

// The controls under the AR portal, shared by both AR screens (ar-viewer,
// ar-portal): the joystick (walk: the portal moves the opposite way), raise /
// lower buttons (hold to move it up or down), turn buttons (hold to turn it
// left or right on the spot) and an anchor button that freezes it.
//
//   const controls = useArPortalControls();
//   <ArScene … {...controls.sceneProps} />          // inside the AR scene
//   {controls.placed && <ArPortalControls controls={controls} style={{ bottom }} />}
//   {controls.tipVisible && <ArStatusPill>{PORTAL_TIP}</ArStatusPill>}
//   {controls.trackingIssue && <ArStatusPill tone="error">{controls.trackingIssue}</ArStatusPill>}
//   {controls.placed && <ArRecalibrateButton top={…} onPress={controls.recalibrate} />}
//
// Anchoring is a lock on these controls, not an AR anchor: the portal already
// sits at fixed world coordinates, so any drift you see is the phone's AR
// tracking sliding, which an app-side lock can't correct.
//
// Anchored (by the button, or automatically on stepping through the door),
// the controls stay put for FADE_DELAY_MS and then fade out; a tap on the
// faded controls shows them again for another FADE_DELAY_MS. While anchored
// the joystick, raise / lower and turn buttons are dimmed and inert, only the
// anchor button works (to release it).
const FADE_DELAY_MS = 7000;
const FADED_OPACITY = 0.25;
const LOCKED_OPACITY = 0.45; // joystick + lift while anchored but not yet faded
const BUTTON_SIZE = 52;
// How long the how-to tip stays up after the door appears.
const TIP_MS = 9000;
// Weak AR tracking is what makes the portal drift (the door itself never
// moves on its own: ARCore's map of the room slides under it), so the
// screens say why it's weak and what helps. A problem has to last
// TRACKING_ISSUE_DELAY_MS before it shows, so a brief hiccup doesn't flash
// a warning; it clears as soon as tracking is back to normal.
const TRACKING_ISSUE_DELAY_MS = 1000;

// The message for a tracking state, or null for none. Before the door is
// placed, limited tracking with no particular reason is just AR starting
// up, which the screens' "Hold your phone up" hint already covers.
function trackingIssueFor(state, reason, placed) {
  if (state === ViroTrackingStateConstants.TRACKING_NORMAL) return null;
  if (reason === ViroARTrackingReasonConstants.TRACKING_REASON_EXCESSIVE_MOTION) {
    return "Moving too fast for AR. Move your phone more slowly.";
  }
  if (reason === ViroARTrackingReasonConstants.TRACKING_REASON_INSUFFICIENT_FEATURES) {
    return "AR can't see enough detail here. Point at a well-lit area with some texture.";
  }
  if (!placed) return null;
  return "AR is losing its place, so the portal may drift. Move slowly over a well-lit, detailed area.";
}

export const PORTAL_TIP =
  "Use the joystick to walk to the door, the arrows to set it on the floor and turn it, and the anchor to hold it still.";

export function useArPortalControls() {
  const [placed, setPlaced] = useState(false);
  const [anchored, setAnchoredState] = useState(false);
  const [awake, setAwake] = useState(true);
  // What the AR scene reads. Refs, not state: it polls them every tick, and
  // the scene's props are frozen at first mount (see ArPortalScene).
  const forwardRef = useRef(null); // which way the phone faces, from the AR scene
  const moveRef = useRef({ x: 0, y: 0 }); // the joystick's push
  const liftRef = useRef(0); // -1 lower, 0 none, 1 raise
  const turnRef = useRef(0); // -1 left, 0 none, 1 right
  const anchoredRef = useRef(false);
  const recalibrateRef = useRef(0); // bumped to ask the scene for a fresh door
  const fadeTimer = useRef(null);
  const tipTimer = useRef(null);
  const firstTipShown = useRef(false);
  const [tipVisible, setTipVisible] = useState(false);
  const placedRef = useRef(false); // `placed`, for the tracking callback
  const [trackingIssue, setTrackingIssue] = useState(null);
  const pendingIssue = useRef(null);
  const issueTimer = useRef(null);
  // Changes on every showTip, so a tip still on screen is replaced (screens
  // key the pill by it) and its fade-in plays again.
  const [tipKey, setTipKey] = useState(0);

  const showTip = useCallback(() => {
    setTipKey((k) => k + 1);
    setTipVisible(true);
    clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTipVisible(false), TIP_MS);
  }, []);

  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setAwake(false), FADE_DELAY_MS);
  }, []);

  const setAnchored = useCallback(
    (value) => {
      anchoredRef.current = value;
      setAnchoredState(value);
      if (value) {
        moveRef.current = { x: 0, y: 0 };
        liftRef.current = 0;
        turnRef.current = 0;
      }
      wake();
    },
    [wake]
  );

  const toggleAnchor = useCallback(() => setAnchored(!anchoredRef.current), [setAnchored]);

  // Kill the door and spawn a new one ahead of the phone, unlocked, and show
  // the instructions again.
  const recalibrate = useCallback(() => {
    recalibrateRef.current += 1;
    setAnchored(false);
    showTip();
  }, [setAnchored, showTip]);

  useEffect(
    () => () => {
      clearTimeout(fadeTimer.current);
      clearTimeout(tipTimer.current);
      clearTimeout(issueTimer.current);
    },
    []
  );

  // Stable on purpose: the scene keeps the first ones it was given.
  const sceneProps = useMemo(
    () => ({
      forwardRef,
      moveRef,
      liftRef,
      turnRef,
      anchoredRef,
      recalibrateRef,
      // The first placement shows the tip; a recalibrate shows it itself.
      onPlaced: () => {
        placedRef.current = true;
        setPlaced(true);
        if (firstTipShown.current) return;
        firstTipShown.current = true;
        showTip();
      },
      // Going in locks the door, so a stray push can't drag it off you.
      onInsideChange: (inside) => {
        if (inside) setAnchored(true);
      },
      onTrackingChange: (state, reason) => {
        const issue = trackingIssueFor(state, reason, placedRef.current);
        if (issue === pendingIssue.current) return;
        pendingIssue.current = issue;
        clearTimeout(issueTimer.current);
        if (issue) issueTimer.current = setTimeout(() => setTrackingIssue(issue), TRACKING_ISSUE_DELAY_MS);
        else setTrackingIssue(null);
      },
    }),
    [setAnchored, showTip]
  );

  return { placed, anchored, awake, tipVisible, tipKey, trackingIssue, moveRef, liftRef, turnRef, wake, toggleAnchor, recalibrate, sceneProps };
}

// `style` positions the whole row (e.g. { bottom }); it can be an animated
// style, so the AR viewer's row can follow its sheet.
export default function ArPortalControls({ controls, style }) {
  const { anchored, awake, moveRef, liftRef, turnRef, wake, toggleAnchor } = controls;
  const faded = anchored && !awake;

  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withTiming(faded ? FADED_OPACITY : 1, { duration: 400 });
  }, [faded, opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const lock = anchored ? styles.locked : null;

  return (
    <Animated.View style={[styles.row, style, fadeStyle]} pointerEvents="box-none">
      <View style={styles.cluster}>
        <Pressable
          onPress={toggleAnchor}
          accessibilityRole="button"
          accessibilityLabel={anchored ? "Release the portal" : "Anchor the portal"}
          accessibilityState={{ selected: anchored }}
          style={({ pressed }) => [
            styles.button,
            anchored && styles.buttonActive,
            pressed && (anchored ? styles.buttonActivePressed : styles.buttonPressed),
          ]}
        >
          <Icon name="anchor" size={20} color={anchored ? colors.textOnDark : colors.textSecondary} />
        </Pressable>

        <View style={[styles.joystick, lock]} pointerEvents={anchored ? "none" : "auto"}>
          <ArJoystick
            onMove={(v) => {
              moveRef.current = v;
            }}
            style={styles.joystickPad}
          />
        </View>

        <View style={[styles.lift, lock]} pointerEvents={anchored ? "none" : "auto"}>
          <HoldButton direction={1} label="Raise the portal" icon="portalUp" holdRef={liftRef} />
          <HoldButton direction={-1} label="Lower the portal" icon="portalDown" holdRef={liftRef} />
        </View>

        <View style={[styles.lift, lock]} pointerEvents={anchored ? "none" : "auto"}>
          <HoldButton direction={-1} label="Turn the portal left" icon="portalTurnLeft" holdRef={turnRef} />
          <HoldButton direction={1} label="Turn the portal right" icon="portalTurnRight" holdRef={turnRef} />
        </View>

        {/* Faded out: the first tap only brings the controls back, so it
            can't release the anchor by accident. */}
        {faded && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={wake}
            accessibilityRole="button"
            accessibilityLabel="Show the portal controls"
          />
        )}
      </View>
    </Animated.View>
  );
}

// Held, not tapped: moves (raise / lower) or turns the portal for as long as
// it's pressed, by setting `holdRef` to `direction` and back to 0.
function HoldButton({ direction, label, icon, holdRef }) {
  return (
    <Pressable
      onPressIn={() => {
        holdRef.current = direction;
      }}
      onPressOut={() => {
        holdRef.current = 0;
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Icon name={icon} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    height: JOYSTICK_SIZE,
    alignItems: "center",
  },
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  joystick: { width: JOYSTICK_SIZE, height: JOYSTICK_SIZE },
  joystickPad: { position: "relative" },
  lift: { gap: spacing.md },
  locked: { opacity: LOCKED_OPACITY },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlaySurface,
    ...shadows.floating,
  },
  buttonPressed: { backgroundColor: colors.iconButton },
  buttonActive: { backgroundColor: colors.primary },
  buttonActivePressed: { backgroundColor: colors.primaryPressed },
});
