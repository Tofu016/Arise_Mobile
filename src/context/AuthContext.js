import { createContext, useEffect, useState } from "react";
import { apiRequest, getToken, setToken, clearToken } from "../api/client";

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
// The token is kept in SecureStore (see src/api/client.js), whose API is
// async-only (no synchronous read at all, unlike the web's
// localStorage), so the very first render can't yet know whether a
// stored token exists — hence `loading` starting true and only
// resolving once that initial async read actually completes.
//
// All requests go through apiRequest (src/api/client.js), which also
// owns the API address and where the token is stored.

export const AuthContext = createContext(null);

function withUid(user) {
  return user ? { ...user, uid: user.id } : user;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, recover the session from whatever token is already
  // stored, if any — the mobile equivalent of the web app's own "am I
  // still logged in, and as who" recovery on a page refresh, just
  // async here since SecureStore has no synchronous read at all.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const data = await apiRequest("Auth_API/me", { auth: true });
        if (!cancelled) setUser(withUid(data.user));
      } catch (err) {
        // Only a token the server actually refused is dropped. A network
        // error, or a server that's down and answering with an error
        // page, shouldn't sign someone out — the token may still be good.
        if (err.kind === "rejected") {
          await clearToken();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    const data = await apiRequest("Auth_API/login", { method: "POST", body: { email, password } });
    await setToken(data.token);
    setUser(withUid(data.user));
    return data.user;
  };

  // New accounts always start as "pending" server-side — matches the
  // original Firebase behavior exactly: the account is genuinely
  // signed in immediately (a real token, right away), not waiting on
  // approval first.
  const register = async (email, password, name) => {
    const data = await apiRequest("Auth_API/register", { method: "POST", body: { email, password, name } });
    await setToken(data.token);
    setUser(withUid(data.user));
    return data.user;
  };

  // Always resolves successfully whether or not the email actually has
  // an account — the backend's own anti-enumeration protection, so
  // there's no separate "user not found" case to special-case here.
  const forgotPassword = async (email) => {
    await apiRequest("Auth_API/forgotPassword", { method: "POST", body: { email } });
  };

  // Revokes the token server-side too, so a copy of it can't keep
  // working until it expires. Best effort: signing out locally must never
  // fail just because the server can't be reached right now.
  const signOut = async () => {
    try {
      await apiRequest("Auth_API/logout", { method: "POST", auth: true });
    } catch {
      // Offline or already invalid — the local sign-out below still happens.
    }
    await clearToken();
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
