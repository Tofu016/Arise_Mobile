import { createContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

// Ported directly from the web app's AuthContext.jsx — same two-part model
// (Auth session vs. Firestore profile/role), same token-refresh-on-role-
// change behavior. The hook itself lives in useAuth.js, not here, for the
// same Fast Refresh reason as the web version (a file exporting both a
// component and a plain hook breaks Metro's fast refresh the same way it
// broke Vite's).
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) setProfile(null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    let lastSeenRole;
    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      async (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setProfile(data);
        setProfileLoading(false);

        if (data?.role && data.role !== lastSeenRole) {
          lastSeenRole = data.role;
          try {
            await user.getIdToken(true);
          } catch {
            // Non-fatal — the claim just catches up on the token's next
            // natural refresh instead of immediately.
          }
        }
      },
      () => setProfileLoading(false)
    );
    return unsubscribe;
  }, [user]);

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    loading: authLoading || (!!user && profileLoading && !profile),
    signOut: () => firebaseSignOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
