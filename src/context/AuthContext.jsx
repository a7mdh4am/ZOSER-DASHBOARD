import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, setCsrf } from '../lib/api.js';
import { hasPermission } from '../lib/permissions.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let data = await authApi.me();
        setCsrf(data.csrfToken);
        // Access token may have expired (2h) while the refresh token
        // (2w) is still valid — rotate before deciding we're logged out.
        // Node's /auth/me never auto-refreshes itself (unlike the request()
        // wrapper's 401-retry, which never fires here since /me always 200s).
        if (!data.admin) {
          const refreshed = await authApi.refresh().catch(() => null);
          if (refreshed?.refreshed) {
            data = await authApi.me();
          }
        }
        if (data.admin) setUser(data.admin);
      } catch {
        /* offline */
      } finally {
        setReady(true);
      }
    })();

    const onUnauthorized = () => setUser(null);
    window.addEventListener('zoser:unauthorized', onUnauthorized);
    return () => window.removeEventListener('zoser:unauthorized', onUnauthorized);
  }, []);

  // The CSRF cookie/token don't rotate on login/logout (only minted once,
  // reused for the whole browser session) — no setCsrf() needed here.
  const login = useCallback(async (username, password) => {
    await authApi.login(username, password);
    // The login response omits `permissions` — re-fetch /me for the full
    // permission set the rest of the app's `can()` checks depend on.
    const me = await authApi.me();
    setUser(me.admin);
    return { user: me.admin };
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

  const value = useMemo(() => ({
    user,
    ready,
    login,
    logout,
    refreshUser,
    can,
  }), [user, ready, login, logout, refreshUser, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
