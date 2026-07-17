import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { fetchAllocations, type OverAllocationError } from '@/api/resources.api';
import { fetchProjects } from '@/api/projects.api';
import { fetchIssues } from '@/api/issues.api';
import { fetchEngineeringManagers, fetchTeamManagement } from '@/api/teamRoster.api';
import type { CreateAllocationPayload } from '@/hooks/useResources';
import type { Capacity, Issue } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { hasOrgWideVisibility } from '@/utils/orgRoles';
import { todayLocalIso } from '@/utils/allocationUi';
import { isOpenIssueStatus } from '@/utils/issueLifecycle';
import { issueDisplayKey } from '@/utils/issueUi';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

interface ResourceIssueAllocateFormProps {
  row: Capacity;
  loading?: boolean;
  submitError?: unknown;
  onCancel: () => void;
  onSubmit: (payload: CreateAllocationPayload) => void;
}

function parseOverAllocationError(error: unknown): OverAllocationError | null {
  if (!isAxiosError(error) || error.response?.status !== 400) return null;
  const data = error.response.data as Record<string, unknown>;
  if (data?.title !== 'OVER_ALLOCATION') return null;
  return data as unknown as OverAllocationError;
}

function defaultPercentage(available: number): number {
  if (available <= 0) return 0;
  return Math.min(50, available);
}

function issueMatchesSearch(issue: Issue, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const key = issueDisplayKey(issue).toLowerCase();
  const title = (issue.title ?? '').toLowerCase();
  const description = (issue.description ?? '').toLowerCase();
  const id = issue.id.toLowerCase();
  return key.includes(q) || title.includes(q) || description.includes(q) || id.includes(q);
}

