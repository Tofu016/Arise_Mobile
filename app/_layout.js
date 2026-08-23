import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { useAuth } from "../src/context/useAuth";

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

export default function RootLayout() {
  return (
    // Must wrap everything, at the very outermost level — gestures
    // (like the room sheet's drag handle) silently fail to register at
    // all without this, with no error shown to explain why.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0f1115" } }} />
          </AuthGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
