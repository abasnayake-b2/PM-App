import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AllocationBar } from '@/components/AllocationBar';
import { useEmployee } from '@/hooks/useEmployees';
import { useAllocations } from '@/hooks/useResources';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/useAuthStore';
import { P } from '@/utils/permissions';
import { isManagerOrAboveRole } from '@/utils/orgRoles';
import { partitionAllocations, sumAllocationPercent } from '@/utils/allocationUi';
import type { Allocation } from '@/types';

function AllocationListItem({ allocation }: { allocation: Allocation }) {
  return (
    <li>
      <div className="flex justify-between gap-3 text-sm">
        <Link to={`/issues/${allocation.issueId}`} className="font-medium hover:text-accent">
          {allocation.issueTitle}
        </Link>
        <span>{allocation.percentage}%</span>
      </div>
      <p className="text-xs text-text2">
        <Link to={`/projects/${allocation.projectId}`} className="hover:text-accent">
          {allocation.projectName}
        </Link>
      </p>
      <p className="text-xs text-text2">{allocation.roleOnProject ?? 'Team member'}</p>
      <p className="text-xs text-text2">
        {allocation.fromDate}
        {allocation.toDate ? ` → ${allocation.toDate}` : ' → ongoing'}
      </p>
      <div className="mt-2">
        <AllocationBar percentage={allocation.percentage} showLabel={false} />
      </div>
    </li>
  );
}

export function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const { can } = usePermissions();
  const showTeamView = can(P.ALLOCATIONS_VIEW) && isManagerOrAboveRole(role);
  const canDeleteAllocation = can(P.ALLOCATIONS_DELETE);

  const { data: employee, isLoading, error } = useEmployee(id);
  const { data: allocations } = useAllocations(
    { employeeId: id },
    { enabled: !!id && showTeamView },
  );
  const { active, upcoming } = useMemo(
    () => partitionAllocations(allocations ?? []),
    [allocations],
  );
  const activeTotal = useMemo(() => sumAllocationPercent(active), [active]);

  if (id === 'new') {
    return <Navigate to="/team" replace />;
  }

  if (!showTeamView) {
    return <Navigate to="/resources" replace />;
  }

  if (isLoading) {
    return <p className="text-text2">Loading resource…</p>;
  }

  if (error || !employee) {
    return (
      <div>
        <Link to="/resources" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft size={16} />
          Back to resource utilization
        </Link>
        <p className="mt-4 text-danger">Resource not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/resources" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
        <ArrowLeft size={16} />
        Back to resource utilization
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{employee.fullName}</h1>
          <p className="mt-1 text-text2">{employee.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-border bg-bg2 px-3 py-1 text-sm">
            {employee.roleCode}
          </span>
          <span
            className={`rounded-lg border px-3 py-1 text-sm ${
              employee.status === 'ACTIVE' ? 'border-border bg-bg2' : 'border-danger/40 text-danger'
            }`}
          >
            {employee.status}
          </span>
          {canDeleteAllocation && (
            <Link
              to="/team"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bg3"
            >
              Edit in Team
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="font-semibold">Profile</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text2">Department</dt>
                <dd>{employee.departmentName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">Designation</dt>
                <dd>{employee.designationName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">Manager</dt>
                <dd>{employee.managerName ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">Issue allocations</h2>
              {active.length > 0 && (
                <span className="text-sm font-semibold tabular-nums">{activeTotal}% active today</span>
              )}
            </div>

            {!allocations?.length ? (
              <p className="mt-4 text-sm text-text2">No issue allocations.</p>
            ) : (
              <div className="mt-4 space-y-6">
                {active.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-text2">Active now</h3>
                    <ul className="mt-3 space-y-4">
                      {active.map((a) => (
                        <AllocationListItem key={a.id} allocation={a} />
                      ))}
                    </ul>
                  </div>
                )}

                {upcoming.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-text2">Upcoming</h3>
                    <ul className="mt-3 space-y-4">
                      {upcoming.map((a) => (
                        <AllocationListItem key={a.id} allocation={a} />
                      ))}
                    </ul>
                  </div>
                )}

                {active.length === 0 && upcoming.length === 0 && (
                  <p className="text-sm text-text2">No current or upcoming allocations.</p>
                )}
              </div>
            )}
          </section>
        </div>
    </div>
  );
}
