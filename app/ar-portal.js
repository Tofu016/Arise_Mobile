import { useEffect, useSyncExternalStore } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { usePlacardDialogs } from "../src/hooks/usePlacardDialogs";
import { usePhotoFile } from "../src/hooks/usePhotoFile";
import { colors, typography, spacing } from "../src/theme";
import Button from "../src/components/Button";
import { AR_PAGER_HEIGHT, ArCloseButton, ArPager, ArRecalibrateButton, ArStatusPill, ArTitlePill } from "../src/components/ArChrome";
import { JOYSTICK_SIZE } from "../src/components/ArJoystick";
import ArPortalScene from "../src/components/ArPortalScene";
import ArPortalControls, { useArPortalControls, PORTAL_TIP } from "../src/components/ArPortalControls";

// A room's 360 view inside the AR door-frame portal: the room card's 360°
// VIEW and the placard scanner both lead here. The door, its joystick
// placement and stepping through are ArPortalScene's, the joystick / raise /
// anchor buttons are ArPortalControls' (both shared with the room AR view).
//
// What's inside the door depends on how you got here (the `source` param):
//   room card    the room's own 360 photo (the first photo an admin marked
//                360 in the web's room photos)
//   "scan"       the placard scanner: the room's AR 360 images from the web's
//                OCR Management page, paged through with the pager above the
//                joystick ("2 / 5"; the door stays where it is, only the view
//                inside changes), or the bundled placeholder (the web's "NO
//                IMAGE" panorama, assets/images/no-image.jpg) when it has none.
//
// The photo path is looked up INSIDE the scene, not passed in as a prop:
// ViroARSceneNavigator's initialScene captures its factory's output once, at
// first mount, so a prop that arrives later (the room details load
// asynchronously, the visitor pages to another image) would stay frozen at
// its first value. The page is a module-level store for the same reason.
// roomName and fromScan are safe as props: they're fixed for the lifetime of
// this screen.
const PLACEHOLDER_360 = require("../assets/images/no-image.jpg");

// Which of the room's AR 360 images is showing (scan only). One AR portal
// screen exists at a time; it resets to the first image when the screen goes.
let page = 0;
const pageListeners = new Set();
function setPage(next) {
  page = next;
  pageListeners.forEach((fn) => fn());
}
function subscribePage(fn) {
  pageListeners.add(fn);
  return () => pageListeners.delete(fn);
}
function usePage() {
  return useSyncExternalStore(subscribePage, () => page);
}

function scanPhotos(placard) {
  return placard?.ocrPhotos360 || [];
}

// The page wraps onto the list, so one an admin's edit made out of range
// still lands on an image.
function photoPathFor(placard, fromScan, pageIndex) {
  if (!fromScan) return placard?.photo360;
  const photos = scanPhotos(placard);
  return photos.length ? photos[pageIndex % photos.length] : "";
}

function ArScene({ roomName, fromScan, sceneProps }) {
  const { getForRoom } = usePlacardDialogs();
  const placard = getForRoom(roomName);
  const pageIndex = usePage();
  // The placeholder only once the details have loaded, so a room that does
  // have its own image doesn't flash the placeholder first.
  const fallbackSource = fromScan && placard ? PLACEHOLDER_360 : undefined;
  return <ArPortalScene photoPath={photoPathFor(placard, fromScan, pageIndex)} fallbackSource={fallbackSource} {...sceneProps} />;
}

// Space between the bottom of the screen (above the safe area) and the
// joystick.
const JOYSTICK_BOTTOM = 40;

