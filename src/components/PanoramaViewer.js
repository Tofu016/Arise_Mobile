import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { markerTypeInfo } from "../utils/constants";
import {
  toPosition,
  overlayScale,
  markerScale,
  isFacing,
  previewScale,
  clampZoom,
  zoomedFov,
} from "../utils/panoramaMath";
import { reportMaxTextureSize } from "../hooks/usePanoramaImage";
import { useHotspotPreview } from "../hooks/useHotspotPreview";
import { DeviceMotion, deviceLook, angleDelta } from "../utils/deviceLook";
import { colors, fontFamily, shadows } from "../theme";

// The 360° viewer. Hotspots and markers are ported from Arise_Web's
// components/panorama/Hotspot.jsx and Marker.jsx so they look and behave
// the same:
//   - a hotspot is a camera-facing disc + ring + pulsing ring + white
//     chevron, drawn in the 3D scene; green and larger when it's the
//     route's next stop. As in web's phone/kiosk layout (alwaysShowPreview),
//     every hotspot in view shows a preview card of where it leads, and one
//     tap — on the arrow or on its card — walks there.
//   - a marker is a coloured dot with the type's icon and its label
//     underneath, always visible. Web draws it as an HTML overlay (drei's
//     <Html>); React Native has no DOM to portal into, so here it's a native
//     view laid over the canvas and moved to the marker's projected screen
//     position every frame (OverlayTracker). The preview cards work the
//     same way.

const FOV = 75; // vertical, degrees

// Arrival views (entryYaw — a hotspot's angle, an admin's default view, an
// elevator's doors) are "the angle to look AT", in the same convention as
// toPosition() and the web viewer. The camera's own yaw (CameraRig, drag,
// gyro) is its rotation about Y, which looks the MIRROR way: rotation θ
// looks at angle −θ. Converting only here — where an arrival view becomes
// the camera's — is what stops walks landing facing the mirror image of
// the intended direction (exactly backwards near 90°/270°).
function cameraYawFor(lookAtYaw) {
  return -lookAtYaw;
}

// Hotspots are drawn after (over) the panorama; the arrow inside a hotspot
// goes one step above its disc.
const HOTSPOT_RENDER_ORDER = 10;
// Period of the hotspot's outer-ring pulse.
const RING_PULSE_SECONDS = 2;
// Gap between the hotspot ring and its preview card, as a share of the original.
const PREVIEW_GAP_FRACTION = 0.5;
// Hotspots are drawn this much bigger than web's size for the same screen,
// so they're easy to hit with a thumb on a phone.
const HOTSPOT_SIZE_BOOST = 1.75;
// Gyro mode: sensor updates per second, and how much of each new reading
// is taken (the rest is the previous one) to calm the sensor's jitter.
const GYRO_INTERVAL_MS = 16;
// Moving between spots (see "Moving between spots" in PanoramaViewer):
const APPROACH_MS = 420; // step forward: turn toward the hotspot and zoom in
const ARRIVE_MS = 650; // the new photo eases back out to normal
const CROSSFADE_MS = 450; // the old photo dissolves over the new one
const WALK_ZOOM_FOV = 45; // how far in the step forward zooms
const JUMP_ZOOM_FOV = 62; // a jump or ride only settles in gently
const GYRO_SMOOTHING = 0.35;
// Zoom: how much of the way to the zoom level's FOV the lens eases each
// frame (smooths the pinch without making it feel laggy).
const ZOOM_EASE = 0.3;
// Markers likewise, a little.
const MARKER_SIZE_BOOST = 1.25;
// A tap this close (px) to a tappable marker's dot, or on its label, hits it.
const MARKER_HIT_SLOP = 16;
const MARKER_LABEL_HEIGHT = 19; // the label pill (13px text + padding)
const MARKER_LABEL_GAP = 3;

// 3D materials can't read the theme — these are web's values: the accent
// maroon, success green for the route's next stop, and white for the arrow.
const HOTSPOT_COLOR = "#a12124";
const HOTSPOT_NEXT_COLOR = "#2e7d46";
const ARROW_COLOR = "#ffffff";

