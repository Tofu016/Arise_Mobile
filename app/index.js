import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import { useSearchableRooms } from "../src/hooks/useSearchableRooms";
import { usePanoramaImage } from "../src/hooks/usePanoramaImage";
import { useBuildings, useBuildingsSettled, campusOf } from "../src/utils/buildingStore";
import { allBuildings } from "../src/utils/constants";
import { searchCampus, pickLocationSuggestions, findRoomForMarker } from "../src/utils/search";
import * as route from "../src/utils/directionsRoute";
import { elevatorDestinationsFrom, arrivalYawFromLanding } from "../src/utils/elevators";
import { pickDefaultNode, pickFloorStart, walkEntryView, jumpEntryView, findFlyover } from "../src/utils/navigation";
import { useRecentRooms, addRecentRoom, removeRecentRoom } from "../src/hooks/useRecentRooms";
import { useSavedRooms, saveRoom, unsaveRoom } from "../src/hooks/useSavedRooms";
import MobileRoomSheet from "../src/components/MobileRoomSheet";
import MobileDirectionsSheet from "../src/components/MobileDirectionsSheet";
import ElevatorPicker from "../src/components/ElevatorPicker";
import FlyoverPanel from "../src/components/FlyoverPanel";
import PanoramaViewer from "../src/components/PanoramaViewer";
import SearchSheet from "../src/components/SearchSheet";
import DirectorySheet from "../src/components/DirectorySheet";
import AboutSheet from "../src/components/AboutSheet";
import BuildingSheet from "../src/components/BuildingSheet";
import ToastHost, { showToast } from "../src/components/Toast";
import BottomNav, { NAV_HEIGHT } from "../src/components/BottomNav";
import TopLogo from "../src/components/TopLogo";
import LoadingSpinner from "../src/components/LoadingSpinner";
import Icon, { COLOR_ICONS } from "../src/components/Icon";
import { useAnalytics } from "../src/hooks/useAnalytics";
import { isGyroAvailable } from "../src/utils/deviceLook";
import { colors, typography, radii, spacing, shadows } from "../src/theme";

// Auto walk steps along the route every 3 s — the brand board's
// "AUTO WALK (EVERY 3S)".
const AUTO_WALK_MS = 3000;
// The bottom-right buttons: the gyro toggle (its image, no plate) and the
// round AR button stacked above it.
const GYRO_SIZE = 76;
const AR_BTN_SIZE = 50;

