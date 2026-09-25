import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";

// Rewritten to call Buildings_API instead of a live Firestore
// subscription — same module-level pattern as before (not a hook
// itself; subscribes/fetches once at import time, notifies any
// component that's opted in via useCustomBuildingsVersion()). No live
// subscription anymore, matching the same trade-off already made
// throughout this whole migration — a fetch-once-on-load, refreshable
// on demand, rather than an instant update the moment something
// changes elsewhere.
//
// Kept as the full, identical shape to the web app's own version —
// including addCustomBuilding/deleteCustomBuilding, which the mobile
// app still has no admin UI to ever call — for the same reason as
// before: keeping this file identical between the two codebases means
// future copy-paste updates stay simple, with nothing to reconcile.

let customBuildings = [];
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

fetch(`${API_BASE_URL}/Buildings_API/getAll`)
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      customBuildings = data.buildings.map((b) => ({
        id: b.id,
        label: b.name,
        floors: Array.from({ length: b.floor_count }, (_, i) => i + 1),
      }));
      notify();
    }
  })
  .catch((err) => {
    console.error("Failed to load buildings:", err);
  });

export function getCustomBuildings() {
  return customBuildings;
}

export function subscribeCustomBuildings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useCustomBuildingsVersion() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeCustomBuildings(() => setTick((t) => t + 1)), []);
}

async function getToken() {
  return AsyncStorage.getItem("authToken");
}

// Kept even though the mobile app has no admin UI to call this from —
// see this file's own top comment. Genuinely calls Buildings_API's
// create endpoint, same as the web admin's own version of this
// function does — matching the original Firestore version's own
// behavior (it genuinely persisted too, even though nothing on mobile
// ever triggered it), rather than quietly becoming a no-op just
// because nothing currently calls it.
export async function addCustomBuilding({ name, floorCount, reservedIds = [] }) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new Error("Building name is required.");
  }

  const count = Math.floor(Number(floorCount));
  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Floor count must be a whole number of at least 1.");
  }
  if (count > 100) {
    throw new Error("Floor count seems too high — double check it.");
  }

  const reserved = new Set(reservedIds);
  const base = slugify(trimmedName) || "building";
  let id = base;
  let n = 2;
  while (reserved.has(id)) {
    id = `${base}${n}`;
    n += 1;
  }

  const building = { id, label: trimmedName, floors: Array.from({ length: count }, (_, i) => i + 1) };

  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(`${API_BASE_URL}/Buildings_API/create`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id, name: trimmedName, floor_count: count }),
  }).catch((err) => {
    console.error("Failed to save building:", err);
  });

  return building;
}

export async function deleteCustomBuilding(id) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(`${API_BASE_URL}/Buildings_API/delete/${id}`, {
    method: "DELETE",
    headers,
  }).catch((err) => {
    console.error("Failed to delete building:", err);
  });
}
