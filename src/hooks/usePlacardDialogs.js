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

function toFrontendDialog(row) {
  return {
    id: row.id,
    roomName: row.room_name,
    roomDescription: row.description || "",
    department: row.department || "",
    use: row.use || "",
    link: row.link || "",
    photo: row.photo_path || "",
    photo360: row.photo_360_path || "",
    ocrSearchTerms: (row.search_terms || []).map((t) => t.term),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Rewritten to call PlacardDialogs_API instead of a live Firestore
// subscription — same upsert-by-name semantics as the web app's own
// equivalent hook (create() and update() are genuinely separate
// backend endpoints; this hook is what bridges "save this room" into
// whichever one actually applies, exactly as the web version does).
//
// create()/update() on the backend both require an admin-authenticated
// session (requireAdmin(), unchanged from how PlacardDialogs_API has
// always worked) — this rewrite preserves that permission model
// exactly as-is; it doesn't relax or work around it. Whatever mobile
// screen calls saveRoomDialog needs a signed-in admin session for it
// to actually succeed, same as it always would have going through
// this same backend from the web app.
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

  const saveRoomDialog = useCallback(
    async (roomName, patch) => {
      const existing = getForRoom(roomName);

      const body = {};
      if (patch.roomName !== undefined) body.room_name = patch.roomName;
      if (patch.roomDescription !== undefined) body.description = patch.roomDescription;
      if (patch.department !== undefined) body.department = patch.department;
      if (patch.use !== undefined) body.use = patch.use;
      if (patch.link !== undefined) body.link = patch.link;
      if (patch.photo !== undefined) body.photo_path = patch.photo;
      if (patch.photo360 !== undefined) body.photo_360_path = patch.photo360;
      if (patch.ocrSearchTerms !== undefined) body.search_terms = patch.ocrSearchTerms;

      let id;
      if (existing) {
        await apiRequest(`PlacardDialogs_API/update/${existing.id}`, { method: "PATCH", body, auth: true });
        id = existing.id;
      } else {
        const trimmedName = (patch.roomName || roomName).trim();
        const ocrTerm = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const data = await apiRequest("PlacardDialogs_API/create", {
          method: "POST",
          auth: true,
          body: {
            room_name: trimmedName,
            description: "",
            search_terms: ocrTerm ? [ocrTerm] : [],
            ...body,
          },
        });
        id = data.dialog.id;
      }

      await dialogsResource.refresh();
      return id;
    },
    [getForRoom]
  );

  return { getForRoom, saveRoomDialog };
}