export default function MainScreen() {
  const router = useRouter();
  const buildings = useBuildings(); // re-renders when the building list loads/changes
  const buildingsSettled = useBuildingsSettled();
  const { nodes, error: loadError } = usePublicNodes();
  // The status bar/notch takes up a different amount of space on every
  // device — a hardcoded "top: 12" would sit right under (or behind) it on
  // some phones. This gives the actual safe area for the current device.
  const insets = useSafeAreaInsets();

  // Only one sheet at a time, same as the web app's panelMode:
  //   null | "search" | "directory" | "room" | "directions" | "building" | "about"
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
  // switch to another server from the About sheet). Waits for the building
  // list too (or its failure), since the Main Campus entrance is picked by
  // each building's campus.
  useEffect(() => {
    if (nodes && buildingsSettled && (currentId === null || !nodes.some((n) => n.id === currentId))) {
      const start = pickDefaultNode(nodes, allBuildings());
      if (start) {
        setCurrentId(start.id);
        setEntryView(jumpEntryView(start));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, buildingsSettled]);

  const byId = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);

  const current = useMemo(() => {
    if (!nodes || !currentId) return null;
    return nodes.find((n) => n.id === currentId) || null;
  }, [nodes, currentId]);

  const { image: panorama, error: photoError } = usePanoramaImage(current?.photo);

  // Sessions for the Analytics dashboard (platform "mobile"). The campus and
  // building come from the first spot the visitor is on; the server keeps
  // the first values it is given.
  const analytics = useAnalytics();
  const currentBuilding = current?.building;
  useEffect(() => {
    if (currentBuilding) analytics.setLocation(campusOf(currentBuilding), currentBuilding);
  }, [analytics, currentBuilding]);

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
  // of the doors) rather than "keep walking the same way". `from`: the stop
  // just before arrival, when that isn't where the visitor stands (Skip
  // hallway passes over several), for the arrival view's return arrow.
  const goTo = (id, hotspot, { ride = false, from = currentId } = {}) =>
    requestMove(id, () => {
      analytics.move("walk", currentId, id);
      setCurrentId(id);
      setEntryView(ride ? walkEntryView(hotspot) : walkEntryView(hotspot, byId[id], from));
    });

  // ---------- Search ----------
  const [searchQuery, setSearchQuery] = useState("");
  // Rooms with actual detail records (photo/description/department/use) —
  // see useSearchableRooms.js for how this is built.
  const { searchableRooms } = useSearchableRooms();

  // Rooms first, then plain node-name matches (entrances, hallways, etc.)
  // not already surfaced as a room: utils/search.js, shared with web.
  const { roomResults, placeResults } = useMemo(
    () => searchCampus(searchQuery, nodes, searchableRooms),
    [nodes, searchQuery, searchableRooms]
  );

  // A fresh random sample each time the sheet opens: rooms with details,
  // then places filling what's left, as web's pickLocationSuggestions.
  const { rooms: randomSuggestions, places: randomPlaceSuggestions } = useMemo(
    () => pickLocationSuggestions(nodes, searchableRooms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelMode === "search", searchableRooms, nodes]
  );

  // Tracked after a pause in typing, not per keystroke: a pause is a fair
  // proxy for "this is the search they meant to run".
  useEffect(() => {
    if (!searchQuery.trim()) return undefined;
    const timer = setTimeout(() => {
      analytics.roomSearched(searchQuery, roomResults[0]?.node?.id, roomResults.length > 0);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const jumpToNode = (id) => {
    requestMove(id, () => {
      analytics.move("jump", currentId, id);
      setCurrentId(id);
      setEntryView(jumpEntryView(nodes?.find((n) => n.id === id)));
    });
    setSearchQuery("");
    closePanel();
  };

  // The visitor picking a destination themselves (search, directory, room
  // card) is what "go_to" counts; directions' own hop to its first stop
  // uses plain jumpToNode.
  const jumpToDestination = (id) => {
    if (flyover) return;
    analytics.goTo(id);
    jumpToNode(id);
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
  // The state and every transition are utils/directionsRoute.js, shared with
  // the web app, so both apps resolve, route, re-route and step through a
  // route the same way. `null` means no directions are open.
  const [directions, setDirections] = useState(null);

  // Keep an active route in sync with wherever the visitor actually is:
  // following the route advances the step, wandering off re-routes from the
  // new spot (honoring the chosen stairs/elevator), and off a Nearest exit
  // route it aims at whichever exit is nearest from here.
  useEffect(() => {
    if (!nodes) return;
    setDirections((d) => route.syncToPosition(d, currentId, nodes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const showDirections = (next) => {
    setDirections(next);
    setSearchQuery("");
    searchInputRef.current?.blur();
    setPanelMode("directions");
  };

  // Opening directions always REPLACES whatever the panel was showing,
  // same as web/PWA — Maps switches from place details straight into
  // directions mode, not stacking both.
  const openDirectionsTo = (node) => showDirections(route.openDirectionsTo(current, node));

  // Tracked the moment a route resolves: directions.path flips from falsy
  // to a real array once per route.
  const directionsPathRef = useRef(null);
  useEffect(() => {
    const path = directions?.path ?? null;
    if (path && path !== directionsPathRef.current) analytics.directionsRequested(directions.fromId, directions.toId);
    directionsPathRef.current = path;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directions?.path]);

  // The Directions tab: back to the route in progress if there is one
  // (switching tabs keeps it), otherwise a fresh one from where you're
  // standing, with the destination left to pick.
  const openDirectionsPanel = () => showDirections(directions || route.openDirections(current));

  // The Nearest exit sheet's DIRECTIONS button: back to ordinary
  // directions from where you are now, keeping the destination that was
  // being planned before switching to the exit (if any).
  const plannedDestinationRef = useRef(null);
  const switchToDirections = () => {
    setAutoWalking(false);
    const planned = plannedDestinationRef.current;
    setDirections({ ...route.openDirections(current), toQuery: planned?.toQuery || "", toId: planned?.toId || null });
  };

  // The Directions sheet's NEAREST EXIT button: replaces whatever route was
  // being planned with the route to the nearest Emergency Exit Destination
  // Point an admin ticked (utils/evacuation.js, through directionsRoute's
  // getEmergencyDirections, as on web). It never uses an elevator, takes the
  // hidden fire stairs listed by Emergency Exit markers, and never climbs
  // above the visitor's floor or Floor 1 unless nothing else exists.
  const openDirectionsToNearestExit = () => {
    if (!current || !nodes) return;
    setAutoWalking(false);
    plannedDestinationRef.current =
      !directions?.emergency && directions?.toId ? { toQuery: directions.toQuery, toId: directions.toId } : null;
    showDirections(route.getEmergencyDirections(route.openDirections(current), nodes));
  };

  // "This way is blocked": the visitor reports the route's next stop
  // impassable (smoke, fire, a locked door). It is excluded for the rest of
  // this emergency route and the way out is recomputed from where they stand.
  const handleBlocked = () => {
    if (!nodes) return;
    setDirections((d) => route.blockNextStop(d, nodes, currentId));
  };

  const closeDirections = () => {
    setAutoWalking(false);
    setDirections(null);
    closePanel();
  };

  // From/To suggestions: rooms first, then places, no duplicates, the same
  // as the search sheet (and as web's directions panel).
  const directionsQuery = route.activeQuery(directions);
  const directionsSuggestions = useMemo(() => {
    if (!directions?.editingField || !directionsQuery.trim()) return { rooms: [], places: [] };
    const { roomResults: rooms, placeResults: places } = searchCampus(directionsQuery, nodes, searchableRooms);
    return { rooms, places };
  }, [directions?.editingField, directionsQuery, nodes, searchableRooms]);

  // "Get directions": resolves typed text by exact name when nothing was
  // picked, then computes the route; a route that changes floor may come
  // back asking stairs or elevator first (pendingModeChoice). Returns the
  // route's path, or null.
  const computeRoute = () => {
    if (!directions || !nodes) return null;
    const next = route.getDirections(directions, nodes, searchableRooms);
    setDirections(next);
    return next.path;
  };

  const handleGetDirections = () => {
    computeRoute();
  };

  const handleChooseMode = (mode) => setDirections((d) => route.chooseTransportMode(d, mode));

  const handleStartWalking = () => {
    if (!directions?.path) return;
    jumpToNode(directions.path[0]);
    setDirections((d) => (d ? route.restartRoute(d) : d));
    setPanelMode("directions"); // jumpToNode closes the panel — reopen it for the route in progress
  };

  // A walk along the route's next link, an elevator ride, or (on a Nearest
  // exit route) the hidden fire stairs, as route.nextStep says. Not
  // jumpToNode: that clears search and closes the panel, and we want to stay
  // in the directions view while progressing through the route. An elevator
  // or fire stairs step carries its own arrival view (out of the doors).
  const handleWalkToNextStop = () => {
    const step = route.nextStep(directions, hotspots, nodes);
    if (!step) return;
    if (step.kind === "walk") {
      goTo(step.id, { yaw: step.yaw, defaultYaw: step.defaultYaw, defaultPitch: step.defaultPitch });
      return;
    }
    goTo(step.id, step.yaw == null ? undefined : { yaw: step.yaw }, { ride: true });
  };

  // Where the visitor is along the route: whether they've arrived, the next
  // stop, which way to turn, and whether the next step is an elevator ride
  // ({ markerId, floor }) or the hidden fire stairs ({ markerId, floor,
  // goesDown }).
  const progress = route.routeProgress(directions, { byId, hotspots, entryYaw: entryView.yaw, nodes });
  const { arrived, nextStopId, nextStopName, nextElevator, nextFireStairs, turnInstruction } = progress;
  const nextElevatorFloor = nextElevator?.floor ?? null;

  // "Skip hallway": once walking, the end of the straight run ahead in one
  // move (see route.straightRunAhead).
  const skip = route.hasStartedWalking(directions, currentId) ? route.straightRunAhead(directions, byId) : null;
  const handleSkipAhead = () => {
    if (!skip) return;
    goTo(skip.targetId, skip.angle, { from: skip.via[skip.via.length - 1] });
  };

  // Room sheet's "Get Directions" now opens the real Directions sheet
  // instead of jumping directly. "360° View" still just jumps, matching
  // web's actual behavior — that button was never directions-related.
  const handleRoomGetDirections = () => {
    if (!selectedRoomCard) return;
    openDirectionsTo(selectedRoomCard.node);
    setSelectedRoomCard(null);
  };
  const handleRoomGoTo = () => {
    if (!selectedRoomCard) return;
    jumpToDestination(selectedRoomCard.node.id);
    setSelectedRoomCard(null);
  };

  // The room's own 360 photo, inside the AR portal. The card stays open
  // underneath, so closing the portal comes back to it.
  const handleRoomView360 = () => {
    if (!selectedRoomCard) return;
    router.push({ pathname: "/ar-portal", params: { roomName: selectedRoomCard.roomName } });
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

  // The Building sheet's picks (an entrance, or a floor's starting node):
  // a jump, as on web. Already standing there just closes the sheet.
  const pickBuildingNode = (id) => {
    if (!id || id === currentId) {
      closePanel();
      return;
    }
    jumpToDestination(id);
  };

  const handleTab = (tab) => {
    if (tab === "scan") {
      closePanel();
      router.push("/placard-scanner");
      return;
    }
    const panelFor = { location: "directory", search: "search", building: "building", about: "about" }[tab];
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
          <LoadingSpinner label="Loading campus" />
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
              highlightedMarkerId={nextElevator?.markerId ?? nextFireStairs?.markerId ?? null}
              previewsHidden={!!elevatorPicker}
              gyroEnabled={gyroOn}
              entryYaw={entryView.yaw}
              entryPitch={entryView.pitch}
            />
            {current.photo && !panorama && !photoError && (
              <View style={styles.panoramaSpinner} pointerEvents="none">
                <LoadingSpinner label="Loading photo" />
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

      {/* ---------- Bottom-right, above the nav: the gyro look-around
          toggle in the corner, the AR view button stacked above it (centred
          over it). The placard scanner is the bottom nav's scan button. Hidden
          while a sheet is up. ---------- */}
      {!panelMode && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.cornerBtnWrap,
            gyroAvailable
              ? { bottom: sheetBottom + 4 + GYRO_SIZE + spacing.sm, right: spacing.xl + (GYRO_SIZE - AR_BTN_SIZE) / 2 }
              : { bottom: sheetBottom + 4, right: spacing.xl },
          ]}
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
          {/* Compass inside the four arrows, no plate behind it: black
              chevrons + grey compass = drag to look (off); dim chevrons + a
              maroon compass with a gold needle = move the phone to look (on),
              so "on" is unmistakable. A soft white outline in the image keeps
              it readable over any panorama. */}
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
          onDirections={openDirectionsPanel}
          inputRef={searchInputRef}
          recentRooms={recentRooms}
          onRemoveRecent={removeRecentRoom}
          suggestions={randomSuggestions}
          placeSuggestions={randomPlaceSuggestions}
          roomResults={roomResults}
          placeResults={placeResults}
          onPickRoom={openRoomCard}
          onPickPlace={(n) => jumpToDestination(n.id)}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "directory" && (
        <DirectorySheet
          searchableRooms={searchableRooms}
          currentNode={current}
          saved={savedRooms.saved}
          savedLimit={savedRooms.limit}
          savedReady={savedRooms.status === "ready"}
          onRemoveSaved={removeSavedRoom}
          onPickRoom={openRoomCard}
          onClose={closePanel}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "building" && (
        <BuildingSheet
          nodes={nodes}
          currentNode={current}
          onPickNode={pickBuildingNode}
          onPickFloor={(buildingId, floor) => pickBuildingNode(pickFloorStart(nodes, buildingId, floor)?.id)}
          onClose={closePanel}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "about" && (
        <AboutSheet
          onClose={closePanel}
          onFeedbackSubmitted={(feedback) => analytics.feedbackSubmitted(feedback?.id, feedback?.rating)}
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
          onGoTo={handleRoomGoTo}
          onGetDirections={handleRoomGetDirections}
          onView360={handleRoomView360}
          bottomOffset={sheetBottom}
          topLimit={sheetTop}
        />
      )}

      {panelMode === "directions" && directions && (
        <MobileDirectionsSheet
          directions={directions}
          suggestions={directionsSuggestions}
          onClose={closeDirections}
          onChangeFrom={(text) => setDirections((d) => route.editField(d, "from", text))}
          onChangeTo={(text) => setDirections((d) => route.editField(d, "to", text))}
          onFocusFrom={() => setDirections((d) => (d ? route.focusField(d, "from") : d))}
          onFocusTo={() => setDirections((d) => (d ? route.focusField(d, "to") : d))}
          onPickRoom={(field, room) => setDirections((d) => route.pickRoomField(d, field, room))}
          onPickPlace={(field, node) => setDirections((d) => route.pickNodeField(d, field, node))}
          onChooseMode={handleChooseMode}
          skip={skip}
          onSkipAhead={handleSkipAhead}
          turnInstruction={turnInstruction}
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
      <BottomNav active={panelMode && panelMode !== "directions" ? activeTab : null} onPress={handleTab} bottom={navBottom} />

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
  // The photo's loading spinner, in the middle of the screen.
  panoramaSpinner: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },

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
  largeFloatingBtn: { position: "relative", width: AR_BTN_SIZE, height: AR_BTN_SIZE, borderRadius: AR_BTN_SIZE / 2 },
  cornerBtnWrap: { position: "absolute" },
  gyroBtn: { width: GYRO_SIZE, height: GYRO_SIZE, alignItems: "center", justifyContent: "center" },
  gyroBtnPressed: { opacity: 0.6 },
  gyroIcon: { width: GYRO_SIZE, height: GYRO_SIZE },

});
