"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  onForceLogout,
  refresh as apiRefresh,
  setAccessToken,
} from "./api-client";
import type { PublicUser } from "./types";

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    onForceLogout(() => setUser(null));
  }, []);

  // Hard refresh never has the access token in memory, so every mount must
  // re-derive the session from the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Treat any failure (including the API being unreachable) as logged
      // out — never leave the app stuck on the loading state.
      try {
        const token = await apiRefresh();
        if (!token) return;
        const { user: me } = await getMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setAccessToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser } = await apiLogin(email, password);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updated: PublicUser) => {
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
