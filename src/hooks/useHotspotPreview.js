import { useEffect, useState } from "react";
import { Image } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { usePhotoFile } from "./usePhotoFile";
import { onServerChange } from "../api/serverAddress";

// The hotspot sneak-peek image, as on web (Arise_Web useHotspotPreview):
// the linked node's panorama, looking along the hotspot's yaw — an 80°-wide
// view with the card's 288:180 shape.
//
// Web reprojects that view into a true perspective image from the decoded
// pixels. Decoding a panorama in JS is far too slow on a phone, so this
// crops the same region straight out of the equirectangular photo
// (natively, with expo-image-manipulator) instead; around the horizon, where
// the preview looks, the two are close.
//
// Returns an array of { uri, share } slices laid side by side (two when the
// view straddles the photo's left/right seam), or null while it's working.
const SOURCE_WIDTH = 2048; // the downscaled photo it's cut from
const FOV = 80; // horizontal degrees, as web
const ASPECT = 288 / 180; // web's preview size

const cache = new Map(); // "photo@yaw" -> slices
const inFlight = new Map(); // "photo@yaw" -> Promise<slices>
onServerChange(() => {
  cache.clear();
  inFlight.clear();
});

function getSize(uri) {
  return new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
}

async function crop(uri, originX, originY, width, height) {
  const context = ImageManipulator.manipulate(uri);
  context.crop({ originX: Math.round(originX), originY: Math.round(originY), width: Math.round(width), height: Math.round(height) });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

async function makePreview(fileUri, yaw) {
  const { width: W, height: H } = await getSize(fileUri);
  const cropW = (W * FOV) / 360;
  const cropH = Math.min(H, cropW / ASPECT);
  // Where the viewer's sphere puts yaw on the photo (see Arise_Web
  // rectilinear.js directionToPixel): yaw 0 is three-quarters across.
  const centreU = ((((yaw / 360 + 0.75) % 1) + 1) % 1) * W;
  const top = (H - cropH) / 2;
  let left = centreU - cropW / 2;
  if (left < 0) left += W;
  const right = left + cropW;

  if (right <= W) return [{ uri: await crop(fileUri, left, top, cropW, cropH), share: 1 }];
  // Straddles the seam: the part up to the right edge, then from the left edge.
  const firstW = W - left;
  const secondW = cropW - firstW;
  const [a, b] = await Promise.all([crop(fileUri, left, top, firstW, cropH), crop(fileUri, 0, top, secondW, cropH)]);
  return [
    { uri: a, share: firstW / cropW },
    { uri: b, share: secondW / cropW },
  ];
}

export function useHotspotPreview(photo, yaw, active) {
  const { uri: fileUri } = usePhotoFile(active ? photo : null, { width: SOURCE_WIDTH });
  const key = photo ? `${photo}@${Math.round(yaw ?? 0)}` : null;
  // Tagged with its key, so a result never answers for a different hotspot.
  const [state, setState] = useState({ key: null, slices: null });

  useEffect(() => {
    if (!active || !key) return;
    const ready = cache.get(key);
    if (ready) {
      setState({ key, slices: ready });
      return;
    }
    if (!fileUri) return;
    let cancelled = false;
    if (!inFlight.has(key)) {
      inFlight.set(
        key,
        makePreview(fileUri, yaw ?? 0)
          .then((result) => {
            cache.set(key, result);
            return result;
          })
          .finally(() => inFlight.delete(key))
      );
    }
    inFlight
      .get(key)
      .then((result) => !cancelled && setState({ key, slices: result }))
      .catch(() => {}); // no preview: the card keeps its spinner
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fileUri, active]);

  if (!active || !key) return null;
  return cache.get(key) ?? (state.key === key ? state.slices : null);
}
