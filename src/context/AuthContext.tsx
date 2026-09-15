// ─── Auth Context (JWT via FastAPI) ──────────────────────────
// Stores the bearer token in localStorage and hydrates the user
// from /api/auth/me on load.
// ─────────────────────────────────────────────────────────────

import React, {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import type { Role, User } from '../types/api';
import { api, ClientError, tokenStore } from '../services/api';

const USER_KEY = 'hydronexus_user';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (tokenStore.get()) {
        try {
          const me = await api.me();
          if (!cancelled) {
            setUser(me);
            localStorage.setItem(USER_KEY, JSON.stringify(me));
          }
        } catch {
          tokenStore.clear();
          localStorage.removeItem(USER_KEY);
          if (!cancelled) setUser(null);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.login(email.trim().toLowerCase(), password);
      tokenStore.set(res.access_token);
      setUser(res.user);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      return { success: true };
    } catch (err) {
      const message =
        err instanceof ClientError
          ? err.message
          : 'Unable to reach the server. Check the backend connection.';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const role: Role | undefined = user?.role;
  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    isAuthenticated: !!user,
    isAdmin: role === 'admin',
    isWorker: role === 'worker',
    login,
    logout,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, ready, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
