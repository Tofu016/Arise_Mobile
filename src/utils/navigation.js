// Where a visitor lands and which way they face — pure functions, ported
// from the web app's src/utils/navigation.js so both apps agree.
//
// Facing, as the web app does it:
//   walk (hotspot tap, next directions step) — the link's own default
//        arrival view if an admin set one, else the way the arrow pointed.
//   jump (search result, room, building pick, first landing) — the
//        destination's own starting view if set, else dead ahead.

// Deterministic "where do we start": prefer an entrance, in building order
// (GD1, GD2, GD3, then any admin-added buildings), lowest floor first.
// Falls back to the first node at all if no entrances are tagged.
export function pickDefaultNode(nodes, buildingOrder) {
  if (!nodes || nodes.length === 0) return null;
  const entrances = nodes.filter((n) => n.type === "entrance");
  if (entrances.length === 0) return nodes[0];
  return [...entrances].sort((a, b) => {
    const ai = buildingOrder.indexOf(a.building);
    const bi = buildingOrder.indexOf(b.building);
    if (ai !== bi) return ai - bi;
    return (a.floor ?? 0) - (b.floor ?? 0);
  })[0];
}

// A building's lowest-floor entrance.
export function pickDefaultEntranceForBuilding(nodes, buildingId) {
  if (!nodes) return null;
  const inBuilding = nodes.filter((n) => n.type === "entrance" && n.building === buildingId);
  if (inBuilding.length === 0) return null;
  return [...inBuilding].sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))[0];
}

// Where a visitor lands on one floor: the node an admin flagged as that
// floor's starting node, else the floor's first entrance, else its first
// node. Null if the floor has no nodes.
export function pickFloorStart(nodes, buildingId, floor) {
  if (!nodes) return null;
  const onFloor = nodes.filter((n) => n.building === buildingId && Number(n.floor) === Number(floor));
  return onFloor.find((n) => n.startingNode) || onFloor.find((n) => n.type === "entrance") || onFloor[0] || null;
}

// Where picking a whole building lands: the start of its lowest floor
// above ground that has nodes; failing that (only underground nodes), its
// default entrance or any node.
export function pickBuildingStart(nodes, buildingId) {
  if (!nodes) return null;
  const floors = [...new Set(nodes.filter((n) => n.building === buildingId).map((n) => Number(n.floor)))];
  const firstFloor = floors.filter((f) => f > 0).sort((a, b) => a - b)[0];
  if (firstFloor !== undefined) return pickFloorStart(nodes, buildingId, firstFloor);
  return pickDefaultEntranceForBuilding(nodes, buildingId) || nodes.find((n) => n.building === buildingId) || null;
}

// The view to open facing after walking along a hotspot link.
export function walkEntryView(hotspot) {
  return {
    yaw: hotspot?.defaultYaw ?? hotspot?.yaw ?? 0,
    pitch: hotspot?.defaultPitch ?? 0,
  };
}

// The view to open facing after jumping straight to a node.
export function jumpEntryView(node) {
  return {
    yaw: node?.startingViewYaw ?? 0,
    pitch: node?.startingViewPitch ?? 0,
  };
}
