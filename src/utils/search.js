import { normalize, matchScore, bestScore, isFuzzyScore } from "./fuzzy";

// Ported from the web app's src/utils/search.js (keep in step), so a search
// finds and ranks the same things on both. findRoomForMarker is the one
// deliberate difference: mobile keeps two extra fallback rules (see below).

// How results are grouped, best first. Within a group, a lower match score
// (see fuzzy.js) comes first, then the original order.
const GROUP_EXACT = 0;
const GROUP_PARTIAL = 1;
const GROUP_TEXT = 2;
const GROUP_FUZZY = 3;

function rankBy(items, classify) {
  const ranked = [];
  for (const item of items) {
    const result = classify(item);
    if (result) ranked.push({ item, ...result });
  }
  // Array.prototype.sort is stable, so ties keep their original order.
  ranked.sort((a, b) => a.group - b.group || a.score - b.score);
  return ranked.map((r) => r.item);
}

// Ranks results so an exact room match ("203") always beats a partial one
// ("203" matching "2033"), and a room match always beats a name match, since
// this is primarily meant for "type a room number, get directed there."
// Forgiving about case, spaces and punctuation, and (for letters-only
// queries) about a typo or two; those close-but-not-quite matches come last.
export function searchNodes(query, nodes) {
  const q = normalize(query);
  if (!q) return [];

  return rankBy(nodes, (n) => {
    const roomScore = bestScore(q, n.rooms || []);
    const nameScore = matchScore(q, n.name);
    if (roomScore === 0) return { group: GROUP_EXACT, score: 0 };
    if (roomScore < 30) return { group: GROUP_PARTIAL, score: roomScore };
    if (nameScore < 30) return { group: GROUP_TEXT, score: nameScore };
    const fuzzy = Math.min(roomScore, nameScore);
    if (isFuzzyScore(fuzzy)) return { group: GROUP_FUZZY, score: fuzzy };
    return null;
  }).slice(0, 8);
}

// Ranks room results with the same priority pattern as searchNodes: exact
// room name first, then partial name, then a hit somewhere in the room's
// description/department text (searching "registrar" finds a room whose
// Department is "Registrar's Office"), then the typo-tolerant matches. The
// long description is only ever matched exactly; typos are forgiven in the
// short fields only. `searchableRooms` is [{ roomName, node, placard, kind }],
// see buildSearchableRooms; `placard` may be null.
export function searchRooms(query, searchableRooms) {
  const q = normalize(query);
  if (!q) return [];

  return rankBy(searchableRooms, (r) => {
    const nameScore = matchScore(q, r.roomName);
    if (nameScore === 0) return { group: GROUP_EXACT, score: 0 };
    if (nameScore < 30) return { group: GROUP_PARTIAL, score: nameScore };

    const { roomDescription, department } = r.placard || {};
    const shortText = [department].filter(Boolean);
    const textScore = Math.min(
      bestScore(q, shortText, { fuzzy: false }),
      matchScore(q, roomDescription, { fuzzy: false })
    );
    if (textScore < Infinity) return { group: GROUP_TEXT, score: textScore };

    const fuzzy = Math.min(nameScore, bestScore(q, shortText));
    if (isFuzzyScore(fuzzy)) return { group: GROUP_FUZZY, score: fuzzy };
    return null;
  }).slice(0, 8);
}

// The names a node offers as a given kind of destination: its "Rooms served"
// entries, or the labels of its facility markers. A facility exists only as a
// marker (it is not in "Rooms served"), so its label is its name; blank
// labels are skipped and a label repeated on one node counts once.
export function namesOfKind(node, kind) {
  if (kind === "room") return node.rooms || [];
  const labels = (node.markers || []).filter((m) => m.type === "facility").map((m) => (m.label || "").trim());
  return [...new Set(labels.filter(Boolean))];
}

