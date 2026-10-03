import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getApiBaseUrl, loadServerAddress } from "./serverAddress";

// The one place the app talks to Arise_API. Where it lives comes from
// serverAddress.js (.env's default, or a server picked in the About sheet
// in the development build), read at call time. Every endpoint the app
// uses is public — there are no accounts.

const DEFAULT_TIMEOUT_MS = 20000;

// kind says what went wrong, for callers that need to tell apart e.g.
// "offline" from "the server said no":
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

// Earlier versions of the app had accounts and kept a session token on
// the phone (SecureStore, and AsyncStorage before that). There's no
// sign-in any more, so it's deleted once per launch, off the critical
// path — nothing reads it.
const OLD_TOKEN_KEY = "authToken";
SecureStore.deleteItemAsync(OLD_TOKEN_KEY).catch(() => {});
AsyncStorage.removeItem(OLD_TOKEN_KEY).catch(() => {});

// jpeg: ask for a downscaled JPEG copy instead of the original (see
// Photo_preview in Arise_API); width: its maximum width, one of the
// server's allowed widths (1024, 2048, 4096) — 1024 when omitted.
export function photoUrl(path, { jpeg = false, width } = {}) {
  const url = `${getApiBaseUrl()}/IndoorUploads_API/serve?path=${encodeURIComponent(path)}`;
  if (!jpeg) return url;
  return width ? `${url}&format=jpeg&width=${width}` : `${url}&format=jpeg`;
}

// Calls an Arise_API endpoint ("Nodes_API/getAll") and returns the parsed
// reply, or throws an ApiError.
export async function apiRequest(endpoint, { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  await loadServerAddress(); // the saved server, before the very first call
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let text;
  try {
    response = await fetch(`${getApiBaseUrl()}/${endpoint}`, {
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
