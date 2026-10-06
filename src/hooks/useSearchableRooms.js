import { useMemo } from "react";
import { usePublicNodes } from "./usePublicNodes";
import { usePlacardDialogs } from "./usePlacardDialogs";
import { buildSearchableRooms } from "../utils/search";

// Every room and facility in the tour, matched by name to its details
// record (see utils/search.js buildSearchableRooms), built the same way as
// the web app's: rooms and facilities with no Room Edit record are listed
// too, with a null `placard`, so anything rendering a room must treat it as
// optional. Search, the directory, directions and saved rooms all draw on
// this one list. The placard scanner keeps to the rooms an admin put on OCR
// (see utils/ocrTerms.js isOcrEligible), which all have details.
export function useSearchableRooms() {
  const { nodes, error: nodesError } = usePublicNodes();
  const { getForRoom } = usePlacardDialogs();

  const searchableRooms = useMemo(
    () => buildSearchableRooms(nodes, getForRoom, { includeWithoutDetails: true }),
    [nodes, getForRoom]
  );

  return { searchableRooms, nodes, error: nodesError };
}
