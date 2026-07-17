import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { TeamMemberForm } from '@/components/TeamMemberForm';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import {
  useCreateEmployee,
  useDeleteEmployee,
  useDesignations,
  useEmployees,
  useTeamSearch,
  useUpdateEmployee,
} from '@/hooks/useEmployees';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { Employee } from '@/types';
import type { CreateEmployeePayload, UpdateEmployeePayload } from '@/hooks/useEmployees';

function EmployeeRow({
  emp,
  canManageTeam,
  onEdit,
  onDeactivate,
}: {
  emp: Employee;
  canManageTeam: boolean;
  onEdit: (emp: Employee) => void;
  onDeactivate: (emp: Employee) => void;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium">
        <Link to={`/resources/${emp.id}`} className="hover:text-accent">
          {emp.fullName}
        </Link>
      </td>
      <td className="px-4 py-3 text-text2">{emp.email}</td>
      <td className="px-4 py-3">{emp.designationName ?? '—'}</td>
      <td className="px-4 py-3">{emp.managerName ?? '—'}</td>
      <td className="px-4 py-3">{emp.roleCode}</td>
      <td className="px-4 py-3">
        <span className={emp.status === 'ACTIVE' ? 'text-text' : 'text-danger'}>{emp.status}</span>
      </td>
      {canManageTeam && (
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(emp)}
              className="rounded p-1 text-text2 hover:bg-bg3 hover:text-text"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            {emp.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => onDeactivate(emp)}
                className="rounded p-1 text-danger hover:bg-danger/10"
                title="Deactivate"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

export function TeamPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { can } = usePermissions();
  const canManageTeam = can(P.TEAM_CREATE);
  const isManagerOrAbove = can(P.TEAM_VIEW);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);

  const { data: teamResult, isLoading, error } = useTeamSearch(search, 'EMPLOYEE', isManagerOrAbove);
  const { data: allEmployees } = useEmployees(isManagerOrAbove && canManageTeam);
  const { data: designations } = useDesignations(isManagerOrAbove);
  const createEmployee = useCreateEmployee({ navigateOnSuccess: false });
  const updateEmployee = useUpdateEmployee(editing?.id ?? '');
  const deleteEmployee = useDeleteEmployee();

  const employees = teamResult?.employees ?? [];

  const supervisors = useMemo(
    () =>
      (allEmployees ?? [])
        .filter((e) => e.status === 'ACTIVE')
        .map((e) => ({ id: e.id, label: e.fullName })),
    [allEmployees],
  );

  if (!isManagerOrAbove) {
    return <Navigate to="/" replace />;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
  };

  const handleEdit = (emp: Employee) => {
    setEditing(emp);
    setDialog('edit');
  };

  const handleDeactivate = (emp: Employee) => {
    if (window.confirm(`Deactivate ${emp.fullName}?`)) {
      deleteEmployee.mutate(emp.id);
    }
  };

  const colSpan = canManageTeam ? 7 : 6;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="text-accent" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Team</h1>
            <p className="text-text2">Manage employees — the master list for all team members</p>
          </div>
        </div>
        {canManageTeam && (
          <button
            type="button"
            onClick={() => setDialog('create')}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Plus size={16} />
            Add employee
          </button>
        )}
      </div>

      <form onSubmit={handleSearch} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm min-w-[12rem]">
          <span className="text-text2">Search</span>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text2" size={16} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name…"
              className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSearchInput('');
            }}
            className="text-sm text-text2 hover:text-text"
          >
            Clear
          </button>
        )}
      </form>

      {isLoading && <p className="mt-6 text-text2">Loading team…</p>}
      {error && <p className="mt-6 text-danger">Failed to load employees.</p>}

      {!isLoading && !error && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg2 text-text2">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Supervisor</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManageTeam && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <EmployeeRow
                  key={emp.id}
                  emp={emp}
                  canManageTeam={canManageTeam}
                  onEdit={handleEdit}
                  onDeactivate={handleDeactivate}
                />
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-text2">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dialog && canManageTeam && (
        <SlideOverPanel
          title={dialog === 'create' ? 'Add employee' : `Edit ${editing?.fullName ?? ''}`}
          subtitle={dialog === 'edit' ? 'Directory' : undefined}
          onClose={closeDialog}
          wide
        >
          <TeamMemberForm
            mode={dialog}
            initial={editing ?? undefined}
            designations={designations ?? []}
            supervisors={supervisors}
            loading={createEmployee.isPending || updateEmployee.isPending}
            onCancel={closeDialog}
            onSubmit={(payload) => {
              if (dialog === 'create') {
                createEmployee.mutate(payload as CreateEmployeePayload, {
                  onSuccess: closeDialog,
                });
              } else if (editing) {
                updateEmployee.mutate(payload as UpdateEmployeePayload, {
                  onSuccess: closeDialog,
                });
              }
            }}
          />
        </SlideOverPanel>
      )}
    </div>
  );
}
