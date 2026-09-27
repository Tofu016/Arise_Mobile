import * as THREE from "three";

// Gyro look-around for the panorama viewer: which way the phone's back is
// pointing, as the viewer's yaw/pitch.
//
// expo-sensors is loaded defensively: it has native code, so an app build
// made before it was added doesn't contain it, and importing it there
// throws. In that case DeviceMotion is null and the gyro button stays
// hidden, rather than the app crashing.
let DeviceMotion = null;
try {
  DeviceMotion = require("expo-sensors").DeviceMotion;
} catch {
  DeviceMotion = null;
}
export { DeviceMotion };

export async function isGyroAvailable() {
  if (!DeviceMotion) return false;
  try {
    return await DeviceMotion.isAvailableAsync();
  } catch {
    return false;
  }
}

// DeviceMotion's `rotation` is the W3C device orientation (alpha, beta,
// gamma, in radians), so the standard conversion applies — the one in
// three.js's DeviceOrientationControls: Euler (beta, alpha, -gamma) in YXZ
// order, then a -90° turn about X so the camera looks out of the back of
// the phone rather than down through its screen. The app is portrait-only,
// so there's no screen-rotation term.
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();
const backOfPhone = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const forward = new THREE.Vector3();

// { yaw, pitch } in degrees, in the viewer's convention (camera rotation
// about Y and X, see PanoramaViewer's CameraRig).
export function deviceLook({ alpha, beta, gamma }) {
  euler.set(beta, alpha, -gamma, "YXZ");
  quaternion.setFromEuler(euler).multiply(backOfPhone);
  forward.set(0, 0, -1).applyQuaternion(quaternion);
  return {
    yaw: THREE.MathUtils.radToDeg(Math.atan2(-forward.x, -forward.z)),
    pitch: THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, forward.y)))),
  };
}

// The shortest signed difference between two angles in degrees (-180..180],
// so smoothing never swings the long way round past ±180.
export function angleDelta(to, from) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}
