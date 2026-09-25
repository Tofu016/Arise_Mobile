import { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Rewritten to call the same Arise_API backend the web app now uses,
// instead of Firebase Auth + Firestore. Same reasoning as the web
// app's own AuthContext.jsx conversion: Firebase split identity into
// two systems (an Auth session, and a separate Firestore profile doc)
// because those were genuinely two separate things; Arise_API's users
// table already combines both, so user and profile are the same
// object here too — both keys kept anyway so anything reading either
// one (ported directly from the web app, or written fresh) keeps
// working without needing to know they're now identical.
//
// The token-refresh-on-role-change dance from the Firebase version is
// gone entirely — that existed purely to sync a Firestore-side role
// into a separate auth-token-claims system. A session here just
// re-checks the role directly on the next request; there's no second
// system left to keep in sync.
//
// AsyncStorage, not localStorage — React Native has no such API at
// all. Its own API is async-only (no synchronous read at all, unlike
// localStorage), so the very first render can't yet know whether a
// stored token exists — hence `loading` starting true and only
// resolving once that initial async read actually completes.
//
// EXPO_PUBLIC_API_BASE_URL, not a plain env var — Expo only inlines
// environment variables prefixed exactly this way into the built app;
// a bare API_BASE_URL would silently be undefined at runtime. Left
// pointing at a placeholder for now — the actual local-network IP this
// needs is a separate, deliberately deferred piece (see the project's
// own network-access discussion).
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";
const TOKEN_KEY = "authToken";

export const AuthContext = createContext(null);

function withUid(user) {
  return user ? { ...user, uid: user.id } : user;
}

async function apiPost(endpoint, body) {
  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, recover the session from whatever token is already
  // stored, if any — the mobile equivalent of the web app's own "am I
  // still logged in, and as who" recovery on a page refresh, just
  // async here since AsyncStorage has no synchronous read at all.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/Auth_API/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          setUser(withUid(data.user));
        } else {
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        // Network error on startup — leave the stored token in place
        // rather than clearing it; a real "no longer valid" case is
        // handled above (data.success === false), but a plain network
        // hiccup shouldn't sign someone out.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    const data = await apiPost("Auth_API/login", { email, password });
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setUser(withUid(data.user));
    return data.user;
  };

  // New accounts always start as "pending" server-side — matches the
  // original Firebase behavior exactly: the account is genuinely
  // signed in immediately (a real token, right away), not waiting on
  // approval first.
  const register = async (email, password, name) => {
    const data = await apiPost("Auth_API/register", { email, password, name });
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setUser(withUid(data.user));
    return data.user;
  };

  // Always resolves successfully whether or not the email actually has
  // an account — the backend's own anti-enumeration protection, so
  // there's no separate "user not found" case to special-case here.
  const forgotPassword = async (email) => {
    await apiPost("Auth_API/forgotPassword", { email });
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const value = {
    user, // { id, uid, email, name, role }, or null
    profile: user, // same object — see this file's own comment for why
    role: user?.role ?? null,
    loading,
    login,
    register,
    forgotPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
