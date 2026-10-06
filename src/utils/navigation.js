// Where a visitor lands and which way they face — pure functions, ported
// from the web app's src/utils/navigation.js so both apps agree.
//
// Facing, as the web app does it:
//   walk (hotspot tap, next directions step) — keep facing the way you
//        walked (see walkEntryView).
//   jump (search result, room, building pick, first landing) — the
//        destination's own starting view if set, else dead ahead.

// Deterministic "where do we start", as web's pickDefaultNode: the Main
// Campus entrance (the node an admin flagged campusEntrance, shared across
// GD1/GD2/GD3) wins outright when one exists, since that's the single front
// door visitors should land at. Otherwise prefer an entrance, in building
// order (GD1, GD2, GD3, then any admin-added buildings), lowest floor first.
// Falls back to the first node at all if no entrances are tagged.
// `buildings` is the building list (utils/buildingStore.js) in display order.
export function pickDefaultNode(nodes, buildings) {
  if (!nodes || nodes.length === 0) return null;
  const campusOf = (buildingId) => buildings.find((b) => b.id === buildingId)?.campusId ?? buildingId;
  const mainEntrance = nodes.find((n) => n.campusEntrance && campusOf(n.building) === "main");
  if (mainEntrance) return mainEntrance;
  const entrances = nodes.filter((n) => n.type === "entrance");
  if (entrances.length === 0) return nodes[0];
  const order = buildings.map((b) => b.id);
  return [...entrances].sort((a, b) => {
    const ai = order.indexOf(a.building);
    const bi = order.indexOf(b.building);
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

// Every floor with at least one node in a building, low to high: the
// Building sheet's floor buttons (web: the Compact layout's Building dialog).
export function floorsForBuilding(nodes, buildingId) {
  if (!nodes) return [];
  return [...new Set(nodes.filter((n) => n.building === buildingId).map((n) => Number(n.floor)))].sort(
    (a, b) => a - b
  );
}

// A building's entrance shortcuts: whichever node an admin flagged as that
// building's own Building entrance, and whichever node is the Campus
// entrance for the campus it belongs to (which may be a different
// GD1/GD2/GD3 building, see campusForBuilding). When both are the very same
// node, it's offered once, as the campus entrance (the broader label covers
// the narrower one). `campusForBuilding` is buildingStore's campusOf.
export function findKioskEntranceShortcuts(nodes, buildingId, campusForBuilding) {
  if (!nodes || !buildingId) return [];
  const buildingEntrance = nodes.find((n) => n.building === buildingId && n.buildingEntrance);
  const campusEntrance = nodes.find(
    (n) => n.campusEntrance && campusForBuilding(n.building) === campusForBuilding(buildingId)
  );
  if (buildingEntrance && campusEntrance && buildingEntrance.id === campusEntrance.id) {
    return [{ key: "campus", label: "Campus Entrance", nodeId: campusEntrance.id }];
  }
  const shortcuts = [];
  if (buildingEntrance) shortcuts.push({ key: "building", label: "Building Entrance", nodeId: buildingEntrance.id });
  if (campusEntrance) shortcuts.push({ key: "campus", label: "Campus Entrance", nodeId: campusEntrance.id });
  return shortcuts;
}

// The one node an admin flagged as the shared entrance for the whole Main
// Campus cluster: the Building sheet's top shortcut.
export function findMainCampusEntrance(nodes, campusForBuilding) {
  return (nodes || []).find((n) => n.campusEntrance && campusForBuilding(n.building) === "main") || null;
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

// One campus has one position on the map: every building in it answers with
// the coordinates of the first building of that campus that has any, so a
// building whose own coordinates drifted (or were never set) cannot split a
// campus in two. Same rule as web's campusPosition.
function campusPosition(building, buildings) {
  const campus = building.campusId ?? building.id;
  const anchor = buildings.find((b) => (b.campusId ?? b.id) === campus && b.lat != null && b.lng != null);
  return { campus, lat: anchor?.lat, lng: anchor?.lng };
}

// The cross-campus flyover for a move between two nodes (see
// components/FlyoverPanel.js), or null when it isn't one: the two ends must
// be in different campuses, both with real coordinates, and those must
// differ. Moves inside one campus (GD1/GD2/GD3) never fly, whatever their
// buildings' own coordinates say. Same rule as web's findFlyover.
export function findFlyover(fromNode, toNode, buildings) {
  if (!fromNode || !toNode) return null;
  const from = buildings.find((b) => b.id === fromNode.building);
  const to = buildings.find((b) => b.id === toNode.building);
  if (!from || !to) return null;
  const a = campusPosition(from, buildings);
  const b = campusPosition(to, buildings);
  if (a.campus === b.campus) return null;
  if (a.lat == null || b.lat == null) return null;
  if (a.lat === b.lat && a.lng === b.lng) return null;
  return {
    fromLat: a.lat,
    fromLng: a.lng,
    fromLabel: from.label || fromNode.building,
    toLat: b.lat,
    toLng: b.lng,
    toLabel: to.label || toNode.building,
  };
}
