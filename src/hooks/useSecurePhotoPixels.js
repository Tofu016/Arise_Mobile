import { useEffect, useState } from "react";
import { ref, getBytes } from "firebase/storage";
import jpeg from "jpeg-js";
import { storage } from "../firebase";

function extractStoragePath(photo) {
  if (!photo) return null;
  const match = photo.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : photo;
}

// Decoded pixels persist for the life of the app session — re-visiting a
// node you've already seen skips the (comparatively slow) fetch+decode
// entirely. No eviction/size cap for now — a typical tour session visits a
// bounded number of unique panoramas, so this is a reasonable trade-off
// worth revisiting only if memory actually becomes a real problem.
const pixelCache = new Map();

// Mobile equivalent of the web app's useSecurePhotoUrl.js — same underlying
// security model (fetches bytes through the Storage SDK, which genuinely
// enforces Storage Security Rules, unlike a public download-URL link).
//
// Output format differs from web on purpose, and deliberately avoids the
// native texture-loading bridge entirely: after several attempts at getting
// expo's native image-loading pipeline to reliably feed a JPEG file into a
// Three.js texture (each either crashing or silently rendering black), the
// one thing that's worked without any trouble is a DataTexture built from
// raw pixel data. So instead of writing a file and asking a native loader
// to read+decode it, this decodes the JPEG bytes directly in JS (via
// jpeg-js) and hands back plain { width, height, data } — pixels the
// PanoramaViewer can feed straight into THREE.DataTexture, the one part of
// this whole pipeline that's been reliable from the very first try.
export function useSecurePhotoPixels(photo) {
  const [pixels, setPixels] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    const path = extractStoragePath(photo);
    if (!path) {
      setPixels(null);
      return;
    }

    const cached = pixelCache.get(path);
    if (cached) {
      setPixels(cached);
      return;
    }

    setPixels(null);
    let cancelled = false;
    getBytes(ref(storage, path))
      .then((buffer) => {
        if (cancelled) return;
        const decoded = jpeg.decode(new Uint8Array(buffer), { useTArray: true });
        if (cancelled) return;
        const result = { width: decoded.width, height: decoded.height, data: decoded.data };
        pixelCache.set(path, result);
        setPixels(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load/decode photo.");
      });

    return () => {
      cancelled = true;
    };
  }, [photo]);

  return { pixels, error };
}
