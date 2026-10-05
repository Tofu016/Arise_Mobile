import { EMERGENCY_EXIT_MARKER, floorLabel } from "./constants";

// Ported from the web app's src/utils/emergencyExits.js (the visitor-facing
// half). A fire exit node is any node carrying an emergency exit marker: the
// marker sits where a fire stairwell door is in the panorama and lists the
// landing nodes the hidden stairs come out at (`landings`, node ids). Landings
// are directed and used only by Nearest Exit; ordinary directions walk neighbor
// links and never take them. A marker with no landings is a fire door to the
// street, whose node is ticked as an Emergency Exit Destination Point.

export function emergencyExitMarkers(node) {
  return (node?.markers || []).filter((m) => m.type === EMERGENCY_EXIT_MARKER);
}

export function isFireExitNode(node) {
  return emergencyExitMarkers(node).length > 0;
}

// fromId -> [{ toId, markerId }]. A landing naming a missing node, the node
// itself, or a target two markers both list is skipped or counted once.
export function exitLandingEdges(nodes) {
  const ids = new Set(nodes.map((n) => n.id));
  const edges = new Map();
  for (const node of nodes) {
    const seen = new Set();
    for (const marker of emergencyExitMarkers(node)) {
      for (const toId of marker.landings || []) {
        if (toId === node.id || !ids.has(toId) || seen.has(toId)) continue;
        seen.add(toId);
        if (!edges.has(node.id)) edges.set(node.id, []);
        edges.get(node.id).push({ toId, markerId: marker.id });
      }
    }
  }
  return edges;
}

// If moving fromId -> toId is a trip down the hidden fire stairs, the marker to
// use at each end (`fromMarker` lists toId; `toMarker` is the landing node's own
// door, if it has one); otherwise null.
export function fireStairsBetween(nodes, fromId, toId) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const from = byId[fromId];
  const to = byId[toId];
  if (!from || !to || (from.neighbors || []).includes(toId)) return null;
  const fromMarker = emergencyExitMarkers(from).find((m) => (m.landings || []).includes(toId));
  if (!fromMarker) return null;
  return { fromMarker, toMarker: emergencyExitMarkers(to)[0] || null, toFloor: Number(to.floor) };
}

// Stepping out of the stairwell: face away from the landing's own door.
export function arrivalYawFromExit(marker) {
  return ((Number(marker.yaw) || 0) + 180) % 360;
}

// The wording for a step down (or up) the hidden fire stairs. `step` is
// { floor, goesDown }.
export function fireStairsAction(step) {
  return `Take Emergency Exit stairs ${step.goesDown ? "down" : "up"} to ${floorLabel(step.floor)}`;
}
