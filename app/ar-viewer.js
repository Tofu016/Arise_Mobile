import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import {
  ViroARSceneNavigator,
  ViroARScene,
  ViroPortalScene,
  ViroPortal,
  Viro3DObject,
  Viro360Image,
  ViroSphere,
  ViroNode,
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
import ArJoystick, { JOYSTICK_SIZE } from "../src/components/ArJoystick";

// Same physical door model, same confirmed-correct tuning as ar-portal.js.
const PLACEMENT_DISTANCE_METERS = 2.7432;
const DOOR_SCALE = 0.32;
const RISE_DISTANCE = 1.6;
const DOOR_ROTATION = [0, -90, 0];
const MASK_SCALE = [1.197, 1.93, 1];
const MASK_POSITION_OFFSET = [0, 0, 0];
const MASK_ROTATION = [0, 0, 0];

// Joystick: moving "yourself" through the space without stepping. The AR
// camera is the phone's real position, so it's the portal (door + photo)
// that moves the opposite way: push up and it comes toward you (walk in),
// push sideways and it slides past. Relative to where the phone faces, on
// the level (up/down tilt is ignored). Metres per second at a full push;
// updated JOYSTICK_TICK_MS apart while the stick is held.
const JOYSTICK_SPEED = 1.2;
const JOYSTICK_TICK_MS = 33;
// Space between the joystick and the top of the Walk-to sheet below it.
const JOYSTICK_GAP = 28;
// Going through the door: the opening is 1.2 m wide (MASK_SCALE); passing
// its plane within this far (m) of its centre, sideways, counts — the
// opening's half-width plus some slack, so "close to it" is enough.
const DOOR_VICINITY = 1.1;
// How far (m) past the plane before it counts, so standing right in the
// doorway doesn't flicker in and out.
const PLANE_DEADBAND = 0.05;
// Inside, the photo is a sphere this big (m) around where you stepped in —
// far enough that the few metres you might walk inside don't show — so the
// doorway can cut a hole in it (see "Going through the door").
const INSIDE_RADIUS = 30;
// Lines the sphere's photo up with the same photo seen through the door
// from outside (Viro360Image). If stepping in turns the view, adjust the
// Y angle; if it comes out mirrored, set INSIDE_MIRROR.
const INSIDE_ROTATION = [0, 0, 0];
const INSIDE_MIRROR = false;

ViroMaterials.createMaterials({
  doorFrameMaterial: { diffuseColor: "#8a7660" },
  portalMask: { diffuseColor: "rgba(255,255,255,0)" },
  // Invisible, but hides whatever is behind it: the doorway seen from
  // inside, so the real world (the camera) shows through it.
  doorwayHole: {
    lightingModel: "Constant",
    colorWritesMask: "None",
    writesToDepthBuffer: true,
    readsFromDepthBuffer: true,
    cullMode: "None",
  },
});

// One material per photo, for the inside sphere (created once each).
const insideMaterials = new Map();
function insideMaterialFor(uri) {
  if (!insideMaterials.has(uri)) {
    const name = `insidePhoto${insideMaterials.size}`;
    ViroMaterials.createMaterials({
      [name]: {
        diffuseTexture: { uri },
        lightingModel: "Constant",
        cullMode: "None",
      },
    });
    insideMaterials.set(uri, name);
  }
  return insideMaterials.get(uri);
}

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
function ArViewerScene({ initialNodeId, onRegisterNavigate, onNodeChange, onPlaced, forwardRef, moveRef }) {
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

  // ---------- Going through the door ----------
  // Worked out here rather than by Viro's `passable` portal: Viro only
  // notices a crossing when the PHONE moves, so a joystick walk (the door
  // moving instead) left you standing past the door until you swayed the
  // phone. Here, whichever moved, crossing the door's plane close enough to
  // the opening (DOOR_VICINITY) switches you in or out. Walking around the
  // door, off to the side, changes nothing.
  //   outside: the portal — the photo shows only through the door;
  //   inside:  the photo is a big sphere around you, and the doorway (the
  //            portal's own mask shape, in an invisible "hole" material)
  //            is drawn first and blocks the sphere behind it — so looking
  //            back, the real world shows through the door. Two-way.
  const placedRef = useRef(null); // the door's position, for the checks below
  const cameraRef = useRef(null); // the phone's latest position
  const sideRef = useRef(0); // which side of the door's plane the phone is on
  const insideRef = useRef(false);
  const [inside, setInside] = useState(false);
  const [insideCentre, setInsideCentre] = useState(null); // where you stepped in
  const insideMaterial = useMemo(() => (photoUri ? insideMaterialFor(photoUri) : null), [photoUri]);

  const checkCrossing = () => {
    const cam = cameraRef.current;
    const door = placedRef.current;
    if (!cam || !door) return;
    const dz = cam[2] - door[2];
    const side = dz > PLANE_DEADBAND ? 1 : dz < -PLANE_DEADBAND ? -1 : 0;
    if (side === 0 || side === sideRef.current) return;
    const crossedAtDoor = sideRef.current !== 0 && Math.abs(cam[0] - door[0]) <= DOOR_VICINITY;
    sideRef.current = side;
    if (!crossedAtDoor) return;
    insideRef.current = !insideRef.current;
    if (insideRef.current) setInsideCentre([...cam]);
    setInside(insideRef.current);
  };

  const handleCameraTransformUpdate = (cameraTransform) => {
    const { position, forward } = cameraTransform;
    // Every frame: which way the phone faces on the level, for the joystick.
    const flat = Math.hypot(forward[0], forward[2]);
    if (forwardRef && flat > 0.1) forwardRef.current = [forward[0] / flat, forward[2] / flat];
    cameraRef.current = position;
    checkCrossing();
    if (!isTrackingNormal.current || hasPlaced.current) return;
    const target = [
      position[0] + forward[0] * PLACEMENT_DISTANCE_METERS,
      position[1] + forward[1] * PLACEMENT_DISTANCE_METERS,
      position[2] + forward[2] * PLACEMENT_DISTANCE_METERS,
    ];
    placedRef.current = target;
    setPlacedPosition(target);
    hasPlaced.current = true;
    onPlaced?.(); // the screen drops its "hold your phone up" hint
  };

  // Joystick: while it's pushed, move the portal (see JOYSTICK_SPEED).
  const placed = !!placedPosition;
  useEffect(() => {
    if (!placed || !moveRef || !forwardRef) return undefined;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { x, y } = moveRef.current;
      const f = forwardRef.current;
      if ((!x && !y) || !f) return;
      // You move forward·y + right·x; the portal moves the other way.
      // Right of forward [fx, fz] is [fz, -fx] in Viro's world (tested on a
      // phone: the textbook [-fz, fx] made left and right come out swapped).
      const step = JOYSTICK_SPEED * dt;
      const mx = (f[0] * y + f[1] * x) * step;
      const mz = (f[1] * y - f[0] * x) * step;
      const p = placedRef.current;
      if (!p) return;
      placedRef.current = [p[0] - mx, p[1], p[2] - mz];
      setPlacedPosition(placedRef.current);
      checkCrossing(); // the door moved past you, even with the phone still
    }, JOYSTICK_TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, moveRef, forwardRef]);

  return (
    <ViroARScene onTrackingUpdated={handleTrackingUpdated} onCameraTransformUpdate={handleCameraTransformUpdate}>
      {/* Gated ONLY on placedPosition now — this is the actual fix. Stays
          mounted and fixed continuously once placed, regardless of
          photoUri's state during a later node switch. */}
      {placedPosition && (
        <>
          <ViroAmbientLight color="#ffffff" intensity={300} />
          {inside ? (
            // Inside (see "Going through the door"): the photo all around,
            // with the real world through the doorway.
            <>
              {insideMaterial && insideCentre && (
                <ViroSphere
                  position={insideCentre}
                  radius={INSIDE_RADIUS}
                  widthSegmentCount={48}
                  heightSegmentCount={24}
                  facesOutward={false}
                  rotation={INSIDE_ROTATION}
                  scale={INSIDE_MIRROR ? [-1, 1, 1] : [1, 1, 1]}
                  materials={[insideMaterial]}
                  renderingOrder={1}
                />
              )}
              <ViroNode position={placedPosition}>
                <Viro3DObject
                  type="OBJ"
                  source={require("../assets/models/portal-mask.obj")}
                  materials={["doorwayHole"]}
                  scale={MASK_SCALE}
                  rotation={MASK_ROTATION}
                  position={MASK_POSITION_OFFSET}
                  renderingOrder={-1}
                />
                <Viro3DObject
                  type="OBJ"
                  source={require("../assets/models/door-frame.obj")}
                  materials={["doorFrameMaterial"]}
                  scale={[DOOR_SCALE, DOOR_SCALE, DOOR_SCALE]}
                  rotation={DOOR_ROTATION}
                  position={[0, 0, 0]}
                />
              </ViroNode>
            </>
          ) : (
            <ViroPortalScene position={placedPosition}>
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
                    : {
                        position: [0, -RISE_DISTANCE, 0],
                        animation: { name: "riseFromGround", run: true },
                      })}
                />
              </ViroPortal>
              {/* This alone depends on photoUri — the ONLY thing that should
                blink out briefly during a node switch. */}
              {photoUri && <Viro360Image source={{ uri: photoUri }} />}
            </ViroPortalScene>
          )}
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
  const { width: screenWidth } = useWindowDimensions();
  // The joystick rides above the sheet, following it as it's dragged, with
  // a clear gap (JOYSTICK_GAP) so it never reads as part of the sheet.
  const sheetBottom = insets.bottom + spacing.md;
  const sheetHeight = useSharedValue(0);
  const joystickStyle = useAnimatedStyle(() => ({
    bottom: sheetBottom + sheetHeight.value + JOYSTICK_GAP,
  }));
  const { nodeId } = useLocalSearchParams();
  const { nodes } = usePublicNodes();

  const navigateRef = useRef(null);
  const forwardRef = useRef(null); // which way the phone faces, from the AR scene
  const moveRef = useRef({ x: 0, y: 0 }); // the joystick's push
  const [displayNodeId, setDisplayNodeId] = useState(nodeId);
  // Until the door is placed (AR tracking has settled), a hint says what to do.
  const [placed, setPlaced] = useState(false);
  // Header + list, measured, so the sheet fits them exactly.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const contentHeight = headerHeight && listHeight ? headerHeight + listHeight : undefined;

  const displayNode = nodes?.find((n) => n.id === displayNodeId);
  const neighbors = (displayNode?.neighbors || []).map((nid) => nodes?.find((n) => n.id === nid)).filter(Boolean);

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
              forwardRef={forwardRef}
              moveRef={moveRef}
            />
          ),
        }}
        style={styles.flex}
      />

      <ArCloseButton top={insets.top + 12} onPress={() => router.back()} />
      {!placed && (
        <ArStatusPill style={{ top: insets.top + 64 }}>
          Hold your phone up and move it slowly while AR gets ready.
        </ArStatusPill>
      )}

      {/* Joystick, centred just above the sheet: push to move through the
          space. */}
      {placed && (
        <Animated.View
          style={[styles.joystickWrap, { left: (screenWidth - JOYSTICK_SIZE) / 2 }, joystickStyle]}
          pointerEvents="box-none"
        >
          <ArJoystick
            onMove={(v) => {
              moveRef.current = v;
            }}
            style={styles.joystick}
          />
        </Animated.View>
      )}

      {/* Where you are, and the spots you can walk to from here — sized to
          fit, so it covers as little of the camera as possible. */}
      <BottomSheet
        snapPoints={[PEEK_HEIGHT, 0.5]}
        initialSnap={1}
        bottomOffset={sheetBottom}
        visibleHeight={sheetHeight}
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

  joystickWrap: {
    position: "absolute",
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
  },
  joystick: { position: "relative" },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  nodeTitle: { ...typography.h3 },
  nodeWhere: { ...typography.sublabel, marginTop: 2 },
  list: { paddingBottom: spacing.md },
  sectionLabel: {
    ...typography.eyebrow,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
});
