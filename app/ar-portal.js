import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ViroARSceneNavigator,
  ViroARScene,
  ViroPortalScene,
  ViroPortal,
  Viro3DObject,
  Viro360Image,
  ViroAmbientLight,
  ViroMaterials,
  ViroAnimations,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import { usePlacardDialogs } from "../src/hooks/usePlacardDialogs";
import { useSecurePhotoFileUri } from "../src/hooks/useSecurePhotoFileUri";

// ViroReact works in meters, not feet — 9 feet is roughly 2.7432 meters.
// Increased from the original 5ft (1.524m) — confirmed working at this
// distance on device.
const PLACEMENT_DISTANCE_METERS = 2.7432;

// The custom door-frame model came out of Blender at roughly 4.1 x 6.25 x
// 4.05 units (width x height x depth) — quite large for a doorway. Scaling
// to target a realistic ~2m height; width/depth scale proportionally with
// it since it's a uniform scale, not a stretch.
const DOOR_SCALE = 0.32;
// How far below its resting position the door starts, in meters — the
// "underground" starting point for the rise animation.
const RISE_DISTANCE = 1.6;

// Confirmed correct on a real device — the model's own tunnel direction
// didn't map to the axis my earlier reasoning assumed; this was found by
// direct trial rather than derived, which is why it doesn't match the
// axis-swap math from the comments above.
const DOOR_ROTATION = [0, -90, 0];

// Precisely measured from the door model's own raw vertex data (not
// estimated) — the actual inner opening between the two pillars and the
// underside of the top bridge, deliberately excluding the base (per what
// was asked: flush with the pillars and bridge, not the solid base). The
// mask reaches all the way down to the ground rather than stopping at the
// base's own inner ledge, since the opening naturally continues to the
// floor. These are already in final world-space units (post DOOR_SCALE),
// since the mask's own scale/position props apply directly, unlike the
// door's which pass through DOOR_SCALE as an intermediate step.
const MASK_SCALE = [1.197, 1.93, 1];

// Confirmed correct on a real device — the missing piece was Z, not X;
// the gap was toward/away from the viewer, not left/right.
const MASK_POSITION_OFFSET = [0, -0.037, 0.55];

const MASK_ROTATION = [0, 0, 0];

ViroMaterials.createMaterials({
  doorFrameMaterial: { diffuseColor: "#8a7660" }, // a plain wood-ish tone — the model has no embedded material of its own
  // Fully transparent — this is the actual "see-through" technique itself:
  // a solid quad made invisible via zero-opacity material, rather than a
  // model with a genuine geometric hole. Confirmed working on device.
  portalMask: { diffuseColor: "rgba(255,255,255,0)" },
});

ViroAnimations.registerAnimations({
  riseFromGround: {
    // Relative, not absolute — "+=" rises by a fixed distance from
    // whatever positionY the component actually started at, rather than
    // animating to a hardcoded Y=0. This matters now that the door and
    // mask have different final resting positions (mask's true opening
    // isn't centered on the door's own origin) — a shared absolute target
    // would be wrong for one of them; a shared relative distance is
    // correct for both.
    properties: { positionY: `+=${RISE_DISTANCE}` },
    duration: 1200,
    easing: "EaseOut", // starts fast, settles gently into its final position — reads as "coming to rest," not an abrupt stop
  },
});

