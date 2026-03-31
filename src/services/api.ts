import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// Change this to your backend URL
// For Android emulator use 10.0.2.2, for physical device use your PC's local IP
export const API_BASE_URL = 'http://10.250.219.130:8000';
// export const API_BASE_URL = 'http://72.61.106.77:8002';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const getTokens = async () => {
  const access = await SecureStore.getItemAsync('access_token');
  const refresh = await SecureStore.getItemAsync('refresh_token');
  return { access, refresh };
};

export const setTokens = async (access: string, refresh: string) => {
  await SecureStore.setItemAsync('access_token', access);
  await SecureStore.setItemAsync('refresh_token', refresh);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
  await SecureStore.deleteItemAsync('user_data');
};

export const setUserData = async (user: object) => {
  await SecureStore.setItemAsync('user_data', JSON.stringify(user));
};

export const getUserData = async () => {
  const data = await SecureStore.getItemAsync('user_data');
  return data ? JSON.parse(data) : null;
};

export const createApi = (accessToken?: string | null): AxiosInstance => {
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  });

  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config as RetryConfig;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const { refresh } = await getTokens();
          if (!refresh) return Promise.reject(error);

          const res = await axios.post(`${API_BASE_URL}/api/accounts/token/refresh/`, { refresh });
          const newAccess = res.data.access;
          await SecureStore.setItemAsync('access_token', newAccess);

          originalRequest.headers.set('Authorization', `Bearer ${newAccess}`);
          return api(originalRequest);
        } catch {
          await clearTokens();
          return Promise.reject(error);
        }
      }
      return Promise.reject(error);
    }
  );

  return api;
};
