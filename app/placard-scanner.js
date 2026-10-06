import { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { recognizeText } from "@infinitered/react-native-mlkit-text-recognition";
import { useSearchableRooms } from "../src/hooks/useSearchableRooms";
import { matchRoomsFromOcr } from "../src/utils/ocrRoomMatch";
import { reconstructVerticalText } from "../src/utils/verticalTextSort";
import { buildingLabel, floorLabel } from "../src/utils/constants";
import { colors, typography, radii, spacing, shadows } from "../src/theme";
import Button from "../src/components/Button";
import ListRow from "../src/components/ListRow";
import Icon from "../src/components/Icon";

// Two distinct shapes rather than one compromise — the person picks which
// one matches what they're looking at, so each style gets a reticle
// actually fitted to it instead of splitting the difference.
const RETICLE_CONFIGS = {
  horizontal: { widthFraction: 0.82, aspectRatio: 1.6 }, // wide, short — a normal single-line placard
  vertical: { widthFraction: 0.5, aspectRatio: 0.42 }, // narrow, tall — a stack of individual letters
};

const MAX_SUGGESTIONS = 4;

export default function PlacardScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  // Only rooms with details: a scan leads on to the room's AR portal, which
  // needs the details' 360 photo (and OCR search terms live there too).
  const { searchableRooms: allRooms } = useSearchableRooms();
  const searchableRooms = useMemo(() => allRooms.filter((r) => r.placard), [allRooms]);

  const [reticleMode, setReticleMode] = useState("horizontal");

  // capture | processing | matched | suggestions | no-match | error
  const [phase, setPhase] = useState("capture");
  const [recognizedText, setRecognizedText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [matchedRoom, setMatchedRoom] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const { widthFraction, aspectRatio } = RETICLE_CONFIGS[reticleMode];
  const reticleWidth = screenWidth * widthFraction;
  const reticleHeight = reticleWidth / aspectRatio;
  const reticleLeft = (screenWidth - reticleWidth) / 2;
  const reticleTop = (screenHeight - reticleHeight) / 2;

  const handleCapture = async () => {
    if (!cameraRef.current || phase === "processing") return;
    setPhase("processing");
    setErrorMessage("");

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });

      // The reticle's bounds were defined as fractions of the SCREEN, but
      // the captured photo has its own resolution — converting through the
      // shared 0..1 fraction (rather than raw pixel values) is what keeps
      // the crop aligned with what was actually visible in the reticle,
      // regardless of the phone's specific screen/camera resolution.
      const cropOriginX = (reticleLeft / screenWidth) * photo.width;
      const cropOriginY = (reticleTop / screenHeight) * photo.height;
      const cropWidth = (reticleWidth / screenWidth) * photo.width;
      const cropHeight = (reticleHeight / screenHeight) * photo.height;

      const context = ImageManipulator.manipulate(photo.uri);
      context.crop({
        originX: Math.round(cropOriginX),
        originY: Math.round(cropOriginY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight),
      });
      const rendered = await context.renderAsync();
      const cropped = await rendered.saveAsync({ format: SaveFormat.JPEG });

      const ocrResult = await recognizeText(cropped.uri);
      const rawText = (ocrResult.text || "").trim();

      // Some placards print vertically stacked individual letters, which
      // read as scrambled nonsense in ML Kit's own raw text order — this
      // reassembles them into correct reading order using each detected
      // line's actual position. Kept purely additive: both readings get
      // tried against the room data, and whichever matches better wins, so
      // ordinary horizontal placards are never put at risk by this.
      const reconstructedText = reconstructVerticalText(ocrResult, cropped.width, cropped.height);

      const rawMatches = matchRoomsFromOcr(rawText, searchableRooms);
      const reconstructedMatches =
        reconstructedText && reconstructedText !== rawText
          ? matchRoomsFromOcr(reconstructedText, searchableRooms)
          : [];

      const bestRawScore = rawMatches[0]?.score ?? 0;
      const bestReconstructedScore = reconstructedMatches[0]?.score ?? 0;
      const useReconstructed = bestReconstructedScore > bestRawScore;

      const trimmedText = useReconstructed ? reconstructedText : rawText;
      const matches = useReconstructed ? reconstructedMatches : rawMatches;
      setRecognizedText(trimmedText);

      const exact = matches.find((m) => m.isExact);

      if (exact) {
        setMatchedRoom(exact.room);
        setPhase("matched");
      } else if (matches.length > 0) {
        setSuggestions(matches.slice(0, MAX_SUGGESTIONS));
        setPhase("suggestions");
      } else {
        setPhase("no-match");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  const handleSelectSuggestion = (room) => {
    setMatchedRoom(room);
    setPhase("matched");
  };

  const handleRetry = () => {
    setPhase("capture");
    setRecognizedText("");
    setSuggestions([]);
    setMatchedRoom(null);
    setErrorMessage("");
  };

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>ARISE needs camera access to scan room placards.</Text>
        <Button label="Grant camera access" onPress={requestPermission} />
      </View>
    );
  }

  const bracket = { width: BRACKET, height: BRACKET, position: "absolute" };

  return (
    <View style={styles.flex}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* The brand board's reticle: four rounded corner brackets. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: reticleLeft, top: reticleTop, width: reticleWidth, height: reticleHeight }}
      >
        <View style={[bracket, styles.cornerTL]} />
        <View style={[bracket, styles.cornerTR]} />
        <View style={[bracket, styles.cornerBL]} />
        <View style={[bracket, styles.cornerBR]} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.roundBtn, { top: insets.top + 14, left: spacing.lg }, pressed && styles.roundBtnPressed]}
        onPress={() => router.back()}
        accessibilityLabel="Close scanner"
        hitSlop={6}
      >
        <Icon name="terminate" size={17} color={colors.textSecondary} />
      </Pressable>

      <View style={[styles.bottomArea, { bottom: insets.bottom + 24 }]}>
        {phase === "capture" && (
          <>
            <Text style={styles.instructionText}>Fit the placard inside the brackets</Text>
            <View style={styles.controls}>
              <Pressable
                onPress={handleCapture}
                accessibilityLabel="Scan placard"
                style={({ pressed }) => [styles.captureOuter, pressed && styles.captureOuterPressed]}
              >
                <View style={styles.captureInner} />
              </Pressable>

              <Pressable
                onPress={() => router.navigate({ pathname: "/", params: { panel: "search" } })}
                accessibilityLabel="Search instead"
                style={({ pressed }) => [styles.searchCircle, pressed && styles.roundBtnPressed]}
              >
                <Icon name="search" size={18} color={colors.textSecondary} />
              </Pressable>

              {/* Landscape = a normal single-line placard; portrait = a
                  stack of individual letters (see RETICLE_CONFIGS). */}
              <View style={styles.orientation}>
                {[
                  ["horizontal", "scanLandscape", "Scan in landscape"],
                  ["vertical", "scanPortrait", "Scan in portrait"],
                ].map(([mode, icon, label]) => (
                  <Pressable
                    key={mode}
                    onPress={() => setReticleMode(mode)}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: reticleMode === mode }}
                    style={[styles.orientationOption, reticleMode === mode && styles.orientationOptionActive]}
                  >
                    <Icon
                      name={icon}
                      size={18}
                      color={reticleMode === mode ? colors.textOnPrimary : colors.textSecondary}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        {phase === "processing" && (
          <View style={styles.processingPill}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.processingText}>Reading placard…</Text>
          </View>
        )}

        {phase === "matched" && matchedRoom && (
          <View style={styles.card}>
            <Text style={styles.foundLabel}>Room found</Text>
            <Text style={styles.foundName}>{matchedRoom.roomName}</Text>
            <Text style={styles.foundWhere}>
              {buildingLabel(matchedRoom.node.building)} {floorLabel(matchedRoom.node.floor)}
            </Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={({ pressed }) => [styles.choice, styles.choicePrimary, pressed && styles.choicePrimaryPressed]}
                onPress={() =>
                  // replace, not push — the scanner's camera needs to be
                  // fully unmounted (releasing the hardware) before the AR
                  // portal's own camera session starts. A plain push() keeps
                  // this screen mounted in the background (for instant "back"
                  // navigation), which left two things fighting over the same
                  // camera hardware — the likely cause of a silent crash with
                  // no error log right as the AR camera session started.
                  router.replace({
                    pathname: "/ar-portal",
                    params: { nodeId: matchedRoom.node.id, roomName: matchedRoom.roomName },
                  })
                }
              >
                <Text style={[styles.choiceText, styles.choiceTextPrimary]}>View in AR</Text>
                <Icon name="arView" size={26} color={colors.textOnPrimary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.choice, styles.choiceOutline, pressed && styles.choiceOutlinePressed]}
                onPress={handleRetry}
              >
                <Text style={styles.choiceText}>Scan another</Text>
                <Icon name="scanCode" size={26} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        )}

        {phase === "suggestions" && (
          <View style={[styles.card, styles.cardList]}>
            <Text style={[styles.foundLabel, styles.cardPad]}>Did you mean…</Text>
            <Text style={[styles.recognizedHint, styles.cardPad]} numberOfLines={1}>
              Read: "{recognizedText || "(no text recognized)"}"
            </Text>
            {suggestions.map((m) => (
              <ListRow
                key={m.room.roomName}
                title={m.room.roomName}
                subtitle={`${buildingLabel(m.room.node.building)} - ${floorLabel(m.room.node.floor)}`}
                onPress={() => handleSelectSuggestion(m.room)}
              />
            ))}
            <Button label="Scan again" icon="scanCode" onPress={handleRetry} style={styles.cardButton} />
          </View>
        )}

        {phase === "no-match" && (
          <View style={styles.card}>
            <Text style={styles.recognizedHint} numberOfLines={2}>
              Read: "{recognizedText || "(no text recognized)"}"
            </Text>
            <Text style={styles.errorText}>No matching room found. Try repositioning the placard.</Text>
            <Button label="Scan again" icon="scanCode" onPress={handleRetry} style={styles.cardButtonFull} />
          </View>
        )}

        {phase === "error" && (
          <View style={styles.card}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Button label="Try again" onPress={handleRetry} style={styles.cardButtonFull} />
          </View>
        )}
      </View>
    </View>
  );
}

