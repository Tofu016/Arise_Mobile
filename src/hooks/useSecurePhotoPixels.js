import { useEffect, useState } from "react";
import jpeg from "jpeg-js";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";

const pixelCache = new Map();

// TEMPORARY diagnostic logging — now includes a global.__photoDecodedAt
// absolute timestamp specifically so PanoramaViewer.js can compute the
// real gap between "decode finished here" and "texture creation started
// there", across two separate files/components. Plain console.log calls
// in each file can't be directly compared without a shared reference
// point like this — this is that reference point. Remove both this and
// the matching code in PanoramaViewer.js once the actual bottleneck is
// identified.
export function useSecurePhotoPixels(photo) {
  const [pixels, setPixels] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    if (!photo) {
      setPixels(null);
      return;
    }

    const cached = pixelCache.get(photo);
    if (cached) {
      console.log(`[photo] cache hit for ${photo}`);
      setPixels(cached);
      return;
    }

    setPixels(null);
    let cancelled = false;

    const url = `${API_BASE_URL}/IndoorUploads_API/serve?path=${encodeURIComponent(photo)}&format=jpeg`;
    const t0 = Date.now();
    console.log(`[photo] fetch start: ${url}`);

    fetch(url)
      .then((response) => {
        console.log(`[photo] fetch responded after ${Date.now() - t0}ms, status ${response.status}`);
        if (!response.ok) throw new Error(`Couldn't load photo (status ${response.status}).`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        console.log(`[photo] got ${buffer.byteLength} bytes after ${Date.now() - t0}ms, starting decode`);
        const tDecode = Date.now();
        const decoded = jpeg.decode(new Uint8Array(buffer), { useTArray: true });
        console.log(`[photo] decode finished after ${Date.now() - tDecode}ms (${decoded.width}x${decoded.height})`);
        if (cancelled) return;
        const result = { width: decoded.width, height: decoded.height, data: decoded.data };
        pixelCache.set(photo, result);
        // Absolute timestamp, shared across files via a global — this is
        // the actual moment setPixels() is about to be called, which is
        // what PanoramaViewer.js's own logging compares itself against.
        global.__photoDecodedAt = Date.now();
        setPixels(result);
      })
      .catch((err) => {
        console.log(`[photo] FAILED after ${Date.now() - t0}ms:`, err.message);
        if (!cancelled) setError(err.message || "Failed to load/decode photo.");
      });

    return () => {
      cancelled = true;
    };
  }, [photo]);

  return { pixels, error };
}
