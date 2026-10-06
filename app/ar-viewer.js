import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import { buildingLabel, floorLabel } from "../src/utils/constants";
import { colors, typography, spacing } from "../src/theme";
import BottomSheet from "../src/components/BottomSheet";
import Button from "../src/components/Button";
import ListRow from "../src/components/ListRow";
import { ArCloseButton, ArRecalibrateButton, ArStatusPill } from "../src/components/ArChrome";
import ArPortalScene from "../src/components/ArPortalScene";
import ArPortalControls, { useArPortalControls, PORTAL_TIP } from "../src/components/ArPortalControls";

// Space between the portal controls and the top of the Walk-to sheet below.
const JOYSTICK_GAP = 28;

// One persistent AR session, content switches in place, NOT a remount per
// node. A remount-based version was tried and tore down/restarted the
// entire native AR camera session on every node switch, which got stuck
// mid-transition ("Preparing AR..." and nothing further).
//
// The door, its placement, the joystick placement and stepping through are
// all ArPortalScene's (shared with ar-portal.js). This only picks which node's
// photo is inside. usePublicNodes() is called HERE, not passed down as a
// prop: that data loads asynchronously, and a prop would freeze this
// permanently with stale data if it wasn't ready at first mount.
function ArViewerScene({ initialNodeId, onRegisterNavigate, onNodeChange, sceneProps }) {
  const { nodes } = usePublicNodes();
  const [viewNodeId, setViewNodeId] = useState(initialNodeId);
  const viewNode = nodes?.find((n) => n.id === viewNodeId);

  useEffect(() => {
    onRegisterNavigate?.(setViewNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onNodeChange?.(viewNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNodeId]);

  return <ArPortalScene photoPath={viewNode?.photo} {...sceneProps} />;
}

// Peek: just the spot's name showing.
const PEEK_HEIGHT = 84;

export default function ArViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The portal controls ride above the sheet, following it as it's dragged,
  // with a clear gap (JOYSTICK_GAP) so they never read as part of the sheet.
  const sheetBottom = insets.bottom + spacing.md;
  const sheetHeight = useSharedValue(0);
  const joystickStyle = useAnimatedStyle(() => ({
    bottom: sheetBottom + sheetHeight.value + JOYSTICK_GAP,
  }));
  const { nodeId } = useLocalSearchParams();
  const { nodes } = usePublicNodes();

  const navigateRef = useRef(null);
  const [displayNodeId, setDisplayNodeId] = useState(nodeId);
  // Until the door is placed (AR tracking has settled), a hint says what to do.
  const controls = useArPortalControls();
  const { placed } = controls;
  // Header + list, measured, so the sheet fits them exactly.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const contentHeight = headerHeight && listHeight ? headerHeight + listHeight : undefined;

  const displayNode = nodes?.find((n) => n.id === displayNodeId);
  const neighbors = (displayNode?.neighbors || []).map((nid) => nodes?.find((n) => n.id === nid)).filter(Boolean);

  const handleNavigate = (targetNodeId) => {
    navigateRef.current?.(targetNodeId);
  };

  if (!nodeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No starting point selected for AR view.</Text>
        <Button label="Go back" onPress={() => router.back()} size="sm" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ViroARSceneNavigator
        initialScene={{
          scene: () => (
            <ArViewerScene
              initialNodeId={nodeId}
              onRegisterNavigate={(fn) => {
                navigateRef.current = fn;
              }}
              onNodeChange={setDisplayNodeId}
              sceneProps={controls.sceneProps}
            />
          ),
        }}
        style={styles.flex}
      />

      <ArCloseButton top={insets.top + 12} onPress={() => router.back()} />
      {placed && <ArRecalibrateButton top={insets.top + 12} onPress={controls.recalibrate} />}
      {controls.tipVisible && <ArStatusPill key={controls.tipKey} style={{ top: insets.top + 64 }}>{PORTAL_TIP}</ArStatusPill>}
      {!placed && (
        <ArStatusPill style={{ top: insets.top + 64 }}>
          Hold your phone up and move it slowly while AR gets ready.
        </ArStatusPill>
      )}

      {/* Joystick, raise / lower and anchor, centred just above the sheet:
          place the door, anchor it, then walk through (or pull it onto
          yourself). */}
      {placed && <ArPortalControls controls={controls} style={joystickStyle} />}

      {/* Where you are, and the spots you can walk to from here — sized to
          fit, so it covers as little of the camera as possible. */}
      <BottomSheet
        snapPoints={[PEEK_HEIGHT, 0.5]}
        initialSnap={1}
        bottomOffset={sheetBottom}
        visibleHeight={sheetHeight}
        topLimit={insets.top + 64}
        fitContent
        contentHeight={contentHeight}
      >
        <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Text style={styles.nodeTitle} numberOfLines={1}>
            {displayNode?.name || "…"}
          </Text>
          {!!displayNode && (
            <Text style={styles.nodeWhere}>
              {buildingLabel(displayNode.building)} - {floorLabel(displayNode.floor)}
            </Text>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.list} onContentSizeChange={(_, h) => setListHeight(h)}>
          <Text style={styles.sectionLabel}>Walk to</Text>
          {neighbors.length === 0 && <Text style={styles.emptyText}>Nowhere connected from here.</Text>}
          {neighbors.map((n) => (
            <ListRow
              key={n.id}
              title={n.name}
              subtitle={`${buildingLabel(n.building)} - ${floorLabel(n.floor)}`}
              onPress={() => handleNavigate(n.id)}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stays black — behind the live AR camera feed.
  flex: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  errorText: { ...typography.body, textAlign: "center" },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  nodeTitle: { ...typography.h3 },
  nodeWhere: { ...typography.sublabel, marginTop: 2 },
  list: { paddingBottom: spacing.md },
  sectionLabel: {
    ...typography.eyebrow,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
});
