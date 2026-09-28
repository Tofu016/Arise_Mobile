import { useEffect, useState } from "react";
import { View } from "react-native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { useAuth } from "../src/context/useAuth";
import { usePublicNodes } from "../src/hooks/usePublicNodes";
import StartupScreen from "../src/components/StartupScreen";
import { colors } from "../src/theme";

// The native splash stays up until the startup screen (which uses the
// brand fonts) is ready to take over — see StartupScreen.
SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  SplashScreen.setOptions({ fade: true, duration: 200 });
} catch {
  // An older app build without it just hides the splash without a fade.
}

const PUBLIC_ROUTES = ["login", "register", "forgot-password", "forgot-email"];

// Mirrors the web app's RequireAuth.jsx logic, adapted for Expo Router:
// instead of wrapping individual routes in a guard component, this watches
// the current route + auth state from one place and redirects as needed.
// Same three states as web: signed out -> /login, signed in but pending ->
// /approval, signed in and approved -> the real app.
function AuthGate({ children }) {
  const { user, role, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const current = segments[0] || "index";
    const isPublicRoute = PUBLIC_ROUTES.includes(current);
    const needsApproval = !role || role === "pending";

    if (!user && !isPublicRoute) {
      router.replace("/login");
      return;
    }
    if (user && isPublicRoute) {
      router.replace(needsApproval ? "/approval" : "/");
      return;
    }
    if (user && needsApproval && current !== "approval") {
      router.replace("/approval");
      return;
    }
    if (user && !needsApproval && current === "approval") {
      router.replace("/");
    }
  }, [user, role, loading, segments]);

  return children;
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
  "OptimusPrinceps-Regular": require("../assets/fonts/OptimusPrinceps-Regular.ttf"),
  "OptimusPrinceps-SemiBold": require("../assets/fonts/OptimusPrinceps-SemiBold.ttf"),
};

// Screen transitions: forms (register, forgot password…) slide in from the
// right; the overrides below cover the rest.
const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
  animation: "slide_from_right",
  animationDuration: 280,
};

// ---------- Startup screen ----------
// Shown from launch until the app is ready: the saved sign-in has been
// checked and — for an approved account, which lands on the tour — the
// campus data (nodes) has arrived. Once the emblem is actually on screen
// (StartupScreen's onShown), it stays at least MIN_MS so the logo and
// title can be seen; and it never keeps anyone waiting on a slow network
// past MAX_MS from launch: the screen behind it shows its own
// loading/error state from there. Shown once per launch only — signing
// out later doesn't bring it back.
const STARTUP_MIN_MS = 3300; // the logo animation (~2.3 s) plus a moment on the finished logo
const STARTUP_MAX_MS = 12000;

// Only mounted when the tour will need the nodes, so a signed-out launch
// doesn't fetch them for nothing. The fetch is shared with the main
// screen's (see sharedResource), so this starts it early rather than twice.
function NodesReady({ onReady }) {
  const { nodes, error } = usePublicNodes();
  useEffect(() => {
    if (nodes || error) onReady();
  }, [nodes, error, onReady]);
  return null;
}

function StartupGate() {
  const { user, role, loading } = useAuth();
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

  const toTour = !loading && !!user && (role === "user" || role === "admin");
  const ready = timedOut || (minElapsed && !loading && (!toTour || nodesReady));
  useEffect(() => {
    if (ready) setDone(true);
  }, [ready]);

  return (
    <>
      {toTour && !nodesReady && <NodesReady onReady={() => setNodesReady(true)} />}
      {!done && <StartupScreen onShown={() => setShownAt(Date.now())} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // A split second on launch, behind the native splash. If loading ever
  // fails, carry on with the system font rather than a blank app.
  if (!fontsLoaded && !fontError) return null;

  return (
    // Must wrap everything, at the very outermost level — gestures
    // (like the room sheet's drag handle) silently fail to register at
    // all without this, with no error shown to explain why.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          {/* The app, with the startup screen laid over the whole of it. */}
          <View style={{ flex: 1 }}>
            <AuthGate>
              <Stack screenOptions={SCREEN_OPTIONS}>
                {/* Sign-in state swaps these with replace(), so they cross-fade
                    rather than slide as if navigating forward. */}
                <Stack.Screen name="index" options={{ animation: "fade" }} />
                <Stack.Screen name="login" options={{ animation: "fade" }} />
                <Stack.Screen name="approval" options={{ animation: "fade" }} />
                {/* Camera / AR screens rise over the tour. */}
                <Stack.Screen name="placard-scanner" options={{ animation: "fade_from_bottom" }} />
                <Stack.Screen name="ar-viewer" options={{ animation: "fade_from_bottom" }} />
                <Stack.Screen name="ar-portal" options={{ animation: "fade_from_bottom" }} />
              </Stack>
            </AuthGate>
            <StartupGate />
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
