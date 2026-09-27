import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import Icon from "./Icon";
import { colors, typography, radii, spacing } from "../theme";

// The cross-campus "minimap flyover", ported from Arise_Web's
// FlyoverPanel.jsx: before a move to a building somewhere else (e.g. the
// main campus -> Digital Campus), a map shows where the destination is
// relative to here, with the road route between them. It moves on by
// itself after a few seconds; SKIP goes now, x stays where you are.
//
// Web draws it with MapLibre, which is only the map engine: its tiles come
// from OpenStreetMap (web's osmMapStyle). The app has no map engine (adding
// one means a native rebuild), and this map is only a few seconds' still
// preview, so it's drawn directly from those same OpenStreetMap tiles,
// framed on both points like web's fitBounds, with the route (from the
// same OSRM demo server) drawn over them.
const AUTO_PROCEED_MS = 4000;

const TILE = 256; // px per tile at its own zoom
const FIT_PADDING = 40; // as web's fitBounds padding
const MAX_ZOOM = 17;
// OpenStreetMap's tile policy asks every app to identify itself, and
// answers anonymous requests with an "Access blocked" tile. React Native's
// <Image> on Android ignores request headers (it goes out as plain
// "okhttp"), so tiles are downloaded with this header by expo-file-system
// (as the panoramas are), kept in the cache folder, and shown from there —
// which also makes a map seen before appear at once.
const TILE_HEADERS = { "User-Agent": "ARISE-SDCA-Mobile/1.0 (St. Dominic College of Asia campus tour)" };
const tileFiles = new Map(); // "z/x/y" -> file URI, once on disk
const tileDownloads = new Map(); // "z/x/y" -> Promise<file URI>

function tileFile(key, url) {
  if (tileFiles.has(key)) return Promise.resolve(tileFiles.get(key));
  if (!tileDownloads.has(key)) {
    const fileUri = `${FileSystem.cacheDirectory}osm-tile-${key.replace(/\//g, "-")}.png`;
    const promise = FileSystem.getInfoAsync(fileUri)
      .then((info) =>
        info.exists
          ? fileUri
          : FileSystem.downloadAsync(url, fileUri, { headers: TILE_HEADERS }).then(async (result) => {
              if (result.status !== 200) {
                await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
                throw new Error(`Tile ${key}: HTTP ${result.status}`);
              }
              return fileUri;
            })
      )
      .then((uri) => {
        tileFiles.set(key, uri);
        return uri;
      })
      .finally(() => tileDownloads.delete(key));
    tileDownloads.set(key, promise);
  }
  return tileDownloads.get(key);
}

// Local file URIs for the given tiles, filling in as each arrives.
function useTileFiles(tiles) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    for (const t of tiles) {
      if (tileFiles.has(t.key)) continue;
      tileFile(t.key, t.uri)
        .then(() => !cancelled && setVersion((v) => v + 1))
        .catch(() => {}); // that square stays the plain map background
    }
    return () => {
      cancelled = true;
    };
  }, [tiles]);
  return (key) => tileFiles.get(key) ?? null;
}
const ROUTE_COLOR = "#4a9eff"; // web's route line
const ROUTE_WIDTH = 4;

// Web Mercator: (lat, lng) -> pixel position in the whole world map at zoom z.
function project(lat, lng, z) {
  const scale = TILE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
}

// The closest zoom that still fits both points inside the padding.
function fitZoom(from, to, width, height) {
  for (let z = MAX_ZOOM; z > 1; z--) {
    const [x1, y1] = project(from.lat, from.lng, z);
    const [x2, y2] = project(to.lat, to.lng, z);
    if (Math.abs(x2 - x1) <= width - 2 * FIT_PADDING && Math.abs(y2 - y1) <= height - 2 * FIT_PADDING) return z;
  }
  return 1;
}

