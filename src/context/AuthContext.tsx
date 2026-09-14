// ─── Auth Context ─────────────────────────────────────────────
// Mock authentication. Replace with real JWT/session auth later.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AuthState } from '../data/types';

// MOCK CREDENTIALS — replace with real auth endpoint later
const MOCK_ADMIN_EMAIL = 'admin@h2smonitor.com';
const MOCK_ADMIN_PASSWORD = 'admin@1234'; // never expose real creds in production

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const stored = sessionStorage.getItem('h2s_auth');
    return stored ? JSON.parse(stored) : { isAuthenticated: false, adminName: '' };
  });

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate network delay
    await new Promise(res => setTimeout(res, 800));

    if (
      email.trim().toLowerCase() === MOCK_ADMIN_EMAIL &&
      password === MOCK_ADMIN_PASSWORD
    ) {
      const newState: AuthState = { isAuthenticated: true, adminName: 'Admin' };
      setAuthState(newState);
      sessionStorage.setItem('h2s_auth', JSON.stringify(newState));
      return { success: true };
    }

    return { success: false, error: 'Invalid credentials. Please check your email and password.' };
  }, []);

  const logout = useCallback(() => {
    setAuthState({ isAuthenticated: false, adminName: '' });
    sessionStorage.removeItem('h2s_auth');
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
