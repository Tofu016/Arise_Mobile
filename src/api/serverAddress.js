import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Where Arise_API lives. The default comes from EXPO_PUBLIC_API_BASE_URL
// (.env) at build time. Only the development build can switch to another
// server from the Sign in screen — the choice is saved on the phone.
// Preview and production builds can't, and only ever talk to their
// built-in address (a server saved by a development build on the same
// phone is ignored), so no one can point a shared app at a fake server.
// See app.config.js (APP_VARIANT) for which build is which.

// EXPO_PUBLIC_ prefix: Expo only inlines variables named this way.
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";

// Set by app.config.js: true only in the development build. Fails
// closed — a config without the flag hides the setting.
export const serverSettingEnabled = Constants.expoConfig?.extra?.serverSetting === true;

const STORAGE_KEY = "arise.apiBaseUrl";
const DEFAULT_PATH = "/Arise_API/index.php";

let current = DEFAULT_API_BASE_URL;
let ready = null;
const listeners = new Set();
const resetters = new Set();

// Reads the saved address (once). Every API request waits for this, so the
// very first call — restoring the session on launch — already goes to the
// right server.
export function loadServerAddress() {
  if (!ready) {
    ready = (serverSettingEnabled ? AsyncStorage.getItem(STORAGE_KEY) : Promise.resolve(null))
      .then((saved) => {
        if (saved) current = saved;
      })
      .catch(() => {});
  }
  return ready;
}

export function getApiBaseUrl() {
  return current;
}

// Just "host:port" of an address, for display.
export function serverHost(url) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url || "");
  return m ? m[1] : url;
}

// Tidies what someone typed into an API base address, or throws an Error
// with a message fit to show:
//   "192.168.1.30"                → http://192.168.1.30/Arise_API/index.php
//   "https://arise.example.edu/"  → https://arise.example.edu/Arise_API/index.php
//   "http://10.0.0.5/api/index.php" (a full address) → kept as typed
export function normalizeServerAddress(input) {
  let url = (input || "").trim();
  if (!url) throw new Error("Enter the server's address.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`;
  const m = /^(https?):\/\/([^/?#\s]+)([^?#\s]*)$/i.exec(url);
  if (!m) throw new Error("That doesn't look like a web address (http:// or https://).");
  const [, scheme, host, rawPath] = m;
  const path = rawPath.replace(/\/+$/, "");
  return `${scheme.toLowerCase()}://${host}${path || DEFAULT_PATH}`;
}

// Whether Arise_API answers at `url` — its public Buildings list is asked
// for and must come back as the API's own JSON.
export async function testServerAddress(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/Buildings_API/getAll`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const data = JSON.parse(await res.text());
    return data?.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Switches server (null = back to the built-in default), saved for the
// next launch. Everything cached from the old server is dropped (see
// onServerChange), so nothing from it lingers.
export async function setServerAddress(url) {
  if (!serverSettingEnabled) return;
  const next = url || DEFAULT_API_BASE_URL;
  if (next === current) return;
  current = next;
  try {
    if (next === DEFAULT_API_BASE_URL) await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Still switched for this session.
  }
  resetters.forEach((fn) => fn());
  listeners.forEach((fn) => fn());
}

// Caches of server data register here to be emptied on a switch.
export function onServerChange(reset) {
  resetters.add(reset);
  return () => resetters.delete(reset);
}

// The current address, re-rendering when it changes.
export function useServerAddress() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current
  );
}