// The road route as [lng, lat] points (OSRM's GeoJSON order), falling back
// to a straight line — same as web.
function useRoute(from, to) {
  const [state, setState] = useState({ coords: null, error: false });
  useEffect(() => {
    let cancelled = false;
    setState({ coords: null, error: false });
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!coords?.length) throw new Error("No route geometry in response");
        if (!cancelled) setState({ coords, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ coords: [[from.lng, from.lat], [to.lng, to.lat]], error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [from.lat, from.lng, to.lat, to.lng]);
  return state;
}

function StaticMap({ from, to, route, width, height }) {
  const view = useMemo(() => {
    const z = fitZoom(from, to, width, height);
    const [fx, fy] = project(from.lat, from.lng, z);
    const [tx, ty] = project(to.lat, to.lng, z);
    const left = (fx + tx) / 2 - width / 2;
    const top = (fy + ty) / 2 - height / 2;
    const toScreen = (lat, lng) => {
      const [x, y] = project(lat, lng, z);
      return [x - left, y - top];
    };

    // Tiles one zoom deeper, drawn at half size, so they're sharp on
    // high-density screens.
    const tileZoom = Math.min(z + 1, 19);
    const size = TILE / 2;
    const count = 2 ** tileZoom;
    const tiles = [];
    for (let ty0 = Math.floor(top / size); ty0 <= Math.floor((top + height) / size); ty0++) {
      if (ty0 < 0 || ty0 >= count) continue;
      for (let tx0 = Math.floor(left / size); tx0 <= Math.floor((left + width) / size); tx0++) {
        const x = ((tx0 % count) + count) % count;
        tiles.push({
          key: `${tileZoom}/${x}/${ty0}`,
          uri: `https://tile.openstreetmap.org/${tileZoom}/${x}/${ty0}.png`,
          left: tx0 * size - left,
          top: ty0 * size - top,
          size,
        });
      }
    }
    return { tiles, toScreen };
  }, [from, to, width, height]);

  // The route as short straight segments (thin rotated bars), skipping
  // points too close together to matter.
  const segments = useMemo(() => {
    if (!route) return [];
    const points = [];
    for (const [lng, lat] of route) {
      const p = view.toScreen(lat, lng);
      const last = points[points.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) points.push(p);
    }
    const out = [];
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1];
      const [x2, y2] = points[i];
      const length = Math.hypot(x2 - x1, y2 - y1);
      out.push({
        key: i,
        left: (x1 + x2) / 2 - length / 2,
        top: (y1 + y2) / 2 - ROUTE_WIDTH / 2,
        width: length + ROUTE_WIDTH, // overlap a little so joints close up
        angle: `${Math.atan2(y2 - y1, x2 - x1)}rad`,
      });
    }
    return out;
  }, [route, view]);

  const fileFor = useTileFiles(view.tiles);
  const [fromX, fromY] = view.toScreen(from.lat, from.lng);
  const [toX, toY] = view.toScreen(to.lat, to.lng);
  const PIN = 30;

  return (
    <View style={[styles.map, { width, height }]}>
      {view.tiles.map((t) => {
        const file = fileFor(t.key);
        return file ? (
          <Image
            key={t.key}
            source={{ uri: file }}
            fadeDuration={150}
            style={{ position: "absolute", left: t.left, top: t.top, width: t.size, height: t.size }}
          />
        ) : null;
      })}
      {segments.map((s) => (
        <View
          key={s.key}
          style={[
            styles.routeSegment,
            { left: s.left - ROUTE_WIDTH / 2, top: s.top, width: s.width, transform: [{ rotate: s.angle }] },
          ]}
        />
      ))}
      {/* Pins stand on their point: the icon's bottom tip is the spot. */}
      <View style={[styles.pin, { left: fromX - PIN / 2, top: fromY - PIN }]}>
        <Icon name="location" size={PIN} color={colors.gray700} />
      </View>
      <View style={[styles.pin, { left: toX - PIN / 2, top: toY - PIN }]}>
        <Icon name="location" size={PIN} color={colors.primary} />
      </View>
      <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
    </View>
  );
}

export default function FlyoverPanel({ flyover, onComplete, onCancel, bottomOffset, topLimit }) {
  const { fromLat, fromLng, fromLabel, toLat, toLng, toLabel } = flyover;
  const from = useMemo(() => ({ lat: fromLat, lng: fromLng }), [fromLat, fromLng]);
  const to = useMemo(() => ({ lat: toLat, lng: toLng }), [toLat, toLng]);
  const { coords, error } = useRoute(from, to);
  const { width: windowWidth } = useWindowDimensions();
  // The sheet spans the screen less its side margins; the map fills it
  // less the content padding.
  const mapWidth = windowWidth - spacing.md * 2 - spacing.lg * 2;
  // Measured, so the sheet is exactly as tall as its content.
  const [contentHeight, setContentHeight] = useState(0);

  const timerRef = useRef(null);
  useEffect(() => {
    timerRef.current = setTimeout(onComplete, AUTO_PROCEED_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = () => {
    clearTimeout(timerRef.current);
    onComplete();
  };
  const handleCancel = () => {
    clearTimeout(timerRef.current);
    onCancel();
  };

  // A sheet like the others (above the bottom nav, no dimmed backdrop);
  // dragging it down is the same as x — stay here.
  return (
    <BottomSheet
      onClose={handleCancel}
      snapPoints={[0.9]}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
      fitContent
      contentHeight={contentHeight || undefined}
    >
      <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {fromLabel} → {toLabel}
          </Text>
          <Pressable
            onPress={handleCancel}
            hitSlop={8}
            style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
            accessibilityLabel="Stay here"
          >
            <Icon name="terminate" size={15} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <StaticMap from={from} to={to} route={coords} width={mapWidth} height={Math.round(mapWidth * 0.72)} />
          {error && <Text style={styles.note}>Showing a straight-line estimate: the routing service didn't respond.</Text>}
          <Button label="Skip" iconRight="proceedNext" onPress={handleSkip} style={styles.skip} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // Same header as the Directions sheet.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h3, flex: 1 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.iconButton,
  },
  roundBtnPressed: { backgroundColor: colors.borderStrong },
  map: { borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.surfaceSunken },
  routeSegment: { position: "absolute", height: ROUTE_WIDTH, borderRadius: ROUTE_WIDTH / 2, backgroundColor: ROUTE_COLOR },
  pin: { position: "absolute" },
  attribution: {
    position: "absolute",
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 9,
    color: colors.textSecondary,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  note: { ...typography.caption, marginTop: spacing.sm },
  skip: { marginTop: spacing.md },
});