function hotspotGeometry(highlighted) {
  const dotRadius = highlighted ? 18 : 14;
  const ringArgs = highlighted ? [20, 26, 40] : [16, 20, 40];
  // Where the preview card's bottom edge sits above the hotspot (scene units).
  const previewY = ringArgs[1] + (50 - ringArgs[1]) * PREVIEW_GAP_FRACTION;
  return { dotRadius, ringArgs, previewY };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Applies rotation every frame, imperatively, rather than through React
// props/state — this is what makes the drag feel smooth rather than choppy,
// since it's not waiting on a React re-render to pick up each new value.
// Also plays the moving-between-spots animations, the same way:
//   turnRef — { from, to: { yaw, pitch }, start, duration }: eases the view
//             round (written into rotationRef, so a drag afterwards carries
//             on from wherever it ended)
//   lensRef — { from, to, start, duration, hold }: eases the field of view
//             for a move; `hold` keeps it at `to` afterwards, until the
//             next photo replaces it
//   zoomRef — the visitor's pinch-zoom level: between moves the lens
//             eases toward its FOV
function CameraRig({ rotationRef, turnRef, lensRef, zoomRef }) {
  const { camera } = useThree();
  useFrame(() => {
    const now = Date.now();
    const turn = turnRef.current;
    if (turn) {
      const t = Math.min(1, (now - turn.start) / turn.duration);
      const e = easeInOut(t);
      rotationRef.current = {
        yaw: turn.from.yaw + (turn.to.yaw - turn.from.yaw) * e,
        pitch: turn.from.pitch + (turn.to.pitch - turn.from.pitch) * e,
      };
      if (t >= 1) turnRef.current = null;
    }
    const lens = lensRef.current;
    if (lens) {
      const t = Math.min(1, (now - lens.start) / lens.duration);
      const fov = lens.from + (lens.to - lens.from) * (lens.easing === "out" ? easeOut(t) : easeInOut(t));
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      if (t >= 1 && !lens.hold) lensRef.current = null;
    } else {
      const target = zoomedFov(FOV, zoomRef.current);
      const diff = target - camera.fov;
      if (diff !== 0) {
        camera.fov = Math.abs(diff) < 0.01 ? target : camera.fov + diff * ZOOM_EASE;
        camera.updateProjectionMatrix();
      }
    }
    // YXZ order (yaw around Y first, then pitch around X) is the standard
    // rotation order for a first-person-style look-around camera — avoids
    // the gimbal-lock artifacts a naive rotation order can produce.
    camera.rotation.order = "YXZ";
    camera.rotation.y = THREE.MathUtils.degToRad(rotationRef.current.yaw);
    camera.rotation.x = THREE.MathUtils.degToRad(rotationRef.current.pitch);
  });
  return null;
}

// The texture's "data" is { localUri } rather than pixel bytes: three.js
// passes it through to gl.texSubImage2D unchanged, and expo-gl recognises
// that shape and decodes the JPEG file natively (stb_image) straight into
// the texture — no JS-side decode at all. width/height must be the file's
// real size, since three.js allocates the GPU storage from them first.
function makeTexture(image) {
  const tex = new THREE.DataTexture({ localUri: image.uri }, image.width, image.height, THREE.RGBAFormat);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  // Decoded rows arrive top-to-bottom; THREE.DataTexture defaults flipY
  // to false (unlike image-based textures, which default it to true), and
  // expo-gl honours UNPACK_FLIP_Y for file uploads too — set explicitly so
  // the photo isn't upside-down. If it ever looks flipped, this is the toggle.
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

// The panorama on screen. Its texture is owned by the viewer (which frees
// it once it's been replaced and faded out — three.js never frees a
// texture's GPU copy on its own).
function PanoramaSphere({ texture }) {
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

// The panorama being replaced, drawn just inside the new one and faded out
// over it, so a move dissolves instead of cutting — web's FadingSphere.
function FadingSphere({ texture, onDone }) {
  const material = useRef();
  const start = useRef(Date.now());
  const done = useRef(false);
  useFrame(() => {
    const t = Math.min(1, (Date.now() - start.current) / CROSSFADE_MS);
    if (material.current) material.current.opacity = 1 - t;
    if (t >= 1 && !done.current) {
      done.current = true;
      onDone();
    }
  });
  return (
    <mesh scale={[-1, 1, 1]} renderOrder={1}>
      <sphereGeometry args={[499, 60, 40]} />
      <meshBasicMaterial ref={material} map={texture} side={THREE.DoubleSide} transparent depthWrite={false} />
    </mesh>
  );
}

// A wayfinding arrow toward a linked node — web's Hotspot.jsx, minus its
// DOM preview (drawn by PreviewCard instead). Its invisible hit sphere is
// registered in hitMapRef for the viewer's manual raycast.
function Hotspot({ hotspot, highlighted, uiScale, hitMapRef }) {
  const pos = useMemo(() => toPosition(hotspot.yaw, hotspot.pitch), [hotspot.yaw, hotspot.pitch]);
  const color = highlighted ? HOTSPOT_NEXT_COLOR : HOTSPOT_COLOR;
  const dotOpacity = 0.85;
  const ringOpacity = 0.5;
  const { dotRadius, ringArgs } = hotspotGeometry(highlighted);
  const groupRef = useRef();
  const pulseRef = useRef();

  // A wide upside-down "V" (chevron) sized to sit inside the dot, centred
  // vertically. Flat 2D geometry with a constant stroke thickness.
  const arrowShape = useMemo(() => {
    const w = dotRadius * 0.55; // half-width of the chevron
    const rise = dotRadius * 0.4; // height from apex down to the arm ends
    const k = dotRadius * 0.26; // stroke thickness (vertical)
    const apex = (rise + k) / 2;
    const armEnd = apex - rise;
    const s = new THREE.Shape();
    s.moveTo(0, apex);
    s.lineTo(w, armEnd);
    s.lineTo(w, armEnd - k);
    s.lineTo(0, apex - k);
    s.lineTo(-w, armEnd - k);
    s.lineTo(-w, armEnd);
    s.closePath();
    return s;
  }, [dotRadius]);

  useFrame(({ camera, clock }) => {
    if (!groupRef.current) return;
    // Pulse ring: every RING_PULSE_SECONDS an extra copy of the ring
    // expands outward and fades, then restarts.
    if (pulseRef.current) {
      const phase = (clock.elapsedTime % RING_PULSE_SECONDS) / RING_PULSE_SECONDS;
      pulseRef.current.scale.setScalar(1 + phase * 0.6);
      pulseRef.current.material.opacity = ringOpacity * (1 - phase);
    }
    // Billboard the whole marker toward the camera so the disc / ring /
    // arrow never turn edge-on as the visitor looks around.
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.scale.setScalar(uiScale);
  });

  // depthTest is off on everything drawn here (with a renderOrder above the
  // panorama): the marker sits only 20 units inside the panorama sphere, so
  // turned toward the camera, parts of it can poke outside the sphere and
  // the depth test would cut them off. It's always meant to be in front.
  const flat = { transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide };
  return (
    <group ref={groupRef} position={pos}>
      {/* Larger invisible hit area, so a fingertip on or near the marker
          counts. depthWrite off so it can't occlude anything behind it. */}
      <mesh
        ref={(mesh) => {
          if (mesh) hitMapRef.current.set(hotspot.id, mesh);
          else hitMapRef.current.delete(hotspot.id);
        }}
      >
        <sphereGeometry args={[42, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh renderOrder={HOTSPOT_RENDER_ORDER}>
        <circleGeometry args={[dotRadius, 40]} />
        <meshBasicMaterial color={color} opacity={dotOpacity} {...flat} />
      </mesh>
      <mesh renderOrder={HOTSPOT_RENDER_ORDER}>
        <ringGeometry args={ringArgs} />
        <meshBasicMaterial color={color} opacity={ringOpacity} {...flat} />
      </mesh>
      <mesh ref={pulseRef} renderOrder={HOTSPOT_RENDER_ORDER}>
        <ringGeometry args={ringArgs} />
        <meshBasicMaterial color={color} opacity={ringOpacity} {...flat} />
      </mesh>
      <mesh position={[0, 0, 0.5]} renderOrder={HOTSPOT_RENDER_ORDER + 1}>
        <shapeGeometry args={[arrowShape]} />
        <meshBasicMaterial color={ARROW_COLOR} opacity={1} {...flat} />
      </mesh>
    </group>
  );
}

// Projects the markers and the hotspots' preview-card anchors to screen
// positions every frame the camera moves, into a shared value the overlay
// views read on the UI thread — the native stand-in for drei's <Html>.
//   overlay.value = { markers: [[x, y, visible], …], previews: [[x, y, scale, visible], …] }
// Also reports which hotspots face the camera (onFacingChange), so a card —
// and its photo download — only exists while its hotspot is in view, as web.
function OverlayTracker({ markers, hotspots, highlightedId, uiScale, overlay, projectedRef, onFacingChange }) {
  const markerDirs = useMemo(
    () => markers.map((m) => new THREE.Vector3(...toPosition(m.yaw, m.pitch)).normalize()),
    [markers]
  );
  const hotspotInfos = useMemo(
    () =>
      hotspots.map((h) => {
        const pos = new THREE.Vector3(...toPosition(h.yaw, h.pitch));
        return { id: h.id, pos, dir: pos.clone().normalize(), previewY: hotspotGeometry(h.id === highlightedId).previewY };
      }),
    [hotspots, highlightedId]
  );
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), up: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const last = useRef({ key: "", facing: "" });

  useFrame(({ camera, size }) => {
    const q = camera.quaternion;
    // Only when something moved — a still view costs nothing.
    const key = `${q.x.toFixed(5)},${q.y.toFixed(5)},${q.z.toFixed(5)},${q.w.toFixed(5)},${camera.fov.toFixed(2)},${size.width},${size.height},${uiScale}`;
    const prev = last.current;
    if (key === prev.key && prev.markerDirs === markerDirs && prev.hotspotInfos === hotspotInfos) return;

    camera.updateMatrixWorld();
    const look = camera.getWorldDirection(tmp.look);
    const project = (vec) => {
      vec.project(camera);
      return [((vec.x + 1) / 2) * size.width, ((1 - vec.y) / 2) * size.height];
    };

    const markerPositions = markerDirs.map((dir) => {
      if (look.dot(dir) <= 0.05) return [0, 0, 0]; // behind the camera
      const [x, y] = project(tmp.v.copy(dir).multiplyScalar(480));
      return [x, y, 1];
    });

    // A card's bottom-centre anchor: above its hotspot in the hotspot's own
    // (camera-facing) plane, so "up" is the camera's up.
    const facingIds = [];
    const previewPositions = hotspotInfos.map((h) => {
      const lookDot = look.dot(h.dir);
      if (!isFacing(lookDot)) return [0, 0, 1, 0];
      facingIds.push(h.id);
      tmp.up.set(0, 1, 0).applyQuaternion(q).multiplyScalar(h.previewY * uiScale);
      const [x, y] = project(tmp.v.copy(h.pos).add(tmp.up));
      return [x, y, previewScale(lookDot), 1];
    });

    overlay.value = { markers: markerPositions, previews: previewPositions };
    projectedRef.current = markerPositions; // the tap handler's copy
    const facing = facingIds.join("|");
    last.current = { key, markerDirs, hotspotInfos, facing };
    if (facing !== prev.facing) onFacingChange(facingIds);
  });
  return null;
}

const NONE = [];

const OFFSCREEN = { transform: [{ translateX: -9999 }, { translateY: -9999 }] };

// The route's next step, when it's a marker (an elevator landing): white
// ring plus a green halo that breathes, as web's pano-marker-pulse.
function MarkerPulse({ size }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [t]);
  const halo = size + 12;
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.9 - t.value * 0.65,
    transform: [{ scale: 1 + (t.value * 16) / halo }],
  }));
  return (
    <>
      <Animated.View
        style={[styles.pulseHalo, { width: halo, height: halo, borderRadius: halo / 2, marginLeft: -halo / 2, marginTop: -halo / 2 }, haloStyle]}
      />
      <View
        style={[styles.pulseRing, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, marginLeft: -(size + 6) / 2, marginTop: -(size + 6) / 2 }]}
      />
    </>
  );
}

