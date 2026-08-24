import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
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
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import { useSecurePhotoFileUri } from "../src/hooks/useSecurePhotoFileUri";

// Same physical door model, same confirmed-correct tuning as ar-portal.js.
const PLACEMENT_DISTANCE_METERS = 2.7432;
const DOOR_SCALE = 0.32;
const RISE_DISTANCE = 1.6;
const DOOR_ROTATION = [0, -90, 0];
const MASK_SCALE = [1.197, 1.93, 1];
const MASK_POSITION_OFFSET = [0, 0, 0];
const MASK_ROTATION = [0, 0, 0];

// Peek/half/full drag sheet — same values/spring config as MobileRoomSheet.
const SNAP_PEEK = 0.24;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.88;
const SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

ViroMaterials.createMaterials({
  doorFrameMaterial: { diffuseColor: "#8a7660" },
  portalMask: { diffuseColor: "rgba(255,255,255,0)" },
});

ViroAnimations.registerAnimations({
  riseFromGround: {
    properties: { positionY: `+=${RISE_DISTANCE}` },
    duration: 1200,
    easing: "EaseOut",
  },
});

// One persistent AR session, content switches in place — NOT a remount per
// node. A remount-based version was tried and tore down/restarted the
// entire native AR camera session on every node switch, which got stuck
// mid-transition ("Preparing AR..." and nothing further) — a much heavier,
// riskier operation than swapping content within an already-running
// session.
//
// The real bug in the very first version of this same in-place approach:
// useSecurePhotoFileUri resets its own uri to null at the START of every
// new fetch, including mid-switch — and the whole portal structure (door,
// mask, boundary) was gated on photoUri being truthy, so that momentary
// null likely unmounted the entire structure, not just the photo,
// explaining both bugs (position resetting, scale looking wrong) as one
// root cause. Fixed here by decoupling: the structural elements depend
// ONLY on placedPosition and stay mounted continuously once placed; only
// Viro360Image itself depends on photoUri, so a momentary gap during a
// switch is just a brief blank photo, not the whole portal disappearing.
//
// usePublicNodes() is called HERE, inside this component, not passed down
// as a prop — that data loads asynchronously, and a prop would freeze this
// permanently with stale data if it wasn't ready at first mount (the same
// bug ar-portal.js already hit once with photoUri).
function ArViewerScene({ initialNodeId, onRegisterNavigate, onNodeChange }) {
  const { nodes } = usePublicNodes();
  const [viewNodeId, setViewNodeId] = useState(initialNodeId);
  const viewNode = nodes?.find((n) => n.id === viewNodeId);
  const { uri: photoUri } = useSecurePhotoFileUri(viewNode?.photo);

  useEffect(() => {
    onRegisterNavigate?.(setViewNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onNodeChange?.(viewNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNodeId]);

  const [placedPosition, setPlacedPosition] = useState(null);
  const [hasRisen, setHasRisen] = useState(false);
  const isTrackingNormal = useRef(false);
  const hasPlaced = useRef(false);

  useEffect(() => {
    // Deliberately NOT waiting on photoUri here — the rise should happen
    // once, based on placement alone, and never re-trigger just because a
    // later node switch briefly nulls the photo out.
    if (!placedPosition || hasRisen) return;
    const timer = setTimeout(() => setHasRisen(true), 1200);
    return () => clearTimeout(timer);
  }, [placedPosition, hasRisen]);

  const handleTrackingUpdated = (state) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      isTrackingNormal.current = true;
    }
  };

  const handleCameraTransformUpdate = (cameraTransform) => {
    if (!isTrackingNormal.current || hasPlaced.current) return;
    const { position, forward } = cameraTransform;
    const target = [
      position[0] + forward[0] * PLACEMENT_DISTANCE_METERS,
      position[1] + forward[1] * PLACEMENT_DISTANCE_METERS,
      position[2] + forward[2] * PLACEMENT_DISTANCE_METERS,
    ];
    setPlacedPosition(target);
    hasPlaced.current = true;
  };

  return (
    <ViroARScene
      onTrackingUpdated={handleTrackingUpdated}
      onCameraTransformUpdate={handleCameraTransformUpdate}
    >
      {/* Gated ONLY on placedPosition now — this is the actual fix. Stays
          mounted and fixed continuously once placed, regardless of
          photoUri's state during a later node switch. */}
      {placedPosition && (
        <>
          <ViroAmbientLight color="#ffffff" intensity={300} />
          <ViroPortalScene passable position={placedPosition}>
            <ViroPortal>
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
            {/* This alone depends on photoUri — the ONLY thing that should
                blink out briefly during a node switch. */}
            {photoUri && <Viro360Image source={{ uri: photoUri }} />}
          </ViroPortalScene>
        </>
      )}
    </ViroARScene>
  );
}

