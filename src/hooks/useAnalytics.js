import { useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { apiRequest } from "../api/client";

// Mobile counterpart of the web app's useAnalytics (Analytics_API/track),
// counting this app's sessions as platform "mobile". Same batching and the
// same event shapes, so Analytics shows the app next to web and kiosk.
// Best-effort: a failed flush (offline, or an API that predates the mobile
// platform) is swallowed and never reaches the visitor.

const FLUSH_INTERVAL_MS = 15000;
const MAX_QUEUED = 10;
// Matches Cron_API's stale-session cutoff: past this long away, coming back
// is a new visit rather than the old session resuming.
const SESSION_GAP_MS = 30 * 60 * 1000;

// Hermes has no guaranteed crypto.randomUUID, and these ids only need to be
// unique per session, so a plain UUID v4.
function newSessionId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Returns { setLocation, roomSearched, goTo, directionsRequested, move,
// feedbackSubmitted }.
export function useAnalytics() {
  const sessionIdRef = useRef(newSessionId());
  const queueRef = useRef([]);
  const metaRef = useRef({ campus: null, building: null });
  const backgroundedAtRef = useRef(null);

  const flushRef = useRef(() => {});
  flushRef.current = () => {
    if (!queueRef.current.length) return;
    const events = queueRef.current;
    queueRef.current = [];
    apiRequest("Analytics_API/track", {
      method: "POST",
      body: { session_id: sessionIdRef.current, client: "mobile", ...metaRef.current, events },
    }).catch(() => {});
  };

  useEffect(() => {
    const interval = setInterval(() => flushRef.current(), FLUSH_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const awayFor = backgroundedAtRef.current ? Date.now() - backgroundedAtRef.current : 0;
        backgroundedAtRef.current = null;
        if (awayFor > SESSION_GAP_MS) {
          sessionIdRef.current = newSessionId();
          metaRef.current = { campus: null, building: null };
        }
        return;
      }
      // The OS can freeze the app right after this, so send what is queued now.
      if (backgroundedAtRef.current === null) backgroundedAtRef.current = Date.now();
      flushRef.current();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      flushRef.current();
    };
  }, []);

  return useMemo(() => {
    const track = (event) => {
      queueRef.current.push(event);
      if (queueRef.current.length >= MAX_QUEUED) flushRef.current();
    };
    return {
      // Backend only fills campus/building in once per session, so resending
      // them on every flush is harmless.
      setLocation: (campus, building) => {
        metaRef.current = {
          campus: campus ?? metaRef.current.campus,
          building: building ?? metaRef.current.building,
        };
      },
      roomSearched: (query, nodeId, matched) =>
        track({ type: "room_searched", room_query: query, node_id: nodeId || undefined, matched: !!matched }),
      goTo: (nodeId) => track({ type: "go_to", node_id: nodeId }),
      directionsRequested: (fromNodeId, toNodeId) =>
        track({ type: "directions_requested", from_node_id: fromNodeId, to_node_id: toNodeId }),
      move: (kind, fromNodeId, toNodeId) =>
        track({ type: "move", move_kind: kind, from_node_id: fromNodeId || undefined, to_node_id: toNodeId }),
      // Links the feedback (About sheet) to this session, as web does. Sent
      // at once: it's a one-off, and the visitor may close the app next.
      // Unlike web, the session carries on — the app stays open.
      feedbackSubmitted: (feedbackId, rating) => {
        track({ type: "feedback_submitted", feedback_id: feedbackId, rating });
        flushRef.current();
      },
    };
  }, []);
}
