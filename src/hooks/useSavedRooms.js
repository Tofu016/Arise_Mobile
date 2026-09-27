import { useEffect, useSyncExternalStore } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/useAuth";

// The signed-in account's saved rooms (the bookmark on a room card), kept
// on the account by Arise_API's SavedRooms_API so they follow the user to
// another phone. A saved room is its details record's id
// (placard_dialog_id) plus the name the server last knew it by.
//
// Ids are numbers throughout: the room details from PlacardDialogs_API
// carry them as strings ("11"), so every entry point converts.
//
// One module-level store, like sharedResource: loaded once per signed-in
// account, emptied on sign-out, and read by every component through
// useSavedRooms(). Changes are optimistic — the bookmark flips at once and
// flips back if the server refuses (the promise then rejects with the
// server's message, e.g. the 20-room limit). Calls for the same room run
// one after another, so a quick save-unsave-save lands in order.

const EMPTY = { userId: null, saved: [], limit: 20, status: "idle" }; // status: idle | loading | ready | error
let state = EMPTY;
const listeners = new Set();
const queues = new Map(); // placard_dialog_id -> the last call's promise

function setState(next) {
  state = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function load(userId) {
  setState({ ...EMPTY, userId, status: "loading" });
  try {
    const data = await apiRequest("SavedRooms_API/getMine", { auth: true });
    if (state.userId !== userId) return; // signed out / switched meanwhile
    const saved = data.saved.map((s) => ({ ...s, placard_dialog_id: Number(s.placard_dialog_id) }));
    setState({ userId, saved, limit: data.limit ?? EMPTY.limit, status: "ready" });
  } catch {
    if (state.userId === userId) setState({ ...state, status: "error" });
  }
}

// Runs `call` after any earlier call for the same room has finished.
function enqueue(id, call) {
  const run = (queues.get(id) || Promise.resolve()).catch(() => {}).then(call);
  queues.set(id, run);
  run.finally(() => {
    if (queues.get(id) === run) queues.delete(id);
  });
  return run;
}

export function isSaved(id) {
  const n = Number(id);
  return state.saved.some((s) => s.placard_dialog_id === n);
}

// Resolves once the server has it; rejects (after undoing the change) with
// an Error whose message is fit to show.
export function saveRoom(rawId, roomName) {
  const id = Number(rawId);
  if (isSaved(id)) return Promise.resolve();
  if (state.saved.length >= state.limit) {
    return Promise.reject(new Error(`You can save up to ${state.limit} rooms. Remove one to save another.`));
  }
  const entry = { placard_dialog_id: id, room_name: roomName };
  setState({ ...state, saved: [entry, ...state.saved] });
  return enqueue(id, () =>
    apiRequest("SavedRooms_API/save", { method: "POST", body: { placard_dialog_id: id }, auth: true })
  ).catch((err) => {
    setState({ ...state, saved: state.saved.filter((s) => s.placard_dialog_id !== id) });
    throw err;
  });
}

export function unsaveRoom(rawId) {
  const id = Number(rawId);
  const index = state.saved.findIndex((s) => s.placard_dialog_id === id);
  if (index === -1) return Promise.resolve();
  const entry = state.saved[index];
  setState({ ...state, saved: state.saved.filter((s) => s.placard_dialog_id !== id) });
  return enqueue(id, () => apiRequest(`SavedRooms_API/remove/${id}`, { method: "DELETE", auth: true })).catch((err) => {
    if (!isSaved(id)) {
      const saved = [...state.saved];
      saved.splice(Math.min(index, saved.length), 0, entry);
      setState({ ...state, saved });
    }
    throw err;
  });
}

export function reloadSavedRooms() {
  if (state.userId != null) load(state.userId);
}

// { saved, limit, status } for the signed-in account, loading it the
// first time it's asked for and emptying it on sign-out.
export function useSavedRooms() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const snapshot = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (userId === state.userId) return;
    if (userId == null) setState(EMPTY);
    else load(userId);
  }, [userId]);

  return snapshot.userId === userId ? snapshot : { ...EMPTY, userId };
}
