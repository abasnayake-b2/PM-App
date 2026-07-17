import { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Employee } from '@/types';
import type { CreateEmployeePayload, UpdateEmployeePayload } from '@/hooks/useEmployees';
import type { Designation } from '@/api/users.api';
import { fetchAssignableRoles } from '@/api/users.api';

export interface SupervisorOption {
  id: string;
  label: string;
  roleCode?: string;
}

interface TeamMemberFormProps {
  mode: 'create' | 'edit';
  designations: Designation[];
  supervisors: SupervisorOption[];
  initial?: Employee;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateEmployeePayload | UpdateEmployeePayload) => void;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const;

export function TeamMemberForm({
  mode,
  designations,
  supervisors,
  initial,
  loading,
  onCancel,
  onSubmit,
}: TeamMemberFormProps) {
  const { data: roleOptions = [] } = useQuery({
    queryKey: ['assignable-roles'],
    queryFn: fetchAssignableRoles,
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const firstName = (fd.get('firstName') as string).trim();
    const lastName = (fd.get('lastName') as string).trim();
    const designationId = (fd.get('designationId') as string) || undefined;
    const managerId = (fd.get('managerId') as string) || undefined;

    if (mode === 'create') {
      const payload: CreateEmployeePayload = {
        email: (fd.get('email') as string).trim().toLowerCase(),
        firstName,
        lastName,
        password: fd.get('password') as string,
        roleCode: (fd.get('roleCode') as string) || 'MANAGER',
        designationId,
        managerId,
      };
      onSubmit(payload);
      return;
    }

    const payload: UpdateEmployeePayload = {
      firstName,
      lastName,
      designationId,
      managerId,
      roleCode: (fd.get('roleCode') as string) || undefined,
      status: (fd.get('status') as string) || undefined,
    };
    const password = (fd.get('password') as string).trim();
    if (password) payload.password = password;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">First name</span>
          <input
            name="firstName"
            type="text"
            required
            defaultValue={initial?.firstName}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Last name</span>
          <input
            name="lastName"
            type="text"
            required
            defaultValue={initial?.lastName}
            className={inputClass}
          />
        </label>
      </div>

      {mode === 'create' && (
        <label className="block text-sm">
          <span className="text-text2">Email</span>
          <input name="email" type="email" required className={inputClass} />
        </label>
      )}

      <label className="block text-sm">
        <span className="text-text2">Designation</span>
        <select name="designationId" className={inputClass} defaultValue={initial?.designationId ?? ''}>
          <option value="">None</option>
          {designations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-text2">Supervisor</span>
        <select name="managerId" className={inputClass} defaultValue={initial?.managerId ?? ''}>
          <option value="">None</option>
          {supervisors
            .filter((s) => s.id !== initial?.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Role</span>
          <select
            name="roleCode"
            defaultValue={initial?.roleCode ?? roleOptions.find((r) => r.code === 'MANAGER')?.code ?? roleOptions[0]?.code ?? 'MANAGER'}
            className={inputClass}
          >
            {roleOptions.map((r) => (
              <option key={r.id} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
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
      </div>

      <label className="block text-sm">
        <span className="text-text2">{mode === 'create' ? 'Password' : 'New password (optional)'}</span>
        <input
          name="password"
          type="password"
          required={mode === 'create'}
          minLength={mode === 'create' ? 8 : undefined}
          className={inputClass}
          placeholder={mode === 'edit' ? 'Leave blank to keep current password' : undefined}
        />
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Add employee' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
