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

function toBuilding(row) {
  return { id: row.id, label: row.name };
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
