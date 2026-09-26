import { useEffect, useMemo, useState } from "react";
import { Image } from "react-native";
import { usePhotoFile } from "./usePhotoFile";

// A panorama as { uri, width, height } for PanoramaViewer, which hands the
// file straight to expo-gl: its texImage2D decodes a { localUri } natively
// (stb_image, in C++), many times faster than decoding JPEG in JS — which
// is what made a sharp panorama affordable. The download is native too.
//
// The size is read natively (Image.getSize, header only) because three.js
// allocates the GPU texture before expo-gl decodes the file into it.

// Largest first. The GPU's own limit is reported by the viewer once its GL
// context exists (see reportMaxTextureSize); OpenGL ES 3.0 only guarantees
// 2048, although practically every phone supports 4096 or more.
const WIDTHS = [4096, 2048, 1024];
let maxTextureSize = 4096;

export function reportMaxTextureSize(size) {
  if (size > 0) maxTextureSize = size;
}

function panoramaWidth() {
  return WIDTHS.find((w) => w <= maxTextureSize) ?? WIDTHS[WIDTHS.length - 1];
}

const sizes = new Map(); // file URI -> { width, height }

export function usePanoramaImage(photo) {
  const { uri, error: fileError } = usePhotoFile(photo, { width: panoramaWidth() });
  const [state, setState] = useState({ uri: null, size: null, error: null });

  useEffect(() => {
    if (!uri) return;
    const known = sizes.get(uri);
    if (known) {
      setState({ uri, size: known, error: null });
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        sizes.set(uri, { width, height });
        if (!cancelled) setState({ uri, size: { width, height }, error: null });
      },
      () => {
        if (!cancelled) setState({ uri, size: null, error: "Couldn't read the panorama." });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  let size = null;
  if (uri) size = state.uri === uri ? state.size : sizes.get(uri);
  // One stable object per file: PanoramaViewer builds its GPU texture from
  // it, so a new object on every render would rebuild the texture each time.
  const image = useMemo(
    () => (uri && size ? { uri, width: size.width, height: size.height } : null),
    [uri, size?.width, size?.height] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const error = fileError || (uri && state.uri === uri ? state.error : null);
  return { image, error };
}
