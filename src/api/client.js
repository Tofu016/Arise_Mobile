import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// The one place the app learns where Arise_API lives and how to talk to it.
//
// EXPO_PUBLIC_API_BASE_URL, not a plain env var — Expo only inlines
// environment variables prefixed exactly this way into the built app; a
// bare API_BASE_URL would silently be undefined at runtime.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";

const TOKEN_KEY = "authToken";

const DEFAULT_TIMEOUT_MS = 20000;

// kind says what went wrong, which callers sometimes need to tell apart —
// e.g. a session is only dropped when the server actually refused the
// token, never because the phone was briefly offline:
//   "network"  — no reply at all (offline, wrong address, timed out)
//   "server"   — a reply that isn't the API's JSON (a PHP error page, a 500)
//   "rejected" — the API answered { success: false, error }
export class ApiError extends Error {
  constructor(message, kind, status = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

// The session token lives in SecureStore (Keychain / Android Keystore),
// not AsyncStorage, which is a plain unencrypted file. Tokens saved by
// earlier versions of the app are moved over once, on first read, so
// updating doesn't sign anyone out.
export async function getToken() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) return token;

  const legacy = await AsyncStorage.getItem(TOKEN_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacy);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
  return legacy;
}

export function setToken(token) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// jpeg: ask for a downscaled JPEG copy instead of the original (see
// Photo_preview in Arise_API); width: its maximum width, one of the
// server's allowed widths (1024, 2048, 4096) — 1024 when omitted.
export function photoUrl(path, { jpeg = false, width } = {}) {
  const url = `${API_BASE_URL}/IndoorUploads_API/serve?path=${encodeURIComponent(path)}`;
  if (!jpeg) return url;
  return width ? `${url}&format=jpeg&width=${width}` : `${url}&format=jpeg`;
}

// Calls an Arise_API endpoint ("Nodes_API/getAll") and returns the parsed
// reply, or throws an ApiError. auth: true sends the stored token, if any.
export async function apiRequest(endpoint, { method = "GET", body, auth = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let text;
  try {
    response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    text = await response.text();
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    throw new ApiError(
      timedOut
        ? "The server took too long to respond. Check your connection and try again."
        : "Couldn't reach the server. Check your connection and try again.",
      "network"
    );
  } finally {
    clearTimeout(timer);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(`The server sent an unexpected response (status ${response.status}).`, "server", response.status);
  }

  if (!data || data.success !== true) {
    throw new ApiError(data?.error || "Something went wrong.", "rejected", response.status);
  }
  return data;
}
