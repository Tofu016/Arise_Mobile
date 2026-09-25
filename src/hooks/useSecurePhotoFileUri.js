import { useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";

// Dependency-free bytes -> base64 conversion — avoids relying on btoa/Buffer
// being available in the Hermes JS engine, which isn't guaranteed. Verified
// against Node's built-in Buffer.toString('base64') across empty input,
// every remainder case (1/2/3 leftover bytes), and a 5000-byte blob.
function bytesToBase64(bytes) {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += CHARS[(chunk >> 18) & 63] + CHARS[(chunk >> 12) & 63] + CHARS[(chunk >> 6) & 63] + CHARS[chunk & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    result += CHARS[(chunk >> 18) & 63] + CHARS[(chunk >> 12) & 63] + "==";
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result += CHARS[(chunk >> 18) & 63] + CHARS[(chunk >> 12) & 63] + CHARS[(chunk >> 6) & 63] + "=";
  }
  return result;
}

// Rewritten to call Arise_API's IndoorUploads_API/serve endpoint instead
// of Firebase Storage's getBytes() — genuinely public now, no auth token
// needed (see useSecurePhotoPixels.js's own comment for why).
//
// &format=jpeg requested here too, same conservative reasoning as the
// panorama pipeline: this file's own original comments describe a
// genuinely fragile, trial-and-error history getting ViroReact's
// Viro360Image to reliably display anything at all (their one working
// test needed a bundled require() asset, not even a data: URI). Given
// how finicky that integration already proved for a well-supported
// format, there's no real confidence it would handle WebP cleanly
// either — asking the backend to convert first avoids testing that
// uncertainty on the one AR path that's already been this hard to get
// working. Always writes a real .jpg file now (not the original
// extension) as a direct consequence.
export function useSecurePhotoFileUri(photo) {
  const [uri, setUri] = useState(null);
  const [error, setError] = useState(null);
  const lastFileUri = useRef(null);

  useEffect(() => {
    setUri(null);
    setError(null);
    if (!photo) return;

    let cancelled = false;
    const url = `${API_BASE_URL}/IndoorUploads_API/serve?path=${encodeURIComponent(photo)}&format=jpeg`;

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Couldn't load photo.");
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const base64 = bytesToBase64(new Uint8Array(buffer));

        // Clean up the previous temp file before writing a new one, so
        // switching between photos repeatedly doesn't quietly pile up
        // cached files for the rest of the session.
        if (lastFileUri.current) {
          FileSystem.deleteAsync(lastFileUri.current, { idempotent: true }).catch(() => {});
        }

        const fileUri = `${FileSystem.cacheDirectory}ar-photo-${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (cancelled) return;
        lastFileUri.current = fileUri;
        setUri(fileUri);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load photo.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photo]);

  return { uri, error };
}
