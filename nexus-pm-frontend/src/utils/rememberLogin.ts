const STORAGE_KEY = 'dfnpm.login.remember';

export interface RememberedLogin {
  email: string;
  password: string;
}

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decode(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function loadRememberedLogin(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; password?: string };
    if (!parsed.email) return null;
    return {
      email: parsed.email,
      password: parsed.password ? decode(parsed.password) : '',
    };
  } catch {
    return null;
  }
}

export function saveRememberedLogin(email: string, password: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      email: email.trim(),
      password: encode(password),
    }),
  );
}

export function clearRememberedLogin(): void {
  localStorage.removeItem(STORAGE_KEY);
}
