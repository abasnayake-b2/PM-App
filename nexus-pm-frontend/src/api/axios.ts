import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { authUserFromToken } from '@/utils/permissions';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

function isAuthAnonymousUrl(url?: string) {
  const path = url ?? '';
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/password-reset')
  );
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Login / refresh / reset already return 401 for bad credentials — do not
    // attempt token refresh (that deadlocks when /auth/refresh itself gets 401).
    if (isAuthAnonymousUrl(original.url)) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshPromise ??= api
      .post('/auth/refresh')
      .then((res) => {
        const token = res.data.accessToken as string;
        useAuthStore.getState().setSession(token, authUserFromToken(res.data));
        return token;
      })
      .catch(() => {
        useAuthStore.getState().clearSession();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const newToken = await refreshPromise;
    if (newToken) {
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
    return Promise.reject(error);
  },
);

export default api;
