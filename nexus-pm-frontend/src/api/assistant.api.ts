import { useAuthStore } from '@/store/useAuthStore';
import { authUserFromToken } from '@/utils/permissions';
import api from '@/api/axios';

export type AiStatus = {
  enabled: boolean;
  available: boolean;
  model: string;
  modelProfile?: string;
};

export type AiStructuredAnswer = {
  title?: string;
  summary?: string;
  metrics?: { label: string; value: string }[];
  tables?: { title: string; columns: string[]; rows: string[][] }[];
  caveats?: string[];
  sources?: { toolKey: string; label: string; href: string }[];
};

export type AiSseHandlers = {
  onToken?: (text: string) => void;
  onToolStart?: (toolKey: string, label: string) => void;
  onToolEnd?: (toolKey: string, label: string) => void;
  onError?: (message: string) => void;
  onDone?: (ok: boolean, content?: string, structured?: AiStructuredAnswer) => void;
};

async function ensureAccessToken(): Promise<string | null> {
  let token = useAuthStore.getState().accessToken;
  if (token) return token;

  try {
    const res = await api.post('/auth/refresh');
    token = res.data.accessToken as string;
    useAuthStore.getState().setSession(token, authUserFromToken(res.data));
    return token;
  } catch {
    useAuthStore.getState().clearSession();
    return null;
  }
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const { data } = await api.get<AiStatus>('/ai/status');
  return data;
}

/**
 * Streams assistant chat via SSE. Uses fetch (not axios) for long-lived streams.
 */
export async function streamAiChat(
  message: string,
  handlers: AiSseHandlers,
  signal?: AbortSignal,
  retried = false,
): Promise<void> {
  const token = await ensureAccessToken();
  if (!token) {
    handlers.onError?.('Session expired. Please sign in again.');
    handlers.onDone?.(false);
    return;
  }

  const response = await fetch('/api/v1/ai/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (response.status === 401 && !retried) {
    try {
      const refresh = await api.post('/auth/refresh');
      const newToken = refresh.data.accessToken as string;
      useAuthStore.getState().setSession(newToken, authUserFromToken(refresh.data));
      return streamAiChat(message, handlers, signal, true);
    } catch {
      handlers.onError?.('Session expired. Please sign in again.');
      handlers.onDone?.(false);
      return;
    }
  }

  if (response.status === 403) {
    handlers.onError?.('You do not have permission to use the Assistant.');
    handlers.onDone?.(false);
    return;
  }

  if (response.status === 503) {
    handlers.onError?.('Assistant is unavailable. Ask an administrator to enable AI.');
    handlers.onDone?.(false);
    return;
  }

  if (response.status === 429) {
    let detail = 'Assistant rate limit exceeded. Try again later.';
    try {
      const problem = await response.json();
      if (problem?.detail) detail = problem.detail;
    } catch {
      /* ignore */
    }
    handlers.onError?.(detail);
    handlers.onDone?.(false);
    return;
  }

  if (!response.ok || !response.body) {
    let detail = `Request failed (${response.status})`;
    try {
      const problem = await response.json();
      if (problem?.detail) detail = problem.detail;
    } catch {
      /* ignore */
    }
    handlers.onError?.(detail);
    handlers.onDone?.(false);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      parseSseBlock(rawEvent, handlers);
    }
  }

  if (buffer.trim()) {
    parseSseBlock(buffer, handlers);
  }
}

function parseSseBlock(block: string, handlers: AiSseHandlers) {
  const lines = block.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
  } catch {
    return;
  }

  const type = (payload.type as string) || eventName;
  switch (type) {
    case 'token':
      handlers.onToken?.(String(payload.text ?? ''));
      break;
    case 'tool_start':
      handlers.onToolStart?.(String(payload.toolKey ?? ''), String(payload.label ?? payload.toolKey ?? ''));
      break;
    case 'tool_end':
      handlers.onToolEnd?.(String(payload.toolKey ?? ''), String(payload.label ?? payload.toolKey ?? ''));
      break;
    case 'error':
      handlers.onError?.(String(payload.message ?? 'Assistant error'));
      break;
    case 'done':
      handlers.onDone?.(
        Boolean(payload.ok),
        payload.content != null ? String(payload.content) : undefined,
        payload.structured as AiStructuredAnswer | undefined,
      );
      break;
    default:
      break;
  }
}