// The true immersive portal (ViroPortalScene + Viro360Image), plus a flat
// preview layer visible from outside — see the flat-preview comment below
// for why both exist together. The photo comes through a real file:// URI,
// not a data: URI — see useSecurePhotoFileUri.js for the reasoning specific
// to Viro360Image.
//
// Data-fetching lives INSIDE this component, not passed in as a photoUri
// prop from the parent — ViroARSceneNavigator's initialScene captures its
// factory function's output once, at first mount, and doesn't re-render it
// when a parent's state later changes. photoUri starts null before the
// async fetch resolves; passed as a prop, this scene got permanently frozen
// with that initial null even after the real value arrived in the parent.
// roomName itself is safe to pass as a prop — it's a static string for the
// lifetime of this screen, not something that changes after mount.
function ArScene({ roomName }) {
  const { getForRoom } = usePlacardDialogs();
  const placard = getForRoom(roomName);
  const { uri: photoUri } = useSecurePhotoFileUri(placard?.photo360);

  const [placedPosition, setPlacedPosition] = useState(null);
  // Tracks whether the rise animation has finished — once true, the door
  // and mask switch to a plain static position with NO animation prop
  // attached at all. A declarative animation={{run: true}} prop re-applies
  // itself on every re-render (e.g. from the photo hooks' own state
  // updates), which can re-trigger the rise from scratch even after it
  // already finished once — removing the prop entirely, not just setting
  // run: false, is what actually stops that from happening.
  const [hasRisen, setHasRisen] = useState(false);
  // Refs, not state — these gate the ONE-TIME placement decision without
  // needing to re-render on every camera transform update (which fires
  // continuously as the phone moves).
  const isTrackingNormal = useRef(false);
  const hasPlaced = useRef(false);

  useEffect(() => {
    if (!placedPosition || !photoUri || hasRisen) return;
    // Matches the animation's own registered duration — once that much
    // time has genuinely passed, the rise is done and it's safe to settle
    // into a static position.
    const timer = setTimeout(() => setHasRisen(true), 1200);
    return () => clearTimeout(timer);
  }, [placedPosition, photoUri, hasRisen]);

  const handleTrackingUpdated = (state) => {
    // Only trust the camera transform once AR has genuinely found stable
    // tracking — the very first transform readings, before tracking
    // stabilizes, can be unreliable.
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      isTrackingNormal.current = true;
    }
  };

  const handleCameraTransformUpdate = (cameraTransform) => {
    if (!isTrackingNormal.current || hasPlaced.current) return;

    const { position, forward } = cameraTransform;
    // The actual placement math: a point straight ahead of wherever the
    // camera currently is, at a fixed real-world distance — no hit-testing
    // against a detected surface needed, no tap required.
    const target = [
      position[0] + forward[0] * PLACEMENT_DISTANCE_METERS,
      position[1] + forward[1] * PLACEMENT_DISTANCE_METERS,
      position[2] + forward[2] * PLACEMENT_DISTANCE_METERS,
    ];
    setPlacedPosition(target);
    hasPlaced.current = true; // locks in — later transform updates are ignored
  };

  return (
    <ViroARScene
      onTrackingUpdated={handleTrackingUpdated}
      onCameraTransformUpdate={handleCameraTransformUpdate}
    >
      {/* Waits for BOTH tracking to be ready AND the real photo to have
          finished loading — showing anything before the photo arrives
          would either show nothing or briefly flash the wrong content. */}
      {placedPosition && photoUri && (
        <>
          {/* Objects need lighting to be visible — the door model has no
              embedded material of its own, unlike the old hand-written
              frame which didn't need lighting since flat unlit shapes
              don't require it the same way. */}
          <ViroAmbientLight color="#ffffff" intensity={300} />

          {/* The real immersive portal — takes over once you physically
              walk through it. The door model itself rises out of the
              ground into its resting position; the portal boundary/photo
              content stay at their normal position throughout, since
              they're not visible from outside anyway until you've walked
              through. */}
          <ViroPortalScene passable position={placedPosition}>
            <ViroPortal>
              {/* The invisible mask — this alone now provides the genuine
                  see-through effect, so the earlier flat-preview workaround
                  layer is gone entirely. Rotation confirmed matching the
                  door's. Position offset is what's still being tuned —
                  see MASK_POSITION_OFFSET above. Switches to a plain
                  static resting position with no animation prop at all
                  once hasRisen is true — settling permanently, immune to
                  re-renders re-triggering the rise. Size precisely
                  measured from the door model's real vertex data. */}
              <Viro3DObject
                type="OBJ"
                source={require("../assets/models/portal-mask.obj")}
                materials={["portalMask"]}
                scale={MASK_SCALE}
                rotation={MASK_ROTATION}
                {...(hasRisen
                  ? { position: MASK_POSITION_OFFSET }
                  : {
                      position: [
                        MASK_POSITION_OFFSET[0],
                        MASK_POSITION_OFFSET[1] - RISE_DISTANCE,
                        MASK_POSITION_OFFSET[2],
                      ],
                      animation: { name: "riseFromGround", run: true },
                    })}
              />
              <Viro3DObject
                type="OBJ"
                source={require("../assets/models/door-frame.obj")}
                materials={["doorFrameMaterial"]}
                scale={[DOOR_SCALE, DOOR_SCALE, DOOR_SCALE]}
                rotation={DOOR_ROTATION}
                {...(hasRisen
                  ? { position: [0, 0, 0] }
                  : { position: [0, -RISE_DISTANCE, 0], animation: { name: "riseFromGround", run: true } })}
              />
            </ViroPortal>
            <Viro360Image source={{ uri: photoUri }} />
          </ViroPortalScene>
        </>
      )}
    </ViroARScene>
  );
}

