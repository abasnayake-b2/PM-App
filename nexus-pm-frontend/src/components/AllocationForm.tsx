import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllocations, type OverAllocationError } from '@/api/resources.api';
import { fetchEngineeringManagers } from '@/api/teamRoster.api';
import type { CreateAllocationPayload, UpdateAllocationPayload } from '@/hooks/useResources';
import type { Allocation } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { hasOrgWideVisibility } from '@/utils/orgRoles';
import { todayLocalIso } from '@/utils/allocationUi';
import { isAxiosError } from 'axios';

export interface AllocationFormOption {
  id: string;
  label: string;
  designationName?: string;
  teamName?: string;
  engineeringManagerName?: string;
}

interface AllocationFormProps {
  employees: AllocationFormOption[];
  issues?: AllocationFormOption[];
  defaultIssueId?: string;
  defaultEmployeeId?: string;
  editingAllocation?: Allocation;
  title?: string;
  loading?: boolean;
  enableEngineeringManagerFilter?: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateAllocationPayload) => void;
  onUpdate?: (allocationId: string, payload: UpdateAllocationPayload) => void;
  submitError?: unknown;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

function parseOverAllocationError(error: unknown): OverAllocationError | null {
  if (!isAxiosError(error) || error.response?.status !== 400) return null;
  const data = error.response.data as Record<string, unknown>;
  if (data?.title !== 'OVER_ALLOCATION') return null;
  return data as unknown as OverAllocationError;
}

function todayIso(): string {
  return todayLocalIso();
}

function defaultPercentage(available: number): number {
  if (available <= 0) return 0;
  return Math.min(50, available);
}

function matchesEngineeringManager(employee: AllocationFormOption, filter: string): boolean {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) return true;
  const em = (employee.engineeringManagerName ?? '').toLowerCase();
  if (em.includes(normalized)) return true;
  return employee.label.trim().toLowerCase() === normalized;
}