// A point-of-interest marker — web's Marker.jsx: coloured dot with the
// type's icon, label pill underneath, centred on its spot.
// Purely visual: taps are hit-tested by the viewer itself (markerAt), so a
// generous area around it counts and a drag starting on it still turns the
// view.
function MarkerOverlay({ marker, index, overlay, size, highlighted }) {
  const info = markerTypeInfo(marker.type);

  const anchorStyle = useAnimatedStyle(() => {
    const p = overlay.value.markers[index];
    if (!p || !p[2]) return OFFSCREEN;
    return { transform: [{ translateX: p[0] }, { translateY: p[1] }] };
  });

  return (
    <Animated.View style={[styles.anchor, anchorStyle]} pointerEvents="none">
      <View style={styles.centred} accessibilityLabel={marker.label}>
        <View style={{ width: size, height: size }}>
          {highlighted && <View style={styles.pulseCentre}><MarkerPulse size={size} /></View>}
          <View
            style={[
              styles.markerDot,
              { width: size, height: size, borderRadius: size / 2, backgroundColor: info.color },
              !highlighted && styles.markerDotShadow,
            ]}
          >
            <MaterialCommunityIcons name={info.glyph} size={Math.round(size * 0.5)} color="#fff" />
          </View>
        </View>
        <Text style={[styles.markerLabel, highlighted && styles.markerLabelHighlighted]} numberOfLines={1}>
          {marker.label}
        </Text>
      </View>
    </Animated.View>
  );
}

