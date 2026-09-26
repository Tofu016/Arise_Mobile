import { useEffect, useSyncExternalStore } from "react";

// Data that several screens read (all nodes, all placard dialogs), fetched
// once and shared, instead of every hook call firing its own request —
// the main screen alone used to load every node twice.
//
// A module-level store rather than a React context, same pattern as
// buildingStore.js: the AR scenes render inside ViroARSceneNavigator,
// which is fragile about what flows into them from outside (see
// ar-portal.js), and a hook reading a module-level store works anywhere.
//
// Loaded on first use. A later mount refreshes in the background once the
// data is older than maxAgeMs, so an admin's edit still shows up without
// restarting the app. A failed background refresh keeps the data already
// shown — `error` is only set when there is nothing to show at all.
export function createSharedResource(load, { maxAgeMs = 5 * 60 * 1000 } = {}) {
  let state = { data: null, error: null };
  let loadedAt = 0;
  let inFlight = null;
  const listeners = new Set();

  function setState(next) {
    state = next;
    listeners.forEach((fn) => fn());
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getSnapshot() {
    return state;
  }

  // Resolves with the fresh data, or null if loading failed — never
  // rejects, since the outcome is already recorded in the shared state.
  function refresh() {
    if (!inFlight) {
      inFlight = load()
        .then((data) => {
          loadedAt = Date.now();
          setState({ data, error: null });
          return data;
        })
        .catch((err) => {
          setState({ data: state.data, error: state.data ? null : err.message || "Couldn't load data." });
          return null;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  function useResource() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    useEffect(() => {
      if (!state.data || Date.now() - loadedAt > maxAgeMs) refresh();
    }, []);
    return { data: snapshot.data, error: snapshot.error, refresh };
  }

  // The current data (or null), for plain functions that can't use a hook.
  // They only see new data when a component using useResource re-renders.
  function getData() {
    return state.data;
  }

  return { useResource, refresh, getData };
}
