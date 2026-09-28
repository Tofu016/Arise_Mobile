// The geometry behind the panorama viewer, ported from Arise_Web's
// utils/panoramaMath.js so hotspots and markers size and behave the same on
// both. Yaw/pitch are degrees: yaw 0 points along -Z and increases
// clockwise seen from above; pitch is up/down from the horizon.

export const MARKER_RADIUS = 480; // just inside the 500-radius panorama sphere, so arrows sit in front of the image

// Where a hotspot/marker at (yaw, pitch) sits in the scene.
export function toPosition(yaw, pitch, radius = MARKER_RADIUS) {
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  return [
    radius * Math.sin(yawRad) * Math.cos(pitchRad),
    radius * Math.sin(pitchRad),
    -radius * Math.cos(yawRad) * Math.cos(pitchRad),
  ];
}

// Web's FOV rule (a constant horizontal view), used here only to reproduce
// its reference scale below.
const TARGET_HORIZONTAL_FOV = 100;
const MIN_FOV = 60;
const MAX_FOV = 180;

function computeFov(width, height) {
  const aspect = width / height;
  const targetHorizontalRad = (TARGET_HORIZONTAL_FOV * Math.PI) / 180;
  const verticalDeg = ((2 * Math.atan(Math.tan(targetHorizontalRad / 2) / aspect)) * 180) / Math.PI;
  return Math.min(MAX_FOV, Math.max(MIN_FOV, verticalDeg));
}

// Hotspots are sized in scene units, so on screen they'd follow the FOV and
// canvas height; this factor keeps them the same apparent size relative to
// the screen's shorter side, normalised so a 1920x1080 desktop is exactly 1
// (the size web tuned them at).
const OVERLAY_REF_HEIGHT = 1080;
const OVERLAY_REF_PX_PER_UNIT = OVERLAY_REF_HEIGHT / 2 / Math.tan(((computeFov(1920, 1080) * Math.PI) / 180) / 2);

export function overlayScale(width, height, fov) {
  if (!width || !height || !fov) return 1;
  const pxPerUnit = height / 2 / Math.tan(((fov * Math.PI) / 180) / 2);
  return (Math.min(width, height) / OVERLAY_REF_HEIGHT) * (OVERLAY_REF_PX_PER_UNIT / pxPerUnit);
}

// Pinch zoom — web's kiosk zoom: `zoom` multiplies the apparent magnification
// (1 = the normal view, >1 zoomed in, <1 zoomed out). Applied to the
// vertical FOV through its tangent, which is what magnification actually
// scales, and clamped so zooming out stops short of fisheye.
export const MIN_ZOOM = 0.7;
export const MAX_ZOOM = 3;
const ZOOMED_MIN_FOV = 20;
const ZOOMED_MAX_FOV = 165;

export function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function zoomedFov(baseFov, zoom) {
  const halfRad = (baseFov * Math.PI) / 360;
  const fov = (2 * Math.atan(Math.tan(halfRad) / clampZoom(zoom)) * 180) / Math.PI;
  return Math.min(ZOOMED_MAX_FOV, Math.max(ZOOMED_MIN_FOV, fov));
}

// Markers (HTML overlays on web) scale with the screen's shorter side alone.
export function markerScale(width, height) {
  return Math.min(1.5, Math.max(0.75, Math.min(width, height) / 1080));
}

// A hotspot counts as "facing" the visitor (its preview may show) while the
// cosine of the angle between the view direction and the hotspot is above
// this: cos(~78°), generous, so a card near the screen edge still shows.
export const FACING_DOT = 0.2;

export function isFacing(lookDot) {
  return lookDot > FACING_DOT;
}

// The sneak-peek card scales with how directly the visitor looks at its
// hotspot: full size straight on, shrinking linearly to PREVIEW_MIN_SCALE
// once the hotspot is PREVIEW_FALLOFF_DEG away from the view direction.
export const PREVIEW_MAX_SCALE = 1.0;
export const PREVIEW_MIN_SCALE = 0.38;
export const PREVIEW_FALLOFF_DEG = 75;

export function previewScale(lookDot) {
  const angleDeg = (Math.acos(Math.min(1, Math.max(-1, lookDot))) * 180) / Math.PI;
  const t = Math.min(1, angleDeg / PREVIEW_FALLOFF_DEG);
  return PREVIEW_MAX_SCALE + (PREVIEW_MIN_SCALE - PREVIEW_MAX_SCALE) * t;
}
