import { useState, useEffect, useCallback } from "react";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";

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
function toFrontendNode(row) {
  const hotspots = {};
  const neighbors = (row.neighbors || []).map((n) => {
    hotspots[n.neighbor_id] = { yaw: n.yaw, pitch: n.pitch };
    return n.neighbor_id;
  });

  const markers = (row.markers || []).map((m) => ({
    id: m.id,
    type: m.type,
    label: m.label,
    yaw: m.yaw,
    pitch: m.pitch,
  }));

  const rooms = (row.rooms || []).map((r) => r.room_name);

  return {
    id: row.id,
    name: row.name,
    building: row.building,
    floor: row.floor,
    type: row.type,
    leadsToFloor: row.leads_to_floor !== null ? row.leads_to_floor : null,
    photo: row.photo_path || "",
    rooms,
    neighbors,
    hotspots,
    markers,
  };
}

export function usePublicNodes() {
  const [nodes, setNodes] = useState(null); // null while loading, matching the original contract
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/Nodes_API/getAll`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Couldn't load nodes.");
      }
      setNodes(data.nodes.map(toFrontendNode));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { nodes, error };
}
