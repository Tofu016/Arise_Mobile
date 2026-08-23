import { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { recognizeText } from "@infinitered/react-native-mlkit-text-recognition";

// A landscape rectangle sized to roughly match a typical door placard's
// proportions, centered on screen. Computed once here (not hardcoded pixel
// values) so both the visual overlay AND the crop math below share the
// exact same source of truth for the reticle's bounds.
const RETICLE_WIDTH_FRACTION = 0.82;
const RETICLE_ASPECT_RATIO = 1.6; // width / height

export default function PlacardScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [phase, setPhase] = useState("capture"); // capture | processing | result | error
  const [recognizedText, setRecognizedText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const reticleWidth = screenWidth * RETICLE_WIDTH_FRACTION;
  const reticleHeight = reticleWidth / RETICLE_ASPECT_RATIO;
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

      const { text } = await recognizeText(cropped.uri);
      setRecognizedText((text || "").trim());
      setPhase("result");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  const handleRetry = () => {
    setPhase("capture");
    setRecognizedText("");
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

        {phase === "result" && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Recognized text</Text>
            <Text style={styles.resultText}>
              {recognizedText || "(no text recognized — try repositioning the placard)"}
            </Text>
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
  topBar: { position: "absolute", left: 12, right: 12, flexDirection: "row" },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,17,21,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#e6e6e6", fontSize: 16 },
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
    gap: 12,
  },
  resultLabel: { color: "#9aa0ac", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  resultText: { color: "#e6e6e6", fontSize: 15, textAlign: "center", lineHeight: 21 },
  errorText: { color: "#ff9a9a", fontSize: 13, textAlign: "center" },
});
