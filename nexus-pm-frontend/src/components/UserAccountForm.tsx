import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { UserAccount } from '@/api/userManagement.api';
import type { EligibleManagementOption } from '@/api/userManagement.api';
import type { CreateUserAccountPayload, UpdateUserAccountPayload } from '@/api/userManagement.api';
import { fetchAssignableRoles } from '@/api/users.api';
import { fetchDepartments, fetchDesignations } from '@/api/users.api';
import type { SupervisorOption } from '@/components/TeamMemberForm';
import {
  canSuperviseRole,
  defaultOrgWideVisibility,
  requiredSupervisorRank,
  supervisorRequirementHint,
  supportsVisibilityToggle,
} from '@/utils/orgRoles';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const;

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string; detail?: string } | undefined;
    return data?.detail || data?.message || error.message || 'Save failed';
  }
  if (error instanceof Error) return error.message;
  return 'Save failed';
}

interface UserAccountFormProps {
  mode: 'create' | 'edit';
  initial?: UserAccount;
  eligibleManagement: EligibleManagementOption[];
  supervisors: SupervisorOption[];
  loading?: boolean;
  error?: unknown;
  onCancel: () => void;
  onSubmit: (payload: CreateUserAccountPayload | UpdateUserAccountPayload) => void;
}

function resolveAutoManagerId(
  managementId: string,
  eligibleManagement: EligibleManagementOption[],
): string {
  if (!managementId) return '';
  const person = eligibleManagement.find((entry) => entry.id === managementId);
  return person?.supervisorEmployeeId ?? '';
}

