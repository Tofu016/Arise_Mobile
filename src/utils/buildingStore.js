import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

// Ported unchanged from the web app — this is pure Firestore + React state,
// no DOM dependencies at all, so it works identically here. Every consumer
// (the mobile MainPage, eventually) reads through getCustomBuildings()/
// useCustomBuildingsVersion() and stays in sync automatically as buildings
// are added or removed from ANY session — including the web admin panel.

const COLLECTION = "buildings";

let customBuildings = [];
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

onSnapshot(collection(db, COLLECTION), (snapshot) => {
  customBuildings = snapshot.docs.map((d) => d.data());
  notify();
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

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Kept even though the mobile app has no admin UI to call these from — the
// mobile app only ever reads buildings, never creates them. Keeping the
// full file identical to the web version means future copy-paste updates
// between the two stay simple, with nothing to reconcile.
export function addCustomBuilding({ name, floorCount, reservedIds = [] }) {
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

  const floors = Array.from({ length: count }, (_, i) => i + 1);
  const building = { id, label: trimmedName, floors };

  setDoc(doc(db, COLLECTION, id), building).catch((err) => {
    console.error("Failed to save building to Firestore:", err);
  });

  return building;
}

export function deleteCustomBuilding(id) {
  deleteDoc(doc(db, COLLECTION, id)).catch((err) => {
    console.error("Failed to delete building from Firestore:", err);
  });
}
