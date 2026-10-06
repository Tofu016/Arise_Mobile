import { defaultHotspotAngle } from "./constants";

// Ported from the web app's src/utils/hotspots.js (keep in step).

// The angle a node's hotspot to one neighbor sits at: its saved angle, or
// the evenly-spread default when none was placed yet. Used by the
// directions route (utils/directionsRoute.js) to judge straight hallways.
export function hotspotAngle(node, neighborId) {
  const neighborIds = node?.neighbors || [];
  const idx = neighborIds.indexOf(neighborId);
  if (idx === -1) return null;
  return node.hotspots?.[neighborId] || defaultHotspotAngle(idx, neighborIds.length);
}
