import { useMemo } from "react";
import { usePublicNodes } from "./usePublicNodes";
import { usePlacardDialogs } from "./usePlacardDialogs";

// Rooms with actual detail records (photo/description/department/use) —
// built by matching each node's "Rooms served" entries against
// placardDialogs, same as web. Only rooms an admin has actually gone
// through Room Edit for show up here.
//
// Extracted out of the search feature (Stage 3c) into its own shared hook
// so the placard scanner (Stage C) draws from the exact same data, rather
// than duplicating this computation in two places.
export function useSearchableRooms() {
  const { nodes, error: nodesError } = usePublicNodes();
  const { getForRoom } = usePlacardDialogs();

  const searchableRooms = useMemo(() => {
    if (!nodes) return [];
    const out = [];
    const seen = new Set();
    for (const n of nodes) {
      for (const roomName of n.rooms || []) {
        const key = roomName.trim().toUpperCase();
        if (seen.has(key)) continue;
        const placard = getForRoom(roomName);
        if (!placard) continue;
        seen.add(key);
        out.push({ roomName, node: n, placard });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, getForRoom]);

  return { searchableRooms, nodes, error: nodesError };
}
