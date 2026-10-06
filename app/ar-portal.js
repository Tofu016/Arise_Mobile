import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { usePlacardDialogs } from "../src/hooks/usePlacardDialogs";
import { usePhotoFile } from "../src/hooks/usePhotoFile";
import { colors, typography, spacing } from "../src/theme";
import Button from "../src/components/Button";
import { ArCloseButton, ArRecalibrateButton, ArStatusPill, ArTitlePill } from "../src/components/ArChrome";
import { JOYSTICK_SIZE } from "../src/components/ArJoystick";
import ArPortalScene from "../src/components/ArPortalScene";
import ArPortalControls, { useArPortalControls, PORTAL_TIP } from "../src/components/ArPortalControls";

// A room's own 360 photo inside the AR door-frame portal: the room card's
// 360° VIEW and the placard scanner both lead here. The door, its joystick
// placement and stepping through are ArPortalScene's, the joystick / raise /
// anchor buttons are ArPortalControls' (both shared with ar-viewer.js).
//
// The photo path is looked up INSIDE the scene, not passed in as a prop:
// ViroARSceneNavigator's initialScene captures its factory's output once, at
// first mount, so a prop that arrives later (the room details load
// asynchronously) would stay frozen at its first value. roomName itself is
// safe as a prop: it's fixed for the lifetime of this screen.
function ArScene({ roomName, sceneProps }) {
  const { getForRoom } = usePlacardDialogs();
  const placard = getForRoom(roomName);
  return <ArPortalScene photoPath={placard?.photo360} {...sceneProps} />;
}

// Space between the bottom of the screen (above the safe area) and the
// joystick.
const JOYSTICK_BOTTOM = 40;

export default function ArPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomName } = useLocalSearchParams();
  const { getForRoom } = usePlacardDialogs();

  // The room's OWN 360 photo (the first photo an admin marked 360 in the
  // web's room photos), not the node's photo: a node listed under "Rooms
  // served" can easily be a hallway with an unrelated photo.
  const placard = getForRoom(roomName);
  // getForRoom returns null until the details have loaded; this tells "not
  // loaded yet" from "genuinely has no 360 photo", so the UI doesn't sit on a
  // spinner forever.
  const placardHasNoPhoto = Boolean(placard && !placard.photo360);
  const { uri: photoUri, error: photoError } = usePhotoFile(placard?.photo360);
  // Until the door is placed (AR tracking has settled), a hint says what to do.
  const controls = useArPortalControls();
  const { placed } = controls;

  // Status lines at the bottom sit above the joystick once it's showing.
  const statusBottom = insets.bottom + JOYSTICK_BOTTOM + (placed ? JOYSTICK_SIZE + spacing.lg : 0);

  // No room name at all: someone navigated here directly rather than from
  // the room card or the scanner. Said so, instead of an empty AR scene.
  if (!roomName) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No room selected for AR preview.</Text>
        <Button label="Go back" onPress={() => router.back()} size="sm" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ViroARSceneNavigator
        initialScene={{
          scene: () => <ArScene roomName={roomName} sceneProps={controls.sceneProps} />,
        }}
        style={styles.flex}
      />

      <ArCloseButton top={insets.top + 12} onPress={() => router.back()} />
      <ArTitlePill top={insets.top + 12}>{roomName}</ArTitlePill>
      {placed && <ArRecalibrateButton top={insets.top + 12} onPress={controls.recalibrate} />}
      {controls.tipVisible && <ArStatusPill key={controls.tipKey} style={{ top: insets.top + 64 }}>{PORTAL_TIP}</ArStatusPill>}
      {!placed && !photoError && !placardHasNoPhoto && (
        <ArStatusPill style={{ top: insets.top + 64 }}>Hold your phone up and move it slowly while AR gets ready.</ArStatusPill>
      )}

      {/* Joystick, raise / lower and anchor, centred at the bottom: place the
          door, anchor it, then walk through (or pull it onto yourself). */}
      {placed && <ArPortalControls controls={controls} style={{ bottom: insets.bottom + JOYSTICK_BOTTOM }} />}

      {!photoUri && !photoError && !placardHasNoPhoto && (
        <ArStatusPill tone="loading" style={{ bottom: statusBottom }}>
          Preparing the room's 360° view…
        </ArStatusPill>
      )}
      {photoError && (
        <ArStatusPill tone="error" style={{ bottom: statusBottom }}>
          {photoError}
        </ArStatusPill>
      )}
      {placardHasNoPhoto && !photoError && (
        <ArStatusPill tone="error" style={{ bottom: statusBottom }}>
          This room doesn't have a 360° photo yet.
        </ArStatusPill>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Stays black, behind the live AR camera feed.
  flex: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  errorText: { ...typography.body, textAlign: "center" },
});