export function ResourceIssueAllocateForm({
  row,
  loading,
  submitError,
  onCancel,
  onSubmit,
}: ResourceIssueAllocateFormProps) {
  const role = useAuthStore((s) => s.user?.role);
  const orgWideVisibility = useAuthStore((s) => s.user?.orgWideVisibility);
  const userName = useAuthStore((s) => s.user?.name);
  const isScopedManager = !hasOrgWideVisibility(role, orgWideVisibility);

  const defaultEm = row.engineeringManagerName?.trim() || '';
  const [engineeringManager, setEngineeringManager] = useState(
    isScopedManager && userName ? userName : defaultEm,
  );
  const [projectId, setProjectId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [fromDate, setFromDate] = useState(todayLocalIso());
  const [toDate, setToDate] = useState('');
  const [percentage, setPercentage] = useState(50);
  const [dismissedError, setDismissedError] = useState(false);

  const { data: engineeringManagers = [] } = useQuery({
    queryKey: ['engineering-managers'],
    queryFn: fetchEngineeringManagers,
  });

  const { data: management = [] } = useQuery({
    queryKey: ['team-management'],
    queryFn: () => fetchTeamManagement(),
  });

  const emOptions = useMemo(() => {
    const names = new Set(engineeringManagers);
    if (defaultEm) names.add(defaultEm);
    if (isScopedManager && userName) names.add(userName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [engineeringManagers, defaultEm, isScopedManager, userName]);

  const selectedEmManagementId = useMemo(() => {
    const selected = engineeringManager.trim().toLowerCase();
    if (!selected) return undefined;
    return management.find((m) => m.fullName.trim().toLowerCase() === selected)?.id;
  }, [management, engineeringManager]);

  const { data: projectsPage, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'allocate', selectedEmManagementId ?? engineeringManager],
    queryFn: () =>
      fetchProjects({
        size: 200,
        engineeringManagerManagementId: selectedEmManagementId,
      }),
    enabled: !!engineeringManager,
  });

  const projects = useMemo(() => {
    const content = projectsPage?.content ?? [];
    if (selectedEmManagementId) return content;
    const selected = engineeringManager.trim().toLowerCase();
    if (!selected) return [];
    return content.filter(
      (project) => (project.engineeringManagerName ?? '').trim().toLowerCase() === selected,
    );
  }, [projectsPage, selectedEmManagementId, engineeringManager]);

  const { data: issuesPage, isLoading: issuesLoading } = useQuery({
    queryKey: ['issues', 'allocate', projectId],
    queryFn: () => fetchIssues({ projectId, size: 200 }),
    enabled: !!projectId,
  });

  const availableIssues = useMemo(() => {
    const open = (issuesPage?.content ?? []).filter((issue) => isOpenIssueStatus(issue.statusName));
    return open.filter((issue) => issueMatchesSearch(issue, issueSearch));
  }, [issuesPage, issueSearch]);

  const selectedIssue = useMemo(
    () => availableIssues.find((issue) => issue.id === issueId) ?? null,
    [availableIssues, issueId],
  );

  const { data: overlapping, isLoading: overlapLoading } = useQuery({
    queryKey: ['allocations', 'overlap', row.employeeId, fromDate, toDate || 'ongoing'],
    queryFn: () =>
      fetchAllocations({
        employeeId: row.employeeId,
        from: fromDate,
        to: toDate || undefined,
      }),
    enabled: !!row.employeeId && !!fromDate,
  });

  const existingTotal = useMemo(
    () => (overlapping ?? []).reduce((sum, allocation) => sum + allocation.percentage, 0),
    [overlapping],
  );
  const available = Math.max(0, 100 - existingTotal);
  const overAllocation = submitError && !dismissedError ? parseOverAllocationError(submitError) : null;

  useEffect(() => {
    if (isScopedManager && userName) {
      setEngineeringManager(userName);
    } else if (defaultEm) {
      setEngineeringManager(defaultEm);
    }
  }, [isScopedManager, userName, defaultEm, row.employeeId]);

  useEffect(() => {
    setProjectId('');
    setIssueId('');
    setIssueSearch('');
  }, [engineeringManager]);

  useEffect(() => {
    setIssueId('');
    setIssueSearch('');
  }, [projectId]);

  useEffect(() => {
    if (issueId && !availableIssues.some((issue) => issue.id === issueId)) {
      setIssueId('');
    }
  }, [availableIssues, issueId]);

  useEffect(() => {
    if (overlapLoading) return;
    setPercentage((current) => {
      if (available <= 0) return 0;
      if (current > available) return available;
      if (current < 1) return defaultPercentage(available);
      return current;
    });
  }, [fromDate, toDate, available, overlapLoading, row.employeeId]);

  const canSubmit =
    !!issueId &&
    !!projectId &&
    !!toDate &&
    percentage >= 1 &&
    percentage <= available &&
    !loading &&
    !overlapLoading;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setDismissedError(false);
    onSubmit({
      employeeId: row.employeeId,
      issueId,
      roleOnProject: row.designationName || undefined,
      percentage,
      fromDate,
      toDate,
      billable: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-bg3 p-4">
      <h3 className="font-semibold">Allocate on issue</h3>

      {overAllocation && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          <p className="font-medium text-danger">
            Over-allocation: this would reach {overAllocation.totalWouldBe}% (currently{' '}
            {overAllocation.existingTotal}% on overlapping dates).
          </p>
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
            ? ((submitError.response?.data as { detail?: string })?.detail ??
              'Failed to save allocation.')
            : 'Failed to save allocation.'}
        </p>
      )}

      <label className="block text-sm">
        <span className="text-text2">Engineering manager</span>
        <select
          className={inputClass}
          value={engineeringManager}
          disabled={isScopedManager}
          onChange={(e) => setEngineeringManager(e.target.value)}
          required
        >
          <option value="" disabled>
            Select engineering manager…
          </option>
          {emOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-text2">Project</span>
        <select
          className={inputClass}
          value={projectId}
          disabled={!engineeringManager || projectsLoading}
          onChange={(e) => setProjectId(e.target.value)}
          required
        >
          <option value="" disabled>
            {!engineeringManager
              ? 'Select an engineering manager first…'
              : projectsLoading
                ? 'Loading projects…'
                : projects.length === 0
                  ? 'No projects for this manager…'
                  : 'Select project…'}
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <label className="block text-sm">
          <span className="text-text2">Search issues</span>
          <input
            type="search"
            className={inputClass}
            value={issueSearch}
            disabled={!projectId}
            placeholder="Search by description or issue number…"
            onChange={(e) => setIssueSearch(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Issue</span>
          <select
            className={inputClass}
            value={issueId}
            disabled={!projectId || issuesLoading}
            onChange={(e) => setIssueId(e.target.value)}
            required
          >
            <option value="" disabled>
              {!projectId
                ? 'Select a project first…'
                : issuesLoading
                  ? 'Loading issues…'
                  : availableIssues.length === 0
                    ? issueSearch.trim()
                      ? 'No matching issues…'
                      : 'No open issues on this project…'
                    : 'Select issue…'}
            </option>
            {availableIssues.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issueDisplayKey(issue)} — {issue.title}
              </option>
            ))}
          </select>
        </label>
        {selectedIssue?.description && (
          <p className="line-clamp-3 text-xs text-text2">{selectedIssue.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-text2">Start date</span>
          <input
            type="date"
            required
            className={inputClass}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">End date</span>
          <input
            type="date"
            required
            className={inputClass}
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-text2">
          Allocation %{' '}
          {!overlapLoading && available > 0 && (
            <span className="text-text2">(max {available}%)</span>
          )}
        </span>
        <input
          type="number"
          min={available > 0 ? 1 : 0}
          max={available > 0 ? available : 0}
          required
          className={inputClass}
          value={percentage}
          disabled={overlapLoading || available <= 0}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            if (Number.isNaN(next)) return;
            setPercentage(Math.min(Math.max(next, 1), available));
          }}
        />
        {available <= 0 && !overlapLoading && (
          <span className="mt-0.5 block text-xs text-danger">
            No free capacity in this date range.
          </span>
        )}
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : 'Save allocation'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
