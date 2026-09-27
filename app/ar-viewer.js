import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
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
import { usePhotoFile } from "../src/hooks/usePhotoFile";
import { buildingLabel, floorLabel } from "../src/utils/constants";
import { colors, typography, spacing } from "../src/theme";
import BottomSheet from "../src/components/BottomSheet";
import Button from "../src/components/Button";
import ListRow from "../src/components/ListRow";
import { ArCloseButton, ArStatusPill } from "../src/components/ArChrome";

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
// usePhotoFile returns a null uri while a photo not yet downloaded is
// fetched, including mid-switch (already-visited nodes come back
// instantly from its shared cache) — and the whole portal structure (door,
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
function ArViewerScene({ initialNodeId, onRegisterNavigate, onNodeChange, onPlaced }) {
  const { nodes } = usePublicNodes();
  const [viewNodeId, setViewNodeId] = useState(initialNodeId);
  const viewNode = nodes?.find((n) => n.id === viewNodeId);
  const { uri: photoUri } = usePhotoFile(viewNode?.photo);

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
    onPlaced?.(); // the screen drops its "hold your phone up" hint
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

// Peek: just the spot's name showing.
const PEEK_HEIGHT = 84;

export default function ArViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { nodeId } = useLocalSearchParams();
  const { nodes } = usePublicNodes();

  const navigateRef = useRef(null);
  const [displayNodeId, setDisplayNodeId] = useState(nodeId);
  // Until the door is placed (AR tracking has settled), a hint says what to do.
  const [placed, setPlaced] = useState(false);
  // Header + list, measured, so the sheet fits them exactly.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const contentHeight = headerHeight && listHeight ? headerHeight + listHeight : undefined;

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
              onPlaced={() => setPlaced(true)}
            />
          ),
        }}
        style={styles.flex}
      />

      <ArCloseButton top={insets.top + 12} onPress={() => router.back()} />
      {!placed && <ArStatusPill style={{ top: insets.top + 64 }}>Hold your phone up and move it slowly while AR gets ready.</ArStatusPill>}

      {/* Where you are, and the spots you can walk to from here — sized to
          fit, so it covers as little of the camera as possible. */}
      <BottomSheet
        snapPoints={[PEEK_HEIGHT, 0.5]}
        initialSnap={1}
        bottomOffset={insets.bottom + spacing.md}
        topLimit={insets.top + 64}
        fitContent
        contentHeight={contentHeight}
      >
        <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Text style={styles.nodeTitle} numberOfLines={1}>
            {displayNode?.name || "…"}
          </Text>
          {!!displayNode && (
            <Text style={styles.nodeWhere}>
              {buildingLabel(displayNode.building)} - {floorLabel(displayNode.floor)}
            </Text>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.list} onContentSizeChange={(_, h) => setListHeight(h)}>
          <Text style={styles.sectionLabel}>Walk to</Text>
          {neighbors.length === 0 && <Text style={styles.emptyText}>Nowhere connected from here.</Text>}
          {neighbors.map((n) => (
            <ListRow
              key={n.id}
              title={n.name}
              subtitle={`${buildingLabel(n.building)} - ${floorLabel(n.floor)}`}
              onPress={() => handleNavigate(n.id)}
            />
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

  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  nodeTitle: { ...typography.h3 },
  nodeWhere: { ...typography.sublabel, marginTop: 2 },
  list: { paddingBottom: spacing.md },
  sectionLabel: { ...typography.eyebrow, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  emptyText: { ...typography.bodySmall, color: colors.textMuted, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
});
