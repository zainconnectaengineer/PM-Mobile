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
      const { access, refresh } = await getTokens();
      const user = await getUserData();
      if (access && refresh && user) {
        setState({ user, access, refresh, isAuthenticated: true });
      }
    } catch {
      // tokens invalid or missing
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
