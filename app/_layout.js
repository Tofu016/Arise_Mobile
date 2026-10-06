import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import StartupScreen from "../src/components/StartupScreen";
import { colors } from "../src/theme";

// Immersive mode: the status bar and the phone's back/home/recents bar stay
// hidden. A swipe from the edge still reveals them briefly (Android's own
// behaviour); the listener hides the navigation bar again when it appears.
// expo-navigation-bar is native, so a dev build made before it was added
// doesn't have it: required defensively and skipped rather than crashing.
let NavigationBar = null;
try {
  NavigationBar = require("expo-navigation-bar");
} catch {
  // Falls back to leaving the navigation bar as the system has it.
}

// The native splash stays up until the startup screen (which uses the
// brand fonts) is ready to take over — see StartupScreen.
SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  SplashScreen.setOptions({ fade: true, duration: 200 });
} catch {
  // An older app build without it just hides the splash without a fade.
}

// The brand fonts (see assets/fonts/README.md), registered under the family
// names src/theme/typography.js uses. Loaded at runtime rather than embedded
// by the expo-font config plugin, so a font change needs only a Metro
// reload, and the family name is the same key on Android and iOS.
const FONT_FILES = {
  "CenturyGothic-Regular": require("../assets/fonts/CenturyGothic-Regular.ttf"),
  "CenturyGothic-SemiBold": require("../assets/fonts/CenturyGothic-SemiBold.ttf"),
  "CenturyGothic-Bold": require("../assets/fonts/CenturyGothic-Bold.ttf"),
  "CenturyGothic-Black": require("../assets/fonts/CenturyGothic-Black.ttf"),
};

// Screen transitions: slide in from the right by default; the overrides
// below cover the rest.
const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
  animation: "slide_from_right",
  animationDuration: 280,
};

// ---------- Startup screen ----------
// Shown from launch until the app is ready: the campus data (nodes) the
// tour opens on has arrived — there's no sign-in; everyone lands on the
// tour. Once the emblem is actually on screen
// (StartupScreen's onShown), it stays at least MIN_MS so the logo and
// title can be seen; and it never keeps anyone waiting on a slow network
// past MAX_MS from launch: the screen behind it shows its own
// loading/error state from there. Shown once per launch only.
const STARTUP_MIN_MS = 3300; // the logo animation (~2.3 s) plus a moment on the finished logo
const STARTUP_MAX_MS = 12000;

// Waits for the nodes. The fetch is shared with the main screen's (see
// sharedResource), so this starts it early rather than twice.
function NodesReady({ onReady }) {
  const { nodes, error } = usePublicNodes();
  useEffect(() => {
    if (nodes || error) onReady();
  }, [nodes, error, onReady]);
  return null;
}

function StartupGate() {
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [nodesReady, setNodesReady] = useState(false);
  const [done, setDone] = useState(false);

  // The minimum starts once the emblem is visible, not at launch.
  const [shownAt, setShownAt] = useState(null);
  useEffect(() => {
    if (shownAt == null) return undefined;
    const min = setTimeout(() => setMinElapsed(true), STARTUP_MIN_MS);
    return () => clearTimeout(min);
  }, [shownAt]);
  useEffect(() => {
    const max = setTimeout(() => setTimedOut(true), STARTUP_MAX_MS);
    return () => clearTimeout(max);
  }, []);

  const ready = timedOut || (minElapsed && nodesReady);
  useEffect(() => {
    if (ready) setDone(true);
  }, [ready]);

  return (
    <>
      {!nodesReady && <NodesReady onReady={() => setNodesReady(true)} />}
      {!done && <StartupScreen onShown={() => setShownAt(Date.now())} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  useEffect(() => {
    if (!NavigationBar || Platform.OS !== "android") return undefined;
    const hide = () => NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    hide();
    const sub = NavigationBar.addVisibilityListener(({ visibility }) => {
      if (visibility === "visible") setTimeout(hide, 2500);
    });
    return () => sub.remove();
  }, []);
  // A split second on launch, behind the native splash. If loading ever
  // fails, carry on with the system font rather than a blank app.
  if (!fontsLoaded && !fontError) return null;

  return (
    // Must wrap everything, at the very outermost level — gestures
    // (like the room sheet's drag handle) silently fail to register at
    // all without this, with no error shown to explain why.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar hidden />
        {/* The app, with the startup screen laid over the whole of it. */}
        <View style={{ flex: 1 }}>
          <Stack screenOptions={SCREEN_OPTIONS}>
            <Stack.Screen name="index" options={{ animation: "fade" }} />
            {/* Camera / AR screens rise over the tour. */}
            <Stack.Screen name="placard-scanner" options={{ animation: "fade_from_bottom" }} />
            <Stack.Screen name="ar-portal" options={{ animation: "fade_from_bottom" }} />
          </Stack>
          <StartupGate />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
