// Elevators, ported from the web app's src/utils/elevators.js (the
// visitor-facing half; the admin validation stays on web).
//
// An elevator is one `elevators` row (label, building, accessibleFloors —
// the floors the car actually stops at) plus one landing marker per floor,
// placed on the node where that floor's elevator doors are. Nodes_API
// joins the elevator's label and floors onto every landing marker, so two
// landings of the same elevator can never disagree.
//
// Landings of the same elevator are connected to each other for routing
// (see pathfinding.js), and tapping one in the viewer rides to another.

// elevatorId -> every landing of it, as { nodeId, floor, marker }.
export function landingsByElevator(nodes) {
  const groups = new Map();
  for (const node of nodes || []) {
    for (const marker of node.markers || []) {
      if (marker.type !== "elevator" || !marker.elevatorId) continue;
      if (!groups.has(marker.elevatorId)) groups.set(marker.elevatorId, []);
      groups.get(marker.elevatorId).push({ nodeId: node.id, floor: Number(node.floor), marker });
    }
  }
  return groups;
}

// Every pair of landings of the same elevator, both on floors it serves.
export function elevatorEdges(nodes) {
  const edges = [];
  for (const [elevatorId, landings] of landingsByElevator(nodes)) {
    const served = landings.filter((l) => l.marker.accessibleFloors.includes(l.floor));
    for (let i = 0; i < served.length; i++) {
      for (let j = i + 1; j < served.length; j++) {
        if (served[i].nodeId === served[j].nodeId || served[i].floor === served[j].floor) continue;
        edges.push({ a: served[i].nodeId, b: served[j].nodeId, elevatorId });
      }
    }
  }
  return edges;
}

// nodeId -> Set of node ids reachable by one elevator ride.
export function elevatorAdjacency(nodes) {
  const adjacency = new Map();
  for (const { a, b } of elevatorEdges(nodes)) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }
  return adjacency;
}

// The landings reachable by riding elevator `elevatorId` from `nodeId`,
// lowest floor first: [{ node, floor, marker }]. `marker` is the landing
// marker on the destination node.
export function elevatorDestinationsFrom(nodes, nodeId, elevatorId) {
  const byId = Object.fromEntries((nodes || []).map((n) => [n.id, n]));
  const landings = landingsByElevator(nodes).get(elevatorId) || [];
  if (!landings.some((l) => l.nodeId === nodeId)) return [];
  return elevatorEdges(nodes)
    .filter((e) => e.elevatorId === elevatorId && (e.a === nodeId || e.b === nodeId))
    .map((e) => (e.a === nodeId ? e.b : e.a))
    .map((id) => landings.find((l) => l.nodeId === id))
    .filter((l) => l && byId[l.nodeId])
    .map((l) => ({ node: byId[l.nodeId], floor: l.floor, marker: l.marker }))
    .sort((a, b) => a.floor - b.floor);
}

// If moving fromId -> toId is an elevator ride, the landing marker to use
// on each end; otherwise null. Turns a route step into "take the elevator"
// instead of "walk through this hotspot".
export function elevatorRideBetween(nodes, fromId, toId) {
  const edge = elevatorEdges(nodes).find(
    (e) => (e.a === fromId && e.b === toId) || (e.a === toId && e.b === fromId)
  );
  if (!edge) return null;
  const landings = landingsByElevator(nodes).get(edge.elevatorId);
  const from = landings.find((l) => l.nodeId === fromId);
  const to = landings.find((l) => l.nodeId === toId);
  return { elevatorId: edge.elevatorId, fromMarker: from.marker, toMarker: to.marker, toFloor: to.floor };
}

// Stepping out of the car: arrive facing away from the destination
// landing's doors (its marker), toward the floor itself.
export function arrivalYawFromLanding(marker) {
  return ((Number(marker.yaw) || 0) + 180) % 360;
}
