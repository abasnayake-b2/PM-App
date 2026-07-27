import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  useAddAiTool,
  useAiToolsActive,
  useAiToolsAvailable,
  useRemoveAiTool,
  useUpdateAiTool,
} from '@/hooks/useAiAdmin';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { AiToolCatalogItem } from '@/api/aiAdmin.api';

export function AiToolsSection() {
  const { can } = usePermissions();
  const { data: available = [], isLoading: loadingAvailable } = useAiToolsAvailable();
  const { data: active = [], isLoading: loadingActive } = useAiToolsActive();
  const addTool = useAddAiTool();
  const removeTool = useRemoveAiTool();
  const updateTool = useUpdateAiTool();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState('');

  const startEdit = (tool: AiToolCatalogItem) => {
    if (!tool.id) return;
    setEditingId(tool.id);
    setDraftDescription(tool.description ?? '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateTool.mutateAsync({ id: editingId, description: draftDescription });
    setEditingId(null);
  };

  return (
    <div className="mt-6 space-y-8">
      <p className="text-sm text-text2">
        Choose which report APIs the Assistant may call. Tools are picked from a fixed eligible pool
        (no free-form URLs). Chat only uses Active tools the user is also permitted to see.
      </p>

      <section>
        <h2 className="text-lg font-semibold">Active tools</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-bg3 text-text2">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Permission</th>
                <th className="px-4 py-3 font-medium">API</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loadingActive && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-text2">
                    Loading…
                  </td>
                </tr>
              )}
              {!loadingActive && active.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-text2">
                    No Active tools. Add from Available below.
                  </td>
                </tr>
              )}
              {active.map((tool) => (
                <tr key={tool.id ?? tool.toolKey} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{tool.displayName}</div>
                    {editingId === tool.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={draftDescription}
                          onChange={(e) => setDraftDescription(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit()}
                            disabled={!can(P.ADMIN_UPDATE) || updateTool.isPending}
                            className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-text2 line-clamp-2">{tool.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs">{tool.toolKey}</td>
                  <td className="px-4 py-3 align-top text-xs">{tool.requiredPermission || '—'}</td>
                  <td className="px-4 py-3 align-top text-xs text-text2">{tool.apiPath || '—'}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      {can(P.ADMIN_UPDATE) && editingId !== tool.id && (
                        <button
                          type="button"
                          onClick={() => startEdit(tool)}
                          className="rounded-lg border border-border px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
                      )}
                      {can(P.ADMIN_DELETE) && tool.id && (
                        <button
                          type="button"
                          onClick={() => void removeTool.mutateAsync(tool.id!)}
                          disabled={removeTool.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300"
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Available to add</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-bg3 text-text2">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">API</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loadingAvailable && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-text2">
                    Loading…
                  </td>
                </tr>
              )}
              {!loadingAvailable && available.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-text2">
                    All eligible tools are already Active.
                  </td>
                </tr>
              )}
              {available.map((tool) => (
                <tr key={tool.toolKey} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{tool.displayName}</div>
                    <p className="mt-1 text-xs text-text2 line-clamp-2">{tool.description}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{tool.toolKey}</td>
                  <td className="px-4 py-3 text-xs text-text2">{tool.apiPath}</td>
                  <td className="px-4 py-3 text-right">
                    {can(P.ADMIN_CREATE) && (
                      <button
                        type="button"
                        onClick={() => void addTool.mutateAsync({ toolKey: tool.toolKey })}
                        disabled={addTool.isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        <Plus size={12} />
                        Add
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
