import { apiRequest } from "../api/client";
import { createSharedResource } from "../api/sharedResource";

// Rewritten to call Nodes_API instead of a live Firestore subscription.
// Read-only, same as before — no CRUD needed here, unlike the web
// admin's own useNodes.js. Same field-name translation as the web
// app's own equivalent hook (backend snake_case -> the camelCase this
// codebase already expects throughout PanoramaViewer.js,
// MobileRoomSheet.js, pathfinding.js, etc. — all ported directly from
// the web app's own conventions per this file's original comments).
//
// No live subscription anymore — visitors won't see an admin's edit
// appear automatically the way the old Firestore version did; a
// genuine, deliberate trade-off already made across this whole
// project (confirmed early in the web migration), not something new
// introduced here.
// Arise_API returns MySQL numbers as strings ("90", "-1"). Converted here
// so nothing downstream does string math by accident — e.g. a "45" yaw
// plus a drag offset concatenating to "451.2", or floorLabel's -1 check
// never matching "-1".
function num(value) {
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function toFrontendNode(row) {
  // A hotspot's defaultYaw/defaultPitch are the view to arrive facing when
  // walking that one link — null means "no override" (face the arrow).
  const hotspots = {};
  const neighbors = (row.neighbors || []).map((n) => {
    hotspots[n.neighbor_id] = {
      yaw: num(n.yaw),
      pitch: num(n.pitch),
      defaultYaw: num(n.default_yaw),
      defaultPitch: num(n.default_pitch),
    };
    return n.neighbor_id;
  });

  const markers = (row.markers || []).map((m) => ({
    id: m.id,
    type: m.type,
    label: m.label,
    yaw: num(m.yaw),
    pitch: num(m.pitch),
    // Elevator landings only (see utils/elevators.js): which elevator this
    // landing belongs to, and the floors it stops at — joined from the one
    // `elevators` row by the API.
    elevatorId: m.elevator_id ?? null,
    accessibleFloors: (m.accessible_floors || []).map(Number),
    // Emergency exit markers only (see utils/emergencyExits.js): the node ids
    // the hidden fire stairs come out at, lowest floor first.
    landings: m.landings || [],
  }));

  const rooms = (row.rooms || []).map((r) => r.room_name);

  return {
    id: row.id,
    name: row.name,
    building: row.building,
    floor: num(row.floor),
    type: row.type,
    // At most one per building floor: where the floor/building pickers land.
    startingNode: Number(row.is_starting_node) === 1,
    // The view to face when jumped onto this node; null means dead ahead.
    startingViewYaw: num(row.starting_view_yaw),
    startingViewPitch: num(row.starting_view_pitch),
    campusEntrance: Number(row.is_campus_entrance) === 1,
    buildingEntrance: Number(row.is_building_entrance) === 1,
    // An admin's statement that someone who reaches this node is out of danger:
    // what makes it an Emergency Exit Destination Point, the end of Nearest Exit.
    isEmergencyDestination: Number(row.is_emergency_destination) === 1,
    photo: row.photo_path || "",
    rooms,
    neighbors,
    hotspots,
    markers,
  };
}

// One shared copy for every screen (see sharedResource.js).
const nodesResource = createSharedResource(async () => {
  const data = await apiRequest("Nodes_API/getAll");
  return data.nodes.map(toFrontendNode);
});

export function usePublicNodes() {
  const { data, error } = nodesResource.useResource();
  return { nodes: data, error }; // nodes is null while loading, matching the original contract
}