const BRACKET = 34;
const BRACKET_WIDTH = 5;
const BRACKET_COLOR = "rgba(255,255,255,0.92)";

const styles = StyleSheet.create({
  // Stays black — this sits behind the live camera feed for the brief
  // moment before it starts.
  flex: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  permissionText: { ...typography.body, textAlign: "center" },

  cornerTL: { top: 0, left: 0, borderTopWidth: BRACKET_WIDTH, borderLeftWidth: BRACKET_WIDTH, borderColor: BRACKET_COLOR, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderTopWidth: BRACKET_WIDTH, borderRightWidth: BRACKET_WIDTH, borderColor: BRACKET_COLOR, borderTopRightRadius: 16 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BRACKET_WIDTH, borderLeftWidth: BRACKET_WIDTH, borderColor: BRACKET_COLOR, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET_WIDTH, borderRightWidth: BRACKET_WIDTH, borderColor: BRACKET_COLOR, borderBottomRightRadius: 16 },

  roundBtn: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlaySurface,
    ...shadows.floating,
  },
  roundBtnPressed: { backgroundColor: colors.iconButton },

  bottomArea: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center", gap: spacing.lg },
  instructionText: {
    ...typography.sublabel,
    color: colors.textSecondary,
    backgroundColor: colors.overlaySurface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  controls: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  captureOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    ...shadows.floating,
  },
  captureOuterPressed: { backgroundColor: colors.iconButton },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary },
  searchCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlaySurface,
    borderWidth: 3,
    borderColor: colors.surfaceSunken,
  },
  orientation: {
    flexDirection: "row",
    backgroundColor: colors.overlaySurface,
    borderRadius: radii.pill,
    padding: 4,
    gap: 2,
  },
  orientationOption: { width: 48, height: 40, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  orientationOptionActive: { backgroundColor: colors.gray700 },

  processingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.overlaySurface,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    ...shadows.floating,
  },
  processingText: { ...typography.label, color: colors.textPrimary },

  // The brand board's "Room found" card.
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    ...shadows.floating,
  },
  cardList: { paddingHorizontal: 0 },
  cardPad: { paddingHorizontal: spacing.xl },
  foundLabel: { ...typography.sublabel, color: colors.primary },
  foundName: { ...typography.h2 },
  foundWhere: { ...typography.sublabel, color: colors.textSecondary, marginBottom: spacing.md },
  choiceRow: { flexDirection: "row", gap: spacing.md },
  choice: {
    flex: 1,
    height: 104,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  choicePrimary: { backgroundColor: colors.primaryButton },
  choicePrimaryPressed: { backgroundColor: colors.primaryPressed },
  choiceOutline: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.iconButton },
  choiceOutlinePressed: { backgroundColor: colors.surfaceSunken },
  choiceText: { ...typography.button, color: colors.textSecondary },
  choiceTextPrimary: { color: colors.textOnPrimary },
  cardButton: { marginTop: spacing.md, marginHorizontal: spacing.xl },
  cardButtonFull: { marginTop: spacing.md, alignSelf: "stretch" },
  recognizedHint: { ...typography.caption, fontStyle: "italic" },
  errorText: { ...typography.bodySmall, color: colors.danger },
});
