// Which parts of the Directory visitors see, as an admin set them on the web
// app's Directory page (Directory_API). Ported from the web app's
// src/utils/directorySettings.js, the visitor half only (keep in step);
// editing them stays on web.
//
// Campuses and buildings are stored as "hidden" lists, so one created later
// appears by default. A building's rooms are stored per building as
// { incoming, listed, removed }: the directory lists the `listed` rooms, and
// with `incoming` on it also lists every room not in `removed`, so rooms
// created later appear on their own. A building with no entry behaves as
// incoming on with nothing removed.
//
// `showSaved` is read but not used here: it hides web's "Saved Directories"
// group inside its directory, and the app keeps saved rooms in their own tab.
export const DEFAULT_DIRECTORY_SETTINGS = {
  showSaved: true,
  hiddenCampuses: [],
  hiddenBuildings: [],
  buildingRooms: {},
};

const DEFAULT_ENTRY = { incoming: true, listed: [], removed: [] };

// Room names match case-insensitively, the same way buildSearchableRooms
// dedupes them.
const nameKey = (name) => name.trim().toUpperCase();
const hasName = (list, name) => list.some((n) => nameKey(n) === nameKey(name));

// Same wire mapping as the web app's utils/entities.js toDirectorySettings.
export function toDirectorySettings(row) {
  return {
    showSaved: row.show_saved !== false,
    hiddenCampuses: row.hidden_campuses || [],
    hiddenBuildings: row.hidden_buildings || [],
    // An empty map comes back from PHP as an empty list. A map stored by an
    // earlier version (building id to a bare list) is read as no entry.
    buildingRooms: Array.isArray(row.building_rooms) ? {} : row.building_rooms || {},
  };
}

export function entryFor(settings, buildingId) {
  const entry = settings.buildingRooms[buildingId];
  return entry && Array.isArray(entry.listed) ? entry : DEFAULT_ENTRY;
}

export function isRoomListed(settings, buildingId, roomName) {
  const { incoming, listed, removed } = entryFor(settings, buildingId);
  return hasName(listed, roomName) || (incoming && !hasName(removed, roomName));
}

// The rooms (see utils/search.js buildSearchableRooms) a visitor's Directory
// lists for one building.
export function listedRooms(settings, buildingId, rooms) {
  return rooms.filter((r) => r.node.building === buildingId && isRoomListed(settings, buildingId, r.roomName));
}
