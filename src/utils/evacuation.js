import {
  BUILDING_TRANSITION_TYPE,
  EMERGENCY_DESTINATION_TYPES,
  FIRE_STAIRS_PREFERENCE,
  GROUND_FLOOR,
  STAIRS_TYPE,
} from "./constants";
import { exitLandingEdges, isFireExitNode } from "./emergencyExits";

// "Nearest Exit" routing, ported from the web app's src/utils/evacuation.js
// so both apps lead a visitor the same way (the web file is the reference:
// see its comments for the reasoning behind each rule). In short:
//   - the goal is an Emergency Exit Destination Point an admin ticked
//     (`isEmergencyDestination`) on Floor 1 or Underground; nothing is automatic
//   - only neighbor links and emergency exit marker landings (the hidden fire
//     stairs) are walked, so an elevator ride is never part of the route
//   - cost is hop-based: a little for going down a floor, a lot for going up,
//     and a route never rises above the higher of the visitor's floor and
//     Floor 1 unless nothing else exists
//   - fire stairs are favored over an ordinary flight of Stairs by
//     FIRE_STAIRS_PREFERENCE extra hops
const COST_PER_FLOOR_DOWN = 2;
const COST_PER_FLOOR_UP = 8;
const COST_ENTERING_STAIRS = 1;
const COST_ENTERING_BUILDING_TRANSITION = 2;

function floorCost(from, to) {
  const delta = Number(to.floor) - Number(from.floor);
  if (delta < 0) return -delta * COST_PER_FLOOR_DOWN;
  if (delta > 0) return delta * COST_PER_FLOOR_UP;
  return 0;
}

function isStairsFlight(from, to) {
  return Number(from.floor) !== Number(to.floor) && (from.type === STAIRS_TYPE || to.type === STAIRS_TYPE);
}

function entryCost(from, to) {
  let cost = 1 + floorCost(from, to);
  if (isStairsFlight(from, to)) cost += FIRE_STAIRS_PREFERENCE;
  if (to.type === STAIRS_TYPE) cost += COST_ENTERING_STAIRS;
  if (to.type === BUILDING_TRANSITION_TYPE) cost += COST_ENTERING_BUILDING_TRANSITION;
  return cost;
}

// The hidden fire stairs: one hop plus the floors, none of the ordinary Stairs charges.
function landingCost(from, to) {
  return 1 + floorCost(from, to);
}

function canBeDestinationPoint(node) {
  return (EMERGENCY_DESTINATION_TYPES.includes(node.type) || isFireExitNode(node)) && Number(node.floor) <= GROUND_FLOOR;
}

// Smallest-first queue ordered by (cost, id): the id tie-break makes the answer
// identical every time for the same graph.
class MinQueue {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  static before(a, b) {
    return a.cost < b.cost || (a.cost === b.cost && a.id < b.id);
  }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!MinQueue.before(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < items.length && MinQueue.before(items[l], items[smallest])) smallest = l;
        if (r < items.length && MinQueue.before(items[r], items[smallest])) smallest = r;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

function search({ byId, destinations, landings }, fromId, blocked, ceiling) {
  const best = new Map([[fromId, 0]]);
  const previous = new Map();
  const queue = new MinQueue();
  queue.push({ id: fromId, cost: 0 });

  while (queue.size > 0) {
    const { id, cost } = queue.pop();
    if (cost > best.get(id)) continue;
    if (destinations.has(id)) {
      const path = [id];
      while (previous.has(path[0])) path.unshift(previous.get(path[0]));
      return { path, destinationId: id };
    }
    const here = byId[id];
    const steps = [
      ...(here.neighbors || []).map((toId) => ({ toId, price: entryCost })),
      ...(landings.get(id) || []).map(({ toId }) => ({ toId, price: landingCost })),
    ];
    for (const { toId: nbId, price } of steps) {
      const nb = byId[nbId];
      if (!nb || blocked.has(nbId)) continue;
      if (Number(nb.floor) > ceiling) continue;
      const next = cost + price(here, nb);
      if (next < (best.get(nbId) ?? Infinity)) {
        best.set(nbId, next);
        previous.set(nbId, id);
        queue.push({ id: nbId, cost: next });
      }
    }
  }
  return null;
}

// The route to the nearest destination point from `fromId`, or null when there
// is none. `blocked` is a list of node ids the visitor reported impassable.
// Result: { path, destinationId, ascends }; `ascends` means the route rises
// above both the visitor's floor and the ground floor because no way within
// that exists, and the sheet must warn about it.
export function findEvacuationRoute(nodes, fromId, { blocked = [] } = {}) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const ctx = {
    byId,
    destinations: new Set(nodes.filter((n) => n.isEmergencyDestination && canBeDestinationPoint(n)).map((n) => n.id)),
    landings: exitLandingEdges(nodes),
  };
  const blockedSet = new Set(blocked);
  if (!fromId || !byId[fromId]) return null;
  if (ctx.destinations.has(fromId)) return { path: [fromId], destinationId: fromId, ascends: false };
  const ceiling = Math.max(Number(byId[fromId].floor), GROUND_FLOOR);
  for (const limit of [ceiling, Infinity]) {
    const found = search(ctx, fromId, blockedSet, limit);
    if (found) return { ...found, ascends: found.path.some((id) => Number(byId[id].floor) > ceiling) };
  }
  return null;
}
