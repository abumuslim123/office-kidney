import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type Permission = {
  id: string;
  slug: string;
  name: string;
};

export type UserInfo = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  permissions: Permission[];
};

type AuthContextValue = {
  user: UserInfo | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_KEY = 'kidney_access';
const REFRESH_KEY = 'kidney_refresh';
const USER_KEY = 'kidney_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(ACCESS_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback((access: string, refresh: string, userData: UserInfo) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setAccessToken(access);
    setUser(userData);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string; user: UserInfo }>('/auth/refresh', {
        refreshToken: refresh,
      });
      persist(data.accessToken, data.refreshToken, data.user);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }, [persist, clearAuth]);

  useEffect(() => {
    if (!accessToken) {
      refreshTokens().finally(() => setIsLoading(false));
      return;
    }
    api.interceptors.response.use(
      (r) => r,
      async (err) => {
        if (err.response?.status === 401) {
          const ok = await refreshTokens();
          if (ok && err.config) return api.request(err.config);
        }
        return Promise.reject(err);
      }
    );
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: UserInfo;
      }>('/auth/login', { email, password });
      persist(data.accessToken, data.refreshToken, data.user);
    },
    [persist]
  );

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (refresh) {
      try {
        await api.post('/auth/logout', { refreshToken: refresh });
      } catch {}
    }
    clearAuth();
  }, [clearAuth]);

  const refreshUser = useCallback(async () => {
    const u = localStorage.getItem(USER_KEY);
    if (u) setUser(JSON.parse(u));
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
