import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import {
  fetchAiStatus,
  streamAiChat,
  type AiStatus,
  type AiStructuredAnswer,
} from '@/api/assistant.api';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { isManagerRole, isPortfolioWideRole } from '@/utils/orgRoles';

type ChatRole = 'user' | 'assistant' | 'system';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  tools?: string[];
  structured?: AiStructuredAnswer;
  error?: boolean;
};

function starterPrompts(role: string | undefined, canAllocations: boolean, canIssues: boolean): string[] {
  const prompts: string[] = [];
  if (canAllocations && (isManagerRole(role) || isPortfolioWideRole(role) || role === 'ADMIN' || role === 'SUPER_ADMIN')) {
    prompts.push('Who is over-allocated in the next 4 weeks?');
    prompts.push('Summarise capacity utilisation for the next 12 weeks.');
  }
  prompts.push('Give me a dashboard summary of my scoped projects.');
  if (canIssues) {
    prompts.push('How are issues distributed by status?');
    prompts.push('Show the Change Request status matrix.');
  }
  if (isPortfolioWideRole(role)) {
    prompts.push('What are the key portfolio highlights from the dashboard overview?');
  }
  return prompts.slice(0, 5);
}

function renderAssistantText(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split('\n');
    const isList = lines.every((l) => !l.trim() || /^[-*•]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim()));
    if (isList) {
      return (
        <ul key={bi} className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
          {lines.filter((l) => l.trim()).map((line, li) => (
            <li key={li}>{formatInline(line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''))}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={bi} className="mb-2 whitespace-pre-wrap last:mb-0">
        {lines.map((line, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {formatInline(line)}
          </span>
        ))}
      </p>
    );
  });
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function StructuredBlocks({ structured }: { structured: AiStructuredAnswer }) {
  const hasMetrics = (structured.metrics?.length ?? 0) > 0;
  const hasTables = (structured.tables?.length ?? 0) > 0;
  const hasCaveats = (structured.caveats?.length ?? 0) > 0;
  const hasSources = (structured.sources?.length ?? 0) > 0;
  if (!hasMetrics && !hasTables && !hasCaveats && !hasSources) {
    return null;
  }
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {hasMetrics && (
        <div className="grid gap-2 sm:grid-cols-2">
          {structured.metrics!.map((m, i) => (
            <div key={i} className="rounded-lg bg-bg2 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-text2">{m.label}</p>
              <p className="mt-0.5 font-semibold">{m.value}</p>
            </div>
          ))}
        </div>
      )}
      {hasTables &&
        structured.tables!.map((table, ti) => (
          <div key={ti} className="overflow-x-auto rounded-lg border border-border">
            {table.title && <p className="border-b border-border bg-bg2 px-3 py-2 text-xs font-medium">{table.title}</p>}
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-text2">
                  {table.columns.map((c, ci) => (
                    <th key={ci} className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-border">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {hasCaveats && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-text2">
          {structured.caveats!.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
      {hasSources && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-text2">Sources:</span>
          {structured.sources!.map((s, i) => (
            <Link key={i} to={s.href || '/'} className="text-accent hover:underline">
              {s.label || s.toolKey}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssistantPage() {
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamHint, setStreamHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canAllocations = can(P.ALLOCATIONS_VIEW);
  const canIssues = can(P.ISSUES_VIEW);
  const prompts = useMemo(
    () => starterPrompts(user?.role, canAllocations, canIssues),
    [user?.role, canAllocations, canIssues],
  );

  useEffect(() => {
    let cancelled = false;
    fetchAiStatus()
      .then((s) => {
        if (!cancelled) {
          setStatus(s);
          setStatusError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg =
            err?.response?.status === 503
              ? 'Assistant is unavailable.'
              : err?.response?.data?.detail || 'Could not load Assistant status.';
          setStatusError(msg);
          setStatus({ enabled: false, available: false, model: '' });
        }
      });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamHint, sending]);

  const unavailable = status != null && !status.available;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || unavailable) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', tools: [] },
    ]);
    setInput('');
    setSending(true);
    setStreamHint(null);

    await streamAiChat(
      trimmed,
      {
        onToken: (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          );
        },
        onToolStart: (_key, label) => {
          setStreamHint(`Fetching ${label}…`);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, tools: [...(m.tools ?? []), label] }
                : m,
            ),
          );
        },
        onToolEnd: () => {
          setStreamHint(null);
        },
        onError: (message) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content || message,
                    error: true,
                  }
                : m,
            ),
          );
        },
        onDone: (ok, content, structured) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              if (content || structured) {
                return {
                  ...m,
                  content: content ?? m.content,
                  structured,
                };
              }
              if (!ok && !m.content) {
                return { ...m, content: 'No response received.', error: true };
              }
              return m;
            }),
          );
        },
      },
      controller.signal,
    ).catch((err) => {
      if (err?.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || 'Stream failed. Please try again.', error: true }
            : m,
        ),
      );
    });

    setSending(false);
    setStreamHint(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-accent/15 p-2 text-accent">
            <Sparkles size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
            <p className="mt-1 text-sm text-text2">
              Ask natural-language questions about reports and statistics in your scope.
            </p>
          </div>
        </div>
        {status?.enabled && status.model && (
          <span className="rounded-lg border border-border bg-bg3 px-3 py-1 text-xs text-text2">
            Model: {status.model}
            {status.modelProfile ? ` (${status.modelProfile})` : ''}
          </span>
        )}
      </header>

      <p className="text-xs text-text2">
        Disclaimer: answers use live report data for your account and may be incomplete. Always verify
        important decisions in Dashboard / Backlog. Figures are not invented.
      </p>

      {(unavailable || statusError) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {statusError ||
            'Assistant unavailable. Enable dfnpm.ai in server config and ensure Admin soft-enable is on.'}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-bg2">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {messages.length === 0 && !unavailable && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <Bot className="text-text2" size={40} />
              <div>
                <p className="font-medium">Ask about your reports</p>
                <p className="mt-1 text-sm text-text2">Try a starter prompt below.</p>
              </div>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={sending || unavailable}
                    onClick={() => void send(p)}
                    className="rounded-lg border border-border bg-bg3 px-3 py-2 text-left text-sm transition hover:border-accent/50 hover:bg-bg3/80 disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent text-white'
                    : m.error
                      ? 'border border-red-500/40 bg-red-500/10 text-red-100'
                      : 'border border-border bg-bg3'
                }`}
              >
                {m.role === 'assistant' && m.tools && m.tools.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {m.tools.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="rounded-md bg-bg2 px-2 py-0.5 text-[11px] text-text2"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {m.role === 'assistant' ? (
                  <>
                    {renderAssistantText(m.content || (sending ? '…' : ''))}
                    {m.structured && <StructuredBlocks structured={m.structured} />}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}

          {streamHint && (
            <div className="flex items-center gap-2 text-xs text-text2">
              <Loader2 size={14} className="animate-spin" />
              {streamHint}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={onSubmit}
          className="flex gap-2 border-t border-border p-3 md:p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending || unavailable}
            placeholder={unavailable ? 'Assistant unavailable' : 'Ask about capacity, issues, dashboard…'}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg3 px-3 py-2.5 text-sm outline-none ring-accent focus:ring-1 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || unavailable || !input.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
