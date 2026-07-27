import { FormEvent, useEffect, useState } from 'react';
import { useAiSettings, useUpdateAiSettings } from '@/hooks/useAiAdmin';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

export function AiSettingsSection() {
  const { can } = usePermissions();
  const { data, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const [softEnabled, setSoftEnabled] = useState(true);
  const [modelProfile, setModelProfile] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [maxTools, setMaxTools] = useState(4);
  const [rateLimit, setRateLimit] = useState(30);
  const [allowedRoles, setAllowedRoles] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setSoftEnabled(data.softEnabled);
    setModelProfile(data.modelProfile);
    setSystemInstructions(data.systemInstructions ?? '');
    setMaxTools(data.maxToolsPerQuestion);
    setRateLimit(data.rateLimitPerHour);
    setAllowedRoles(data.allowedRoles ?? '');
  }, [data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavedMsg(null);
    await update.mutateAsync({
      softEnabled,
      modelProfile,
      systemInstructions,
      maxToolsPerQuestion: maxTools,
      rateLimitPerHour: rateLimit,
      allowedRoles,
    });
    setSavedMsg('AI settings saved.');
  };

  if (isLoading || !data) {
    return <p className="mt-6 text-sm text-text2">Loading AI settings…</p>;
  }

  const selected = data.profiles.find((p) => p.key === modelProfile) ?? data.activeProfile;

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-6">
      {!data.yamlEnabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Hard kill switch is off (`dfnpm.ai.enabled=false`). Soft settings below have no effect until
          YAML/env enables AI.
        </div>
      )}

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={softEnabled}
          onChange={(e) => setSoftEnabled(e.target.checked)}
          disabled={!can(P.ADMIN_UPDATE)}
          className="rounded border-border"
        />
        <span>
          Assistant soft-enabled
          <span className="mt-0.5 block text-xs text-text2">
            Available when YAML is on and this toggle is checked.
          </span>
        </span>
      </label>

      <label className="block text-sm">
        <span className="text-text2">Active LLM</span>
        <select
          value={modelProfile}
          onChange={(e) => setModelProfile(e.target.value)}
          disabled={!can(P.ADMIN_UPDATE)}
          className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2"
        >
          {data.profiles.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="rounded-xl border border-border bg-bg3 px-4 py-3 text-sm">
          <p className="font-medium">{selected.label}</p>
          <p className="mt-1 text-text2">Model: {selected.model}</p>
          <p className="text-text2">Host: {selected.baseUrlHost}</p>
          <p className="mt-2 text-xs text-text2">API keys stay in server config — never shown here.</p>
        </div>
      )}

      <label className="block text-sm">
        <span className="text-text2">System instructions (appended to base prompt)</span>
        <textarea
          value={systemInstructions}
          onChange={(e) => setSystemInstructions(e.target.value)}
          rows={4}
          disabled={!can(P.ADMIN_UPDATE)}
          className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2"
          placeholder="Optional extra guidance for the Assistant…"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Max tools / question</span>
          <input
            type="number"
            min={1}
            max={20}
            value={maxTools}
            onChange={(e) => setMaxTools(Number(e.target.value))}
            disabled={!can(P.ADMIN_UPDATE)}
            className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Rate limit / hour (0 = unlimited)</span>
          <input
            type="number"
            min={0}
            max={10000}
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
            disabled={!can(P.ADMIN_UPDATE)}
            className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-text2">Allowed roles (optional, comma-separated)</span>
        <input
          type="text"
          value={allowedRoles}
          onChange={(e) => setAllowedRoles(e.target.value)}
          disabled={!can(P.ADMIN_UPDATE)}
          placeholder="e.g. MANAGER,VP,CXO — empty = all with AI permission"
          className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2"
        />
      </label>

      {can(P.ADMIN_UPDATE) && (
        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save AI settings'}
        </button>
      )}
      {savedMsg && <p className="text-sm text-emerald-400">{savedMsg}</p>}
    </form>
  );
}
