import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api, setApiToken, setSessionExpiredHandler, AuthUser, ApiError } from "../api";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  /** Shown on the sign-in screen, e.g. after the session expired */
  notice: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export const SESSION_EXPIRED_NOTICE = "Your session has expired. Please sign in again.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    setApiToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setNotice(null);
  }, []);

  const logout = useCallback(() => {
    setApiToken(null);
    setToken(null);
    setUser(null);
  }, []);

  // An expired or rejected token signs out with an explanation
  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout();
      setNotice(SESSION_EXPIRED_NOTICE);
    });
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, notice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export { ApiError };
