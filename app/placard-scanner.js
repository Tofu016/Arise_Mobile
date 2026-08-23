import { useRef, useState } from "react";
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
  const { searchableRooms } = useSearchableRooms();

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
        <Text style={styles.permissionText}>
          ARISE needs camera access to scan room placards.
        </Text>
        <Pressable style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <View
        pointerEvents="none"
        style={[
          styles.reticle,
          { left: reticleLeft, top: reticleTop, width: reticleWidth, height: reticleHeight },
        ]}
      />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {phase === "capture" && (
          <View style={styles.reticleToggle}>
            <Pressable
              style={[styles.reticleToggleOption, reticleMode === "horizontal" && styles.reticleToggleOptionActive]}
              onPress={() => setReticleMode("horizontal")}
            >
              <Text
                style={[styles.reticleToggleText, reticleMode === "horizontal" && styles.reticleToggleTextActive]}
              >
                ↔ Horizontal
              </Text>
            </Pressable>
            <Pressable
              style={[styles.reticleToggleOption, reticleMode === "vertical" && styles.reticleToggleOptionActive]}
              onPress={() => setReticleMode("vertical")}
            >
              <Text style={[styles.reticleToggleText, reticleMode === "vertical" && styles.reticleToggleTextActive]}>
                ↕ Vertical
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.bottomBar, { bottom: insets.bottom + 24 }]}>
        {phase === "capture" && (
          <>
            <Text style={styles.instructionText}>Position the placard inside the box.</Text>
            <Pressable style={styles.captureBtn} onPress={handleCapture}>
              <Text style={styles.captureBtnText}>SCAN PLACARD</Text>
            </Pressable>
          </>
        )}

        {phase === "processing" && (
          <View style={styles.processingPill}>
            <ActivityIndicator color="#4a9eff" />
            <Text style={styles.processingText}>Reading placard…</Text>
          </View>
        )}

        {phase === "matched" && matchedRoom && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Room found</Text>
            <Text style={styles.matchedName}>{matchedRoom.roomName}</Text>
            {matchedRoom.placard?.use && (
              <Text style={styles.matchedSub}>{matchedRoom.placard.use}</Text>
            )}
            <Text style={styles.matchedSub}>
              {buildingLabel(matchedRoom.node.building)} · {floorLabel(matchedRoom.node.floor)}
            </Text>
            <Pressable style={styles.captureBtn} onPress={handleRetry}>
              <Text style={styles.captureBtnText}>SCAN ANOTHER</Text>
            </Pressable>
          </View>
        )}

        {phase === "suggestions" && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Did you mean…</Text>
            <Text style={styles.recognizedHint} numberOfLines={1}>
              Read: "{recognizedText || "(no text recognized)"}"
            </Text>
            {suggestions.map((m) => (
              <Pressable
                key={m.room.roomName}
                style={styles.suggestionRow}
                onPress={() => handleSelectSuggestion(m.room)}
              >
                <Text style={styles.suggestionName}>{m.room.roomName}</Text>
                <Text style={styles.suggestionSub}>
                  {buildingLabel(m.room.node.building)} · {floorLabel(m.room.node.floor)}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.captureBtn} onPress={handleRetry}>
              <Text style={styles.captureBtnText}>SCAN AGAIN</Text>
            </Pressable>
          </View>
        )}

        {phase === "no-match" && (
          <View style={styles.resultCard}>
            <Text style={styles.recognizedHint} numberOfLines={2}>
              Read: "{recognizedText || "(no text recognized)"}"
            </Text>
            <Text style={styles.errorText}>No matching room found — try repositioning the placard.</Text>
            <Pressable style={styles.captureBtn} onPress={handleRetry}>
              <Text style={styles.captureBtnText}>SCAN AGAIN</Text>
            </Pressable>
          </View>
        )}

        {phase === "error" && (
          <View style={styles.resultCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.captureBtn} onPress={handleRetry}>
              <Text style={styles.captureBtnText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: "#0f1115",
  },
  permissionText: { color: "#c7cad1", fontSize: 14, textAlign: "center" },
  permissionBtn: { backgroundColor: "#4a9eff", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  permissionBtnText: { color: "#0f1115", fontWeight: "700", fontSize: 14 },
  reticle: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#4a9eff",
    borderRadius: 12,
    backgroundColor: "rgba(74,158,255,0.08)",
  },
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,17,21,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#e6e6e6", fontSize: 16 },
  reticleToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(15,17,21,0.7)",
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  reticleToggleOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  reticleToggleOptionActive: { backgroundColor: "#4a9eff" },
  reticleToggleText: { color: "#c7cad1", fontSize: 12, fontWeight: "600" },
  reticleToggleTextActive: { color: "#0f1115" },
  bottomBar: { position: "absolute", left: 20, right: 20, alignItems: "center", gap: 14 },
  instructionText: {
    color: "#e6e6e6",
    fontSize: 13,
    textAlign: "center",
    backgroundColor: "rgba(15,17,21,0.7)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  captureBtn: {
    backgroundColor: "#4a9eff",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  captureBtnText: { color: "#0f1115", fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
  processingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#191b22",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  processingText: { color: "#e6e6e6", fontSize: 14 },
  resultCard: {
    width: "100%",
    backgroundColor: "#191b22",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  resultLabel: { color: "#9aa0ac", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  recognizedHint: { color: "#6b7280", fontSize: 12, fontStyle: "italic", textAlign: "center" },
  matchedName: { color: "#e6e6e6", fontSize: 20, fontWeight: "700", textAlign: "center" },
  matchedSub: { color: "#9aa0ac", fontSize: 13, textAlign: "center" },
  suggestionRow: {
    width: "100%",
    backgroundColor: "#14161c",
    borderWidth: 1,
    borderColor: "#2a2d38",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionName: { color: "#e6e6e6", fontSize: 14 },
  suggestionSub: { color: "#9aa0ac", fontSize: 11, marginTop: 2 },
  errorText: { color: "#ff9a9a", fontSize: 13, textAlign: "center" },
});
