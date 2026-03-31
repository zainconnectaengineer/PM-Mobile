import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AuthState, LoginResponse, User } from '../types';
import { clearTokens, setTokens, setUserData, getTokens, getUserData } from '../services/api';

type AuthContextType = AuthState & {
  login: (data: LoginResponse) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  access: null,
  refresh: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    access: null,
    refresh: null,
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      // Add timeout to prevent hanging if SecureStore is slow
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );

      const loadPromise = async () => {
        const { access, refresh } = await getTokens();
        const user = await getUserData();
        if (access && refresh && user) {
          // Validate token by making a quick API call
          try {
            const { createApi } = require('../services/api');
            const res = await createApi(access).get('/api/accounts/users/me/', { timeout: 4000 });
            if (res.data) {
              setState({ user: res.data, access, refresh, isAuthenticated: true });
              return;
            }
          } catch {
            // Token might be expired, try refreshing
            try {
              const axios = require('axios').default;
              const { API_BASE_URL, setTokens: saveTokens } = require('../services/api');
              const refreshRes = await axios.post(`${API_BASE_URL}/api/accounts/token/refresh/`, { refresh }, { timeout: 4000 });
              const newAccess = refreshRes.data.access;
              await saveTokens(newAccess, refresh);
              setState({ user, access: newAccess, refresh, isAuthenticated: true });
              return;
            } catch {
              // Refresh also failed, clear everything
              await clearTokens();
            }
          }
        }
      };

      await Promise.race([loadPromise(), timeoutPromise]);
    } catch {
      // Timeout or error — clear stored data and show login
      try { await clearTokens(); } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginResponse) => {
    await setTokens(data.access, data.refresh);
    await setUserData(data.user);
    setState({
      user: data.user,
      access: data.access,
      refresh: data.refresh,
      isAuthenticated: true,
    });
    // Send heartbeat to mark user online immediately
    try {
      const { createApi } = require('../services/api');
      await createApi(data.access).post('/api/accounts/presence/heartbeat/');
    } catch { /* ignore */ }
  };

  const logout = async () => {
    try {
      // Try to notify the server
      const { access } = await getTokens();
      if (access) {
        const { createApi } = require('../services/api');
        await createApi(access).post('/api/accounts/logout/');
      }
    } catch {
      // ignore
    }
    await clearTokens();
    setState({ user: null, access: null, refresh: null, isAuthenticated: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
