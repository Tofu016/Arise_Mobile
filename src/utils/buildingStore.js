import { apiRequest } from "../api/client";
import { createSharedResource } from "../api/sharedResource";

// Every building, straight from Buildings_API — GD1/GD2/GD3 included.
// nodes.building is a foreign key to that table, so the built-in buildings
// are rows there like any other; the app used to hard-code them AND add
// the API's list on top, listing each GD building twice and ignoring an
// admin renaming one. The API is now the only source, so names and newly
// added buildings follow whatever an admin set in the web panel.
//
// Read-only: the mobile app has no building admin, so there's nothing to
// create or delete from here.

// Where the main campus is. Its buildings (GD1-GD3) have no coordinates of
// their own in the database, so, as on web (Arise_Web constants.js), they
// share this point; only a building on another campus (e.g. Digital
// Campus) carries its own. Used by the cross-campus flyover.
const MAIN_CAMPUS = { lat: 14.45890388620473, lng: 120.95932439713594 };

function toBuilding(row) {
  const lat = row.lat == null ? NaN : parseFloat(row.lat);
  const lng = row.lng == null ? NaN : parseFloat(row.lng);
  const own = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const location = own || (row.campus_id === "main" ? MAIN_CAMPUS : null);
  // The campus it belongs to ("main" for GD1-GD3, "dc" for Digital
  // Campus); a building without one counts as a campus of its own.
  return { id: row.id, label: row.name, campusId: row.campus_id || row.id, ...(location || {}) };
}

const buildingsResource = createSharedResource(async () => {
  const data = await apiRequest("Buildings_API/getAll");
  return data.buildings.map(toBuilding);
});

const NO_BUILDINGS = [];

// For components: the building list, re-rendering when it loads/changes.
export function useBuildings() {
  return buildingsResource.useResource().data || NO_BUILDINGS;
}

// For plain functions (constants.js). Empty until the first load finishes.
export function getBuildings() {
  return buildingsResource.getData() || NO_BUILDINGS;
}

// The campus a building is on (see toBuilding); the building's own id until
// the list has loaded.
export function campusOf(buildingId) {
  return getBuildings().find((b) => b.id === buildingId)?.campusId ?? buildingId;
}
