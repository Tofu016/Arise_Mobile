import { useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The visitor's saved rooms (the bookmark on a room card), kept on this
// phone only, like the search sheet's Recent list — there are no accounts.
// A saved room is its details record's id (placard_dialog_id) plus the
// name it had when saved, newest first, at most LIMIT.
//
// Ids are numbers throughout: the room details from PlacardDialogs_API
// carry them as strings ("11"), so every entry point converts.
//
// One module-level store, read by every component through useSavedRooms().
// saveRoom/unsaveRoom return promises, resolved at once (or rejected with
// a message fit to show, e.g. the limit), so callers can toast either way.
const STORAGE_KEY = "savedRooms";
const LIMIT = 20;

let state = { saved: [], limit: LIMIT, status: "idle" }; // status: idle | loading | ready | error
const listeners = new Set();

function setState(next) {
  state = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist(saved) {
  setState({ ...state, saved });
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
}

function load() {
  setState({ ...state, status: "loading" });
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const stored = JSON.parse(raw || "[]");
      const saved = (Array.isArray(stored) ? stored : [])
        .filter((s) => s && Number.isFinite(Number(s.placard_dialog_id)))
        .map((s) => ({ placard_dialog_id: Number(s.placard_dialog_id), room_name: String(s.room_name || "") }))
        .slice(0, LIMIT);
      setState({ ...state, saved, status: "ready" });
    })
    .catch(() => setState({ ...state, status: "error" }));
}

export function isSaved(id) {
  const n = Number(id);
  return state.saved.some((s) => s.placard_dialog_id === n);
}

export function saveRoom(rawId, roomName) {
  const id = Number(rawId);
  if (isSaved(id)) return Promise.resolve();
  if (state.saved.length >= LIMIT) {
    return Promise.reject(new Error(`You can save up to ${LIMIT} rooms. Remove one to save another.`));
  }
  persist([{ placard_dialog_id: id, room_name: roomName }, ...state.saved]);
  return Promise.resolve();
}

export function unsaveRoom(rawId) {
  const id = Number(rawId);
  persist(state.saved.filter((s) => s.placard_dialog_id !== id));
  return Promise.resolve();
}

// Reads the list from the phone again (the Saved sheet's "Try again").
export function reloadSavedRooms() {
  load();
}

// { saved, limit, status }, read from the phone the first time it's asked for.
export function useSavedRooms() {
  useEffect(() => {
    if (state.status === "idle") load();
  }, []);
  return useSyncExternalStore(subscribe, () => state);
}
