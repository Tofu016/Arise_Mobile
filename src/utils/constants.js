import { getBuildings } from "./buildingStore";

// Display-only lookups. Data itself (buildings, nodes, rooms) comes from
// Arise_API; what's here is how the app presents it — the same choices the
// web app makes in its own constants.js.

// GD1, GD2, GD3 lead every building list (and decide where the tour
// starts), then any other building in the API's own (alphabetical) order.
// Known even before the building list has loaded, so the first landing
// doesn't depend on which request finishes first.
const PREFERRED_ORDER = ["gd1", "gd2", "gd3"];

function orderRank(buildingId) {
  const i = PREFERRED_ORDER.indexOf(buildingId);
  return i === -1 ? PREFERRED_ORDER.length : i;
}

export function allBuildings() {
  return [...getBuildings()].sort((a, b) => orderRank(a.id) - orderRank(b.id));
}

// Building ids in display order, for ranking (see utils/navigation.js).
export function buildingOrder() {
  const rest = allBuildings().map((b) => b.id).filter((id) => !PREFERRED_ORDER.includes(id));
  return [...PREFERRED_ORDER, ...rest];
}

// Falls back to the id upper-cased ("gd1" -> "GD1") until the list loads.
export function buildingLabel(buildingId) {
  return getBuildings().find((b) => b.id === buildingId)?.label || String(buildingId).toUpperCase();
}

export function floorLabel(floor) {
  return floor === -1 ? "UG" : `Floor ${floor}`;
}

// Nearest Exit routing (utils/evacuation.js), ported from the web app's
// constants.js so both apps send a visitor the same way. A fire exit is not a
// node type: a node is a fire exit node when it carries an emergency exit
// marker (utils/emergencyExits.js).
export const STAIRS_TYPE = "stairs";
// Floor 1 is the ground floor in every building, Underground (-1) lies below.
export const GROUND_FLOOR = 1;
// The node types an admin can tick as an Emergency Exit Destination Point, plus
// any node carrying an emergency exit marker (a fire door to the street).
export const EMERGENCY_DESTINATION_TYPES = ["open_area", "parking", "lobby", "entrance"];
// How much a Nearest Exit route favors a protected fire stairwell over an
// ordinary staircase, in extra hops of walking it will accept to reach one.
// It is added to the cost of each flight of ordinary stairs (a floor change
// through a Stairs node), so a fire exit within about this many hops further
// than an ordinary staircase still wins, and a farther one loses. Distance is
// hops between panoramas, not meters. 0 treats them alike. Must equal the
// web app's value, or the two apps send a visitor different ways out.
export const FIRE_STAIRS_PREFERENCE = 5;

// Shown whenever the Nearest Exit route is on screen, so a visitor who gets
// stuck (no route, blocked way, no way down) always has someone to call.
// Same list as the web app's.
export const EMERGENCY_CONTACTS = [
  { label: "Bacoor City Priority Emergency Hotline", number: "161 or (046) 417-0207" },
  { label: "Bureau of Fire Protection (BFP) Bacoor", number: "(046) 417-6060" },
  { label: "Bacoor CDRRMO (Rescue)", number: "(046) 417-0727" },
  { label: "Bacoor Police (PNP)", number: "(046) 417-6366" },
];
export const EMERGENCY_EXIT_MARKER = "emergency_exit";

// Point-of-interest markers placed *within* a panorama at a fixed yaw/pitch —
// distinct from hotspots (which navigate to a different node). "elevator"
// is the one interactive kind: tapping a landing rides to another floor
// (see utils/elevators.js). Same colours as the web app (Arise_Web
// constants.js). Web's icons are still a "?" placeholder, so `glyph` is a
// Material Community Icons name drawn in white on the coloured dot.
export const MARKER_TYPES = [
  { id: "room", label: "Room", glyph: "door", color: "#2f6db0" },
  { id: "facility", label: "Facility", glyph: "map-marker", color: "#2e7d46" },
  { id: "emergency_exit", label: "Emergency Exit", glyph: "exit-run", color: "#c62a2c" },
  { id: "fire_extinguisher", label: "Fire Extinguisher", glyph: "fire-extinguisher", color: "#b5701c" },
  { id: "elevator", label: "Elevator", glyph: "elevator-passenger", color: "#5b3fa0" },
];

export function markerTypeInfo(typeId) {
  return MARKER_TYPES.find((t) => t.id === typeId) || MARKER_TYPES[1];
}

// Where a hotspot arrow sits when an admin hasn't placed it yet: spread
// evenly around the horizon. Same fallback as the web app's.
export function defaultHotspotAngle(index, total) {
  const yaw = total > 0 ? (360 / total) * index : 0;
  return { yaw, pitch: -10 };
}
