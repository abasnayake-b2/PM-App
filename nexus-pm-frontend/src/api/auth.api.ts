import api from './axios';
import type { TokenResponse } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', payload);
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/password-reset/request', { email });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/password-reset/confirm', { token, newPassword });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return data;
}

/** Returns the current user profile, permissions, and a fresh access token. */
export async function fetchCurrentUser(): Promise<TokenResponse> {
  const { data } = await api.get<TokenResponse>('/auth/me');
  return data;
}
