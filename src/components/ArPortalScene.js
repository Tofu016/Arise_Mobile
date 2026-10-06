import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { usePhotoFile } from "../hooks/usePhotoFile";

// The AR door-frame portal with a 360 photo inside, shared by both AR
// screens: the AR view of a node (app/ar-viewer.js) and a room's 360° VIEW
// (app/ar-portal.js). It places the door, raises it out of the ground, lets
// the joystick (walking) and raise / lower buttons move it until it's anchored,
// and switches you in and out when you cross the doorway.
//
// One module for both on purpose. ViroMaterials and ViroAnimations are
// global registries keyed by name: when each screen registered its own
// "doorFrameMaterial", whichever file loaded last set the colour for both,
// so a frame colour changed in one file silently didn't show.
//
// `photoPath` is a server photo path; the file is fetched in here (through
// usePhotoFile), not passed in as a uri, because ViroARSceneNavigator's
// initialScene freezes whatever props it got at first mount. A caller's
// scene component looks the path up itself (from a shared store) and renders
// this. Only the photo depends on the file: the door stays mounted while a
// new photo loads, so switching photos never resets the placement.
//
// The refs and callbacks come from useArPortalControls (ArPortalControls.js):
// `anchoredRef.current` true freezes the door, `liftRef.current` is -1 / 0 / 1
// (lower / none / raise), `onInsideChange(bool)` fires on every crossing.
//
//   <ArPortalScene photoPath={node.photo} {...controls.sceneProps} />

// ViroReact works in meters, not feet: 9 feet is roughly 2.7432 meters.
// Confirmed working at this distance on device.
const PLACEMENT_DISTANCE_METERS = 2.7432;

// The custom door-frame model came out of Blender at roughly 4.1 x 6.25 x
// 4.05 units (width x height x depth), quite large for a doorway. Scaled to
// a realistic ~2m height; a uniform scale, not a stretch.
const DOOR_SCALE = 0.32;
// How far below its resting position the door starts, in meters: the
// "underground" starting point for the rise animation.
const RISE_DISTANCE = 1.6;

// Confirmed correct on a real device. The model's own tunnel direction
// didn't map to the axis earlier reasoning assumed; this was found by direct
// trial rather than derived.
const DOOR_ROTATION = [0, -90, 0];

// Precisely measured from the door model's own raw vertex data (not
// estimated): the inner opening between the two pillars and the underside
// of the top bridge, excluding the base. The mask reaches all the way down
// to the ground, since the opening naturally continues to the floor. Already
// in final world-space units (post DOOR_SCALE), since the mask's own
// scale/position props apply directly.
const MASK_SCALE = [1.197, 1.93, 1];
// Confirmed correct on a real device.
const MASK_POSITION_OFFSET = [0, 0, 0];
const MASK_ROTATION = [0, 0, 0];

// Joystick: moving "yourself" through the space without stepping. The AR
// camera is the phone's real position, so it's the portal (door + photo)
// that moves the opposite way: push up and it comes toward you (walk in),
// push sideways and it slides past. Relative to where the phone faces, on
// the level (up/down tilt is ignored). Metres per second at a full push;
// updated JOYSTICK_TICK_MS apart while the stick is held. Anchoring freezes
// it, and the raise / lower buttons (below) move the door the same way
// whether or not you "walk".
const JOYSTICK_SPEED = 1.2;
const JOYSTICK_TICK_MS = 33;
// The raise / lower buttons (liftRef), metres per second while held.
const LIFT_SPEED = 0.4;
// Going through the door: the opening is 1.2 m wide (MASK_SCALE); passing
// its plane within this far (m) of its centre, sideways, counts: the
// opening's half-width plus some slack, so "close to it" is enough.
const DOOR_VICINITY = 1.1;
// How far (m) past the plane before it counts, so standing right in the
// doorway doesn't flicker in and out.
const PLANE_DEADBAND = 0.05;
// Height window (m) for a crossing, measured from the door's base, and
// deliberately wide: a door the visitor has lowered to their shins still lets
// them walk in upright, without ducking under it. The window is the opening
// (MASK_SCALE height) plus this slack below and above.
const DOOR_LEEWAY_BELOW = 1.0;
const DOOR_LEEWAY_ABOVE = 2.0;
// Inside, the photo is a sphere this big (m) around where you stepped in,
// far enough that the few metres you might walk inside don't show, so the
// doorway can cut a hole in it (see "Going through the door").
const INSIDE_RADIUS = 30;
// Lines the sphere's photo up with the same photo seen through the door
// from outside (Viro360Image). If stepping in turns the view, adjust the
// Y angle; if it comes out mirrored, set INSIDE_MIRROR.
const INSIDE_ROTATION = [0, 0, 0];
const INSIDE_MIRROR = false;

