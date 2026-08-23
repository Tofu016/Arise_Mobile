import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION = "placardDialogs";

// This collection already existed before this feature (used elsewhere,
// hence the existing ocrSearchTerms/roomDescription/roomName fields) — we're
// only adding to it, not replacing anything. Matching happens by the
// `roomName` field's text, NOT the document ID — the pre-existing docs'
// actual ID convention isn't something we know or control, so an ID-based
// lookup would risk silently missing real existing rooms. Matching is
// case/whitespace-insensitive so "203" and " 203 " find the same record,
// but the room's *displayed* name is stored exactly as typed in "Rooms
// served" on the node, never force-altered.
function normalize(name) {
  return (name || "").trim().toUpperCase();
}

export function usePlacardDialogs() {
  const [docs, setDocs] = useState([]); // [{ id, roomName, roomDescription, ocrSearchTerms, photo, department, use, ... }]

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, COLLECTION), (snapshot) => {
      setDocs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  const getForRoom = (roomName) => {
    const key = normalize(roomName);
    if (!key) return null;
    return docs.find((d) => normalize(d.roomName) === key) || null;
  };

  // Updates the matching existing doc if one exists; otherwise creates a new
  // one, seeding the fields the existing system already relies on
  // (roomName, ocrSearchTerms) the same way that data already looks, so any
  // downstream OCR matching keeps working the same way for rooms added
  // through this panel.
  const saveRoomDialog = async (roomName, patch) => {
    const existing = getForRoom(roomName);
    if (existing) {
      await updateDoc(doc(db, COLLECTION, existing.id), {
        ...patch,
        updatedAt: new Date().toISOString(),
      });
      return existing.id;
    }

    const trimmedName = roomName.trim();
    const ocrTerm = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ref = await addDoc(collection(db, COLLECTION), {
      roomName: trimmedName,
      roomDescription: "",
      ocrSearchTerms: ocrTerm ? [ocrTerm] : [],
      ...patch,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return ref.id;
  };

  return { getForRoom, saveRoomDialog };
}