export function UserAccountForm({
  mode,
  initial,
  eligibleManagement,
  supervisors,
  loading,
  error,
  onCancel,
  onSubmit,
}: UserAccountFormProps) {
  const [managementId, setManagementId] = useState(initial?.managementId ?? '');
  const [managerId, setManagerId] = useState(initial?.managerId ?? '');
  const [roleCode, setRoleCode] = useState(initial?.roleCode ?? 'MANAGER');
  const [orgWideVisibility, setOrgWideVisibility] = useState(
    initial?.orgWideVisibility ?? defaultOrgWideVisibility(initial?.roleCode ?? 'MANAGER'),
  );

  const { data: roleOptions = [] } = useQuery({
    queryKey: ['assignable-roles'],
    queryFn: fetchAssignableRoles,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });
  const { data: designations = [] } = useQuery({
    queryKey: ['designations'],
    queryFn: fetchDesignations,
  });

  const selectedManagement = useMemo(
    () => eligibleManagement.find((person) => person.id === managementId),
    [eligibleManagement, managementId],
  );

  const autoManagerId = useMemo(
    () => resolveAutoManagerId(managementId, eligibleManagement),
    [managementId, eligibleManagement],
  );

  useEffect(() => {
    if (mode === 'create' && managementId) {
      setManagerId(autoManagerId);
    }
  }, [mode, managementId, autoManagerId]);

  const needsNoManager = requiredSupervisorRank(roleCode) == null;
  const eligibleSupervisors = useMemo(() => {
    if (needsNoManager) return [];
    return supervisors.filter(
      (s) => s.id !== initial?.id && canSuperviseRole(s.roleCode, roleCode),
    );
  }, [supervisors, initial?.id, roleCode, needsNoManager]);

  useEffect(() => {
    if (!supportsVisibilityToggle(roleCode)) {
      if (orgWideVisibility) setOrgWideVisibility(false);
      return;
    }
    // When switching into VP, default to org-wide; into Manager, own-team — only if user hasn't
    // opened an existing record with an explicit value for this same role.
    if (!initial || initial.roleCode !== roleCode) {
      setOrgWideVisibility(defaultOrgWideVisibility(roleCode));
    }
  }, [roleCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop an incompatible manager when the application role changes (e.g. Manager → VP).
  useEffect(() => {
    if (needsNoManager) {
      if (managerId) setManagerId('');
      return;
    }
    if (!managerId) return;
    const selected = supervisors.find((s) => s.id === managerId);
    if (selected?.roleCode && !canSuperviseRole(selected.roleCode, roleCode)) {
      setManagerId('');
    }
  }, [roleCode, needsNoManager]); // eslint-disable-line react-hooks/exhaustive-deps

  const managerHint = useMemo(() => {
    if (needsNoManager) {
      return supervisorRequirementHint(roleCode);
    }
    if (managerId) {
      const selected = supervisors.find((supervisor) => supervisor.id === managerId);
      if (selected) {
        return selected.roleCode && !canSuperviseRole(selected.roleCode, roleCode)
          ? `${selected.label} is not valid for ${roleCode}. ${supervisorRequirementHint(roleCode)}`
          : selected.label;
      }
      if (initial?.managerId === managerId && initial.managerName) return initial.managerName;
      if (
        selectedManagement?.supervisorEmployeeId === managerId &&
        selectedManagement.supervisorEmployeeName
      ) {
        return selectedManagement.supervisorEmployeeName;
      }
    }
    if (eligibleSupervisors.length === 0) {
      return `${supervisorRequirementHint(roleCode)} No matching login users yet — create a CXO/VP account first if needed.`;
    }
    if (selectedManagement?.supervisorFullName) {
      return selectedManagement.supervisorEmployeeId
        ? `Auto: ${selectedManagement.supervisorEmployeeName ?? selectedManagement.supervisorFullName}`
        : `${selectedManagement.supervisorFullName} (no user account yet — assign manually or onboard supervisor first)`;
    }
    return supervisorRequirementHint(roleCode);
  }, [
    managerId,
    supervisors,
    initial,
    selectedManagement,
    roleCode,
    needsNoManager,
    eligibleSupervisors.length,
  ]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (mode === 'create') {
      const payload: CreateUserAccountPayload = {
        managementId: fd.get('managementId') as string,
        email: (fd.get('email') as string).trim().toLowerCase(),
        password: fd.get('password') as string,
        roleCode: roleCode || 'MANAGER',
        departmentId: (fd.get('departmentId') as string) || undefined,
        designationId: (fd.get('designationId') as string) || undefined,
        managerId: managerId || undefined,
        orgWideVisibility: supportsVisibilityToggle(roleCode) ? orgWideVisibility : false,
      };
      onSubmit(payload);
      return;
    }

    const payload: UpdateUserAccountPayload = {
      email: (fd.get('email') as string).trim().toLowerCase(),
      roleCode: roleCode || undefined,
      status: (fd.get('status') as string) || undefined,
      departmentId: (fd.get('departmentId') as string) || undefined,
      designationId: (fd.get('designationId') as string) || undefined,
      managerId: managerId || undefined,
      orgWideVisibility: supportsVisibilityToggle(roleCode) ? orgWideVisibility : false,
    };
    const password = (fd.get('password') as string).trim();
    if (password) payload.password = password;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error != null && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(error)}
        </div>
      )}

      {mode === 'create' ? (
        <label className="block text-sm">
          <span className="text-text2">Management person</span>
          <select
            name="managementId"
            required
            className={inputClass}
            value={managementId}
            onChange={(e) => setManagementId(e.target.value)}
          >
            <option value="" disabled>
              Select from management roster…
            </option>
            {eligibleManagement.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName} — {person.roleTitle}
                {person.supervisorFullName ? ` (reports to ${person.supervisorFullName})` : ''}
              </option>
            ))}
          </select>
          {eligibleManagement.length === 0 && (
            <p className="mt-1 text-xs text-text2">
              No eligible management people. Add them under Admin → Management first.
            </p>
          )}
        </label>
      ) : (
        <div className="rounded-lg border border-border bg-bg3 px-3 py-2 text-sm">
          <div className="text-text2">Management person</div>
          <div className="font-medium">
            {initial?.managementFullName ?? initial?.fullName ?? '—'}
          </div>
          {initial?.managementRoleTitle && (
            <div className="text-text2">{initial.managementRoleTitle}</div>
          )}
          {!initial?.managementId && (
            <p className="mt-1 text-xs text-text2">Legacy account (not linked to management roster)</p>
          )}
        </div>
      )}

      <label className="block text-sm">
        <span className="text-text2">Email (login)</span>
        <input
          name="email"
          type="email"
          required
          defaultValue={initial?.email}
          className={inputClass}
          autoComplete="off"
        />
      </label>

      <label className="block text-sm">
        <span className="text-text2">
          Password{mode === 'edit' ? ' (leave blank to keep current)' : ''}
        </span>
        <input
          name="password"
          type="password"
          required={mode === 'create'}
          minLength={8}
          className={inputClass}
          autoComplete="new-password"
        />
      </label>

      <label className="block text-sm">
        <span className="text-text2">Application role</span>
        <select
          name="roleCode"
          value={roleCode}
          onChange={(e) => setRoleCode(e.target.value)}
          className={inputClass}
        >
          {roleOptions.length === 0 && (
            <option value={roleCode}>{roleCode || 'Loading roles…'}</option>
          )}
          {roleOptions.map((role) => (
            <option key={role.id} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>
      </label>

      {supportsVisibilityToggle(roleCode) && (
        <div className="rounded-lg border border-border bg-bg3 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Team visibility</p>
              <p className="mt-0.5 text-xs text-text2">
                {orgWideVisibility
                  ? 'Sees all teams / org-wide.'
                  : 'Sees own team only.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={orgWideVisibility}
              onClick={() => setOrgWideVisibility((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                orgWideVisibility ? 'bg-accent' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  orgWideVisibility ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="mt-2 flex gap-2 text-xs">
            <span className={!orgWideVisibility ? 'font-medium text-accent' : 'text-text2'}>
              Own team
            </span>
            <span className="text-text2">/</span>
            <span className={orgWideVisibility ? 'font-medium text-accent' : 'text-text2'}>
              Org-wide
            </span>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <label className="block text-sm">
          <span className="text-text2">Status</span>
          <select name="status" defaultValue={initial?.status ?? 'ACTIVE'} className={inputClass}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        <span className="text-text2">Department</span>
        <select name="departmentId" defaultValue={initial?.departmentId ?? ''} className={inputClass}>
          <option value="">None</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-text2">Designation</span>
        <select name="designationId" defaultValue={initial?.designationId ?? ''} className={inputClass}>
          <option value="">None</option>
          {designations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-text2">Manager</span>
        <select
          name="managerId"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          className={inputClass}
          disabled={needsNoManager}
          required={!needsNoManager && roleCode !== 'SUPER_ADMIN' && roleCode !== 'ADMIN'}
        >
          <option value="">
            {needsNoManager
              ? 'None (top of reporting line)'
              : autoManagerId
                ? 'Auto from management supervisor'
                : 'Select supervisor…'}
          </option>
          {eligibleSupervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text2">{managerHint}</p>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || (mode === 'create' && eligibleManagement.length === 0)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Create user' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