// Every room and facility in the tour, each matched by name to its details
// record (placard dialog) when it has one: [{ roomName, node, placard, kind }].
// Deduped case-insensitively, at the first node that lists the name. Rooms
// are collected across every node before any facility, so a facility that
// shares a name with a room never shadows it.
// `includeWithoutDetails` keeps names with no record too, with a null placard
// (the room card then says there's no information yet); without it, only
// rooms an admin has gone through Room Edit for are kept.
export function buildSearchableRooms(nodes, getForRoom, { includeWithoutDetails = false } = {}) {
  if (!nodes) return [];
  const out = [];
  const seen = new Set();
  for (const kind of ["room", "facility"]) {
    for (const n of nodes) {
      for (const roomName of namesOfKind(n, kind)) {
        const key = roomName.trim().toUpperCase();
        if (seen.has(key)) continue;
        const placard = getForRoom(roomName) || null;
        if (!placard && !includeWithoutDetails) continue;
        seen.add(key);
        out.push({ roomName, node: n, placard, kind });
      }
    }
  }
  return out;
}

// Rooms first, then plain node-name matches (entrances, hallways, ...) as
// a fallback so "Main Entrance" still works, not just room numbers. A node
// already surfaced through a room result is left out of the places, so
// the same location never shows twice. Always scans the whole campus.
export function searchCampus(query, nodes, searchableRooms) {
  const roomResults = searchRooms(query, searchableRooms);
  if (!nodes || !normalize(query)) return { roomResults, placeResults: [] };
  const roomNodeIds = new Set(roomResults.map((r) => r.node.id));
  return { roomResults, placeResults: searchNodes(query, nodes).filter((n) => !roomNodeIds.has(n.id)) };
}

function shuffle(items, random) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// A "don't know what to search for" starting point: a random sample of rooms
// that have details (there'd be little to show for the rest), then plain
// places filling whatever's left, the same "rooms first, places second, no
// duplicates" shape searchCampus returns once there's a query.
export function pickLocationSuggestions(nodes, searchableRooms, count = 6, random = Math.random) {
  const rooms = shuffle(searchableRooms.filter((r) => r.placard), random).slice(0, count);
  const remaining = count - rooms.length;
  if (remaining <= 0 || !nodes) return { rooms, places: [] };
  const roomNodeIds = new Set(rooms.map((r) => r.node.id));
  const placePool = nodes.filter((n) => !roomNodeIds.has(n.id));
  return { rooms, places: shuffle(placePool, random).slice(0, remaining) };
}

// Resolves typed text to a node by EXACT name (case/space/punctuation-
// insensitive): node names first, then room names (a room's navigable
// target is its node). Deliberately no typo tolerance: a wrong guess here
// would send someone to the wrong place; the suggestions list is where
// fuzzy matches are offered, for the visitor to pick.
export function resolveExactNodeMatch(query, nodes, searchableRooms) {
  const q = normalize(query);
  if (!q || !nodes) return null;
  const nodeMatch = nodes.find((n) => normalize(n.name) === q);
  if (nodeMatch) return nodeMatch;
  const roomMatch = searchableRooms.find((r) => normalize(r.roomName) === q);
  return roomMatch ? roomMatch.node : null;
}

// The room a "room" marker in a panorama stands for, or undefined when it
// has none, so its tap has nothing to open.
//   1. the marker's label is a room's name, with or without details: web's
//      only rule;
//   2. otherwise, among the rooms with details that node serves: one whose
//      name contains the label or the other way round ("Canteen" on a node
//      serving "Cafeteria/Canteen");
//   3. otherwise, if that node serves exactly one room with details, that
//      one ("Library" on the node serving "DLRC Digital Campus Site").
// Rules 2 and 3 are mobile only, kept on purpose: marker labels and room
// names are typed separately and don't always agree.
export function findRoomForMarker(marker, searchableRooms, node) {
  const key = normalize(marker.label);
  const exact = key && searchableRooms.find((r) => normalize(r.roomName) === key);
  if (exact) return exact;
  if (!node) return undefined;

  const served = new Set((node.rooms || []).map(normalize));
  const candidates = searchableRooms.filter((r) => r.placard && served.has(normalize(r.roomName)));
  if (key) {
    const partial = candidates.find((r) => {
      const name = normalize(r.roomName);
      return name.includes(key) || key.includes(name);
    });
    if (partial) return partial;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}