export default function ArPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomName, source } = useLocalSearchParams();
  const fromScan = source === "scan";
  const { getForRoom } = usePlacardDialogs();
  const pageIndex = usePage();
  useEffect(() => () => setPage(0), []);

  // Not the node's photo: a node listed under "Rooms served" can easily be a
  // hallway with an unrelated photo.
  const placard = getForRoom(roomName);
  const photoPath = photoPathFor(placard, fromScan, pageIndex);
  const pageCount = fromScan ? scanPhotos(placard).length : 0;
  const shownPage = pageCount ? pageIndex % pageCount : 0;
  // getForRoom returns null until the details have loaded; this tells "not
  // loaded yet" from "genuinely has no 360 photo", so the UI doesn't sit on a
  // spinner forever. After a scan there's always something to show (the
  // placeholder), so it never applies there.
  const placardHasNoPhoto = Boolean(!fromScan && placard && !photoPath);
  const { uri: photoUri, error: photoError } = usePhotoFile(photoPath);
  // The images either side start downloading now, so paging is quick.
  usePhotoFile(pageCount > 1 ? photoPathFor(placard, true, shownPage + 1) : null);
  usePhotoFile(pageCount > 2 ? photoPathFor(placard, true, shownPage + pageCount - 1) : null);
  const loadingPhoto = fromScan ? !placard || Boolean(photoPath && !photoUri && !photoError) : !photoUri && !photoError && !placardHasNoPhoto;
  // Until the door is placed (AR tracking has settled), a hint says what to do.
  const controls = useArPortalControls();
  const { placed } = controls;
  const showPager = placed && pageCount > 1;

  // Bottom up: joystick row, then the pager, then status lines, each only
  // once it's showing.
  const pagerBottom = insets.bottom + JOYSTICK_BOTTOM + (placed ? JOYSTICK_SIZE + spacing.lg : 0);
  const statusBottom = pagerBottom + (showPager ? AR_PAGER_HEIGHT + spacing.md : 0);

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
          scene: () => <ArScene roomName={roomName} fromScan={fromScan} sceneProps={controls.sceneProps} />,
        }}
        style={styles.flex}
      />

      <ArCloseButton top={insets.top + 12} onPress={() => router.back()} />
      <ArTitlePill top={insets.top + 12}>{roomName}</ArTitlePill>
      {placed && <ArRecalibrateButton top={insets.top + 12} onPress={controls.recalibrate} />}
      {/* A tracking problem takes the spot of the tip and the start-up hint:
          it's the one thing the visitor can act on right now. */}
      {controls.trackingIssue && (
        <ArStatusPill tone="error" style={{ top: insets.top + 64 }}>
          {controls.trackingIssue}
        </ArStatusPill>
      )}
      {!controls.trackingIssue && controls.tipVisible && (
        <ArStatusPill key={controls.tipKey} style={{ top: insets.top + 64 }}>
          {PORTAL_TIP}
        </ArStatusPill>
      )}
      {!placed && !controls.trackingIssue && (fromScan || (!photoError && !placardHasNoPhoto)) && (
        <ArStatusPill style={{ top: insets.top + 64 }}>Hold your phone up and move it slowly while AR gets ready.</ArStatusPill>
      )}

      {/* Joystick, raise / lower and anchor, centred at the bottom: place the
          door, anchor it, then walk through (or pull it onto yourself). */}
      {placed && <ArPortalControls controls={controls} style={{ bottom: insets.bottom + JOYSTICK_BOTTOM }} />}

      {/* Not part of the controls row, so it doesn't fade or lock with the
          anchor: paging works from inside the portal too. */}
      {showPager && (
        <ArPager
          index={shownPage}
          count={pageCount}
          onPrevious={() => setPage((shownPage + pageCount - 1) % pageCount)}
          onNext={() => setPage((shownPage + 1) % pageCount)}
          style={{ bottom: pagerBottom }}
        />
      )}

      {loadingPhoto && (
        <ArStatusPill tone="loading" style={{ bottom: statusBottom }}>
          Preparing the room's 360° view…
        </ArStatusPill>
      )}
      {photoError && (
        <ArStatusPill tone="error" style={{ bottom: statusBottom }}>
          {fromScan ? "Couldn't load this 360° image, so a placeholder is shown." : photoError}
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
