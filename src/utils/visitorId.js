import AsyncStorage from "@react-native-async-storage/async-storage";

// A random id for this phone, sent with feedback so Arise_API's 30 second
// limit counts one visitor, not everyone behind the campus's shared Wi-Fi —
// the mobile counterpart of the web app's utils/visitorId.js. Kept on the
// phone so reopening the app doesn't hand out a fresh allowance; if storage
// fails it lives for this run only. Not an identity: it's never joined to
// anything.
const KEY = "visitorId";
let cached = null;

function newId() {
  // Hermes has no guaranteed crypto.randomUUID; a plain UUID v4 will do.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getVisitorId() {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      cached = stored;
      return cached;
    }
    cached = newId();
    await AsyncStorage.setItem(KEY, cached);
  } catch {
    cached = cached || newId();
  }
  return cached;
}
