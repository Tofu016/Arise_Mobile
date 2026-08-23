// Shortest path over the same unweighted neighbors graph the hotspot
// navigation already walks — a route through this graph is guaranteed to be
// walkable node-by-node, since it's the exact adjacency list hotspots use.
export function findPath(nodes, fromId, toId) {
  if (!fromId || !toId) return null;
  if (fromId === toId) return [fromId];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  if (!byId[fromId] || !byId[toId]) return null;

  const visited = new Set([fromId]);
  const queue = [[fromId]];

  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    const neighbors = byId[last]?.neighbors || [];
    for (const nb of neighbors) {
      if (visited.has(nb)) continue;
      const nextPath = [...path, nb];
      if (nb === toId) return nextPath;
      visited.add(nb);
      queue.push(nextPath);
    }
  }
  return null; // no walkable route between these two nodes
}
