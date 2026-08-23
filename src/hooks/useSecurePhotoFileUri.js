import { useEffect, useRef, useState } from "react";
import { ref, getBytes } from "firebase/storage";
import * as FileSystem from "expo-file-system/legacy";
import { storage } from "../firebase";

function extractStoragePath(photo) {
  if (!photo) return null;
  const match = photo.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : photo;
}

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

// Mobile equivalent of the web app's useSecurePhotoUrl.js — same underlying
// security model (fetches bytes through the Storage SDK, which genuinely
// enforces Storage Security Rules, unlike a public download-URL link).
//
// Returns a real file:// URI, not a data: URI — this is specifically for
// Viro360Image, whose native image-loading path appears to not handle
// inline data URIs reliably (our one working Viro360Image test used a
// require()'d bundled asset — a real file, resolved through Metro's asset
// system — while a data: URI produced nothing at all, even though the exact
// same data URI works fine with the simpler ViroImage component). A real
// temp file is structurally closer to what a bundled asset resolves to
// under the hood, which is the whole reasoning behind this fix.
export function useSecurePhotoFileUri(photo) {
  const [uri, setUri] = useState(null);
  const [error, setError] = useState(null);
  const lastFileUri = useRef(null);

  useEffect(() => {
    setUri(null);
    setError(null);
    const path = extractStoragePath(photo);
    if (!path) return;

    let cancelled = false;

    (async () => {
      try {
        const buffer = await getBytes(ref(storage, path));
        if (cancelled) return;
        const base64 = bytesToBase64(new Uint8Array(buffer));

        // Clean up the previous temp file before writing a new one, so
        // switching between photos repeatedly doesn't quietly pile up
        // cached files for the rest of the session.
        if (lastFileUri.current) {
          FileSystem.deleteAsync(lastFileUri.current, { idempotent: true }).catch(() => {});
        }

        const ext = path.match(/\.(\w+)$/)?.[1] || "jpg";
        const fileUri = `${FileSystem.cacheDirectory}ar-photo-${Date.now()}.${ext}`;
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
