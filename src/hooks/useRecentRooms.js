import { useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The search sheet's "Recent" list: rooms this visitor opened, newest first,
// kept on the phone only (not synced — it's a per-device convenience).
// Stored by room name, the same key placard dialogs are matched on; a name
// that no longer matches a room is simply skipped when shown.
const STORAGE_KEY = "recentRooms";
const MAX_RECENT = 10;

let recent = [];
let loaded = false;
const listeners = new Set();

function publish(next) {
  recent = next;
  listeners.forEach((fn) => fn());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const stored = JSON.parse(raw || "[]");
      if (Array.isArray(stored)) {
        recent = stored.filter((n) => typeof n === "string").slice(0, MAX_RECENT);
        listeners.forEach((fn) => fn());
      }
    })
    .catch(() => {});
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addRecentRoom(roomName) {
  if (!roomName) return;
  publish([roomName, ...recent.filter((n) => n !== roomName)].slice(0, MAX_RECENT));
}

export function removeRecentRoom(roomName) {
  publish(recent.filter((n) => n !== roomName));
}

export function useRecentRooms() {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, () => recent);
}