ViroMaterials.createMaterials({
  // The model has no embedded material of its own. Light grey (the brand
  // board's off-white), set in commit 5bbbc02.
  doorFrameMaterial: { diffuseColor: "#f2f1ec" },
  // Fully transparent: the "see-through" technique itself, a solid quad
  // made invisible via a zero-opacity material rather than a model with a
  // genuine geometric hole. Confirmed working on device.
  portalMask: { diffuseColor: "rgba(255,255,255,0)" },
  // Invisible, but hides whatever is behind it: the doorway seen from
  // inside, so the real world (the camera) shows through it.
  //
  // Transparent AND colour-masked: a material with no diffuseColor is solid
  // white, so if a device ignores colorWritesMask the doorway showed as a
  // blank white panel from inside. Alpha 0 keeps it invisible either way,
  // while the depth write still hides the photo sphere behind it.
  doorwayHole: {
    diffuseColor: "rgba(255,255,255,0)",
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
    // Relative, not absolute: "+=" rises by a fixed distance from whatever
    // positionY the object started at. The door and the mask rest at
    // different heights, so a shared absolute target would be wrong for one
    // of them; a shared relative distance is right for both.
    properties: { positionY: `+=${RISE_DISTANCE}` },
    duration: 1200,
    easing: "EaseOut", // starts fast, settles gently: "coming to rest", not an abrupt stop
  },
});

