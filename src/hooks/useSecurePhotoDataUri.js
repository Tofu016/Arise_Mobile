import { useEffect, useState } from "react";

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

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function mimeForPath(path) {
  const ext = path.split(".").pop().toLowerCase();
  return MIME_BY_EXT[ext] || "image/jpeg";
}

// Rewritten to call Arise_API's IndoorUploads_API/serve endpoint instead
// of Firebase Storage's getBytes() — genuinely public now, no auth token
// needed (see useSecurePhotoPixels.js's own comment for why).
//
// Unlike that file, this one does NOT request &format=jpeg — React
// Native's own <Image> component natively and reliably handles WebP
// (and PNG, and GIF) through a data: URI, same as it always handled
// JPEG. The JPEG-only constraint belongs specifically to the panorama
// pipeline's jpeg-js decoder, not to this component at all. The MIME
// type in the resulting data: URI is now read from the actual file
// extension rather than hardcoded to image/jpeg — plain (non-360) room
// photos specifically never go through any format-conversion step on
// upload, so their real format can genuinely vary.
export function useSecurePhotoDataUri(photo) {
  const [uri, setUri] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setUri(null);
    setError(null);
    if (!photo) return;

    let cancelled = false;
    const url = `${API_BASE_URL}/IndoorUploads_API/serve?path=${encodeURIComponent(photo)}`;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Couldn't load photo.");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const base64 = bytesToBase64(new Uint8Array(buffer));
        setUri(`data:${mimeForPath(photo)};base64,${base64}`);
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