export function AllocationForm({
  employees,
  issues,
  defaultIssueId,
  defaultEmployeeId,
  editingAllocation,
  title,
  loading,
  enableEngineeringManagerFilter = true,
  onCancel,
  onSubmit,
  onUpdate,
  submitError,
}: AllocationFormProps) {
  const role = useAuthStore((s) => s.user?.role);
  const orgWideVisibility = useAuthStore((s) => s.user?.orgWideVisibility);
  const userName = useAuthStore((s) => s.user?.name);
  const isScopedManager = !hasOrgWideVisibility(role, orgWideVisibility);

  const isEdit = !!editingAllocation;
  const showEngineeringManagerFilter = enableEngineeringManagerFilter && !isEdit;

  const [dismissedError, setDismissedError] = useState(false);
  const [engineeringManager, setEngineeringManager] = useState('');
  const [issueId, setIssueId] = useState(editingAllocation?.issueId ?? defaultIssueId ?? '');
  const [employeeId, setEmployeeId] = useState(editingAllocation?.employeeId ?? defaultEmployeeId ?? '');
  const [fromDate, setFromDate] = useState(editingAllocation?.fromDate ?? todayIso());
  const [toDate, setToDate] = useState(editingAllocation?.toDate ?? '');
  const [percentage, setPercentage] = useState(editingAllocation?.percentage ?? 50);
  const [roleOnProject, setRoleOnProject] = useState(editingAllocation?.roleOnProject ?? '');
  const [billable, setBillable] = useState(editingAllocation?.billable ?? true);

  const formTitle = title ?? (isEdit ? 'Edit allocation' : 'Allocate resource');
  const excludeAllocationId = editingAllocation?.id;

  const { data: engineeringManagers = [] } = useQuery({
    queryKey: ['engineering-managers'],
    queryFn: fetchEngineeringManagers,
    enabled: showEngineeringManagerFilter,
  });

  const filteredEmployees = useMemo(() => {
    if (!showEngineeringManagerFilter || !engineeringManager) return employees;
    return employees.filter((employee) => matchesEngineeringManager(employee, engineeringManager));
  }, [employees, engineeringManager, showEngineeringManagerFilter]);

  const overAllocation = submitError && !dismissedError ? parseOverAllocationError(submitError) : null;

  const { data: overlapping, isLoading: overlapLoading } = useQuery({
    queryKey: ['allocations', 'overlap', employeeId, fromDate, toDate || 'ongoing', excludeAllocationId ?? ''],
    queryFn: () =>
      fetchAllocations({
        employeeId,
        from: fromDate,
        to: toDate || undefined,
      }),
    enabled: !!employeeId && !!fromDate,
  });

  const existingTotal = useMemo(() => {
    const list = overlapping ?? [];
    const filtered = excludeAllocationId
      ? list.filter((allocation) => allocation.id !== excludeAllocationId)
      : list;
    return filtered.reduce((sum, allocation) => sum + allocation.percentage, 0);
  }, [overlapping, excludeAllocationId]);
  const available = Math.max(0, 100 - existingTotal);

  useEffect(() => {
    if (editingAllocation) {
      setIssueId(editingAllocation.issueId);
      setEmployeeId(editingAllocation.employeeId);
      setFromDate(editingAllocation.fromDate);
      setToDate(editingAllocation.toDate ?? '');
      setPercentage(editingAllocation.percentage);
      setBillable(editingAllocation.billable);
    }
  }, [editingAllocation]);

  useEffect(() => {
    if (isEdit) return;
    setIssueId(defaultIssueId ?? '');
  }, [defaultIssueId, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    setEmployeeId(defaultEmployeeId ?? '');
  }, [defaultEmployeeId, isEdit]);

  useEffect(() => {
    if (!showEngineeringManagerFilter || !isScopedManager || !userName) return;
    setEngineeringManager(userName);
  }, [showEngineeringManagerFilter, isScopedManager, userName]);

  useEffect(() => {
    if (!showEngineeringManagerFilter || !engineeringManager) return;
    if (!employeeId) return;
    const stillVisible = filteredEmployees.some((employee) => employee.id === employeeId);
    if (!stillVisible) setEmployeeId('');
  }, [engineeringManager, filteredEmployees, employeeId, showEngineeringManagerFilter]);

  useEffect(() => {
    if (!employeeId) {
      if (!isEdit) setRoleOnProject('');
      return;
    }
    const employee = employees.find((e) => e.id === employeeId);
    if (employee?.designationName) {
      setRoleOnProject(employee.designationName);
    }
  }, [employeeId, employees, isEdit]);

  useEffect(() => {
    if (!employeeId || overlapLoading || isEdit) return;
    setPercentage((current) => {
      if (available <= 0) return 0;
      if (current > available) return available;
      if (current < 1) return defaultPercentage(available);
      return current;
    });
  }, [employeeId, fromDate, toDate, available, overlapLoading, isEdit]);

  const resolvedIssueId = issueId || defaultIssueId || '';
  const datesInvalid = !!fromDate && !!toDate && fromDate > toDate;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !resolvedIssueId ||
      !employeeId ||
      !toDate ||
      datesInvalid ||
      percentage < 1 ||
      percentage > available
    ) {
      return;
    }

    setDismissedError(false);

    if (isEdit && editingAllocation && onUpdate) {
      onUpdate(editingAllocation.id, {
        roleOnProject: roleOnProject.trim() || undefined,
        percentage,
        fromDate,
        toDate,
        billable,
      });
      return;
    }

    onSubmit({
      employeeId,
      issueId: resolvedIssueId,
      roleOnProject: roleOnProject.trim() || undefined,
      percentage,
      fromDate,
      toDate,
      billable,
    });
  };

  const canSubmit =
    !!resolvedIssueId &&
    !!employeeId &&
    !!toDate &&
    !datesInvalid &&
    percentage >= 1 &&
    percentage <= available &&
    !loading;

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <h2 className="font-semibold">{formTitle}</h2>

      {overAllocation && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="font-medium text-danger">
            Over-allocation: this would reach {overAllocation.totalWouldBe}% (currently{' '}
            {overAllocation.existingTotal}% on overlapping dates).
          </p>
          <ul className="mt-2 space-y-1 text-text2">
            {overAllocation.breakdown.map((item) => (
              <li key={item.allocationId}>
                {item.issueTitle ?? item.projectName}: {item.percentage}% ({item.fromDate}
                {item.toDate ? ` → ${item.toDate}` : ' → ongoing'})
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDismissedError(true)}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {submitError && !overAllocation && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {isAxiosError(submitError)
            ? (submitError.response?.data as { detail?: string })?.detail ?? 'Failed to save allocation.'
            : 'Failed to save allocation.'}
        </p>
      )}

      {isEdit && editingAllocation ? (
        <div className="rounded-lg border border-border bg-bg2/50 p-4 text-sm">
          <p className="font-medium">{editingAllocation.employeeName}</p>
          <p className="text-text2">{editingAllocation.issueTitle}</p>
          <p className="text-xs text-text2">{editingAllocation.projectName}</p>
        </div>
      ) : (
        <>
          {issues && issues.length > 0 && (
            <label className="block text-sm">
              <span className="text-text2">Issue</span>
              <select
                name="issueId"
                required
                className={inputClass}
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
              >
                <option value="" disabled>
                  Select issue…
                </option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {showEngineeringManagerFilter && (
            <label className="block text-sm">
              <span className="text-text2">Engineering manager</span>
              <select
                name="engineeringManager"
                className={inputClass}
                value={engineeringManager}
                disabled={isScopedManager}
                onChange={(e) => setEngineeringManager(e.target.value)}
              >
                <option value="">All managers</option>
                {engineeringManagers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="text-text2">Resource</span>
            <select
              name="employeeId"
              required
              className={inputClass}
              value={employeeId}
              disabled={isScopedManager && showEngineeringManagerFilter && !engineeringManager}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="" disabled>
                {isScopedManager && showEngineeringManagerFilter && !engineeringManager
                  ? 'Select an engineering manager first…'
                  : engineeringManager && filteredEmployees.length === 0
                    ? 'No resources for this manager…'
                    : 'Select from employee roster…'}
              </option>
              {filteredEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                  {e.teamName ? ` · ${e.teamName}` : ''}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label className="block text-sm">
        <span className="text-text2">Designation</span>
        <input
          name="roleOnProject"
          type="text"
          readOnly
          className={`${inputClass} cursor-default bg-bg2 text-text2`}
          value={roleOnProject}
          placeholder="Select an employee to fill designation"
        />
      </label>

      <label className="block text-sm">
        <span className="text-text2">
          Allocation %{' '}
          {employeeId && !overlapLoading && available > 0 && (
            <span className="text-text2">(max {available}%)</span>
          )}
        </span>
        <input
          name="percentage"
          type="number"
          min={available > 0 ? 1 : 0}
          max={available > 0 ? available : 0}
          required
          value={percentage}
          disabled={!employeeId || overlapLoading || available <= 0}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            if (Number.isNaN(next)) return;
            setPercentage(Math.min(Math.max(next, 1), available));
          }}
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">From date</span>
          <input
            name="fromDate"
            type="date"
            required
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              const next = e.target.value;
              setFromDate(next);
              if (toDate && next && toDate < next) {
                setToDate(next);
              }
            }}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">To date</span>
          <input
            name="toDate"
            type="date"
            required
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      {datesInvalid && (
        <p className="text-xs text-danger">Start date must be on or before End date.</p>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input name="billable" type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded border-border" />
        <span className="text-text2">Billable</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Save allocation'}
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
