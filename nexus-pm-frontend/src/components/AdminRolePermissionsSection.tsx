import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  createAccessRole,
  deleteAccessRole,
  fetchAccessPermissions,
  fetchAccessRoles,
  updateRolePermissions,
  type PermissionItem,
  type RoleAccessItem,
} from '@/api/roleAccess.api';

const MODULE_LABELS: Record<string, string> = {
  USERS: 'User accounts',
  PROJECTS: 'Projects',
  ISSUES: 'Main Backlog',
  ALLOCATIONS: 'Resource utilization',
  REPORTS: 'Dashboard',
  ORGANISATIONS: 'Organisation',
  TEAM: 'Management and employees',
  ORG_STRUCTURE: 'Organization — Org structure',
  ADMIN: 'Admin (system)',
  REFERENCE: 'Reference data',
  IMPORT: 'Excel import',
  RELEASES: 'Releases',
};

const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] as const;

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string } | undefined;
    return data?.detail ?? 'Request failed';
  }
  return 'Request failed';
}

function groupPermissions(permissions: PermissionItem[]) {
  const map = new Map<string, PermissionItem[]>();
  for (const permission of permissions) {
    const list = map.get(permission.module) ?? [];
    list.push(permission);
    map.set(permission.module, list);
  }
  return Array.from(map.entries()).map(([module, items]) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    items: items.sort(
      (a, b) =>
        ACTIONS.indexOf(a.action as (typeof ACTIONS)[number]) -
        ACTIONS.indexOf(b.action as (typeof ACTIONS)[number]),
    ),
  }));
}

export function AdminRolePermissionsSection() {
  const qc = useQueryClient();
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['access-permissions'],
    queryFn: fetchAccessPermissions,
  });
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['access-roles'],
    queryFn: fetchAccessRoles,
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0] ?? null;
  const activeRoleId = selectedRole?.id ?? null;

  const [draft, setDraft] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roles.length) return;
    const role = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
    if (role && role.id !== selectedRoleId) {
      setSelectedRoleId(role.id);
    }
    if (role) {
      setDraft(new Set(role.permissionCodes));
    }
  }, [roles, selectedRoleId]);

  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);

  const selectRole = (role: RoleAccessItem) => {
    setSelectedRoleId(role.id);
    setDraft(new Set(role.permissionCodes));
  };

  const toggle = (code: string) => {
    if (!selectedRole?.permissionsEditable) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: () => updateRolePermissions(activeRoleId!, Array.from(draft)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-roles'] });
      qc.invalidateQueries({ queryKey: ['assignable-roles'] });
    },
    onError: (error) => window.alert(apiErrorMessage(error)),
  });

  const createMut = useMutation({
    mutationFn: (payload: { name: string; code: string; permissionCodes: string[] }) =>
      createAccessRole(payload),
    onSuccess: (role) => {
      setShowCreate(false);
      setSelectedRoleId(role.id);
      qc.invalidateQueries({ queryKey: ['access-roles'] });
      qc.invalidateQueries({ queryKey: ['assignable-roles'] });
    },
    onError: (error) => window.alert(apiErrorMessage(error)),
  });

  const deleteMut = useMutation({
    mutationFn: (roleId: string) => deleteAccessRole(roleId),
    onSuccess: () => {
      setSelectedRoleId(null);
      qc.invalidateQueries({ queryKey: ['access-roles'] });
      qc.invalidateQueries({ queryKey: ['assignable-roles'] });
    },
    onError: (error) => window.alert(apiErrorMessage(error)),
  });

  const handleCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMut.mutate({
      name: (fd.get('name') as string).trim(),
      code: (fd.get('code') as string).trim().toUpperCase(),
      permissionCodes: Array.from(draft),
    });
  };

  const isLoading = permissionsLoading || rolesLoading;

  return (
    <div>
      <p className="text-sm text-text2">
        Permissions map to menus and functions: Dashboard, Projects, Main Backlog, Resource
        utilization, Organization (Org structure), Organisation, Management and employees, Admin,
        Reference data, Excel import, and Releases. Built-in roles can be adjusted here; assign roles
        to users on User management.
      </p>

      {isLoading && <p className="mt-4 text-text2">Loading…</p>}

      {!isLoading && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  activeRoleId === role.id ? 'bg-accent text-[var(--accent-fg)]' : 'border border-border hover:bg-bg3'
                }`}
              >
                {role.name}
                {!role.systemRole && <span className="ml-1 opacity-70">· custom</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setDraft(new Set());
                setShowCreate(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm hover:bg-bg3"
            >
              <Plus size={14} />
              Add role
            </button>
          </div>

          {selectedRole && !showCreate && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selectedRole.name}</h2>
                  <p className="text-sm text-text2 font-mono">{selectedRole.code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRole.deletable && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete role "${selectedRole.name}"?`)) {
                          deleteMut.mutate(selectedRole.id);
                        }
                      }}
                      disabled={deleteMut.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
                    >
                      <Trash2 size={14} />
                      Delete role
                    </button>
                  )}
                  {selectedRole.permissionsEditable ? (
                    <button
                      type="button"
                      onClick={() => saveMut.mutate()}
                      disabled={saveMut.isPending}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
                      style={{ color: 'var(--accent-fg)' }}
                    >
                      {saveMut.isPending ? 'Saving…' : 'Save permissions'}
                    </button>
                  ) : (
                    <p className="text-sm text-text2 self-center">Full access — not editable</p>
                  )}
                </div>
              </div>

              <PermissionMatrix
                grouped={grouped}
                draft={draft}
                editable={selectedRole.permissionsEditable}
                onToggle={toggle}
              />
            </div>
          )}

          {showCreate && (
            <div className="mt-6 rounded-xl border border-border p-5">
              <h2 className="text-lg font-semibold">New custom role</h2>
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-text2">Name</span>
                    <input name="name" required className={inputClass} placeholder="e.g. Project Lead" />
                  </label>
                  <label className="block text-sm">
                    <span className="text-text2">Code</span>
                    <input
                      name="code"
                      required
                      className={inputClass}
                      placeholder="e.g. PROJECT_LEAD"
                      pattern="[A-Za-z0-9_]+"
                      title="Letters, numbers, underscores only"
                    />
                  </label>
                </div>
                <p className="text-sm text-text2">Select permissions for this role:</p>
                <PermissionMatrix grouped={grouped} draft={draft} editable onToggle={toggle} />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
                    style={{ color: 'var(--accent-fg)' }}
                  >
                    {createMut.isPending ? 'Creating…' : 'Create role'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PermissionMatrix({
  grouped,
  draft,
  editable,
  onToggle,
}: {
  grouped: ReturnType<typeof groupPermissions>;
  draft: Set<string>;
  editable: boolean;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="mt-4 overflow-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
          <tr>
            <th className="px-4 py-2">Area</th>
            {ACTIONS.map((action) => (
              <th key={action} className="px-4 py-2 text-center">
                {action.charAt(0) + action.slice(1).toLowerCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ module, label, items }) => (
            <tr key={module} className="border-t border-border">
              <td className="px-4 py-2 font-medium">{label}</td>
              {ACTIONS.map((action) => {
                const permission = items.find((p) => p.action === action);
                if (!permission) {
                  return (
                    <td key={action} className="px-4 py-2 text-center text-text2">
                      —
                    </td>
                  );
                }
                return (
                  <td key={action} className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={draft.has(permission.code)}
                      disabled={!editable}
                      onChange={() => onToggle(permission.code)}
                      aria-label={`${label} ${action}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
