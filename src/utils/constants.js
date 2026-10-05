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
// Extra hops of walking a route accepts to reach a protected fire stairwell
// instead of an ordinary flight of stairs. Same value as the web app's.
export const FIRE_STAIRS_PREFERENCE = 3;
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
