import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
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
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import { useSecurePhotoFileUri } from "../src/hooks/useSecurePhotoFileUri";
import { colors, typography, radii, spacing } from "../src/theme";
import BottomSheet from "../src/components/BottomSheet";
import Button from "../src/components/Button";

// Same physical door model, same confirmed-correct tuning as ar-portal.js.
const PLACEMENT_DISTANCE_METERS = 2.7432;
const DOOR_SCALE = 0.32;
const RISE_DISTANCE = 1.6;
const DOOR_ROTATION = [0, -90, 0];
const MASK_SCALE = [1.197, 1.93, 1];
const MASK_POSITION_OFFSET = [0, 0, 0];
const MASK_ROTATION = [0, 0, 0];

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

  const navigateRef = useRef(null);
  const [displayNodeId, setDisplayNodeId] = useState(nodeId);

  const displayNode = nodes?.find((n) => n.id === displayNodeId);
  const neighbors = (displayNode?.neighbors || [])
    .map((nid) => nodes?.find((n) => n.id === nid))
    .filter(Boolean);

  const handleNavigate = (targetNodeId) => {
    navigateRef.current?.(targetNodeId);
  };

  if (!nodeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No starting point selected for AR view.</Text>
        <Button label="Go back" onPress={() => router.back()} size="sm" />
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

      <BottomSheet>
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
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stays black — behind the live AR camera feed.
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
  topBar: { position: "absolute", left: 12 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlaySurface,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: colors.textPrimary, fontSize: 16 },

  content: { flex: 1 },
  contentInner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  nodeTitle: { ...typography.h3, marginBottom: spacing.xs },
  sectionLabel: { ...typography.eyebrow, marginTop: spacing.md + 2, marginBottom: spacing.sm - 2 },
  emptyText: { ...typography.bodySmall, color: colors.textMuted },
  neighborRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
    marginBottom: spacing.sm,
  },
  neighborName: { ...typography.bodySmall, color: colors.textPrimary, fontSize: 14 },
  neighborArrow: { color: colors.primary, fontSize: 16, fontFamily: typography.h3.fontFamily },
});
