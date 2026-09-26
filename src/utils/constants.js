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

// Point-of-interest markers placed *within* a panorama at a fixed yaw/pitch —
// distinct from hotspots (which navigate to a different node). "elevator"
// is the one interactive kind: tapping a landing rides to another floor
// (see utils/elevators.js). Same icons/colors as the web app.
export const MARKER_TYPES = [
  { id: "room", label: "Room", icon: "🚪", color: "#4a9eff" },
  { id: "facility", label: "Facility", icon: "📍", color: "#4affa0" },
  { id: "exit", label: "Emergency Exit", icon: "🚨", color: "#ff4a4a" },
  { id: "hydrant", label: "Fire Hydrant / Extinguisher", icon: "🧯", color: "#ff9a3d" },
  { id: "elevator", label: "Elevator", icon: "🛗", color: "#5b3fa0" },
];

export function markerTypeInfo(typeId) {
  return MARKER_TYPES.find((t) => t.id === typeId) || MARKER_TYPES[1];
}
