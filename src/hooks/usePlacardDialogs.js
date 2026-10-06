import { useCallback } from "react";
import { apiRequest } from "../api/client";
import { createSharedResource } from "../api/sharedResource";

// Matching by the room's `roomName` text, not a database ID — see the
// web app's own equivalent hook for the full reasoning: pre-existing
// records were never ID-keyed in a way this code controls, so a
// name-based lookup (case/whitespace-insensitive) is the only lookup
// that can't silently miss a real existing room.
function normalize(name) {
  return (name || "").trim().toUpperCase();
}

// Same mapping as the web app's utils/entities.js toDialog (keep in step).
// `photos` is every photo in the order an admin sorted them, each with its
// kind ("flat" or "360"). `photo360` is derived here (the first 360 photo)
// for the AR portal, rather than read from the API's photo_360_path, which
// it only still sends for older app builds.
function toFrontendDialog(row) {
  const photos = (row.photos || []).map((p) => ({ path: p.path, kind: p.kind === "360" ? "360" : "flat" }));
  return {
    id: row.id,
    roomName: row.room_name,
    roomDescription: row.description || "",
    department: row.department || "",
    contactNumber: row.contact_number || "",
    link: row.link || "",
    photos,
    photo360: photos.find((p) => p.kind === "360")?.path || "",
    ocrSearchTerms: (row.search_terms || []).map((t) => t.term),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// The room details (placard dialogs) from PlacardDialogs_API, read-only:
// looked up by room name (getForRoom). Editing them is the web Admin
// Panel's job.
//
// One shared copy for every screen (see sharedResource.js).
const dialogsResource = createSharedResource(async () => {
  const data = await apiRequest("PlacardDialogs_API/getAll");
  return data.dialogs.map(toFrontendDialog);
});

const NO_DIALOGS = [];

export function usePlacardDialogs() {
  const { data } = dialogsResource.useResource();
  const docs = data || NO_DIALOGS;

  const getForRoom = useCallback(
    (roomName) => {
      const key = normalize(roomName);
      if (!key) return null;
      return docs.find((d) => normalize(d.roomName) === key) || null;
    },
    [docs]
  );

  return { getForRoom };
}
