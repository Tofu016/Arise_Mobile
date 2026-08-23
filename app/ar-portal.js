import { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ViroARSceneNavigator,
  ViroARScene,
  ViroNode,
  ViroPortalScene,
  ViroPortal,
  Viro3DObject,
  ViroImage,
  Viro360Image,
  ViroCameraTexture,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import { useSecurePhotoFileUri } from "../src/hooks/useSecurePhotoFileUri";

// ViroReact works in meters, not feet — 5 feet is roughly 1.524 meters.
const PLACEMENT_DISTANCE_METERS = 1.524;

// Back to the true immersive portal (ViroPortalScene + Viro360Image), now
// using a real file:// URI instead of a data: URI for the photo — see
// useSecurePhotoFileUri.js for the reasoning. The known trade-off, accepted
// deliberately: the photo only becomes visible once you walk through the
// portal, not from outside — a real, currently-unresolved limitation in
// ViroReact's own AR portal rendering on Android, not something we can fix
// from our side.
function TestArScene() {
  const { nodes } = usePublicNodes();
  // Change this to test a specific, known room's photo — set to null to
  // fall back to "whichever node happens to be first with a photo."
  const TEST_NODE_ID = "gd1_f1_entrance_02"; // e.g. "gd1_f1_entrance01"
  const testNode = TEST_NODE_ID
    ? nodes?.find((n) => n.id === TEST_NODE_ID)
    : nodes?.find((n) => n.photo);
  const { uri: photoUri } = useSecurePhotoFileUri(testNode?.photo);

  const [placedPosition, setPlacedPosition] = useState(null);
  // Refs, not state — these gate the ONE-TIME placement decision without
  // needing to re-render on every camera transform update (which fires
  // continuously as the phone moves).
  const isTrackingNormal = useRef(false);
  const hasPlaced = useRef(false);

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
          {/* Flat preview, visible from outside immediately — fills the
              exact gap left by Viro360Image's known limitation of only
              rendering once you've physically walked through the portal.
              Two copies (front + rotated 180°) so it's visible from either
              side, same reasoning as the earlier flat-only version. */}
          <ViroNode position={placedPosition}>
            <ViroImage source={{ uri: photoUri }} width={1.6} height={2.0} position={[0, 0, -0.02]} />
            <ViroImage
              source={{ uri: photoUri }}
              width={1.6}
              height={2.0}
              position={[0, 0, -0.02]}
              rotation={[0, 180, 0]}
            />
          </ViroNode>

          {/* The real immersive portal — takes over once you physically
              walk through it. */}
          <ViroPortalScene passable position={placedPosition}>
            <ViroPortal>
              <Viro3DObject type="OBJ" source={require("../assets/models/portal-frame.obj")} />
            </ViroPortal>
            <Viro360Image source={{ uri: photoUri }} />
            {/* EXPERIMENTAL — best-reasoned guess at ViroCameraTexture's
                API, since no concrete code example exists anywhere for this
                genuinely brand-new (2.56.0, June 2026) component. Modeled
                on ViroImage's established width/height/position pattern,
                since "aim it at a flat surface" suggests direct, positioned
                usage rather than a separate material-binding step.
                rotation removed for now — a real native error confirmed it
                doesn't accept the standard [x,y,z] array every other Viro
                component uses; testing without it first, one unknown at a
                time, before guessing at what format it actually wants. */}
            <ViroCameraTexture
              width={1.6}
              height={2.0}
              position={[0, 0, 0.02]}
              cameraPosition="back"
            />
          </ViroPortalScene>
        </>
      )}
    </ViroARScene>
  );
}

export default function ArPortalTestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <ViroARSceneNavigator initialScene={{ scene: () => <TestArScene /> }} style={styles.flex} />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#000" },
  topBar: { position: "absolute", left: 12 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,17,21,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#e6e6e6", fontSize: 16 },
});
