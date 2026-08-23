import { useEffect, useState } from "react";
import { ref, getBytes } from "firebase/storage";
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

// For plain 2D photo display (room cards, etc.) via React Native's own
// <Image> component — deliberately NOT the same approach as the panorama's
// useSecurePhotoPixels. That one exists because Three.js's texture pipeline
// specifically can't handle data: URIs (that whole saga is documented in
// that file). React Native's own <Image> component is completely
// different — it natively and reliably supports data: URIs, so this is
// the much simpler path: fetch bytes, base64-encode them, hand the result
// straight to <Image source={{ uri: ... }} />. No native asset bridge, no
// JPEG decoding needed at all.
export function useSecurePhotoDataUri(photo) {
  const [uri, setUri] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setUri(null);
    setError(null);
    const path = extractStoragePath(photo);
    if (!path) return;

    let cancelled = false;
    getBytes(ref(storage, path))
      .then((buffer) => {
        if (cancelled) return;
        const base64 = bytesToBase64(new Uint8Array(buffer));
        setUri(`data:image/jpeg;base64,${base64}`);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load photo.");
      });

    return () => {
      cancelled = true;
    };
  }, [photo]);

  return { uri, error };
}
