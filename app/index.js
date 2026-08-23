import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/useAuth";
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import { useSearchableRooms } from "../src/hooks/useSearchableRooms";
import { useSecurePhotoPixels } from "../src/hooks/useSecurePhotoPixels";
import { useCustomBuildingsVersion } from "../src/utils/buildingStore";
import { allBuildings, buildingLabel, floorLabel, defaultHotspotAngle, markerTypeInfo } from "../src/utils/constants";
import { searchRooms, searchNodes } from "../src/utils/search";
import { findPath } from "../src/utils/pathfinding";
import MobileRoomSheet from "../src/components/MobileRoomSheet";
import MobileDirectionsSheet from "../src/components/MobileDirectionsSheet";
import PanoramaViewer from "../src/components/PanoramaViewer";

// Same logic as the web app's pickDefaultNode: prefer an entrance, in
// building order (GD1, GD2, GD3, then any admin-added buildings), lowest
// floor first.
function pickDefaultNode(nodes) {
  if (!nodes || nodes.length === 0) return null;
  const entrances = nodes.filter((n) => n.type === "entrance");
  if (entrances.length === 0) return nodes[0];
  const order = allBuildings().map((b) => b.id);
  return [...entrances].sort((a, b) => {
    const ai = order.indexOf(a.building);
    const bi = order.indexOf(b.building);
    if (ai !== bi) return ai - bi;
    return (a.floor ?? 0) - (b.floor ?? 0);
  })[0];
}

// Same idea, scoped to one building — used by the Building selector to jump
// straight to that building's first entrance when picked.
function pickDefaultEntranceForBuilding(nodes, buildingId) {
  if (!nodes) return null;
  const inBuilding = nodes.filter((n) => n.type === "entrance" && n.building === buildingId);
  if (inBuilding.length === 0) return null;
  return [...inBuilding].sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))[0];
}

