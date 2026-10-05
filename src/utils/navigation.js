// Where a visitor lands and which way they face — pure functions, ported
// from the web app's src/utils/navigation.js so both apps agree.
//
// Facing, as the web app does it:
//   walk (hotspot tap, next directions step) — keep facing the way you
//        walked (see walkEntryView).
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

// The view to open facing after walking along a hotspot link: keep facing
// the way you were walking.
//
// The panoramas don't share a common north (only ~40% of two-way links
// point back at each other's opposite angle), so an angle from one photo
// means nothing in the next — reusing the arrow's yaw, or the camera's,
// landed some walks facing backwards. Precedence, first match wins (same
// chain as the web app's src/utils/arrivalView.js, see its
// docs/arrival-view.md; keep the two in step):
//   1. the link's own default view (an admin's manual override)
//   2. away from the arrival photo's own RETURN arrow (its hotspot back to
//      where you came from), pitch level
//   3. the clicked arrow's own yaw
//   hotspot     — the link walked, from the node being left
//   arrivalNode — the node arrived at
//   fromId      — the node being left (the stop just before arrival)
export function walkEntryView(hotspot, arrivalNode, fromId) {
  if (Number.isFinite(hotspot?.defaultYaw)) {
    return { yaw: hotspot.defaultYaw, pitch: hotspot.defaultPitch ?? 0 };
  }
  const back = fromId == null ? null : arrivalNode?.hotspots?.[fromId];
  if (back && Number.isFinite(back.yaw)) {
    return { yaw: (back.yaw + 180) % 360, pitch: 0 };
  }
  return { yaw: hotspot?.yaw ?? 0, pitch: 0 };
}

// The view to open facing after jumping straight to a node.
export function jumpEntryView(node) {
  return {
    yaw: node?.startingViewYaw ?? 0,
    pitch: node?.startingViewPitch ?? 0,
  };
}

// The cross-campus flyover for a move between two nodes (see
// components/FlyoverPanel.js), or null when it isn't one: both buildings
// need a location, and the locations must differ. Same rule as web's
// findFlyover.
export function findFlyover(fromNode, toNode, buildings) {
  if (!fromNode || !toNode) return null;
  const from = buildings.find((b) => b.id === fromNode.building);
  const to = buildings.find((b) => b.id === toNode.building);
  if (from?.lat == null || to?.lat == null) return null;
  if (from.lat === to.lat && from.lng === to.lng) return null;
  return {
    fromLat: from.lat,
    fromLng: from.lng,
    fromLabel: from.label || fromNode.building,
    toLat: to.lat,
    toLng: to.lng,
    toLabel: to.label || toNode.building,
  };
}
