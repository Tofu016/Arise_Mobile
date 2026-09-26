import { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { markerTypeInfo } from "../utils/constants";
import { reportMaxTextureSize } from "../hooks/usePanoramaImage";
import { colors } from "../theme";

const MARKER_RADIUS = 480; // just inside the 500-radius panorama sphere, so markers/hotspots sit in front of the image

// Ported unchanged from the web version's PanoramaNav.jsx — pure spherical-
// coordinate math, nothing platform-specific about it at all.
function toPosition(yaw, pitch, radius = MARKER_RADIUS) {
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  return [
    radius * Math.sin(yawRad) * Math.cos(pitchRad),
    radius * Math.sin(pitchRad),
    -radius * Math.cos(yawRad) * Math.cos(pitchRad),
  ];
}

// Applies rotation every frame, imperatively, rather than through React
// props/state — this is what makes the drag feel smooth rather than choppy,
// since it's not waiting on a React re-render to pick up each new value.
function CameraRig({ rotationRef }) {
  const { camera } = useThree();
  useFrame(() => {
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
function PanoramaSphere({ image }) {
  const texture = useMemo(() => {
    if (!image) return null;
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
  }, [image]);

  // Three.js never frees a texture's GPU copy on its own — without this,
  // every panorama visited stays in GPU memory for the whole session.
  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture) return null;

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Registers its own mesh directly into the shared map via React's ref
// callback, keyed by its own hotspot id — this is how the manual raycast in
// PanoramaViewer below knows which 3D object corresponds to which node to
// navigate to.
function Hotspot({ hotspot, meshMapRef }) {
  const position = useMemo(() => toPosition(hotspot.yaw, hotspot.pitch), [hotspot.yaw, hotspot.pitch]);
  return (
    <mesh
      position={position}
      ref={(mesh) => {
        if (mesh) meshMapRef.current.set(hotspot.id, mesh);
        else meshMapRef.current.delete(hotspot.id);
      }}
    >
      <sphereGeometry args={[14, 16, 16]} />
      <meshBasicMaterial color={colors.primary} transparent opacity={0.85} />
    </mesh>
  );
}

// A fixed point-of-interest marker (room/facility/exit/hydrant) — colored
// dot + ring, matching web's visual style, minus the floating text label.
// Web renders that label via drei's <Html> (a real DOM overlay dropped into
// the 3D scene) — there's no DOM in React Native to portal into, so that
// specific technique doesn't carry over. The label shows in a normal RN
// banner when tapped instead (see app/index.js), rather than reaching for
// a 3D-text-rendering library and its own set of native-compatibility
// unknowns, given how much ground we already covered chasing exactly that
// class of problem with the panorama photo itself.
function Marker({ marker, meshMapRef }) {
  const position = useMemo(() => toPosition(marker.yaw, marker.pitch), [marker.yaw, marker.pitch]);
  const info = markerTypeInfo(marker.type);
  return (
    <group
      position={position}
      ref={(group) => {
        if (group) meshMapRef.current.set(marker.id, group);
        else meshMapRef.current.delete(marker.id);
      }}
    >
      <mesh>
        <circleGeometry args={[12, 20]} />
        <meshBasicMaterial color={info.color} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[15, 19, 20]} />
        <meshBasicMaterial color={info.color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function PanoramaViewer({
  image,
  hotspots = [],
  markers = [],
  onNavigate,
  onMarkerTap,
  entryYaw = 0,
  entryPitch = 0,
}) {
  // A plain ref, not React state — deliberately avoids re-rendering the
  // component tree on every single drag frame. CameraRig above reads this
  // directly inside Three.js's own render loop.
  const rotationRef = useRef({ yaw: entryYaw, pitch: entryPitch });
  const startTouchRef = useRef({ x: 0, y: 0 });
  const startRotationRef = useRef({ yaw: 0, pitch: 0 });
  // id -> mesh, populated by each Hotspot/Marker's own ref callback.
  const hotspotMeshMapRef = useRef(new Map());
  const markerMeshMapRef = useRef(new Map());
  // Populated via Canvas's onCreated — gives access to the live camera/size
  // needed to manually raycast on tap, without needing r3f's own built-in
  // pointer-event system (which shares the same touch-conflict risk the
  // drag gesture already ran into once).
  const r3fStateRef = useRef(null);

  // Resets the view to face roughly the direction you were walking, every
  // time a genuinely different panorama finishes loading (image's identity
  // changes on real navigation, but stays the same across unrelated
  // re-renders of this component) — otherwise the camera would just keep
  // whatever rotation was left over from the previous panorama.
  useEffect(() => {
    rotationRef.current = { yaw: entryYaw, pitch: entryPitch };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  // Uses React Native's OWN built-in touch responder system directly —
  // the same one @react-three/fiber's native Canvas already participates in
  // internally — rather than a separate gesture library layered on top.
  // Two different touch-claiming systems stacked on the same view tree
  // compete for the same touches and can leave one of them never receiving
  // events at all, which is exactly what happened trying gesture-handler
  // for the drag. Using the same system Canvas already speaks (and doing
  // tap/hotspot/marker detection the same way, manually, rather than via
  // r3f's own separate built-in pointer events) avoids that conflict
  // entirely.
  const handleResponderGrant = (evt) => {
    const { pageX, pageY } = evt.nativeEvent;
    startTouchRef.current = { x: pageX, y: pageY };
    startRotationRef.current = { ...rotationRef.current };
  };

  const handleResponderMove = (evt) => {
    const { pageX, pageY } = evt.nativeEvent;
    const dx = pageX - startTouchRef.current.x;
    const dy = pageY - startTouchRef.current.y;
    const sensitivity = 0.15;
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
  // a drag-to-look, not a request to interact. On a genuine tap, raycasts
  // from the tapped screen point through the camera to see which (if any)
  // hotspot or marker was hit — hotspots navigate, markers show their info.
  const handleResponderRelease = (evt) => {
    const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
    const dx = pageX - startTouchRef.current.x;
    const dy = pageY - startTouchRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) return; // was a drag, not a tap

    const state = r3fStateRef.current;
    const hasHotspots = hotspotMeshMapRef.current.size > 0;
    const hasMarkers = markerMeshMapRef.current.size > 0;
    if (!state || (!hasHotspots && !hasMarkers)) return;
    const { camera, size } = state;

    const ndcX = (locationX / size.width) * 2 - 1;
    const ndcY = -(locationY / size.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

    const hotspotMeshes = Array.from(hotspotMeshMapRef.current.values());
    const markerMeshes = Array.from(markerMeshMapRef.current.values());
    const intersects = raycaster.intersectObjects([...hotspotMeshes, ...markerMeshes], true);
    if (intersects.length === 0) return;

    // intersectObjects with recursive=true (needed since markers are
    // <group>s containing child meshes) can return a child mesh rather
    // than the group itself — walk up to find which registered id it
    // actually belongs to, checking hotspots first since those are simple
    // single meshes with no children to walk up through.
    const hitObject = intersects[0].object;
    for (const [id, mesh] of hotspotMeshMapRef.current.entries()) {
      if (mesh === hitObject) {
        // The hotspot itself carries the angles the next panorama should
        // open facing (its arrow's yaw, and any per-link default view).
        onNavigate?.(id, hotspots.find((h) => h.id === id));
        return;
      }
    }
    for (const [id, group] of markerMeshMapRef.current.entries()) {
      if (group === hitObject || group === hitObject.parent) {
        onMarkerTap?.(id);
        return;
      }
    }
  };

  return (
    <View
      style={styles.container}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleResponderGrant}
      onResponderMove={handleResponderMove}
      onResponderRelease={handleResponderRelease}
    >
      <Canvas
        camera={{ position: [0, 0, 0.1], fov: 75 }}
        onCreated={(state) => {
          r3fStateRef.current = state;
          // Lets usePanoramaImage avoid asking for a panorama wider than
          // this GPU can hold as a single texture.
          reportMaxTextureSize(state.gl.capabilities.maxTextureSize);
        }}
      >
        <CameraRig rotationRef={rotationRef} />
        {image ? (
          <PanoramaSphere image={image} />
        ) : (
          <mesh scale={[-1, 1, 1]}>
            <sphereGeometry args={[500, 32, 32]} />
            <meshBasicMaterial color={colors.gray300} />
          </mesh>
        )}
        {hotspots.map((h) => (
          <Hotspot key={h.id} hotspot={h} meshMapRef={hotspotMeshMapRef} />
        ))}
        {markers.map((m) => (
          <Marker key={m.id} marker={m} meshMapRef={markerMeshMapRef} />
        ))}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSunken },
});
