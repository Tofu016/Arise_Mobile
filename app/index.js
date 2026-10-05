import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import { useSearchableRooms } from "../src/hooks/useSearchableRooms";
import { usePanoramaImage } from "../src/hooks/usePanoramaImage";
import { useBuildings, campusOf } from "../src/utils/buildingStore";
import { buildingOrder } from "../src/utils/constants";
import { searchRooms, searchNodes, findRoomForMarker } from "../src/utils/search";
import { findPath } from "../src/utils/pathfinding";
import { findEvacuationRoute } from "../src/utils/evacuation";
import { arrivalYawFromExit, fireStairsBetween } from "../src/utils/emergencyExits";
import { elevatorDestinationsFrom, elevatorRideBetween, arrivalYawFromLanding } from "../src/utils/elevators";
import { pickDefaultNode, walkEntryView, jumpEntryView, findFlyover } from "../src/utils/navigation";
import { useRecentRooms, addRecentRoom, removeRecentRoom } from "../src/hooks/useRecentRooms";
import { useSavedRooms, saveRoom, unsaveRoom, reloadSavedRooms } from "../src/hooks/useSavedRooms";
import MobileRoomSheet from "../src/components/MobileRoomSheet";
import MobileDirectionsSheet from "../src/components/MobileDirectionsSheet";
import ElevatorPicker from "../src/components/ElevatorPicker";
import FlyoverPanel from "../src/components/FlyoverPanel";
import PanoramaViewer from "../src/components/PanoramaViewer";
import SearchSheet from "../src/components/SearchSheet";
import DirectorySheet from "../src/components/DirectorySheet";
import AboutSheet from "../src/components/AboutSheet";
import SavedSheet from "../src/components/SavedSheet";
import ToastHost, { showToast } from "../src/components/Toast";
import BottomNav, { NAV_HEIGHT } from "../src/components/BottomNav";
import TopLogo from "../src/components/TopLogo";
import Icon, { COLOR_ICONS } from "../src/components/Icon";
import { isGyroAvailable } from "../src/utils/deviceLook";
import { colors, typography, radii, spacing, shadows } from "../src/theme";

// Auto walk steps along the route every 3 s — the brand board's
// "AUTO WALK (EVERY 3S)".
const AUTO_WALK_MS = 3000;

