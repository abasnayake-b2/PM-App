import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Pencil, Plus, Search, Shield, Trash2, Unlock } from 'lucide-react';
import { UserAccountForm } from '@/components/UserAccountForm';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import {
  useCreateUserAccount,
  useDeleteUserAccount,
  useEligibleEmployees,
  useEligibleManagement,
  useUnlockUserAccount,
  useUpdateUserAccount,
  useUserAccounts,
} from '@/hooks/useUserManagement';
import type { UserAccount } from '@/api/userManagement.api';
import type { CreateUserAccountPayload, UpdateUserAccountPayload } from '@/api/userManagement.api';
import { isAdminRole, isDeliveryManagerRole } from '@/utils/orgRoles';

function isCxoRole(role?: string | null): boolean {
  return role === 'CXO' || role === 'CTO';
}

function isVpRole(role?: string | null): boolean {
  return role === 'VP' || role === 'VP_ENG';
}

function isManagerGridRole(role?: string | null): boolean {
  return (
    role === 'MANAGER' ||
    role === 'SEM' ||
    role === 'SR_SEM' ||
    role === 'TECH_LEAD' ||
    isDeliveryManagerRole(role)
  );
}

export function UserManagementPage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<UserAccount | null>(null);

  const { data: users, isLoading, error } = useUserAccounts(search);
  const { data: eligibleManagement = [] } = useEligibleManagement('', dialog === 'create');
  const { data: eligibleEmployees = [] } = useEligibleEmployees('', dialog === 'create');
  const createUser = useCreateUserAccount();
  const updateUser = useUpdateUserAccount(editing?.id ?? '');
  const deleteUser = useDeleteUserAccount();
  const unlockUser = useUnlockUserAccount();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const supervisors = useMemo(
    () =>
      (users ?? [])
        .filter((u) => u.status === 'ACTIVE')
        .map((u) => ({ id: u.id, label: `${u.fullName} (${u.roleCode})`, roleCode: u.roleCode })),
    [users],
  );

  const { adminUsers, cxoUsers, vpUsers, managerUsers, employeeUsers } = useMemo(() => {
    const list = users ?? [];
    const codesOf = (u: (typeof list)[number]) =>
      (u.roleCodes?.length ? u.roleCodes : [u.roleCode]).map((c) => c.toUpperCase());
    const has = (u: (typeof list)[number], pred: (c: string) => boolean) => codesOf(u).some(pred);

    const adminUsers = list.filter((u) => has(u, isAdminRole));
    const remaining = list.filter((u) => !has(u, isAdminRole));
    const cxoUsers = remaining.filter((u) => has(u, isCxoRole));
    const afterCxo = remaining.filter((u) => !has(u, isCxoRole));
    const vpUsers = afterCxo.filter((u) => has(u, isVpRole));
    const afterVp = afterCxo.filter((u) => !has(u, isVpRole));
    const managerUsers = afterVp.filter(
      (u) =>
        has(u, isManagerGridRole) ||
        (!!u.managementId &&
          !has(u, isAdminRole) &&
          !has(u, isCxoRole) &&
          !has(u, isVpRole) &&
          !has(u, isManagerGridRole)),
    );
    const placed = new Set(
      [...adminUsers, ...cxoUsers, ...vpUsers, ...managerUsers].map((u) => u.id),
    );
    const employeeUsers = list.filter((u) => !placed.has(u.id));
    return { adminUsers, cxoUsers, vpUsers, managerUsers, employeeUsers };
  }, [users]);

  if (!can(P.USERS_VIEW)) {
    return <Navigate to="/" replace />;
  }

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
  };

  const openEdit = (user: UserAccount) => {
    setEditing(user);
    setDialog('edit');
  };

  const handleDeactivate = (user: UserAccount) => {
    if (
      window.confirm(
        `Deactivate login for ${user.fullName}? They will no longer be able to sign in.`,
      )
    ) {
      deleteUser.mutate(user.id);
    }
  };

  const handleUnlock = (user: UserAccount) => {
    const detail = user.accountLocked
      ? 'This will clear the lock and reset failed login attempts to 0.'
      : `Reset failed login attempts (${user.failedLoginAttempts}) to 0?`;
    if (window.confirm(`Unlock ${user.fullName}? ${detail}`)) {
      unlockUser.mutate(user.id);
    }
  };

  const formatLockedUntil = (lockedUntil?: string | null) => {
    if (!lockedUntil) return null;
    const date = new Date(lockedUntil);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="text-accent" size={28} />
          <div>
            <h1 className="text-2xl font-bold">User management</h1>
            <p className="text-text2">
              Create logins from the{' '}
              <Link to="/team/management" className="text-accent hover:underline">
                management roster
              </Link>{' '}
              or the{' '}
              <Link to="/team/employees" className="text-accent hover:underline">
                employee roster
              </Link>
              . You can also move an employee onto management under Employees.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDialog('create')}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium"
          style={{ color: 'var(--accent-fg)' }}
        >
          <Plus size={16} />
          New user
        </button>
      </div>

      <div className="flex flex-1 items-end gap-3 min-w-[12rem] max-w-md">
        <label className="flex-1 text-sm">
          <span className="text-text2">Search</span>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text2" size={16} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, email, role…"
              className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </label>
      </div>

      {isLoading && <p className="text-text2">Loading users…</p>}
      {error && <p className="text-danger">Failed to load user accounts.</p>}

      {!isLoading && !error && (
        <div className="space-y-8">
          <UserAccountGrid
            title="Admin"
            description="System admin and super admin accounts."
            users={adminUsers}
            emptyMessage={
              search ? `No admin accounts matching "${search}".` : 'No admin accounts yet.'
            }
            showManagementRole
            search={search}
            unlockPending={unlockUser.isPending}
            formatLockedUntil={formatLockedUntil}
            onEdit={openEdit}
            onUnlock={handleUnlock}
            onDeactivate={handleDeactivate}
          />
          <UserAccountGrid
            title="CXO"
            description="CXO and CTO accounts."
            users={cxoUsers}
            emptyMessage={
              search ? `No CXO accounts matching "${search}".` : 'No CXO accounts yet.'
            }
            showManagementRole
            search={search}
            unlockPending={unlockUser.isPending}
            formatLockedUntil={formatLockedUntil}
            onEdit={openEdit}
            onUnlock={handleUnlock}
            onDeactivate={handleDeactivate}
          />
          <UserAccountGrid
            title="VP"
            description="VP accounts."
            users={vpUsers}
            emptyMessage={
              search ? `No VP accounts matching "${search}".` : 'No VP accounts yet.'
            }
            showManagementRole
            search={search}
            unlockPending={unlockUser.isPending}
            formatLockedUntil={formatLockedUntil}
            onEdit={openEdit}
            onUnlock={handleUnlock}
            onDeactivate={handleDeactivate}
          />
          <UserAccountGrid
            title="Managers"
            description="Managers, SEM / Sr SEM, tech leads, and other management-roster roles."
            users={managerUsers}
            emptyMessage={
              search
                ? `No manager accounts matching "${search}".`
                : 'No manager accounts yet. Add people on the management roster, then create a login here.'
            }
            showManagementRole
            search={search}
            unlockPending={unlockUser.isPending}
            formatLockedUntil={formatLockedUntil}
            onEdit={openEdit}
            onUnlock={handleUnlock}
            onDeactivate={handleDeactivate}
          />
          <UserAccountGrid
            title="Employee"
            description="Logins linked to the employee roster (not on management)."
            users={employeeUsers}
            emptyMessage={
              search
                ? `No employee accounts matching "${search}".`
                : 'No employee logins yet. Pick someone from the employee roster when creating a user.'
            }
            showManagementRole={false}
            search={search}
            unlockPending={unlockUser.isPending}
            formatLockedUntil={formatLockedUntil}
            onEdit={openEdit}
            onUnlock={handleUnlock}
            onDeactivate={handleDeactivate}
          />
        </div>
      )}

      {dialog && (
        <SlideOverPanel
          title={dialog === 'create' ? 'Create user account' : `Edit ${editing?.fullName ?? ''}`}
          subtitle={dialog === 'edit' ? 'User account' : undefined}
          onClose={closeDialog}
          wide
        >
          <UserAccountForm
            key={editing?.id ?? 'create'}
            mode={dialog}
            initial={editing ?? undefined}
            eligibleManagement={eligibleManagement}
            eligibleEmployees={eligibleEmployees}
            supervisors={supervisors}
            loading={createUser.isPending || updateUser.isPending}
            error={dialog === 'create' ? createUser.error : updateUser.error}
            onCancel={closeDialog}
            onSubmit={(payload) => {
              if (dialog === 'create') {
                createUser.reset();
                createUser.mutate(payload as CreateUserAccountPayload, {
                  onSuccess: closeDialog,
                });
              } else if (editing) {
                updateUser.reset();
                updateUser.mutate(payload as UpdateUserAccountPayload, {
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

function UserAccountGrid({
  title,
  description,
  users,
  emptyMessage,
  showManagementRole,
  search,
  unlockPending,
  formatLockedUntil,
  onEdit,
  onUnlock,
  onDeactivate,
}: {
  title: string;
  description: string;
  users: UserAccount[];
  emptyMessage: string;
  showManagementRole: boolean;
  search: string;
  unlockPending: boolean;
  formatLockedUntil: (lockedUntil?: string | null) => string | null;
  onEdit: (user: UserAccount) => void;
  onUnlock: (user: UserAccount) => void;
  onDeactivate: (user: UserAccount) => void;
}) {
  const cellClass = 'whitespace-nowrap px-4 py-2';
  const colCount = showManagementRole ? 9 : 8;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
      </div>
      <div className="rounded-xl border border-border">
        <div className="max-h-[min(50vh,520px)] overflow-auto">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
              <tr className="whitespace-nowrap">
                <th className="w-12 px-3 py-2 text-center">#</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                {showManagementRole && <th className="px-4 py-2">Management role</th>}
                <th className="px-4 py-2">App role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Login</th>
                <th className="px-4 py-2">Lock status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id} className="border-t border-border hover:bg-bg2/50">
                  <td className={`${cellClass} text-center text-xs tabular-nums text-text2`}>
                    {index + 1}
                  </td>
                  <td className={cellClass}>
                    <div className="font-medium">{user.fullName}</div>
                  </td>
                  <td className={`${cellClass} text-text2`}>{user.email}</td>
                  {showManagementRole && (
                    <td className={`${cellClass} text-text2`}>
                      {user.managementRoleTitle ?? '—'}
                    </td>
                  )}
                  <td className={cellClass}>
                    {(user.roleCodes?.length ? user.roleCodes : [user.roleCode]).join(', ')}
                  </td>
                  <td className={cellClass}>
                    <span className={user.status === 'ACTIVE' ? 'text-text' : 'text-danger'}>
                      {user.status}
                    </span>
                  </td>
                  <td className={cellClass}>
                    <span className={user.authActive ? 'text-text' : 'text-danger'}>
                      {user.authActive ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className={cellClass}>
                    {user.accountLocked ? (
                      <div>
                        <span className="font-medium text-danger">Locked</span>
                        {formatLockedUntil(user.lockedUntil) && (
                          <div className="text-xs text-text2">
                            until {formatLockedUntil(user.lockedUntil)}
                          </div>
                        )}
                        {user.failedLoginAttempts > 0 && (
                          <div className="text-xs text-text2">
                            {user.failedLoginAttempts} failed attempt
                            {user.failedLoginAttempts !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ) : user.failedLoginAttempts > 0 ? (
                      <span className="text-warning">
                        {user.failedLoginAttempts} failed attempt
                        {user.failedLoginAttempts !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-text2">OK</span>
                    )}
                  </td>
                  <td className={cellClass}>
                    <div className="flex gap-2">
                      {(user.accountLocked || user.failedLoginAttempts > 0) && user.authActive && (
                        <button
                          type="button"
                          onClick={() => onUnlock(user)}
                          disabled={unlockPending}
                          className="rounded p-1 text-accent hover:bg-bg3"
                          title="Unlock account and reset failed attempts"
                        >
                          <Unlock size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        className="rounded p-1 text-text2 hover:bg-bg3"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {user.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => onDeactivate(user)}
                          className="rounded p-1 text-danger hover:bg-danger/10"
                          title="Deactivate"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8 text-center text-text2">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-xs text-text2">
          {users.length} {title.toLowerCase()} account{users.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      </div>
    </section>
  );
}
