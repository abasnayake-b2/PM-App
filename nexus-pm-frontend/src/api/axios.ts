import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { authUserFromToken } from '@/utils/permissions';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  // Never follow backend redirects to :8080 (causes CORS). Auth should return JSON 401.
  maxRedirects: 0,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string | null> | null = null;
let logoutRedirectStarted = false;

function isAuthAnonymousUrl(url?: string) {
  const path = url ?? '';
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/password-reset')
  );
}

/** True when JWT `exp` is missing or within skew of expiry. */
function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

/** Clear session and send the user to login (once). */
export function forceLogout() {
  useAuthStore.getState().clearSession();
  if (logoutRedirectStarted) return;
  if (window.location.pathname.startsWith('/login')) return;
  logoutRedirectStarted = true;
  const next = `${window.location.pathname}${window.location.search}`;
  const params = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
  window.location.assign(`/login${params}`);
}

/**
 * Exchange the HttpOnly refreshToken cookie for a new access token.
 * Concurrent callers share one in-flight request.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= api
    .post('/auth/refresh')
    .then((res) => {
      const token = res.data.accessToken as string;
      useAuthStore.getState().setSession(token, authUserFromToken(res.data));
      logoutRedirectStarted = false;
      return token;
    })
    .catch(() => {
      useAuthStore.getState().clearSession();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/** Return the in-memory access token, or restore it from the refresh cookie. */
export async function ensureAccessToken(): Promise<string | null> {
  const existing = useAuthStore.getState().accessToken;
  if (existing && !isAccessTokenExpired(existing)) return existing;
  return refreshAccessToken();
}

api.interceptors.request.use(async (config) => {
  // Never send a stale Bearer on login/refresh — it must stay anonymous.
  if (isAuthAnonymousUrl(config.url)) {
    if (config.headers) {
      delete config.headers.Authorization;
    }
    return config;
  }

  let token = useAuthStore.getState().accessToken;
  if (token && isAccessTokenExpired(token)) {
    token = await refreshAccessToken();
    if (!token) {
      forceLogout();
      return Promise.reject(Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED' }));
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.code === 'SESSION_EXPIRED') {
      return Promise.reject(error);
    }

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
    const newToken = await refreshAccessToken();
    if (newToken) {
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }

    forceLogout();
    return Promise.reject(error);
  },
);

export default api;
