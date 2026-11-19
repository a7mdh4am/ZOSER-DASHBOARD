import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "../lib/api.js";
import { hasPermission } from "../lib/permissions.js";
import { AuthContext } from "./auth.js";

// Who's signed in. The access token lives in memory (lib/api.js), so a new visit asks
// the API for one from the refresh cookie first; until that answers, `ready` is false
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await authApi.refresh();
        if (session?.accessToken && session.admin) setUser(session.admin);
      } catch {
        /* signed out, or offline */
      } finally {
        setReady(true);
      }
    })();

    const onUnauthorized = () => setUser(null);
    window.addEventListener("zoser:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("zoser:unauthorized", onUnauthorized);
  }, []);

  // The login answer carries the admin with their permissions
  const login = useCallback(async (username, password) => {
    const { admin } = await authApi.login(username, password);
    setUser(admin);
    return { user: admin };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback((patch) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const can = useCallback(
    (code) => hasPermission(user?.permissions, code),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      logout,
      refreshUser,
      can,
    }),
    [user, ready, login, logout, refreshUser, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
