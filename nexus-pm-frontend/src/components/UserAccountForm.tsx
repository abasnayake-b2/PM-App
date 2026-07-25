import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { UserAccount } from '@/api/userManagement.api';
import type {
  EligibleEmployeeOption,
  EligibleManagementOption,
  CreateUserAccountPayload,
  UpdateUserAccountPayload,
} from '@/api/userManagement.api';
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

type PersonSource = 'management' | 'employee';

/** Org/hierarchy primary — skip SUPER_ADMIN/ADMIN when other roles are also assigned. */
function pickPrimaryRoleCode(codes: string[]): string {
  const order = [
    'CXO',
    'CTO',
    'VP',
    'VP_ENG',
    'MANAGER',
    'SEM',
    'SR_SEM',
    'TECH_LEAD',
    'PM',
    'PROJECT_MANAGER',
    'DM',
    'DELIVERY_MANAGER',
    'EMPLOYEE',
  ];
  const adminCodes = new Set(['SUPER_ADMIN', 'ADMIN']);
  const upper = codes.map((c) => c.toUpperCase());
  const orgPool = upper.filter((c) => !adminCodes.has(c));
  const pool = orgPool.length > 0 ? orgPool : upper;
  for (const code of order) {
    if (pool.includes(code)) return code;
  }
  // Prefer admin only when that is the sole assignment
  if (pool.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (pool.includes('ADMIN')) return 'ADMIN';
  return pool[0] ?? 'EMPLOYEE';
}

function matchDesignationId(
  designations: { id: string; name: string; code?: string; departmentId?: string }[],
  hints: Array<string | undefined | null>,
): string {
  for (const hint of hints) {
    if (!hint?.trim()) continue;
    const h = hint.trim().toLowerCase();
    const exact = designations.find((d) => d.name.toLowerCase() === h);
    if (exact) return exact.id;
    const byCode = designations.find((d) => (d.code ?? '').toLowerCase() === h);
    if (byCode) return byCode.id;
    const fuzzy = designations.find(
      (d) => d.name.toLowerCase().includes(h) || h.includes(d.name.toLowerCase()),
    );
    if (fuzzy) return fuzzy.id;
  }
  return '';
}

function initialRoleCodes(account?: UserAccount): string[] {
  if (account?.roleCodes?.length) return [...account.roleCodes];
  if (account?.roleCode) return [account.roleCode];
  return ['MANAGER'];
}

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
  eligibleEmployees?: EligibleEmployeeOption[];
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
  eligibleEmployees = [],
  supervisors,
  loading,
  error,
  onCancel,
  onSubmit,
}: UserAccountFormProps) {
  const [personSource, setPersonSource] = useState<PersonSource>('management');
  const [managementId, setManagementId] = useState(initial?.managementId ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? '');
  const [designationId, setDesignationId] = useState(initial?.designationId ?? '');
  const [managerId, setManagerId] = useState(initial?.managerId ?? '');
  const [roleCodes, setRoleCodes] = useState<string[]>(() => initialRoleCodes(initial));
  const roleCode = useMemo(() => pickPrimaryRoleCode(roleCodes), [roleCodes]);
  const [orgWideVisibility, setOrgWideVisibility] = useState(
    initial?.orgWideVisibility ?? defaultOrgWideVisibility(pickPrimaryRoleCode(initialRoleCodes(initial))),
  );

  const toggleRole = (code: string) => {
    setRoleCodes((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

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

  const selectedEmployee = useMemo(
    () => eligibleEmployees.find((person) => person.id === employeeId),
    [eligibleEmployees, employeeId],
  );

  const autoManagerId = useMemo(
    () => resolveAutoManagerId(managementId, eligibleManagement),
    [managementId, eligibleManagement],
  );

  useEffect(() => {
    if (mode !== 'create') return;
    if (personSource === 'management' && managementId) {
      setManagerId(autoManagerId);
      const matched = matchDesignationId(designations, [selectedManagement?.roleTitle]);
      setDesignationId(matched);
      const des = designations.find((d) => d.id === matched);
      setDepartmentId(des?.departmentId ?? '');
    }
  }, [mode, personSource, managementId, autoManagerId, selectedManagement?.roleTitle, designations]);

  useEffect(() => {
    if (mode !== 'create' || personSource !== 'employee' || !selectedEmployee) return;
    if (selectedEmployee.email) setEmail(selectedEmployee.email);
    setDepartmentId(selectedEmployee.departmentId ?? '');
    setDesignationId(selectedEmployee.designationId ?? '');
    setManagerId(selectedEmployee.managerId ?? '');
  }, [mode, personSource, selectedEmployee]);

  // Edit: fill designation from linked management title when empty.
  useEffect(() => {
    if (mode !== 'edit' || designationId || designations.length === 0) return;
    const matched = matchDesignationId(designations, [
      initial?.designationName,
      initial?.managementRoleTitle,
    ]);
    if (!matched) return;
    setDesignationId(matched);
    if (!departmentId) {
      const des = designations.find((d) => d.id === matched);
      if (des?.departmentId) setDepartmentId(des.departmentId);
    }
  }, [mode, designations, designationId, departmentId, initial?.designationName, initial?.managementRoleTitle]);

  const needsNoManager = requiredSupervisorRank(roleCode) == null;
  const eligibleSupervisors = useMemo(() => {
    if (needsNoManager) return [];
    const list = supervisors.filter(
      (s) => s.id !== initial?.id && canSuperviseRole(s.roleCode, roleCode),
    );
    // Keep current manager visible even if not in the filtered supervisor list yet.
    if (managerId && !list.some((s) => s.id === managerId)) {
      const fromUsers = supervisors.find((s) => s.id === managerId);
      const label =
        fromUsers?.label ??
        initial?.managerName ??
        selectedEmployee?.managerName ??
        selectedManagement?.supervisorEmployeeName ??
        'Selected manager';
      list.unshift({
        id: managerId,
        label,
        roleCode: fromUsers?.roleCode ?? '',
      });
    }
    return list;
  }, [
    supervisors,
    initial?.id,
    initial?.managerName,
    roleCode,
    needsNoManager,
    managerId,
    selectedEmployee?.managerName,
    selectedManagement?.supervisorEmployeeName,
  ]);

  useEffect(() => {
    if (!supportsVisibilityToggle(roleCode)) {
      if (orgWideVisibility) setOrgWideVisibility(false);
      return;
    }
    if (!initial || pickPrimaryRoleCode(initialRoleCodes(initial)) !== roleCode) {
      setOrgWideVisibility(defaultOrgWideVisibility(roleCode));
    }
  }, [roleCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only clear manager when it is invalid for the org primary role — never wipe just because
  // an admin role was added alongside a normal org role.
  useEffect(() => {
    if (needsNoManager) return;
    if (!managerId) return;
    const selected = supervisors.find((s) => s.id === managerId);
    if (selected?.roleCode && !canSuperviseRole(selected.roleCode, roleCode)) {
      setManagerId('');
    }
  }, [roleCode, needsNoManager, managerId, supervisors]);

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

  const createDisabled =
    mode === 'create' &&
    (roleCodes.length === 0 ||
      (personSource === 'management'
        ? eligibleManagement.length === 0 || !managementId
        : eligibleEmployees.length === 0 || !employeeId));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (mode === 'create') {
      const payload: CreateUserAccountPayload = {
        email: email.trim().toLowerCase(),
        password: fd.get('password') as string,
        roleCodes: roleCodes.length ? roleCodes : ['MANAGER'],
        roleCode,
        departmentId: departmentId || undefined,
        designationId: designationId || undefined,
        managerId: needsNoManager ? undefined : managerId || undefined,
        orgWideVisibility: supportsVisibilityToggle(roleCode) ? orgWideVisibility : false,
      };
      if (personSource === 'management') {
        payload.managementId = managementId;
      } else {
        payload.employeeId = employeeId;
      }
      onSubmit(payload);
      return;
    }

    const payload: UpdateUserAccountPayload = {
      email: (fd.get('email') as string).trim().toLowerCase(),
      roleCodes: roleCodes.length ? roleCodes : undefined,
      roleCode,
      status: (fd.get('status') as string) || undefined,
      departmentId: departmentId || undefined,
      designationId: designationId || undefined,
      // Preserve existing manager when org-primary needs none (e.g. admin-only); omit field.
      ...(needsNoManager ? {} : { managerId: managerId || undefined }),
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
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm text-text2">Person source</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="personSource"
                  checked={personSource === 'management'}
                  onChange={() => {
                    setPersonSource('management');
                    setEmployeeId('');
                  }}
                />
                Management roster
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="personSource"
                  checked={personSource === 'employee'}
                  onChange={() => {
                    setPersonSource('employee');
                    setManagementId('');
                    setManagerId('');
                  }}
                />
                Employee roster
              </label>
            </div>
          </fieldset>

          {personSource === 'management' ? (
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
                  No eligible management people. Add them under Admin → Management first, or pick
                  Employee roster.
                </p>
              )}
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-text2">Employee</span>
              <select
                name="employeeId"
                required
                className={inputClass}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="" disabled>
                  Select from employee roster…
                </option>
                {eligibleEmployees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                    {person.designationName ? ` — ${person.designationName}` : ''}
                    {person.email ? ` (${person.email})` : ''}
                    {person.managementRoleTitle ? ` · mgmt: ${person.managementRoleTitle}` : ''}
                  </option>
                ))}
              </select>
              {eligibleEmployees.length === 0 && (
                <p className="mt-1 text-xs text-text2">
                  No eligible employees without a login. Add them under Admin → Employees first.
                </p>
              )}
            </label>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-border bg-bg3 px-3 py-2 text-sm">
          <div className="text-text2">Linked person</div>
          <div className="font-medium">
            {initial?.managementFullName ?? initial?.fullName ?? '—'}
          </div>
          {initial?.managementRoleTitle && (
            <div className="text-text2">{initial.managementRoleTitle}</div>
          )}
          {!initial?.managementId && (
            <p className="mt-1 text-xs text-text2">Not linked to management roster</p>
          )}
        </div>
      )}

      <label className="block text-sm">
        <span className="text-text2">Email (login)</span>
        {mode === 'create' ? (
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        ) : (
          <input
            name="email"
            type="email"
            required
            defaultValue={initial?.email}
            className={inputClass}
          />
        )}
      </label>

      <label className="block text-sm">
        <span className="text-text2">
          {mode === 'create' ? 'Password' : 'Password (leave blank to keep current)'}
        </span>
        <input
          name="password"
          type="password"
          required={mode === 'create'}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm text-text2">Application roles</legend>
        <p className="text-xs text-text2">
          Select one or more. Permissions are combined. Hierarchy / manager rules use{' '}
          <span className="font-medium text-text">{roleCode}</span>
          {roleCodes.some((c) => c === 'SUPER_ADMIN' || c === 'ADMIN') &&
          roleCode !== 'SUPER_ADMIN' &&
          roleCode !== 'ADMIN'
            ? ' (admin roles do not replace org reporting)'
            : ''}
          .
        </p>
        <div className="max-h-48 space-y-1.5 overflow-auto rounded-lg border border-border bg-bg3 p-3">
          {roleOptions.map((r) => {
            const checked = roleCodes.includes(r.code);
            return (
              <label key={r.code} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRole(r.code)}
                  className="rounded border-border"
                />
                <span>
                  {r.name}
                  <span className="ml-1 text-xs text-text2">({r.code})</span>
                </span>
              </label>
            );
          })}
          {roleOptions.length === 0 && (
            <p className="text-sm text-text2">Loading roles…</p>
          )}
        </div>
        {roleCodes.length === 0 && (
          <p className="text-xs text-danger">Select at least one role.</p>
        )}
      </fieldset>

      {supportsVisibilityToggle(roleCode) && (
        <div className="rounded-lg border border-border px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Team visibility</p>
              <p className="mt-0.5 text-xs text-text2">
                {orgWideVisibility
                  ? 'Sees org-wide projects and team data.'
                  : 'Sees own team only.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={orgWideVisibility}
              onClick={() => setOrgWideVisibility((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                orgWideVisibility ? 'bg-accent' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition ${
                  orgWideVisibility ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs">
            <span className={!orgWideVisibility ? 'font-medium text-accent' : 'text-text2'}>
              Own team
            </span>
            {' / '}
            <span className={orgWideVisibility ? 'font-medium text-accent' : 'text-text2'}>
              Org-wide
            </span>
          </p>
        </div>
      )}

      {mode === 'edit' && (
        <label className="block text-sm">
          <span className="text-text2">Status</span>
          <select name="status" defaultValue={initial?.status ?? 'ACTIVE'} className={inputClass}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        <span className="text-text2">Department</span>
        <select
          name="departmentId"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className={inputClass}
        >
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-text2">Designation</span>
        <select
          name="designationId"
          value={designationId}
          onChange={(e) => setDesignationId(e.target.value)}
          className={inputClass}
        >
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
              : autoManagerId && personSource === 'management'
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
          disabled={loading || createDisabled || roleCodes.length === 0}
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