export default function MainScreen() {
  const router = useRouter();
  useCustomBuildingsVersion(); // re-render when an admin adds/removes a building
  const { user, profile, role, signOut } = useAuth();
  const { nodes, error: loadError } = usePublicNodes();
  // The status bar/notch takes up a different amount of space on every
  // device — a hardcoded "top: 12" would sit right under (or behind) it on
  // some phones. This gives the actual safe area for the current device.
  const insets = useSafeAreaInsets();

  // Same single-source-of-truth pattern as the web app's panelMode: only one
  // floating panel showing at a time. "search"/"account" are filled in with
  // placeholder content in this stage; "room"/"directions" arrive in 3d/3e.
  const [panelMode, setPanelMode] = useState(null);
  const searchInputRef = useRef(null);
  // The search TextInput never unmounts (only the results panel below it
  // does) — so closing the panel without explicitly blurring it leaves the
  // input still focused at the native level. Tapping it again wouldn't
  // fire onFocus a second time (it's already focused), silently breaking
  // "tap to reopen search." Blurring here makes the next tap a genuine new
  // focus event again. Harmless no-op when some other panel (account,
  // building) is what's actually closing.
  const closePanel = () => {
    setPanelMode(null);
    searchInputRef.current?.blur();
  };

  const [buildingFilter, setBuildingFilter] = useState("all");
  const [currentId, setCurrentId] = useState(null);
  const [history, setHistory] = useState([]);
  const [entryYaw, setEntryYaw] = useState(0);

  // Land directly in the tour instead of an intermediate menu screen.
  useEffect(() => {
    if (nodes && currentId === null) {
      const start = pickDefaultNode(nodes);
      if (start) setCurrentId(start.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const current = useMemo(() => {
    if (!nodes || !currentId) return null;
    return nodes.find((n) => n.id === currentId) || null;
  }, [nodes, currentId]);

  const { pixels, error: photoError } = useSecurePhotoPixels(current?.photo);

  // Same hotspot-position logic as web's MainPage.jsx — falls back to an
  // evenly-spaced default angle for any neighbor that hasn't had its arrow
  // manually positioned by an admin yet.
  const hotspots = useMemo(() => {
    if (!current || !nodes) return [];
    const neighborIds = current.neighbors || [];
    return neighborIds.map((nid, idx) => {
      const target = nodes.find((n) => n.id === nid);
      const angle = current.hotspots?.[nid] || defaultHotspotAngle(idx, neighborIds.length);
      return { id: nid, name: target?.name || nid, ...angle };
    });
  }, [current, nodes]);

  // Fixed point-of-interest markers (rooms/facilities/exits/hydrants) for
  // the current node — same shape as web's, no processing needed.
  const markers = current?.markers || [];
  const [selectedMarker, setSelectedMarker] = useState(null);
  const handleMarkerTap = (markerId) => {
    const marker = markers.find((m) => m.id === markerId);
    if (marker) setSelectedMarker(marker);
  };
  // Dismiss the info banner whenever navigating anywhere — it belongs to
  // whatever panorama was showing when it was tapped, not the next one.
  useEffect(() => {
    setSelectedMarker(null);
  }, [currentId]);

  // Walking via a hotspot tap — pushes history (so Back works) and starts
  // the new panorama facing roughly the direction you were walking, same
  // as web. Distinct from jumpToNode below (search results / room card),
  // which is a fresh start with no history, matching web's same distinction.
  const goTo = (id, angle) => {
    setHistory((h) => (currentId ? [...h, currentId] : h));
    setCurrentId(id);
    setEntryYaw(angle?.yaw ?? 0);
  };

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = [...h];
      setCurrentId(next.pop());
      setEntryYaw(0);
      return next;
    });
  };

  const buildingOptions = useMemo(
    () => [{ id: "all", label: "All Buildings" }, ...allBuildings()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes]
  );

  const handleBuildingPick = (buildingId) => {
    setBuildingFilter(buildingId);
    setPanelMode(null);
    if (buildingId === "all") return;
    const entrance = pickDefaultEntranceForBuilding(nodes, buildingId);
    if (entrance) {
      setHistory([]);
      setCurrentId(entrance.id);
    }
  };

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
    setHistory([]);
    setCurrentId(id);
    setEntryYaw(0);
    setSearchQuery("");
    closePanel();
  };

  // The currently-open room detail sheet, or null.
  const [selectedRoomCard, setSelectedRoomCard] = useState(null);

  const openRoomCard = (room) => {
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
    const reroute = findPath(nodes, currentId, directions.toId);
    setDirections((d) => {
      if (!d) return d;
      if (!reroute) return { ...d, path: null, stepIndex: 0, error: "Lost the route from here — try Get directions again." };
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
    });
    setSearchQuery("");
    searchInputRef.current?.blur();
    setPanelMode("directions");
  };

  const closeDirections = () => {
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

  const handleGetDirections = () => {
    if (!directions?.fromId || !directions?.toId) {
      setDirections((d) => ({ ...d, error: "Pick both a starting point and a destination from the suggestions." }));
      return;
    }
    const path = findPath(nodes, directions.fromId, directions.toId);
    if (!path) {
      setDirections((d) => ({ ...d, path: null, error: "No walkable route found between these two points yet." }));
      return;
    }
    setDirections((d) => ({ ...d, path, stepIndex: 0, error: "" }));
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
    // Deliberately setCurrentId directly, not jumpToNode — that clears
    // search/closes the panel, and we want to stay in the directions view
    // while progressing through the route.
    setCurrentId(nextId);
  };

  const arrived = directions?.path && directions.stepIndex === directions.path.length - 1;
  const nextStopId = directions?.path?.[directions.stepIndex + 1] || null;
  const nextStopName = nextStopId ? (nodes?.find((n) => n.id === nextStopId)?.name || nextStopId) : null;

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

  const handleRoomResultPress = (room) => openRoomCard(room);

  const displayName = profile?.name || user?.email || "";
  const initials = displayName
    ? displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const currentBuildingLabel =
    buildingOptions.find((b) => b.id === buildingFilter)?.label || "All Buildings";

  return (
    <View style={styles.screen}>
      {/* The real panorama photo, secured the same way as web (fetched via
          the Storage SDK, not a public link) — drag-to-look and hotspots
          arrive in the next Stage 4 checkpoints. */}
      <View style={styles.panoramaPlaceholder}>
        {loadError ? (
          <Text style={styles.panoramaErrorText}>{loadError}</Text>
        ) : !nodes ? (
          <Text style={styles.panoramaPlaceholderText}>Loading campus…</Text>
        ) : current ? (
          <View style={styles.panoramaViewerWrap}>
            <PanoramaViewer
              pixels={pixels}
              hotspots={hotspots}
              markers={markers}
              onNavigate={goTo}
              onMarkerTap={handleMarkerTap}
              entryYaw={entryYaw}
            />
            {current.photo && !pixels && !photoError && (
              <View style={styles.panoramaDebugOverlay} pointerEvents="none">
                <Text style={styles.panoramaPlaceholderText}>Loading photo…</Text>
              </View>
            )}
            {photoError && (
              <View style={styles.panoramaDebugOverlay} pointerEvents="none">
                <Text style={styles.panoramaErrorText}>{photoError}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.panoramaPlaceholderText}>No locations yet</Text>
        )}
      </View>

      {/* ---------- Marker info banner ---------- */}
      {selectedMarker && (
        <View style={[styles.markerBanner, { top: insets.top + 60 }]}>
          <View style={[styles.markerBannerDot, { backgroundColor: markerTypeInfo(selectedMarker.type).color }]}>
            <Text style={styles.markerBannerIcon}>{markerTypeInfo(selectedMarker.type).icon}</Text>
          </View>
          <Text style={styles.markerBannerLabel} numberOfLines={2}>{selectedMarker.label}</Text>
          <Pressable onPress={() => setSelectedMarker(null)} hitSlop={10}>
            <Text style={styles.markerBannerClose}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* ---------- Top bar ---------- */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        {history.length > 0 && (
          <Pressable style={styles.backBtn} onPress={goBack} title="Back">
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
        )}

        <Pressable style={styles.arBtn} onPress={() => router.push("/placard-scanner")}>
          <Text style={styles.arBtnText}>AR</Text>
        </Pressable>

        <View style={styles.searchBar}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setPanelMode("search")}
            placeholder="Search a room..."
            placeholderTextColor="#6b7280"
          />
        </View>

        <Pressable
          style={styles.accountBtn}
          onPress={() => setPanelMode((m) => (m === "account" ? null : "account"))}
        >
          <Text style={styles.accountBtnText}>{initials}</Text>
        </Pressable>
      </View>

      {/* ---------- Top-anchored panel: search / account ---------- */}
      {(panelMode === "search" || panelMode === "account") && (
        <>
          <Pressable style={styles.topPanelBackdrop} onPress={closePanel} />
          <View style={[styles.topPanel, { top: insets.top + 60 }]}>
            {panelMode === "search" && (
              <ScrollView style={styles.searchResultsScroll} keyboardShouldPersistTaps="handled">
                {!searchQuery.trim() && randomSuggestions.length > 0 && (
                  <>
                    <Text style={styles.resultsLabel}>Suggested rooms</Text>
                    {randomSuggestions.map((r) => (
                      <View key={r.roomName} style={styles.resultRowOuter}>
                        <Pressable style={styles.resultRowMain} onPress={() => handleRoomResultPress(r)}>
                          <Text style={styles.resultName}>{r.roomName}</Text>
                          <Text style={styles.resultSub}>
                            {r.placard.use ? `${r.placard.use} · ` : ""}
                            {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                          </Text>
                        </Pressable>
                        <Pressable style={styles.resultDirectionsBtn} onPress={() => openDirectionsTo(r.node)}>
                          <Text style={styles.resultDirectionsBtnText}>➜</Text>
                        </Pressable>
                      </View>
                    ))}
                  </>
                )}

                {roomResults.length > 0 && (
                  <>
                    <Text style={styles.resultsLabel}>Rooms</Text>
                    {roomResults.map((r) => (
                      <View key={r.roomName} style={styles.resultRowOuter}>
                        <Pressable style={styles.resultRowMain} onPress={() => handleRoomResultPress(r)}>
                          <Text style={styles.resultName}>{r.roomName}</Text>
                          <Text style={styles.resultSub}>
                            {r.placard.use ? `${r.placard.use} · ` : ""}
                            {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                          </Text>
                        </Pressable>
                        <Pressable style={styles.resultDirectionsBtn} onPress={() => openDirectionsTo(r.node)}>
                          <Text style={styles.resultDirectionsBtnText}>➜</Text>
                        </Pressable>
                      </View>
                    ))}
                  </>
                )}

                {placeResults.length > 0 && (
                  <>
                    <Text style={styles.resultsLabel}>Places</Text>
                    {placeResults.map((n) => (
                      <View key={n.id} style={styles.resultRowOuter}>
                        <Pressable style={styles.resultRowMain} onPress={() => jumpToNode(n.id)}>
                          <Text style={styles.resultName}>{n.name}</Text>
                          <Text style={styles.resultSub}>
                            {n.rooms?.length ? `Rooms: ${n.rooms.join(", ")} · ` : ""}
                            {buildingLabel(n.building)} · {floorLabel(n.floor)}
                          </Text>
                        </Pressable>
                        <Pressable style={styles.resultDirectionsBtn} onPress={() => openDirectionsTo(n)}>
                          <Text style={styles.resultDirectionsBtnText}>➜</Text>
                        </Pressable>
                      </View>
                    ))}
                  </>
                )}

                {searchQuery.trim() && roomResults.length === 0 && placeResults.length === 0 && (
                  <Text style={styles.panelPlaceholderText}>No room or place found for "{searchQuery}".</Text>
                )}
              </ScrollView>
            )}

            {panelMode === "account" && (
              <View style={styles.accountPanelContent}>
                <View style={styles.accountAvatarLarge}>
                  <Text style={styles.accountAvatarLargeText}>{initials}</Text>
                </View>
                <Text style={styles.accountNameText} numberOfLines={1}>{displayName}</Text>
                {role === "admin" && (
                  <Text style={styles.adminHint}>
                    🛠 Admin account — manage the Admin Panel from a desktop browser
                  </Text>
                )}
                <View style={styles.accountDivider} />
                {/* TEMPORARY — testing entry point for the AR portal work in
                    progress (Stage D). Remove once Stage D4 wires the real
                    matched-room → AR flow from the placard scanner. */}
                <Pressable style={styles.signOutBtn} onPress={() => router.push("/ar-portal")}>
                  <Text style={styles.signOutBtnText}>🧪 Test AR Portal</Text>
                </Pressable>
                <Pressable style={styles.signOutBtn} onPress={signOut}>
                  <Text style={styles.signOutBtnText}>Sign out</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}

      {/* ---------- Persistent bottom Building selector — hidden while
          a bottom sheet (room/directions) is occupying that space. ---------- */}
      {panelMode !== "room" && panelMode !== "directions" && (
        <View style={[styles.bottomBarWrap, { bottom: insets.bottom + 16 }]}>
          {panelMode === "building" && (
            <View style={styles.buildingMenu}>
              {buildingOptions.map((b) => (
                <Pressable
                  key={b.id}
                  style={styles.buildingOption}
                  onPress={() => handleBuildingPick(b.id)}
                >
                  <Text
                    style={[
                      styles.buildingOptionText,
                      buildingFilter === b.id && styles.buildingOptionTextActive,
                    ]}
                  >
                    {b.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            style={styles.buildingTrigger}
            onPress={() => setPanelMode((m) => (m === "building" ? null : "building"))}
          >
            <Text style={styles.buildingTriggerText}>{currentBuildingLabel}</Text>
            <Text style={styles.buildingCaret}>{panelMode === "building" ? "▴" : "▾"}</Text>
          </Pressable>
        </View>
      )}

      {/* ---------- Room detail sheet (draggable) ---------- */}
      {panelMode === "room" && selectedRoomCard && (
        <MobileRoomSheet
          room={selectedRoomCard}
          onClose={closeRoomCard}
          onGetDirections={handleRoomGetDirections}
          onView360={handleRoomView360}
        />
      )}

      {/* ---------- Directions sheet ---------- */}
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
          arrived={arrived}
          nextStopName={nextStopName}
          currentId={currentId}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1115" },

  panoramaPlaceholder: {
    flex: 1,
    backgroundColor: "#14161c",
    alignItems: "center",
    justifyContent: "center",
  },
  panoramaPlaceholderText: { color: "#6b7280", fontSize: 13, textAlign: "center", lineHeight: 20 },
  panoramaCurrentName: { color: "#e6e6e6", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  panoramaCurrentSub: { color: "#9aa0ac", fontSize: 13, textAlign: "center", marginBottom: 16 },
  panoramaErrorText: { color: "#ff9a9a", fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  panoramaViewerWrap: { flex: 1, width: "100%" },
  panoramaDebugOverlay: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    alignItems: "center",
  },

  markerBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#191b22",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  markerBannerDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  markerBannerIcon: { fontSize: 14 },
  markerBannerLabel: { flex: 1, color: "#e6e6e6", fontSize: 14 },
  markerBannerClose: { color: "#9aa0ac", fontSize: 16, paddingHorizontal: 4 },

  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  arBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2d38",
    backgroundColor: "#191b22",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  arBtnText: { color: "#4a9eff", fontWeight: "700", fontSize: 13, letterSpacing: 0.5 },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2d38",
    backgroundColor: "#191b22",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  backBtnText: { color: "#e6e6e6", fontSize: 16 },

  searchBar: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a2d38",
    backgroundColor: "#191b22",
    justifyContent: "center",
    paddingHorizontal: 14,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  searchPlaceholderText: { color: "#6b7280", fontSize: 14 },
  searchInput: { color: "#e6e6e6", fontSize: 14, padding: 0 },

  accountBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4a9eff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  accountBtnText: { color: "#0f1115", fontWeight: "700", fontSize: 13 },

  topPanelBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  topPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "#191b22",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 12,
    padding: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  panelPlaceholderText: { color: "#9aa0ac", fontSize: 13, textAlign: "center", paddingVertical: 8 },

  searchResultsScroll: { maxHeight: 360 },
  resultsLabel: {
    color: "#6b7280",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 4,
  },
  resultRowOuter: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultRowMain: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8 },
  resultDirectionsBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2d38",
    backgroundColor: "#262a35",
    alignItems: "center",
    justifyContent: "center",
  },
  resultDirectionsBtnText: { color: "#4a9eff", fontSize: 14 },
  resultName: { color: "#e6e6e6", fontSize: 14, marginBottom: 2 },
  resultSub: { color: "#9aa0ac", fontSize: 12 },

  accountPanelContent: { alignItems: "center", gap: 10, paddingVertical: 4 },
  accountAvatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4a9eff",
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarLargeText: { color: "#0f1115", fontWeight: "700", fontSize: 18 },
  accountNameText: { color: "#e6e6e6", fontSize: 15, maxWidth: "100%" },
  adminHint: {
    color: "#9aa0ac",
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 15,
  },
  accountDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#2a2d38",
    marginTop: 4,
  },
  signOutBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  signOutBtnText: { color: "#e6e6e6", fontSize: 14 },

  bottomBarWrap: { position: "absolute", left: 12, right: 12 },
  buildingTrigger: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2d38",
    backgroundColor: "#191b22",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  buildingTriggerText: { color: "#e6e6e6", fontSize: 14 },
  buildingCaret: { color: "#9aa0ac", fontSize: 12 },
  // Opens UPWARD unconditionally, same reasoning as the web mobile version:
  // this trigger sits at the bottom edge of the screen, so a menu that
  // opened downward would run off-screen.
  buildingMenu: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    marginBottom: 8,
    backgroundColor: "#191b22",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 12,
    padding: 6,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  buildingOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  buildingOptionText: { color: "#e6e6e6", fontSize: 14 },
  buildingOptionTextActive: { color: "#4a9eff", fontWeight: "700" },

});
