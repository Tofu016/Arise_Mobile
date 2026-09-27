import { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { photoUrl } from "../api/client";
import { onServerChange } from "../api/serverAddress";

// A Photo as a local file:// URI — for the panorama viewer (expo-gl decodes
// the file natively, see usePanoramaImage.js) and for ViroReact's
// Viro360Image, whose integration proved fragile enough (its one early
// working test needed a bundled require() asset, not even a data: URI)
// that it's only ever handed a real JPEG file. &format=jpeg asks the server to convert and
// downscale first (see Photo_preview in Arise_API) rather than testing
// whether Viro copes with WebP.
//
// Downloaded straight to disk by the native side, once per photo per app
// session, and shared: the AR portal reads the same photo from two
// components, and the AR viewer revisits nodes as you walk back. A photo
// already on disk is returned on the very first render, so switching to
// it never flashes blank. Each file is named after its Photo path, so a
// photo overwrites its own previous copy instead of piling up; files are
// re-downloaded on the next launch in case an admin replaced them.
// Each width is a separate file (the same photo may be shown sharp in the
// panorama viewer and at 1024px in AR).
const downloaded = new Map(); // "path@width" -> file URI
const inFlight = new Map(); // "path@width" -> Promise<file URI>
// Another server's photos may share these paths: start over on a switch.
onServerChange(() => {
  downloaded.clear();
  inFlight.clear();
});

function keyFor(photo, width) {
  return `${photo}@${width ?? "default"}`;
}

function fileUriFor(photo, width) {
  const suffix = width ? `-w${width}` : "";
  return `${FileSystem.cacheDirectory}photo-${photo.replace(/[^A-Za-z0-9._-]/g, "_")}${suffix}.jpg`;
}

function download(photo, width) {
  const key = keyFor(photo, width);
  if (!inFlight.has(key)) {
    const fileUri = fileUriFor(photo, width);
    const promise = FileSystem.downloadAsync(photoUrl(photo, { jpeg: true, width }), fileUri)
      .then(async (result) => {
        if (result.status !== 200) {
          // The body of a failed request (a 404 message) was still written.
          await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          throw new Error(`Couldn't load photo (status ${result.status}).`);
        }
        downloaded.set(key, result.uri);
        return result.uri;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
  }
  return inFlight.get(key);
}

// width: optional, one of the server's allowed widths (see photoUrl).
export function usePhotoFile(photo, { width } = {}) {
  const key = photo ? keyFor(photo, width) : null;
  const [state, setState] = useState(() => ({ key, uri: key ? downloaded.get(key) ?? null : null, error: null }));

  useEffect(() => {
    if (!photo) {
      setState({ key, uri: null, error: null });
      return;
    }
    const ready = downloaded.get(key);
    if (ready) {
      setState({ key, uri: ready, error: null });
      return;
    }

    let cancelled = false;
    setState({ key, uri: null, error: null });
    download(photo, width)
      .then((uri) => {
        if (!cancelled) setState({ key, uri, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ key, uri: null, error: err.message || "Failed to load photo." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Until the effect catches up with a changed photo, answer for the new
  // one from the shared cache rather than returning the previous photo.
  if (state.key !== key) {
    return { uri: key ? downloaded.get(key) ?? null : null, error: null };
  }
  return { uri: state.uri, error: state.error };
}
