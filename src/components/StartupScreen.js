import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import AriseLogo, { ARISE_LOGO_DURATION_MS } from "./AriseLogo";
import { colors, typography, spacing } from "../theme";

// The startup screen: the ARISE logo animating from its neutral form (the
// square with the AR button — the app icon's shape, which the native splash
// shows) into the full typed-out logo,
// while the app gets ready (see StartupGate in app/_layout.js), then fading
// out once it is.
//
// It takes over from the native splash only once the logo's button image
// has loaded (onShown) — in a development build it comes from Metro over
// the network, and a half-built screen shouldn't flash up first. The
// neutral square is drawn at the same size and place as the splash's
// (see LOGO_WIDTH), so the hand-over is invisible and the animation
// seems to start from the splash itself. A fallback timer shows it anyway
// if the image never reports in.
const SHOW_FALLBACK_MS = 2500;
// The expanded logo's width; the neutral square is NEUTRAL_WIDTH_RATIO
// (600.8/1470.5) of it = 123dp, which is app.json's expo-splash-screen
// imageWidth. Change both together.
const LOGO_WIDTH = 300;

export default function StartupScreen({ onShown }) {
  const { width: windowWidth } = useWindowDimensions();
  const logoWidth = Math.min(LOGO_WIDTH, windowWidth - spacing.xxl * 2);
  const [playing, setPlaying] = useState(false);
  const shown = useRef(false);
  const show = () => {
    if (shown.current) return;
    shown.current = true;
    SplashScreen.hideAsync().catch(() => {});
    setPlaying(true);
    onShown?.();
  };

  useEffect(() => {
    const timer = setTimeout(show, SHOW_FALLBACK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View exiting={FadeOut.duration(400)} style={styles.screen} accessibilityLabel="ARISE is starting">
      {/* Dead centre, like the splash's image. */}
      <AriseLogo width={logoWidth} play={playing} onLoad={show} />

      {playing && (
        <Animated.Text
          entering={FadeIn.delay(ARISE_LOGO_DURATION_MS - 150).duration(450)}
          style={[styles.subtitle, { top: "50%", marginTop: (logoWidth * 601.4) / 1470.3 / 2 + spacing.xl }]}
        >
          St. Dominic College of Asia
        </Animated.Text>
      )}

      {playing && (
        <Animated.View entering={FadeIn.delay(ARISE_LOGO_DURATION_MS + 400).duration(400)} style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.footerText}>Getting the campus ready…</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Covers the whole screen (its parent in _layout.js is the full-screen
  // app container), content centred on it; white like the native splash.
  screen: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { ...typography.label, position: "absolute", left: 0, right: 0, textAlign: "center", color: colors.textMuted },
  footer: {
    position: "absolute",
    bottom: 64,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  footerText: { ...typography.caption, color: colors.textSubtle },
});