// A hotspot's preview card — where it leads, above the arrow, shrinking the
// further off-centre you look (web's .pano-hotspot-preview at its
// phone/kiosk size). Tapping the card walks there too.
function PreviewCard({ hotspot, index, overlay, onPress }) {
  const slices = useHotspotPreview(hotspot.photo, hotspot.yaw, true);
  const anchorStyle = useAnimatedStyle(() => {
    const p = overlay.value.previews?.[index];
    if (!p || !p[3]) return OFFSCREEN;
    return { transform: [{ translateX: p[0] }, { translateY: p[1] }] };
  });
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: overlay.value.previews?.[index]?.[2] ?? 1 }] }));

  return (
    <Animated.View style={[styles.anchor, anchorStyle]} pointerEvents="box-none">
      <View style={styles.bottomCentred} pointerEvents="box-none">
        <Animated.View entering={FadeIn.duration(150)} style={[styles.previewCard, scaleStyle]}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.previewThumb, pressed && styles.previewThumbPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${hotspot.name}`}
          >
            {slices ? (
              <View style={styles.previewSlices}>
                {slices.map((s) => (
                  <Image key={s.uri} source={{ uri: s.uri }} style={{ flex: s.share, height: "100%" }} resizeMode="stretch" />
                ))}
              </View>
            ) : (
              <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading preview" />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function PanoramaViewer({
  image,
  sceneKey,
  hotspots = [],
  markers = [],
  onNavigate,
  onMarkerTap,
  isMarkerTappable = (m) => m.type === "elevator",
  entryYaw = 0,
  entryPitch = 0,
  highlightedId = null,
  highlightedMarkerId = null,
  previewsHidden = false,
  gyroEnabled = false,
}) {
  // A plain ref, not React state — deliberately avoids re-rendering the
  // component tree on every single drag frame. CameraRig above reads this
  // directly inside Three.js's own render loop.
  const rotationRef = useRef({ yaw: cameraYawFor(entryYaw), pitch: entryPitch });
  const startTouchRef = useRef({ x: 0, y: 0 });
  const startRotationRef = useRef({ yaw: 0, pitch: 0 });
  // Gyro mode: the view is the phone's own direction (smoothed) plus an
  // offset. The yaw offset lines the phone's heading up with the panorama
  // (so turning gyro on never jumps the view) and takes finger drags; pitch
  // is the phone's real tilt, plus any vertical drag.
  const gyroRef = useRef(null); // { yaw, pitch } smoothed, or null before the first reading
  const gyroOffsetRef = useRef({ yaw: 0, pitch: 0 });
  const startGyroOffsetRef = useRef({ yaw: 0, pitch: 0 });
  // Pinch zoom (1 = normal), kept in a ref like the rotation, so a pinch
  // never re-renders anything.
  const zoomRef = useRef(1);
  const pinchRef = useRef(null); // { dist, zoom } while two fingers are down
  const pinchedRef = useRef(false); // this touch pinched, so it isn't a tap
  // id -> hit mesh, populated by each Hotspot's own ref callback.
  const hotspotMeshMapRef = useRef(new Map());
  // Populated via Canvas's onCreated — gives access to the live camera/size
  // needed to manually raycast on tap, without needing r3f's own built-in
  // pointer-event system (which shares the same touch-conflict risk the
  // drag gesture already ran into once).
  const r3fStateRef = useRef(null);
  // Markers' latest screen positions ([x, y, visible] each), for markerAt.
  const projectedMarkersRef = useRef([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const overlay = useSharedValue({ markers: [], previews: [] });

  // Hotspots currently in front of the camera — only these get a card.
  const [facingIds, setFacingIds] = useState([]);

  // ---------- Moving between spots ----------
  // The panorama on screen is the viewer's own (`shown`), not simply the
  // `image` prop: when the node changes, the old photo stays up — no grey
  // gap — while the new one loads, and a move plays out in three steps:
  //   1. step forward (walks only): the view turns toward the hotspot you
  //      walked through and zooms in, over APPROACH_MS;
  //   2. the new photo is swapped in once it's loaded AND that step is done,
  //      facing the arrival view;
  //   3. arrive: the old photo dissolves over it (CROSSFADE_MS) while the
  //      new one eases back out from zoomed-in (ARRIVE_MS).
  // A jump or an elevator ride (no hotspot walked) skips step 1 and only
  // settles in gently. Hotspots, markers and preview cards hide from the
  // moment the node changes until the swap, so the new spot's arrows never
  // float over the old photo. In gyro mode the phone steers the view, so
  // step 1 only zooms.
  const turnRef = useRef(null);
  const lensRef = useRef(null);
  const shownRef = useRef(null); // { image, texture, key } — key: the node it's of
  const [shown, setShown] = useState(null);
  const leavingRef = useRef(null); // texture fading out
  const [leaving, setLeaving] = useState(null);
  // Mid-move: the photo on screen is of a different node than the current
  // one. Worked out during render, so the new spot's arrows never get even
  // one frame over the old photo.
  const moving = !!shown && shown.key !== sceneKey;
  const sceneKeyRef = useRef(sceneKey);
  const shownHotspotsRef = useRef(hotspots); // the arrows of the photo on screen
  const approachUntilRef = useRef(0);
  const walkedRef = useRef(false);
  const entryRef = useRef({ entryYaw, entryPitch });
  entryRef.current = { entryYaw, entryPitch };

  // 1. The node changed: start the step forward, if a hotspot was walked.
  useEffect(() => {
    if (sceneKeyRef.current === sceneKey) return;
    sceneKeyRef.current = sceneKey;
    if (!shownRef.current) return; // nothing on screen yet to move from
    const walked = shownHotspotsRef.current.find((h) => h.id === sceneKey);
    walkedRef.current = !!walked;
    const now = Date.now();
    if (walked) {
      if (!gyroEnabled) {
        const from = { ...rotationRef.current };
        const toYaw = cameraYawFor(walked.yaw);
        turnRef.current = {
          from,
          to: {
            yaw: from.yaw + angleDelta(toYaw, from.yaw), // the short way round
            pitch: Math.max(-25, Math.min(25, walked.pitch || 0)),
          },
          start: now,
          duration: APPROACH_MS,
        };
      }
      const fov = r3fStateRef.current?.camera.fov ?? FOV;
      lensRef.current = { from: fov, to: WALK_ZOOM_FOV, start: now, duration: APPROACH_MS, hold: true };
      approachUntilRef.current = now + APPROACH_MS;
    } else {
      approachUntilRef.current = now;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  // Remember the arrows of whatever photo is settled on screen, for step 1's
  // "which hotspot was walked" on the next move. (Declared after step 1's
  // effect, so that one still sees the previous photo's arrows.)
  useEffect(() => {
    if (!moving) shownHotspotsRef.current = hotspots;
  }, [moving, hotspots]);

  // 2 + 3. A new photo is ready: swap it in once the step forward is done.
  useEffect(() => {
    if (!image) return undefined;
    if (shownRef.current?.image === image && shownRef.current.key === sceneKey) return undefined;
    const swap = () => {
      const current = shownRef.current;
      // Another node with the very same photo: keep it, just re-label it.
      const samePhoto = current?.image === image;
      const previous = samePhoto ? null : current;
      shownRef.current = {
        image,
        texture: samePhoto ? current.texture : makeTexture(image),
        key: sceneKeyRef.current,
      };
      setShown(shownRef.current);

      // Face the arrival view.
      const { entryYaw: yaw, entryPitch: pitch } = entryRef.current;
      turnRef.current = null;
      rotationRef.current = { yaw: cameraYawFor(yaw), pitch };
      // In gyro mode, re-aim it so the new panorama opens facing the same
      // way (the phone's tilt stays the phone's).
      if (gyroRef.current) gyroOffsetRef.current = { yaw: cameraYawFor(yaw) - gyroRef.current.yaw, pitch: 0 };

      // Every spot opens at the normal zoom.
      zoomRef.current = 1;
      lensRef.current = null;

      if (previous) {
        leavingRef.current?.dispose(); // a fade still running from a quick earlier move
        leavingRef.current = previous.texture;
        setLeaving(previous.texture);
        lensRef.current = {
          from: walkedRef.current ? WALK_ZOOM_FOV : JUMP_ZOOM_FOV,
          to: FOV,
          start: Date.now(),
          duration: ARRIVE_MS,
          easing: "out",
        };
      }
      walkedRef.current = false;
    };
    const wait = approachUntilRef.current - Date.now();
    if (wait <= 0) {
      swap();
      return undefined;
    }
    const timer = setTimeout(swap, wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, sceneKey]);

  const finishFade = () => {
    leavingRef.current?.dispose();
    leavingRef.current = null;
    setLeaving(null);
  };

  // Free the GPU copies of whatever is still up when the viewer goes away.
  useEffect(
    () => () => {
      shownRef.current?.texture.dispose();
      leavingRef.current?.dispose();
    },
    []
  );

  // What's drawn over the photo: nothing mid-move (see above).
  const visibleHotspots = moving ? NONE : hotspots;
  const visibleMarkers = moving ? NONE : markers;

  const uiScale = overlayScale(size.width, size.height, FOV) * HOTSPOT_SIZE_BOOST;
  const markerSize = Math.round(48 * markerScale(size.width, size.height) * MARKER_SIZE_BOOST);

  // The tappable marker under (x, y), nearest first. A marker is centred on
  // its spot as a whole (dot + gap + label), so its dot sits half the label
  // above it.
  const markerAt = (x, y) => {
    const dotOffset = (MARKER_LABEL_GAP + MARKER_LABEL_HEIGHT) / 2;
    let best = null;
    let bestDist = Infinity;
    visibleMarkers.forEach((m, i) => {
      const p = projectedMarkersRef.current[i];
      if (!p || !p[2] || !isMarkerTappable(m)) return;
      const dotX = p[0];
      const dotY = p[1] - dotOffset;
      const dist = Math.hypot(x - dotX, y - dotY);
      const onDot = dist <= markerSize / 2 + MARKER_HIT_SLOP;
      const labelTop = dotY + markerSize / 2;
      const onLabel =
        y >= labelTop && y <= labelTop + MARKER_LABEL_GAP + MARKER_LABEL_HEIGHT + MARKER_HIT_SLOP && Math.abs(x - dotX) <= 90;
      if ((onDot || onLabel) && dist < bestDist) {
        best = m;
        bestDist = dist;
      }
    });
    return best;
  };

  // Gyro mode: follow the phone. Subscribed only while it's on.
  useEffect(() => {
    if (!gyroEnabled || !DeviceMotion) return undefined;
    gyroRef.current = null;
    DeviceMotion.setUpdateInterval(GYRO_INTERVAL_MS);
    const subscription = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;
      const look = deviceLook(rotation);
      if (!Number.isFinite(look.yaw) || !Number.isFinite(look.pitch)) return;
      const g = gyroRef.current;
      if (!g) {
        // First reading: keep facing exactly what's on screen now.
        gyroRef.current = look;
        gyroOffsetRef.current = { yaw: rotationRef.current.yaw - look.yaw, pitch: 0 };
      } else {
        g.yaw += angleDelta(look.yaw, g.yaw) * GYRO_SMOOTHING;
        g.pitch += (look.pitch - g.pitch) * GYRO_SMOOTHING;
      }
      const cur = gyroRef.current;
      const offset = gyroOffsetRef.current;
      rotationRef.current = {
        yaw: cur.yaw + offset.yaw,
        pitch: Math.max(-89, Math.min(89, cur.pitch + offset.pitch)),
      };
    });
    return () => {
      subscription.remove();
      gyroRef.current = null;
    };
  }, [gyroEnabled]);

  // Uses React Native's OWN built-in touch responder system directly —
  // the same one @react-three/fiber's native Canvas already participates in
  // internally — rather than a separate gesture library layered on top.
  // Two different touch-claiming systems stacked on the same view tree
  // compete for the same touches and can leave one of them never receiving
  // events at all, which is exactly what happened trying gesture-handler
  // for the drag. Tappable markers are child views, so they claim their own
  // touches first; everything else lands here.
  // Two fingers pinch to zoom; one drags to look.
  const startDrag = (pageX, pageY) => {
    startTouchRef.current = { x: pageX, y: pageY };
    startRotationRef.current = { ...rotationRef.current };
    startGyroOffsetRef.current = { ...gyroOffsetRef.current };
  };

  const endPinch = () => {
    pinchRef.current = null;
  };

  const handleResponderGrant = (evt) => {
    const { pageX, pageY } = evt.nativeEvent;
    pinchRef.current = null;
    pinchedRef.current = false;
    startDrag(pageX, pageY);
  };

  const handleResponderMove = (evt) => {
    const { touches = [] } = evt.nativeEvent;
    if (touches.length >= 2) {
      const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
      pinchedRef.current = true;
      if (!pinchRef.current) pinchRef.current = { dist: Math.max(1, dist), zoom: zoomRef.current };
      else zoomRef.current = clampZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist));
      return;
    }
    if (pinchRef.current) {
      // One finger lifted: carry on as a drag from where it is now, rather
      // than jumping to where the first finger started.
      endPinch();
      if (touches[0]) startDrag(touches[0].pageX, touches[0].pageY);
      return;
    }
    const { pageX, pageY } = evt.nativeEvent;
    const dx = pageX - startTouchRef.current.x;
    const dy = pageY - startTouchRef.current.y;
    // Zoomed in, a drag turns the view less, so the scene still follows
    // the finger.
    const fov = r3fStateRef.current?.camera.fov ?? FOV;
    const sensitivity = 0.25 * (fov / FOV);
    // Gyro mode: a drag shifts the phone's view instead of replacing it.
    if (gyroEnabled && gyroRef.current) {
      gyroOffsetRef.current = {
        yaw: startGyroOffsetRef.current.yaw + dx * sensitivity,
        pitch: startGyroOffsetRef.current.pitch + dy * sensitivity,
      };
      return;
    }
    // "Grab and drag the scene" — the same scheme as Google Street View: a
    // swipe pulls the panorama along with the finger, so the camera turns the
    // OPPOSITE way to the drag. Dragging right reveals what was to your left.
    // (Adding dx/dy here rather than subtracting is what flips it that way.)
    const nextYaw = startRotationRef.current.yaw + dx * sensitivity;
    // Clamped so you can't flip the view upside-down past the poles — same
    // constraint the web version's OrbitControls has.
    const nextPitch = Math.max(-89, Math.min(89, startRotationRef.current.pitch + dy * sensitivity));
    rotationRef.current = { yaw: nextYaw, pitch: nextPitch };
  };

  // A "tap" is a touch that ended without much movement — anything more is
  // a drag-to-look. On a genuine tap, raycasts from the tapped point through
  // the camera to see which hotspot (if any) was hit, and walks there.
  const handleResponderRelease = (evt) => {
    endPinch();
    if (pinchedRef.current) return; // a pinch, not a tap
    const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
    const dx = pageX - startTouchRef.current.x;
    const dy = pageY - startTouchRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) return; // was a drag, not a tap

    // Markers are drawn over the hotspots, so they're checked first.
    const marker = markerAt(locationX, locationY);
    if (marker) {
      onMarkerTap?.(marker.id);
      return;
    }

    const state = r3fStateRef.current;
    if (!state || hotspotMeshMapRef.current.size === 0) return;
    const { camera, size: canvasSize } = state;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
      { x: (locationX / canvasSize.width) * 2 - 1, y: -(locationY / canvasSize.height) * 2 + 1 },
      camera
    );
    const intersects = raycaster.intersectObjects(Array.from(hotspotMeshMapRef.current.values()), false);
    if (intersects.length === 0) return;

    const hit = intersects[0].object;
    for (const [id, mesh] of hotspotMeshMapRef.current.entries()) {
      if (mesh !== hit) continue;
      // The hotspot itself carries the angles the next panorama should
      // open facing (its arrow's yaw, and any per-link default view).
      onNavigate?.(id, visibleHotspots.find((h) => h.id === id));
      return;
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleResponderGrant}
      onResponderMove={handleResponderMove}
      onResponderRelease={handleResponderRelease}
      onResponderTerminate={endPinch}
    >
      {/* pointerEvents="none" reaches r3f's own touch layer. That layer
          claims every touch at touch-down (a capture handler that always
          says yes), so without this the container only took over on the
          first move event. A tap with no finger jitter never sent one, and
          was dropped: the "sometimes it takes two taps" bug. Taps are
          raycast by hand below, so r3f's pointer events aren't needed. */}
      <Canvas
        pointerEvents="none"
        camera={{ position: [0, 0, 0.1], fov: FOV }}
        onCreated={(state) => {
          r3fStateRef.current = state;
          // Lets usePanoramaImage avoid asking for a panorama wider than
          // this GPU can hold as a single texture.
          reportMaxTextureSize(state.gl.capabilities.maxTextureSize);
        }}
      >
        <CameraRig rotationRef={rotationRef} turnRef={turnRef} lensRef={lensRef} zoomRef={zoomRef} />
        {shown ? (
          <PanoramaSphere texture={shown.texture} />
        ) : (
          <mesh scale={[-1, 1, 1]}>
            <sphereGeometry args={[500, 32, 32]} />
            <meshBasicMaterial color={colors.gray300} />
          </mesh>
        )}
        {leaving && <FadingSphere key={leaving.uuid} texture={leaving} onDone={finishFade} />}
        {visibleHotspots.map((h) => (
          <Hotspot
            key={h.id}
            hotspot={h}
            highlighted={h.id === highlightedId}
            uiScale={uiScale}
            hitMapRef={hotspotMeshMapRef}
          />
        ))}
        <OverlayTracker
          markers={visibleMarkers}
          hotspots={visibleHotspots}
          highlightedId={highlightedId}
          uiScale={uiScale}
          overlay={overlay}
          projectedRef={projectedMarkersRef}
          onFacingChange={setFacingIds}
        />
      </Canvas>

      {visibleMarkers.map((m, i) => (
        <MarkerOverlay
          key={m.id}
          marker={m}
          index={i}
          overlay={overlay}
          size={markerSize}
          highlighted={m.id === highlightedMarkerId}
        />
      ))}
      {!previewsHidden &&
        visibleHotspots.map(
          (h, i) =>
            facingIds.includes(h.id) && (
              <PreviewCard key={h.id} hotspot={h} index={i} overlay={overlay} onPress={() => onNavigate?.(h.id, h)} />
            )
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSunken, overflow: "hidden" },

  // Positioned at the projected point (translate), then the child shifts
  // itself so the right spot of it lands there.
  anchor: { position: "absolute", left: 0, top: 0 },
  centred: { alignItems: "center", transform: [{ translateX: "-50%" }, { translateY: "-50%" }] },
  bottomCentred: { transform: [{ translateX: "-50%" }, { translateY: "-100%" }] },

  markerDot: { alignItems: "center", justifyContent: "center" },
  markerDotShadow: { boxShadow: "0 0 6px rgba(32,27,27,0.55)" },
  markerLabel: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(32,27,27,0.82)",
    color: "#fff",
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
  markerLabelHighlighted: { backgroundColor: HOTSPOT_NEXT_COLOR },
  pulseCentre: { position: "absolute", left: "50%", top: "50%" },
  pulseHalo: { position: "absolute", backgroundColor: "rgba(46,125,70,0.9)" },
  pulseRing: { position: "absolute", backgroundColor: "#fff" },

  previewCard: {
    width: 280,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    transformOrigin: "50% 100%", // scaled by look direction from its bottom centre
    ...shadows.floating,
  },
  previewThumb: {
    height: 160,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  previewThumbPressed: { opacity: 0.8 },
  previewSlices: { flexDirection: "row", width: "100%", height: "100%" },
});
