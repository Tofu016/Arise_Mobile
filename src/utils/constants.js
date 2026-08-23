import { getCustomBuildings } from "./buildingStore";

// Ported unchanged from the web app — pure data + helper functions, nothing
// DOM-specific in here at all.

export const BUILDINGS = [
  { id: "gd1", label: "GD1" },
  { id: "gd2", label: "GD2" },
  { id: "gd3", label: "GD3" },
];

// Matches the actual Unity node-name vocabulary from the source model.
export const NODE_TYPES = [
  { id: "hallway", label: "Hallway", color: "#4a9eff" },
  { id: "lobby", label: "Lobby", color: "#ffb84a" },
  { id: "entrance", label: "Entrance", color: "#4aff8f" },
  { id: "transition", label: "Transition (main stairs)", color: "#c04aff" },
  { id: "transitionExit", label: "Transition Exit (fire stairs)", color: "#ff4a4a" },
  { id: "openArea", label: "Open Area (parking)", color: "#8f8f8f" },
  { id: "portal", label: "Portal (GD2 \u2194 GD3)", color: "#ffe14a" },
];

export const TRANSITION_TYPES = ["transition", "transitionExit"];

// Point-of-interest markers placed *within* a panorama at a fixed yaw/pitch —
// distinct from hotspots (which navigate to a different node).
export const MARKER_TYPES = [
  { id: "room", label: "Room", icon: "🚪", color: "#4a9eff" },
  { id: "facility", label: "Facility", icon: "📍", color: "#4affa0" },
  { id: "exit", label: "Emergency Exit", icon: "🚨", color: "#ff4a4a" },
  { id: "hydrant", label: "Fire Hydrant / Extinguisher", icon: "🧯", color: "#ff9a3d" },
];

export function markerTypeInfo(typeId) {
  return MARKER_TYPES.find((t) => t.id === typeId) || MARKER_TYPES[1];
}

// Verified directly from the exported Main_Campus_Parent.glb hierarchy —
// each building has a different real floor count, not a shared generic list.
export const BUILDING_FLOORS = {
  gd1: [-1, 1, 2, 3, 4, 5, 6, 7, 8],   // UG + Ground..8th
  gd2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // Ground..10th (no UG)
  gd3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Ground..11th (no UG)
};

// Union of every floor across all buildings — used when no single building is selected.
export const FLOORS = [...new Set(Object.values(BUILDING_FLOORS).flat())].sort((a, b) => a - b);

// Built-in buildings (verified from the GLB) plus any admin-created ones from
// buildingStore. Everything below reads through this instead of the raw
// BUILDINGS/BUILDING_FLOORS constants so admin-created buildings show up
// everywhere a building list is used.
export function allBuildings() {
  return [...BUILDINGS, ...getCustomBuildings()];
}

export function allBuildingIds() {
  return allBuildings().map((b) => b.id);
}

export function allFloors() {
  const customFloors = getCustomBuildings().flatMap((b) => b.floors);
  return [...new Set([...FLOORS, ...customFloors])].sort((a, b) => a - b);
}

export function floorsForBuilding(buildingId) {
  if (BUILDING_FLOORS[buildingId]) return BUILDING_FLOORS[buildingId];
  const custom = getCustomBuildings().find((b) => b.id === buildingId);
  if (custom) return custom.floors;
  return allFloors();
}

export function floorLabel(floor) {
  return floor === -1 ? "UG" : `Floor ${floor}`;
}

export function typeColor(typeId) {
  return NODE_TYPES.find((t) => t.id === typeId)?.color || "#ffffff";
}

export function typeLabel(typeId) {
  return NODE_TYPES.find((t) => t.id === typeId)?.label || typeId;
}

export function buildingLabel(buildingId) {
  return allBuildings().find((b) => b.id === buildingId)?.label || buildingId;
}

export function suggestedPhotoFilename(id) {
  return id ? `${id}.jpg` : "";
}

// camelCase type ids (transitionExit, openArea) become snake_case for
// readability inside a generated ID.
function typeToIdSlug(typeId) {
  return typeId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export function suggestNodeId(building, floor, type, nodes, excludeId = null) {
  const prefix = `${building}_f${floor}_${typeToIdSlug(type)}`;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const used = new Set();
  for (const n of nodes) {
    if (n.id === excludeId) continue;
    const match = n.id.match(pattern);
    if (match) used.add(Number(match[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

// Evenly spaces hotspot arrows around the horizon for any neighbor that
// hasn't been manually positioned yet.
export function defaultHotspotAngle(index, total) {
  const yaw = total > 0 ? (360 / total) * index : 0;
  return { yaw, pitch: -10 };
}