export default function ArViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nodeId } = useLocalSearchParams();
  const { nodes } = usePublicNodes();
  const { height: windowHeight } = useWindowDimensions();

  const navigateRef = useRef(null);
  const [displayNodeId, setDisplayNodeId] = useState(nodeId);

  const displayNode = nodes?.find((n) => n.id === displayNodeId);
  const neighbors = (displayNode?.neighbors || [])
    .map((nid) => nodes?.find((n) => n.id === nid))
    .filter(Boolean);

  const handleNavigate = (targetNodeId) => {
    navigateRef.current?.(targetNodeId);
  };

  const heightFraction = useSharedValue(SNAP_PEEK);
  const startFraction = useSharedValue(SNAP_PEEK);

  const pan = Gesture.Pan()
    .onStart(() => {
      startFraction.value = heightFraction.value;
    })
    .onUpdate((e) => {
      const delta = -e.translationY / windowHeight;
      const next = Math.min(SNAP_FULL, Math.max(0.08, startFraction.value + delta));
      heightFraction.value = next;
    })
    .onEnd(() => {
      const current = heightFraction.value;
      const nearest = SNAP_POINTS.reduce(
        (best, p) => (Math.abs(current - p) < Math.abs(current - best) ? p : best),
        SNAP_POINTS[0]
      );
      heightFraction.value = withSpring(nearest, SPRING_CONFIG);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${heightFraction.value * 100}%`,
  }));

  if (!nodeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No starting point selected for AR view.</Text>
        <Pressable style={styles.closeBtnLarge} onPress={() => router.back()}>
          <Text style={styles.closeBtnLargeText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ViroARSceneNavigator
        initialScene={{
          scene: () => (
            <ArViewerScene
              initialNodeId={nodeId}
              onRegisterNavigate={(fn) => {
                navigateRef.current = fn;
              }}
              onNodeChange={setDisplayNodeId}
            />
          ),
        }}
        style={styles.flex}
      />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.sheet, animatedStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <Text style={styles.nodeTitle} numberOfLines={1}>
            {displayNode?.name || "…"}
          </Text>

          <Text style={styles.sectionLabel}>Walk to</Text>
          {neighbors.length === 0 && <Text style={styles.emptyText}>No connected nodes.</Text>}
          {neighbors.map((n) => (
            <Pressable key={n.id} style={styles.neighborRow} onPress={() => handleNavigate(n.id)}>
              <Text style={styles.neighborName}>{n.name}</Text>
              <Text style={styles.neighborArrow}>→</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
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
  closeBtnLarge: { backgroundColor: "#4a9eff", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  closeBtnLargeText: { color: "#0f1115", fontWeight: "700", fontSize: 14 },
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

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#191b22",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  handleArea: { paddingVertical: 10, alignItems: "center" },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: "#2a2d38" },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 16, paddingBottom: 24 },
  nodeTitle: { color: "#e6e6e6", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  sectionLabel: {
    color: "#6b7280",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 6,
  },
  emptyText: { color: "#6b7280", fontSize: 13 },
  neighborRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#14161c",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  neighborName: { color: "#e6e6e6", fontSize: 14 },
  neighborArrow: { color: "#4a9eff", fontSize: 16, fontWeight: "700" },
});