export default function ArPortalScene({
  photoPath,
  forwardRef,
  moveRef,
  liftRef,
  anchoredRef,
  recalibrateRef,
  onPlaced,
  onInsideChange,
}) {
  const { uri: photoUri } = usePhotoFile(photoPath);

  const [placedPosition, setPlacedPosition] = useState(null);
  // Once the rise has finished, the door and mask switch to a plain static
  // position with NO animation prop at all. A declarative animation={{run:
  // true}} re-applies itself on every re-render (e.g. from the photo hook's
  // state updates) and can re-trigger the rise; removing the prop, not just
  // setting run: false, is what stops that.
  const [hasRisen, setHasRisen] = useState(false);
  // Refs, not state: these gate the ONE-TIME placement decision without
  // re-rendering on every camera transform update.
  const isTrackingNormal = useRef(false);
  const hasPlaced = useRef(false);

  useEffect(() => {
    // Deliberately NOT waiting on photoUri: the rise happens once, based on
    // placement alone, and never re-triggers because a later photo switch
    // briefly nulls the photo out.
    if (!placedPosition || hasRisen) return;
    const timer = setTimeout(() => setHasRisen(true), 1200);
    return () => clearTimeout(timer);
  }, [placedPosition, hasRisen]);

  const handleTrackingUpdated = (state) => {
    // Only trust the camera transform once AR has found stable tracking;
    // the first readings before that can be unreliable.
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
  //   outside: the portal; the photo shows only through the door;
  //   inside:  the photo is a big sphere around you, and the doorway (the
  //            portal's own mask shape, in an invisible "hole" material)
  //            is drawn first and blocks the sphere behind it, so looking
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
    const dy = cam[1] - door[1];
    const atDoorHeight = dy >= -DOOR_LEEWAY_BELOW && dy <= MASK_SCALE[1] + DOOR_LEEWAY_ABOVE;
    const crossedAtDoor = sideRef.current !== 0 && atDoorHeight && Math.abs(cam[0] - door[0]) <= DOOR_VICINITY;
    sideRef.current = side;
    if (!crossedAtDoor) return;
    insideRef.current = !insideRef.current;
    if (insideRef.current) setInsideCentre([...cam]);
    setInside(insideRef.current);
    onInsideChange?.(insideRef.current);
  };

  // Recalibrate: drop the door and let the placement below spawn a new one
  // straight ahead of the phone, as at the start. Asked for through a counter
  // in a ref (recalibrateRef), because the scene's props are frozen.
  const seenRecalibrate = useRef(recalibrateRef?.current ?? 0);
  const resetPortal = () => {
    placedRef.current = null;
    hasPlaced.current = false;
    sideRef.current = 0;
    insideRef.current = false;
    setPlacedPosition(null);
    setHasRisen(false);
    setInside(false);
    setInsideCentre(null);
  };

  const handleCameraTransformUpdate = (cameraTransform) => {
    const { position, forward } = cameraTransform;
    if (recalibrateRef && recalibrateRef.current !== seenRecalibrate.current) {
      seenRecalibrate.current = recalibrateRef.current;
      resetPortal();
      // Spawn the new door on the next update, not this one: placing it in
      // the same batch would swap the position without ever unmounting the
      // old door, so nothing visibly died and the rise didn't replay.
      return;
    }
    // Every frame: which way the phone faces on the level, for the joystick.
    const flat = Math.hypot(forward[0], forward[2]);
    if (forwardRef && flat > 0.1) forwardRef.current = [forward[0] / flat, forward[2] / flat];
    cameraRef.current = position;
    checkCrossing();
    if (!isTrackingNormal.current || hasPlaced.current) return;
    // A point straight ahead of the camera at a fixed real-world distance:
    // no hit-testing against a detected surface, no tap required.
    const target = [
      position[0] + forward[0] * PLACEMENT_DISTANCE_METERS,
      position[1] + forward[1] * PLACEMENT_DISTANCE_METERS,
      position[2] + forward[2] * PLACEMENT_DISTANCE_METERS,
    ];
    placedRef.current = target;
    setPlacedPosition(target);
    hasPlaced.current = true; // locks in; later transform updates are ignored
    onPlaced?.(); // the screen drops its "hold your phone up" hint
  };

  // Joystick and raise / lower buttons: while held, move the portal (see
  // JOYSTICK_SPEED, LIFT_SPEED). Nothing moves while anchored.
  const placed = !!placedPosition;
  useEffect(() => {
    if (!placed || !moveRef || !forwardRef) return undefined;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (anchoredRef?.current) return;
      const { x, y } = moveRef.current;
      const lift = liftRef?.current || 0;
      const f = forwardRef.current;
      if ((!x && !y && !lift) || !f) return;
      // You move forward·y + right·x; the portal moves the other way.
      // Right of forward [fx, fz] is [-fz, fx] here. (An earlier [fz, -fx]
      // was tuned when the stick placed the door directly, and came out
      // mirrored once the stick became walking: push left, door went left.)
      const step = JOYSTICK_SPEED * dt;
      const mx = (f[0] * y - f[1] * x) * step;
      const mz = (f[1] * y + f[0] * x) * step;
      const p = placedRef.current;
      if (!p) return;
      placedRef.current = [p[0] - mx, p[1] + lift * LIFT_SPEED * dt, p[2] - mz];
      setPlacedPosition(placedRef.current);
      checkCrossing(); // the door moved past you, even with the phone still
    }, JOYSTICK_TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, moveRef, forwardRef]);

  return (
    <ViroARScene onTrackingUpdated={handleTrackingUpdated} onCameraTransformUpdate={handleCameraTransformUpdate}>
      {/* Gated ONLY on placedPosition: stays mounted and fixed once placed,
          whatever photoUri does during a later photo switch. */}
      {placedPosition && (
        <>
          {/* The door model needs lighting to be visible. */}
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
                  source={require("../../assets/models/portal-mask.obj")}
                  materials={["doorwayHole"]}
                  scale={MASK_SCALE}
                  rotation={MASK_ROTATION}
                  position={MASK_POSITION_OFFSET}
                  renderingOrder={-1}
                />
                <Viro3DObject
                  type="OBJ"
                  source={require("../../assets/models/door-frame.obj")}
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
                  source={require("../../assets/models/portal-mask.obj")}
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
                  source={require("../../assets/models/door-frame.obj")}
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
              {/* The only thing that should blink out briefly during a
                  photo switch. */}
              {photoUri && <Viro360Image source={{ uri: photoUri }} />}
            </ViroPortalScene>
          )}
        </>
      )}
    </ViroARScene>
  );
}
