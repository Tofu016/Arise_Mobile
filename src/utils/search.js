// Ranks results so an exact room match ("203") always beats a partial one
// ("203" matching "2033"), and a room match always beats a name match — since
// this is primarily meant for "type a room number, get directed there."
export function searchNodes(query, nodes) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exactRoom = [];
  const partialRoom = [];
  const nameMatch = [];

  for (const n of nodes) {
    const rooms = n.rooms || [];
    const roomExact = rooms.some((r) => r.trim().toLowerCase() === q);
    const roomPartial = !roomExact && rooms.some((r) => r.toLowerCase().includes(q));
    const nameHit = n.name.toLowerCase().includes(q);

    if (roomExact) exactRoom.push(n);
    else if (roomPartial) partialRoom.push(n);
    else if (nameHit) nameMatch.push(n);
  }

  return [...exactRoom, ...partialRoom, ...nameMatch].slice(0, 8);
}

// Ranks room results with the same priority pattern as searchNodes: exact
// room name first, then partial name, then a hit somewhere in the room's
// description/department/use text — e.g. searching "registrar" finds a room
// whose Department is "Registrar's Office" even with no name match at all.
// `searchableRooms` is [{ roomName, node, placard }] — only rooms that
// already have a placardDialogs record (see MainPage.jsx).
export function searchRooms(query, searchableRooms) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact = [];
  const partial = [];
  const textMatch = [];

  for (const r of searchableRooms) {
    const name = r.roomName.toLowerCase();
    const isExact = name === q;
    const isPartial = !isExact && name.includes(q);
    const text = [r.placard.roomDescription, r.placard.department, r.placard.use]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const isTextHit = !isExact && !isPartial && text.includes(q);

    if (isExact) exact.push(r);
    else if (isPartial) partial.push(r);
    else if (isTextHit) textMatch.push(r);
  }

  return [...exact, ...partial, ...textMatch].slice(0, 8);
}

// Case/space/punctuation-insensitive form of a name, as web's fuzzy.js
// normalize: "Main Entrance", "main-entrance" and "MAINENTRANCE" match.
function normalizeName(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

// The room (with details — see useSearchableRooms) a "room" marker in a
// panorama stands for, or undefined when it has none, so its tap has
// nothing to open.
//   1. the marker's label is a room's name — web's only rule;
//   2. otherwise — unless the label is one of its node's rooms that simply
//      has no details — among the rooms that node serves: one whose name
//      contains the label or the other way round ("Canteen" on a node
//      serving "Cafeteria/Canteen");
//   3. otherwise, if that node serves exactly one room with details, that
//      one ("Library" on the node serving "DLRC Digital Campus Site").
export function findRoomForMarker(marker, searchableRooms, node) {
  const key = normalizeName(marker.label);
  const exact = key && searchableRooms.find((r) => normalizeName(r.roomName) === key);
  if (exact) return exact;
  if (!node) return undefined;

  const served = new Set((node.rooms || []).map(normalizeName));
  // The label names one of this node's rooms, just one without details
  // ("IMAC Laboratory 2" beside a detailed "IMAC Laboratory 1"): nothing.
  if (served.has(key)) return undefined;
  const candidates = searchableRooms.filter((r) => served.has(normalizeName(r.roomName)));
  if (key) {
    const partial = candidates.find((r) => {
      const name = normalizeName(r.roomName);
      return name.includes(key) || key.includes(name);
    });
    if (partial) return partial;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}