export default function ArPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomName } = useLocalSearchParams();
  const { getForRoom } = usePlacardDialogs();

  // The room's OWN 360° photo (photo360 field on placardDialogs, set via
  // the dedicated "360° room photo" field in Room Edit on the web admin) —
  // not the flat "Room photo" field, and not the node's photo. A node
  // listed under "Rooms served" can easily be a hallway node with no photo
  // of its own, or an irrelevant one; the room's own record is the
  // unambiguous source for "what does the inside of this room look like."
  const placard = getForRoom(roomName);
  // getForRoom starts returning null before its own Firestore data has
  // loaded, same as before — this distinguishes "not loaded yet" from
  // "genuinely has no photo set" so the UI doesn't sit on a spinner forever
  // for a room an admin just hasn't added a photo to yet.
  const placardHasNoPhoto = Boolean(placard && !placard.photo360);
  const { uri: photoUri, error: photoError } = useSecurePhotoFileUri(placard?.photo360);

  // No room name at all — someone navigated here directly rather than
  // through the scanner's real flow. Shown instead of silently rendering an
  // empty AR scene with nothing to look at.
  if (!roomName) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No room selected for AR preview.</Text>
        <Pressable style={styles.closeBtnLarge} onPress={() => router.back()}>
          <Text style={styles.closeBtnLargeText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ViroARSceneNavigator initialScene={{ scene: () => <ArScene roomName={roomName} /> }} style={styles.flex} />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        {roomName ? (
          <View style={styles.roomNamePill}>
            <Text style={styles.roomNameText} numberOfLines={1}>{roomName}</Text>
          </View>
        ) : null}
      </View>

      {!photoUri && !photoError && !placardHasNoPhoto && (
        <View style={styles.loadingPill}>
          <ActivityIndicator color="#4a9eff" />
          <Text style={styles.loadingText}>Preparing AR preview…</Text>
        </View>
      )}
      {photoError && (
        <View style={styles.loadingPill}>
          <Text style={styles.errorTextSmall}>{photoError}</Text>
        </View>
      )}
      {placardHasNoPhoto && !photoError && (
        <View style={styles.loadingPill}>
          <Text style={styles.errorTextSmall}>
            This room doesn't have a photo yet — an admin needs to add one via Room Edit.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: "#0f1115",
  },
  errorText: { color: "#c7cad1", fontSize: 14, textAlign: "center" },
  errorTextSmall: { color: "#ff9a9a", fontSize: 13, textAlign: "center" },
  closeBtnLarge: { backgroundColor: "#4a9eff", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  closeBtnLargeText: { color: "#0f1115", fontWeight: "700", fontSize: 14 },
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,17,21,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#e6e6e6", fontSize: 16 },
  roomNamePill: {
    flex: 1,
    backgroundColor: "rgba(15,17,21,0.7)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  roomNameText: { color: "#e6e6e6", fontSize: 14, fontWeight: "600" },
  loadingPill: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#191b22",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  loadingText: { color: "#e6e6e6", fontSize: 13 },
});
