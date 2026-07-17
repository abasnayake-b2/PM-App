import { FormEvent, useRef } from 'react';
import type { Employee } from '@/types';
import type { CreateEmployeePayload, UpdateEmployeePayload } from '@/hooks/useEmployees';
import type { Department, Designation } from '@/api/users.api';

export interface ResourceFormOption {
  id: string;
  label: string;
}

interface ResourceFormProps {
  mode: 'create' | 'edit';
  departments: Department[];
  designations: Designation[];
  managers: ResourceFormOption[];
  initial?: Employee;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateEmployeePayload | UpdateEmployeePayload) => void;
  onRoleChange?: (roleCode: string) => void;
  roleLoading?: boolean;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const ROLE_OPTIONS = ['EMPLOYEE', 'MANAGER', 'ADMIN'];

export function ResourceForm({
  mode,
  departments,
  designations,
  managers,
  initial,
  loading,
  onCancel,
  onSubmit,
  onRoleChange,
  roleLoading,
}: ResourceFormProps) {
  const roleRef = useRef(initial?.roleCode ?? 'EMPLOYEE');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (mode === 'create') {
      const payload: CreateEmployeePayload = {
        email: (fd.get('email') as string).trim().toLowerCase(),
        firstName: (fd.get('firstName') as string).trim(),
        lastName: (fd.get('lastName') as string).trim(),
        password: fd.get('password') as string,
        roleCode: fd.get('roleCode') as string,
      };
      const dept = fd.get('departmentId') as string;
      const desig = fd.get('designationId') as string;
      const mgr = fd.get('managerId') as string;
      if (dept) payload.departmentId = dept;
      if (desig) payload.designationId = desig;
      if (mgr) payload.managerId = mgr;
      onSubmit(payload);
      return;
    }

    const payload: UpdateEmployeePayload = {
      firstName: (fd.get('firstName') as string).trim(),
      lastName: (fd.get('lastName') as string).trim(),
      status: (fd.get('status') as string) || undefined,
    };
    const dept = fd.get('departmentId') as string;
    const desig = fd.get('designationId') as string;
    const mgr = fd.get('managerId') as string;
    if (dept) payload.departmentId = dept;
    if (desig) payload.designationId = desig;
    if (mgr) payload.managerId = mgr;
    onSubmit(payload);
  };

  const handleRoleChange = (e: FormEvent<HTMLSelectElement>) => {
    if (mode === 'edit' && onRoleChange) {
      const next = e.currentTarget.value;
      if (next !== roleRef.current) {
        roleRef.current = next;
        onRoleChange(next);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {mode === 'create' && (
        <label className="block text-sm">
          <span className="text-text2">Email</span>
          <input name="email" type="email" required className={inputClass} />
        </label>
      )}

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
          <span className="text-text2">Initial password</span>
          <input name="password" type="password" required minLength={8} className={inputClass} />
        </label>
      )}

      <label className="block text-sm">
        <span className="text-text2">Role</span>
        <select
          name="roleCode"
          required
          defaultValue={initial?.roleCode ?? 'EMPLOYEE'}
          disabled={mode === 'edit' && roleLoading}
          onChange={mode === 'edit' ? handleRoleChange : undefined}
          className={inputClass}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {mode === 'edit' && (
          <span className="mt-0.5 block text-xs text-text2">Role changes save immediately on selection.</span>
        )}
      </label>

      {mode === 'edit' && (
        <label className="block text-sm">
          <span className="text-text2">Status</span>
          <select name="status" className={inputClass} defaultValue={initial?.status ?? 'ACTIVE'}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
      )}

      <label className="block text-sm">
        <span className="text-text2">Department</span>
        <select name="departmentId" className={inputClass} defaultValue={initial?.departmentId ?? ''}>
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
        <span className="text-text2">Manager</span>
        <select name="managerId" className={inputClass} defaultValue={initial?.managerId ?? ''}>
          <option value="">None</option>
          {managers
            .filter((m) => m.id !== initial?.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
        </select>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Create resource' : 'Save changes'}
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
