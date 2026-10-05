import { elevatorAdjacency } from "./elevators";

// Ported from the web app's src/utils/pathfinding.js so both apps route
// the same way.

// A fire exit node (one carrying an emergency exit marker) is an ordinary
// node here, often a hallway, and is walked through like any other. The
// hidden fire stairs its marker lists as landings are not neighbor links, so
// nothing in this file ever takes them: only Nearest Exit does (evacuation.js).

// A neighbor edge that changes floor through a Stairs (stairs) node —
// the only signal for "this edge is a stairs edge", since node_neighbors
// has no traversal-kind column.
function isStairsEdge(byId, a, b) {
  const nodeA = byId[a];
  const nodeB = byId[b];
  if (!nodeA || !nodeB || nodeA.floor === nodeB.floor) return false;
  return nodeA.type === "stairs" || nodeB.type === "stairs";
}

// Shortest path over the walkable graph (hotspot links) plus elevator
// rides, restricted by how a floor change may happen:
//   "any"      links plus elevator rides — the default
//   "stairs"   links only; never rides an elevator
//   "elevator" links MINUS floor changes through a Stairs node, PLUS
//              elevator rides, so floors only change by elevator
// Same-floor links are never excluded by mode. In every mode, fire stairs
// landings are never used.
export function findPath(nodes, fromId, toId, mode = "any") {
  if (!fromId || !toId) return null;
  if (fromId === toId) return [fromId];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  if (!byId[fromId] || !byId[toId]) return null;

  const elevatorAdj = mode === "stairs" ? null : elevatorAdjacency(nodes);
  const edgesFrom = (id) => {
    const walkable = (byId[id]?.neighbors || []).filter((nb) => mode !== "elevator" || !isStairsEdge(byId, id, nb));
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
