import { elevatorAdjacency } from "./elevators";

// Ported from the web app's src/utils/pathfinding.js so both apps route
// the same way.

// Fire exits (transitionExit) are for emergencies only, so ordinary routing
// never passes THROUGH one. It can still start or end on one: a visitor
// standing at a fire exit has to be able to route away from it.
const EMERGENCY_ONLY_TYPES = ["transitionExit"];

// A neighbor edge that changes floor through a Stairs (transition) node —
// the only signal for "this edge is a stairs edge", since node_neighbors
// has no traversal-kind column.
function isStairsEdge(byId, a, b) {
  const nodeA = byId[a];
  const nodeB = byId[b];
  if (!nodeA || !nodeB || nodeA.floor === nodeB.floor) return false;
  return nodeA.type === "transition" || nodeB.type === "transition";
}

// Shortest path over the walkable graph (hotspot links) plus elevator
// rides, restricted by how a floor change may happen:
//   "any"      links plus elevator rides — the default
//   "stairs"   links only; never rides an elevator
//   "elevator" links MINUS floor changes through a Stairs node, PLUS
//              elevator rides, so floors only change by elevator
// Same-floor links are never excluded by mode. In every mode, fire exits
// are never passed through.
export function findPath(nodes, fromId, toId, mode = "any") {
  if (!fromId || !toId) return null;
  if (fromId === toId) return [fromId];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  if (!byId[fromId] || !byId[toId]) return null;

  const elevatorAdj = mode === "stairs" ? null : elevatorAdjacency(nodes);
  const emergencyOnly = (id) => id !== toId && EMERGENCY_ONLY_TYPES.includes(byId[id]?.type);

  const edgesFrom = (id) => {
    const walkable = (byId[id]?.neighbors || []).filter((nb) => {
      if (emergencyOnly(nb)) return false;
      if (mode !== "elevator") return true;
      return !isStairsEdge(byId, id, nb);
    });
    const viaElevator = elevatorAdj ? [...(elevatorAdj.get(id) || [])] : [];
    return mode === "stairs" ? walkable : [...new Set([...walkable, ...viaElevator])];
  };

  const visited = new Set([fromId]);
  const queue = [[fromId]];

  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const nb of edgesFrom(last)) {
      if (visited.has(nb)) continue;
      const nextPath = [...path, nb];
      if (nb === toId) return nextPath;
      visited.add(nb);
      queue.push(nextPath);
    }
  }
  return null; // no route between these two nodes under this mode
}