export default function MainScreen() {
  const router = useRouter();
  const buildings = useBuildings(); // re-renders when the building list loads/changes
  const { nodes, error: loadError } = usePublicNodes();
  // The status bar/notch takes up a different amount of space on every
  // device — a hardcoded "top: 12" would sit right under (or behind) it on
  // some phones. This gives the actual safe area for the current device.
  const insets = useSafeAreaInsets();

  // Only one sheet at a time, same as the web app's panelMode:
  //   null | "search" | "directory" | "room" | "directions" | "saved" | "about"
  const [panelMode, setPanelMode] = useState(null);
  // The bottom-nav tab that opened what's showing, so it stays lit while a
  // room card or directions opened from it are up.
  const [activeTab, setActiveTab] = useState(null);
  const searchInputRef = useRef(null);
  const closePanel = () => {
    setPanelMode(null);
    searchInputRef.current?.blur();
  };

  const [currentId, setCurrentId] = useState(null);
  // The view the next panorama opens facing — see utils/navigation.js.
  const [entryView, setEntryView] = useState({ yaw: 0, pitch: 0 });

  // Land directly in the tour instead of an intermediate menu screen — and
  // again if the spot on screen is no longer in the data (e.g. after a
  // switch to another server from the About sheet).
  useEffect(() => {
    if (nodes && (currentId === null || !nodes.some((n) => n.id === currentId))) {
      const start = pickDefaultNode(nodes, buildingOrder());
      if (start) {
        setCurrentId(start.id);
        setEntryView(jumpEntryView(start));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const current = useMemo(() => {
    if (!nodes || !currentId) return null;
    return nodes.find((n) => n.id === currentId) || null;
  }, [nodes, currentId]);

  const { image: panorama, error: photoError } = usePanoramaImage(current?.photo);

  // One arrow per link out of the current node, placed where an admin put
  // it, carrying the link's own arrival view (see utils/navigation.js).
  const hotspots = useMemo(() => {
    if (!current || !nodes) return [];
    const neighborIds = current.neighbors || [];
    return neighborIds.map((nid) => {
      const target = nodes.find((n) => n.id === nid);
      // Every link has its own angle: node_neighbors.yaw/pitch are NOT NULL.
      return { id: nid, name: target?.name || nid, photo: target?.photo || null, ...current.hotspots[nid] };
    });
  }, [current, nodes]);

  // Fixed point-of-interest markers (rooms/facilities/emergency exits/fire extinguishers, and
  // elevator landings) for the current node — same shape as web's.
  const markers = current?.markers || [];
  const [elevatorPicker, setElevatorPicker] = useState(null);

  // Same as web: tapping an elevator landing is like pressing the call
  // button (with only one other floor it rides straight there, otherwise it
  // asks which floor), and tapping a room marker opens that room's card.
  // Every other marker is just its always-visible label.
  const handleMarkerTap = (markerId) => {
    const marker = markers.find((m) => m.id === markerId);
    if (!marker) return;
    if (marker.type === "elevator" && marker.elevatorId && current) {
      const destinations = elevatorDestinationsFrom(nodes, current.id, marker.elevatorId);
      if (destinations.length === 1) {
        rideElevatorTo(destinations[0]);
        return;
      }
      if (destinations.length > 1) {
        setElevatorPicker({ label: marker.label, currentFloor: current.floor, destinations });
        return;
      }
    }
    // The emergency exit marker only moves the visitor while it is the next
    // step of a Nearest Exit route: it takes the hidden fire stairs.
    if (marker.type === "emergency_exit" && nextFireStairs && marker.id === nextFireStairs.markerId) {
      handleWalkToNextStop();
      return;
    }
    if (marker.type === "room") {
      const room = roomForMarker.get(marker.id);
      if (room) openRoomCard(room);
    }
  };

  // A ride is a walk: you step out facing away from the doors, toward the
  // floor.
  const rideElevatorTo = (dest) => {
    setElevatorPicker(null);
    goTo(dest.node.id, { yaw: arrivalYawFromLanding(dest.marker) }, { ride: true });
  };
  // ---------- Gyro look-around ----------
  // The designer's gyro-map / gyro-arrowkeys pair: move the phone to look
  // around (compass icon) or drag with a finger (arrows icon). Only offered
  // on a phone with the sensor, in an app build that includes expo-sensors.
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroOn, setGyroOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isGyroAvailable().then((ok) => !cancelled && setGyroAvailable(ok));
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Cross-campus flyover ----------
  // As on web, every move (walk, jump, back) to a building somewhere else
  // is held back behind the flyover map; it happens when that finishes (or
  // is skipped), and not at all if it's cancelled. While one is showing,
  // other moves (an auto-walk step, a stray tap) are ignored.
  const [flyover, setFlyover] = useState(null);
  const requestMove = (targetId, move) => {
    if (flyover) return;
    const hop = findFlyover(current, nodes?.find((n) => n.id === targetId), buildings);
    if (hop) setFlyover({ ...hop, pending: move });
    else move();
  };
  const completeFlyover = () => {
    const pending = flyover?.pending;
    setFlyover(null);
    pending?.();
  };
  const cancelFlyover = () => {
    setFlyover(null);
    setAutoWalking(false); // it would only ask again
  };

  // Walking via a hotspot (or a directions step, or an elevator ride): opens
  // the new panorama facing the way you walked (or the link's own default
  // view), same as web. Distinct from jumpToNode below (search results /
  // room card), which opens facing the destination's own starting view.
  // `ride`: an elevator ride, which keeps its own arrival view (facing out
  // of the doors) rather than "keep walking the same way".
  const goTo = (id, hotspot, { ride = false } = {}) =>
    requestMove(id, () => {
      setCurrentId(id);
      setEntryView(ride ? walkEntryView(hotspot) : walkEntryView(hotspot, nodes?.find((n) => n.id === id), currentId));
    });

  // ---------- Search ----------
  const [searchQuery, setSearchQuery] = useState("");
  // Rooms with actual detail records (photo/description/department/use) —
  // see useSearchableRooms.js for how this is built.
  const { searchableRooms } = useSearchableRooms();

  const roomResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchRooms(searchQuery, searchableRooms);
  }, [searchableRooms, searchQuery]);

  // Plain node-name matches (entrances, hallways, etc.), excluding anything
  // already surfaced as a room result above — same fallback behavior as web.
  const placeResults = useMemo(() => {
    if (!nodes || !searchQuery.trim()) return [];
    const roomNodeIds = new Set(roomResults.map((r) => r.node.id));
    return searchNodes(searchQuery, nodes).filter((n) => !roomNodeIds.has(n.id));
  }, [nodes, searchQuery, roomResults]);

  const randomSuggestions = useMemo(() => {
    if (searchableRooms.length === 0) return [];
    return [...searchableRooms].sort(() => Math.random() - 0.5).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode === "search", searchableRooms]);

  const jumpToNode = (id) => {
    requestMove(id, () => {
      setCurrentId(id);
      setEntryView(jumpEntryView(nodes?.find((n) => n.id === id)));
    });
    setSearchQuery("");
    closePanel();
  };

  // The currently-open room detail sheet, or null.
  // Room markers that have a room with details behind them — only those
  // open a card, so only those respond to a tap.
  const roomForMarker = useMemo(() => {
    const map = new Map();
    for (const m of markers) {
      if (m.type !== "room") continue;
      const room = findRoomForMarker(m, searchableRooms, current);
      if (room) map.set(m.id, room);
    }
    return map;
  }, [markers, searchableRooms, current]);
  const isMarkerTappable = (m) =>
    m.type === "elevator"
      ? !!m.elevatorId
      : m.type === "emergency_exit"
        ? m.id === nextFireStairs?.markerId
        : roomForMarker.has(m.id);

  const [selectedRoomCard, setSelectedRoomCard] = useState(null);

  const openRoomCard = (room) => {
    addRecentRoom(room.roomName);
    setSelectedRoomCard(room);
    setSearchQuery("");
    searchInputRef.current?.blur();
    setPanelMode("room");
  };

  const closeRoomCard = () => {
    setSelectedRoomCard(null);
    closePanel();
  };

  // ---------- Directions ----------
  const [directions, setDirections] = useState(null);
  // shape: { fromQuery, fromId, toQuery, toId, path, stepIndex, error, editingField }

  // Keep an active route in sync with wherever the visitor actually is —
  // relevant once Stage 4 adds real hotspot navigation; for now it also
  // covers jumping around via search while a route is active.
  useEffect(() => {
    if (!directions?.path || !currentId) return;
    const idx = directions.path.indexOf(currentId);
    if (idx !== -1) {
      if (idx !== directions.stepIndex) {
        setDirections((d) => (d ? { ...d, stepIndex: idx } : d));
      }
      return;
    }
    // Off an emergency route: aim at whichever exit is nearest from here, not the old one.
    if (directions.emergency) {
      const here = nodes?.find((n) => n.id === currentId);
      if (here) setDirections(exitDirections(here, directions.emergency.blocked));
      return;
    }
    const reroute = findPath(nodes, currentId, directions.toId);
    setDirections((d) => {
      if (!d) return d;
      if (!reroute) return { ...d, path: null, stepIndex: 0, error: "Lost the route from here. Try Get directions again." };
      return { ...d, path: reroute, stepIndex: 0, error: "" };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // Opening directions always REPLACES whatever the panel was showing,
  // same as web/PWA — Maps switches from place details straight into
  // directions mode, not stacking both.
  const openDirectionsTo = (node) => {
    setDirections({
      fromQuery: current?.name || "",
      fromId: current?.id || null,
      toQuery: node.name,
      toId: node.id,
      path: null,
      stepIndex: 0,
      error: "",
      editingField: null,
      kind: "point",
    });
    setSearchQuery("");
    searchInputRef.current?.blur();
    setPanelMode("directions");
  };

  // The Directions tab: back to the route in progress if there is one
  // (switching tabs keeps it), otherwise a fresh one from where you're
  // standing, with the destination left to pick.
  const openDirectionsPanel = () => {
    if (!directions) {
      setDirections({
        fromQuery: current?.name || "",
        fromId: current?.id || null,
        toQuery: "",
        toId: null,
        path: null,
        stepIndex: 0,
        error: "",
        editingField: null,
        kind: "point",
      });
    }
    setSearchQuery("");
    searchInputRef.current?.blur();
    setPanelMode("directions");
  };

  // The Nearest exit sheet's DIRECTIONS button: back to ordinary
  // directions from where you are now, keeping the destination that was
  // being planned before switching to the exit (if any).
  const plannedDestinationRef = useRef(null);
  const switchToDirections = () => {
    setAutoWalking(false);
    const planned = plannedDestinationRef.current;
    setDirections({
      fromQuery: current?.name || "",
      fromId: current?.id || null,
      toQuery: planned?.toQuery || "",
      toId: planned?.toId || null,
      path: null,
      stepIndex: 0,
      error: "",
      editingField: null,
      kind: "point",
    });
  };

  // The Directions sheet's NEAREST EXIT button: replaces whatever route was
  // being planned with the route to the nearest Emergency Exit Destination
  // Point an admin ticked (utils/evacuation.js, ported from the web app so
  // both lead a visitor the same way). It never uses an elevator, takes the
  // hidden fire stairs listed by Emergency Exit markers, and never climbs
  // above the visitor's floor or Floor 1 unless nothing else exists. Routes
  // are limited to the campus you're on (GD1-GD3 are one campus, Digital
  // Campus another), so it never sends you across to another campus.
  //
  // `blocked` is the node ids the visitor reported impassable with "This way
  // is blocked"; the route is recomputed around them from `fromNode`.
  const exitDirections = (fromNode, blocked = []) => {
    const campus = campusOf(fromNode.building);
    const campusNodes = nodes.filter((n) => campusOf(n.building) === campus);
    const result = findEvacuationRoute(campusNodes, fromNode.id, { blocked });
    const destination = result ? nodes.find((n) => n.id === result.destinationId) : null;
    return {
      fromQuery: fromNode.name,
      fromId: fromNode.id,
      toQuery: destination?.name || "",
      toId: destination?.id || null,
      path: result?.path || null,
      stepIndex: 0,
      error: result
        ? ""
        : blocked.length
          ? "No other way out was found from here. Emergency hotline: 161"
          : "No safe way out was found from here. Emergency hotline: 161",
      editingField: null,
      kind: "exit",
      emergency: { blocked, ascends: !!result?.ascends },
    };
  };

  const openDirectionsToNearestExit = () => {
    if (!current || !nodes) return;
    setAutoWalking(false);
    plannedDestinationRef.current =
      directions?.kind === "point" && directions.toId ? { toQuery: directions.toQuery, toId: directions.toId } : null;
    setDirections(exitDirections(current));
    setSearchQuery("");
    searchInputRef.current?.blur();
    setPanelMode("directions");
  };

  // "This way is blocked": the visitor reports the route's next stop
  // impassable (smoke, fire, a locked door). It is excluded for the rest of
  // this emergency route and the way out is recomputed from where they stand;
  // with the lowest fire stairs landing blocked that is the next landing.
  const handleBlocked = () => {
    if (!directions?.emergency || !directions.path || !nodes) return;
    const here = directions.path.includes(currentId) ? currentId : directions.path[directions.stepIndex];
    const blockedId = directions.path[directions.path.indexOf(here) + 1];
    const fromNode = nodes.find((n) => n.id === here);
    if (!blockedId || !fromNode) return;
    setDirections(exitDirections(fromNode, [...new Set([...directions.emergency.blocked, blockedId])]));
  };

  const closeDirections = () => {
    setAutoWalking(false);
    setDirections(null);
    closePanel();
  };

  const updateDirectionsField = (field, value) => {
    setDirections((d) => ({
      ...d,
      [field === "from" ? "fromQuery" : "toQuery"]: value,
      [field === "from" ? "fromId" : "toId"]: null,
      editingField: field,
      path: null,
      error: "",
    }));
  };

  const pickDirectionsField = (field, node) => {
    setDirections((d) => ({
      ...d,
      [field === "from" ? "fromQuery" : "toQuery"]: node.name,
      [field === "from" ? "fromId" : "toId"]: node.id,
      editingField: null,
    }));
  };

  const directionsFieldMatches = useMemo(() => {
    if (!directions?.editingField || !nodes) return [];
    const q = directions.editingField === "from" ? directions.fromQuery : directions.toQuery;
    return searchNodes(q, nodes);
  }, [directions?.editingField, directions?.fromQuery, directions?.toQuery, nodes]);

  // The route for the picked From/To, or null (with the reason shown).
  const computeRoute = () => {
    if (!directions?.fromId || !directions?.toId) {
      setDirections((d) => ({ ...d, error: "Pick both a starting point and a destination from the suggestions." }));
      return null;
    }
    const path = findPath(nodes, directions.fromId, directions.toId);
    if (!path) {
      setDirections((d) => ({ ...d, path: null, error: "No walkable route found between these two points yet." }));
      return null;
    }
    setDirections((d) => ({ ...d, path, stepIndex: 0, error: "" }));
    return path;
  };

  const handleGetDirections = () => {
    computeRoute();
  };

  const handleStartWalking = () => {
    if (!directions?.path) return;
    jumpToNode(directions.path[0]);
    setDirections((d) => (d ? { ...d, stepIndex: 0 } : d));
    setPanelMode("directions"); // jumpToNode closes the panel — reopen it for the route in progress
  };

  const handleWalkToNextStop = () => {
    if (!directions?.path) return;
    const nextId = directions.path[directions.stepIndex + 1];
    if (!nextId) return;
    // A walk along the route's next link (or an elevator ride, when the
    // route changes floor by elevator), not jumpToNode — that clears
    // search/closes the panel, and we want to stay in the directions view
    // while progressing through the route.
    const hotspot = current?.hotspots?.[nextId];
    const ride = !hotspot && nodes ? elevatorRideBetween(nodes, currentId, nextId) : null;
    // The hidden fire stairs of a Nearest Exit route: taken through the
    // emergency exit marker, stepping out facing away from the landing's own
    // door when it has one.
    const stairs = !hotspot && !ride && directions.emergency && nodes ? fireStairsBetween(nodes, currentId, nextId) : null;
    if (stairs) {
      goTo(nextId, stairs.toMarker ? { yaw: arrivalYawFromExit(stairs.toMarker) } : undefined, { ride: true });
      return;
    }
    goTo(nextId, ride ? { yaw: arrivalYawFromLanding(ride.toMarker) } : hotspot, { ride: !!ride });
  };

  const arrived = directions?.path && directions.stepIndex === directions.path.length - 1;
  const nextStopId = directions?.path?.[directions.stepIndex + 1] || null;
  const nextStopName = nextStopId ? (nodes?.find((n) => n.id === nextStopId)?.name || nextStopId) : null;
  // The floor the route's next step rides to, when that step is an elevator.
  const nextElevatorRide =
    nextStopId && currentId && !current?.hotspots?.[nextStopId] && nodes
      ? elevatorRideBetween(nodes, currentId, nextStopId)
      : null;
  const nextElevatorFloor = nextElevatorRide?.toFloor ?? null;
  // The step down the hidden fire stairs, when that is a Nearest Exit route's
  // next step: { markerId, floor, goesDown }.
  const nextFireStairsStep =
    nextStopId && currentId && directions?.emergency && !current?.hotspots?.[nextStopId] && !nextElevatorRide && nodes
      ? fireStairsBetween(nodes, currentId, nextStopId)
      : null;
  const nextFireStairs = nextFireStairsStep
    ? {
        markerId: nextFireStairsStep.fromMarker.id,
        floor: nextFireStairsStep.toFloor,
        goesDown: nextFireStairsStep.toFloor < Number(current?.floor),
      }
    : null;

  // Room sheet's "Get Directions" now opens the real Directions sheet
  // instead of jumping directly. "360° View" still just jumps, matching
  // web's actual behavior — that button was never directions-related.
  const handleRoomGetDirections = () => {
    if (!selectedRoomCard) return;
    openDirectionsTo(selectedRoomCard.node);
    setSelectedRoomCard(null);
  };
  const handleRoomView360 = () => {
    if (!selectedRoomCard) return;
    jumpToNode(selectedRoomCard.node.id);
    setSelectedRoomCard(null);
  };

  // ---------- Auto walk ----------
  const [autoWalking, setAutoWalking] = useState(false);

  // One step of the route: onto its first stop if the visitor isn't on the
  // route yet, otherwise along to the next stop.
  const autoStep = (path = directions?.path, stepIndex = directions?.stepIndex ?? 0) => {
    if (!path) return;
    if (stepIndex === 0 && currentId !== path[0]) handleStartWalking();
    else handleWalkToNextStop();
  };

  const toggleAutoWalk = () => {
    if (autoWalking) {
      setAutoWalking(false);
      return;
    }
    const path = directions?.path || computeRoute();
    if (!path) return;
    setAutoWalking(true);
    if (directions?.path) autoStep(path);
  };

  // Every 3 s after each step lands, take the next one; stop on arrival.
  useEffect(() => {
    if (!autoWalking) return undefined;
    if (!directions?.path || arrived) {
      setAutoWalking(false);
      return undefined;
    }
    const timer = setTimeout(() => autoStep(), AUTO_WALK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWalking, currentId, directions?.path, directions?.stepIndex, arrived]);

  // ---------- Bottom nav ----------
  const recentNames = useRecentRooms();
  const recentRooms = useMemo(
    () => recentNames.map((name) => searchableRooms.find((r) => r.roomName === name)).filter(Boolean),
    [recentNames, searchableRooms]
  );

  // The placard scanner's search button comes back here asking for the
  // search sheet (?panel=search); open it once, then clear the request.
  const { panel: requestedPanel } = useLocalSearchParams();
  useEffect(() => {
    if (requestedPanel !== "search") return;
    setActiveTab("search");
    setSearchQuery("");
    setPanelMode("search");
    router.setParams({ panel: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPanel]);

  // ---------- Saved rooms ----------
  const savedRooms = useSavedRooms();
  const selectedRoomSaved =
    !!selectedRoomCard && savedRooms.saved.some((s) => s.placard_dialog_id === Number(selectedRoomCard.placard?.id));

  // The room card's bookmark: flips at once; if the server refuses, it
  // flips back and says why (e.g. the 20-room limit).
  const toggleSaveRoom = (room) => {
    const id = room.placard?.id;
    if (id == null) return;
    const saved = savedRooms.saved.some((s) => s.placard_dialog_id === Number(id));
    if (saved) {
      unsaveRoom(id)
        .then(() => showToast(`Removed ${room.roomName} from saved`))
        .catch((err) => showToast(err.message));
    } else {
      saveRoom(id, room.roomName)
        .then(() => showToast(`Saved ${room.roomName}`))
        .catch((err) => showToast(err.message));
    }
  };

  // The Saved sheet's x: gone at once, with UNDO to put it back.
  const removeSavedRoom = (entry, room) => {
    const name = room?.roomName ?? entry.room_name;
    unsaveRoom(entry.placard_dialog_id)
      .then(() =>
        showToast(`Removed ${name}`, {
          actionLabel: "Undo",
          onAction: () => saveRoom(entry.placard_dialog_id, entry.room_name).catch((err) => showToast(err.message)),
        })
      )
      .catch((err) => showToast(err.message));
  };

  const handleTab = (tab) => {
    if (tab === "directions") {
      if (panelMode === "directions") {
        closePanel(); // the route is kept; the tab brings it back
        return;
      }
      setActiveTab("directions");
      openDirectionsPanel();
      return;
    }
    const panelFor = { location: "directory", search: "search", save: "saved", about: "about" }[tab];
    if (panelMode === panelFor) {
      closePanel();
      return;
    }
    setActiveTab(tab);
    setSearchQuery("");
    setPanelMode(panelFor);
  };

  const navBottom = insets.bottom + spacing.md;
  // Sheets float just above the nav, and never cover the logo.
  const sheetBottom = navBottom + NAV_HEIGHT + spacing.sm;
  const sheetTop = insets.top + 76;

  return (
    <View style={styles.screen}>
      {/* The panorama itself — a sharp JPEG copy decoded natively by
          expo-gl (see usePanoramaImage.js), with drag-to-look, hotspots
          and markers. */}
      <View style={styles.panoramaPlaceholder}>
        {loadError ? (
          <Text style={styles.panoramaErrorText}>{loadError}</Text>
        ) : !nodes ? (
          <Text style={styles.panoramaPlaceholderText}>Loading campus…</Text>
        ) : current ? (
          <View style={styles.panoramaViewerWrap}>
            <PanoramaViewer
              image={panorama}
              sceneKey={current.id}
              hotspots={hotspots}
              markers={markers}
              onNavigate={goTo}
              onMarkerTap={handleMarkerTap}
              isMarkerTappable={isMarkerTappable}
              // As on web: the route's next hotspot turns green, and an
              // elevator landing that is the next step pulses.
              highlightedId={nextStopId}
              highlightedMarkerId={nextElevatorRide?.fromMarker?.id ?? nextFireStairs?.markerId ?? null}
              previewsHidden={!!elevatorPicker}
              gyroEnabled={gyroOn}
              entryYaw={entryView.yaw}
              entryPitch={entryView.pitch}
            />
            {current.photo && !panorama && !photoError && (
              <View style={styles.panoramaStatus} pointerEvents="none">
                <Text style={styles.panoramaPlaceholderText}>Loading photo…</Text>
              </View>
            )}
            {photoError && (
              <View style={styles.panoramaStatus} pointerEvents="none">
                <Text style={styles.panoramaErrorText}>{photoError}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.panoramaPlaceholderText}>No locations yet</Text>
        )}
      </View>

      {/* ---------- Top: the logo, centred — SDCA and ARISE taking turns
          (see TopLogo). Brand board: nothing else up here, to leave the
          panorama clear. ---------- */}
      <View style={[styles.logoWrap, { top: insets.top + 10 }]} pointerEvents="none">
        <TopLogo />
      </View>

      {/* ---------- Bottom corners, above the nav: AR view (left) and the
          gyro look-around toggle (right). The placard scanner lives in the
          search sheet. Hidden while a sheet is up. ---------- */}
      {!panelMode && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.cornerBtnWrap, { bottom: sheetBottom + 4, left: spacing.xl }]}
        >
          <Pressable
            style={({ pressed }) => [styles.roundFloatingBtn, styles.largeFloatingBtn, pressed && styles.roundFloatingBtnPressed]}
            onPress={() => currentId && router.push({ pathname: "/ar-viewer", params: { nodeId: currentId } })}
            accessibilityLabel="View in AR"
          >
            <Icon name="arView" size={24} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>
      )}
      {!panelMode && gyroAvailable && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.cornerBtnWrap, { bottom: sheetBottom + 4, right: spacing.xl }]}
        >
          {/* Compass inside the four arrows, no plate behind it; the active
              half is dark, the other grey: black chevrons = drag to look
              (off), dark compass = move the phone to look (on). A soft white
              outline in the image keeps it readable over any panorama. */}
          <Pressable
            style={({ pressed }) => [styles.gyroBtn, pressed && styles.gyroBtnPressed]}
            hitSlop={6}
            onPress={() => setGyroOn((on) => !on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: gyroOn }}
            accessibilityLabel={gyroOn ? "Motion look on: move your phone to look around" : "Look around by moving your phone"}
          >
            <Image
              source={gyroOn ? COLOR_ICONS.gyroControl.on : COLOR_ICONS.gyroControl.off}
              style={styles.gyroIcon}
              resizeMode="contain"
            />
          </Pressable>
        </Animated.View>
      )}

      {/* ---------- Sheets ---------- */}
      {panelMode === "search" && (
        <SearchSheet
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          onClose={closePanel}
          onScan={() => {
            closePanel();
            router.push("/placard-scanner");
          }}
          inputRef={searchInputRef}
          recentRooms={recentRooms}
          onRemoveRecent={removeRecentRoom}
          suggestions={randomSuggestions}
          roomResults={roomResults}
          placeResults={placeResults}
          onPickRoom={openRoomCard}
          onPickPlace={(n) => jumpToNode(n.id)}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "directory" && (
        <DirectorySheet
          nodes={nodes}
          searchableRooms={searchableRooms}
          currentNode={current}
          onPickRoom={openRoomCard}
          onPickPlace={(node) => jumpToNode(node.id)}
          onClose={closePanel}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "saved" && (
        <SavedSheet
          saved={savedRooms.saved}
          limit={savedRooms.limit}
          status={savedRooms.status}
          searchableRooms={searchableRooms}
          onPickRoom={openRoomCard}
          onRemove={removeSavedRoom}
          onRetry={reloadSavedRooms}
          onClose={closePanel}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "about" && (
        <AboutSheet
          onClose={closePanel}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "room" && selectedRoomCard && (
        <MobileRoomSheet
          room={selectedRoomCard}
          saved={selectedRoomSaved}
          onToggleSave={() => toggleSaveRoom(selectedRoomCard)}
          onClose={closeRoomCard}
          onGetDirections={handleRoomGetDirections}
          onView360={handleRoomView360}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "directions" && directions && (
        <MobileDirectionsSheet
          directions={directions}
          fieldMatches={directionsFieldMatches}
          onClose={closeDirections}
          onChangeFrom={(text) => updateDirectionsField("from", text)}
          onChangeTo={(text) => updateDirectionsField("to", text)}
          onFocusFrom={() => setDirections((d) => (d ? { ...d, editingField: "from" } : d))}
          onFocusTo={() => setDirections((d) => (d ? { ...d, editingField: "to" } : d))}
          onPickFrom={(node) => pickDirectionsField("from", node)}
          onPickTo={(node) => pickDirectionsField("to", node)}
          onGetDirections={handleGetDirections}
          onStartWalking={handleStartWalking}
          onWalkNext={handleWalkToNextStop}
          autoWalking={autoWalking}
          onToggleAutoWalk={toggleAutoWalk}
          onNearestExit={openDirectionsToNearestExit}
          onDirections={switchToDirections}
          arrived={arrived}
          nextStopName={nextStopName}
          nextElevatorFloor={nextElevatorFloor}
          nextFireStairs={nextFireStairs}
          onBlocked={handleBlocked}
          currentId={currentId}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {/* ---------- The bottom nav: every menu, one floating pill ---------- */}
      <BottomNav active={panelMode === "directions" ? "directions" : panelMode ? activeTab : null} onPress={handleTab} bottom={navBottom} />

      {elevatorPicker && (
        <ElevatorPicker
          picker={elevatorPicker}
          routeFloor={nextElevatorFloor}
          onRide={rideElevatorTo}
          onClose={() => setElevatorPicker(null)}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      <ToastHost top={sheetTop} />

      {flyover && (
        <FlyoverPanel
          flyover={flyover}
          onComplete={completeFlyover}
          onCancel={cancelFlyover}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  panoramaPlaceholder: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  panoramaPlaceholderText: { ...typography.label, textAlign: "center" },
  panoramaErrorText: { ...typography.bodySmall, color: colors.danger, textAlign: "center", paddingHorizontal: spacing.xxl },
  panoramaViewerWrap: { flex: 1, width: "100%" },
  panoramaStatus: { position: "absolute", top: 130, left: 0, right: 0, alignItems: "center" },

  // A soft white plate keeps the logo legible over any panorama.
  logoWrap: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  roundFloatingBtn: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    ...shadows.floating,
  },
  roundFloatingBtnPressed: { backgroundColor: colors.iconButton },
  largeFloatingBtn: { position: "relative", width: 50, height: 50, borderRadius: 25 },
  cornerBtnWrap: { position: "absolute" },
  gyroBtn: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  gyroBtnPressed: { opacity: 0.6 },
  gyroIcon: { width: 76, height: 76 },

});
