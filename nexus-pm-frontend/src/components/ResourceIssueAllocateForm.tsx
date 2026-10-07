import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Plus } from 'lucide-react';
import { fetchAllocations, type OverAllocationError } from '@/api/resources.api';
import { fetchProjects } from '@/api/projects.api';
import { fetchIssues } from '@/api/issues.api';
import { fetchEngineeringManagers, fetchTeamManagement } from '@/api/teamRoster.api';
import { fetchTaskTypes, fetchTaskCategories } from '@/api/lookup.api';
import type { CreateAllocationPayload } from '@/hooks/useResources';
import type { Capacity, Issue } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { hasOrgWideVisibility } from '@/utils/orgRoles';
import { todayLocalIso } from '@/utils/allocationUi';
import { isNonProjectCategory } from '@/utils/taskCategory';
import { isOpenIssueStatus } from '@/utils/issueLifecycle';
import { issueDisplayKey, formatProjectTaskDisplayKey, formatTaskDisplayKey, projectTaskKeyPrefix } from '@/utils/issueUi';
import {
  useCreateIssueTask,
  useCreateProjectTask,
  useIssueTasks,
  useProjectTasks,
} from '@/hooks/useScopedTasks';
import type { TaskRecord } from '@/api/scopedTasks.api';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { MenuSelect } from '@/components/MenuSelect';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

interface ResourceIssueAllocateFormProps {
  row: Capacity;
  loading?: boolean;
  submitError?: unknown;
  onCancel: () => void;
  onSubmit: (payload: CreateAllocationPayload) => void;
}

function allocationApiErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return 'Failed to save allocation.';
  const data = error.response?.data as
    | { detail?: string; errors?: Record<string, string> }
    | undefined;
  const fieldErrors = data?.errors
    ? Object.entries(data.errors)
        .map(([field, message]) => `${field}: ${message}`)
        .join('; ')
    : '';
  return fieldErrors || data?.detail || 'Failed to save allocation.';
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

function taskOptionLabel(
  task: TaskRecord,
  style: 'rd' | 'project',
  prefix?: string,
): string {
  const key =
    style === 'project'
      ? formatProjectTaskDisplayKey(prefix, task.taskNumber)
      : formatTaskDisplayKey(prefix, task.taskNumber);
  const desc = task.description?.trim();
  return desc ? `${key} — ${desc}` : key;
}

function nextTaskNumber(rows: TaskRecord[]): number {
  return rows.reduce((max, row) => Math.max(max, row.taskNumber || 0), 0) + 1;
}

function InlineNewTask({
  title,
  numberPreview,
  loading,
  error,
  onCancel,
  onCreate,
}: {
  title: string;
  numberPreview: string;
  loading?: boolean;
  error?: unknown;
  onCancel: () => void;
  onCreate: (payload: { description: string; module?: string }) => void;
}) {
  const [description, setDescription] = useState('');
  const [module, setModule] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const save = () => {
    const desc = description.trim();
    if (!desc) {
      setLocalError('Task description is required');
      return;
    }
    setLocalError(null);
    onCreate({ description: desc, module: module.trim() || undefined });
  };

  return (
    <div className="space-y-2 rounded-lg border border-accent/30 bg-bg p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">{title}</p>
      <label className="block text-sm">
        <span className="text-text2">Task number</span>
        <input type="text" readOnly value={`${numberPreview} (auto)`} className={`${inputClass} bg-bg3 text-text2`} />
      </label>
      <label className="block text-sm">
        <span className="text-text2">
          Task description <span className="text-danger">*</span>
        </span>
        <textarea
          rows={2}
          value={description}
          maxLength={4000}
          className={inputClass}
          onChange={(e) => {
            setDescription(e.target.value);
            setLocalError(null);
          }}
        />
      </label>
      <label className="block text-sm">
        <span className="text-text2">Module</span>
        <input
          type="text"
          value={module}
          maxLength={120}
          className={inputClass}
          onChange={(e) => setModule(e.target.value)}
        />
      </label>
      {(localError || error != null) && (
        <p className="text-xs text-danger">{localError || allocationApiErrorMessage(error)}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={save}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : 'Create task'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-bg3 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
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

  const { can } = usePermissions();
  const canAddProjectTask = can(P.PROJECTS_UPDATE);
  const canAddRdTask = can(P.ISSUES_UPDATE);

  const defaultEm = row.engineeringManagerName?.trim() || '';
  const [engineeringManager, setEngineeringManager] = useState(
    isScopedManager && userName ? userName : defaultEm,
  );
  const [taskTypeId, setTaskTypeId] = useState('');
  const [taskCategoryId, setTaskCategoryId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [projectTaskId, setProjectTaskId] = useState('');
  const [rdTaskId, setRdTaskId] = useState('');
  const [addingProjectTask, setAddingProjectTask] = useState(false);
  const [addingRdTask, setAddingRdTask] = useState(false);
  const [nonProjectTaskDescription, setNonProjectTaskDescription] = useState('');
  const [nonProjectTaskModule, setNonProjectTaskModule] = useState('');
  const [fromDate, setFromDate] = useState(todayLocalIso());
  const [toDate, setToDate] = useState('');
  const [percentage, setPercentage] = useState(50);
  const [dismissedError, setDismissedError] = useState(false);

  const { data: engineeringManagers = [] } = useQuery({
    queryKey: ['engineering-managers'],
    queryFn: fetchEngineeringManagers,
  });

  const { data: taskTypes = [], isLoading: taskTypesLoading } = useQuery({
    queryKey: ['task-types'],
    queryFn: fetchTaskTypes,
  });

  const { data: taskCategories = [], isLoading: taskCategoriesLoading } = useQuery({
    queryKey: ['task-categories'],
    queryFn: fetchTaskCategories,
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

  const selectedCategory = useMemo(
    () => taskCategories.find((category) => category.id === taskCategoryId) ?? null,
    [taskCategories, taskCategoryId],
  );
  const nonProject = isNonProjectCategory(selectedCategory?.name);

  const { data: projectsPage, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'allocate', selectedEmManagementId ?? engineeringManager],
    queryFn: () =>
      fetchProjects({
        size: 200,
        engineeringManagerManagementId: selectedEmManagementId,
      }),
    enabled: !!engineeringManager && !nonProject,
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

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId],
  );

  const { data: projectTasks = [], isLoading: projectTasksLoading } = useProjectTasks(
    projectId || undefined,
    !!projectId && !issueId,
  );
  const { data: rdTasks = [], isLoading: rdTasksLoading } = useIssueTasks(
    issueId || undefined,
    !!issueId,
  );
  const createProjectTask = useCreateProjectTask(projectId);
  const createIssueTask = useCreateIssueTask(issueId);

  const projectTaskPrefix = projectTaskKeyPrefix(selectedProject?.name, selectedProject?.product);
  const rdTaskPrefix = selectedIssue ? issueDisplayKey(selectedIssue) : undefined;

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
    setProjectTaskId('');
    setRdTaskId('');
    setAddingProjectTask(false);
    setAddingRdTask(false);
    setNonProjectTaskDescription('');
    setNonProjectTaskModule('');
  }, [taskCategoryId]);

  useEffect(() => {
    setProjectId('');
    setIssueId('');
    setIssueSearch('');
    setProjectTaskId('');
    setRdTaskId('');
    setAddingProjectTask(false);
    setAddingRdTask(false);
  }, [engineeringManager]);

  useEffect(() => {
    setIssueId('');
    setIssueSearch('');
    setProjectTaskId('');
    setRdTaskId('');
    setAddingProjectTask(false);
    setAddingRdTask(false);
  }, [projectId]);

  useEffect(() => {
    setRdTaskId('');
    setProjectTaskId('');
    setAddingProjectTask(false);
    setAddingRdTask(false);
  }, [issueId]);

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

  const datesInvalid = !!fromDate && !!toDate && fromDate > toDate;

  const projectLevelReady = !!projectId && !issueId && !!projectTaskId;
  const rdLevelReady = !!projectId && !!issueId;
  const nonProjectReady = nonProject && !!nonProjectTaskDescription.trim();
  const projectRelatedReady = !nonProject && (projectLevelReady || rdLevelReady);

  const canSubmit =
    !!taskTypeId &&
    !!taskCategoryId &&
    (nonProjectReady || projectRelatedReady) &&
    !!toDate &&
    !datesInvalid &&
    percentage >= 1 &&
    percentage <= available &&
    !loading &&
    !overlapLoading;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setDismissedError(false);
    onSubmit(
      nonProject
        ? {
            employeeId: row.employeeId,
            taskTypeId,
            taskCategoryId,
            nonProjectTaskDescription: nonProjectTaskDescription.trim(),
            nonProjectTaskModule: nonProjectTaskModule.trim() || undefined,
            roleOnProject: row.designationName || undefined,
            percentage,
            fromDate,
            toDate,
            billable: true,
          }
        : {
            employeeId: row.employeeId,
            ...(issueId
              ? { issueId, ...(rdTaskId ? { rdIssueTaskId: rdTaskId } : {}) }
              : { projectTaskId }),
            taskTypeId,
            taskCategoryId,
            roleOnProject: row.designationName || undefined,
            percentage,
            fromDate,
            toDate,
            billable: true,
          },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-bg3 p-4">
      <h3 className="font-semibold">Allocation</h3>

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
            ? allocationApiErrorMessage(submitError)
            : 'Failed to save allocation.'}
        </p>
      )}

      <label className="block text-sm">
        <span className="text-text2">Engineering manager</span>
        <MenuSelect
          className={inputClass}
          value={engineeringManager}
          disabled={isScopedManager}
          required
          placeholder="Select engineering manager…"
          options={emOptions.map((name) => ({ value: name, label: name }))}
          onChange={setEngineeringManager}
        />
      </label>

      <label className="block text-sm">
        <span className="text-text2">Task category</span>
        <MenuSelect
          className={inputClass}
          value={taskCategoryId}
          disabled={taskCategoriesLoading}
          required
          placeholder={
            taskCategoriesLoading
              ? 'Loading task categories…'
              : taskCategories.length === 0
                ? 'No task categories configured…'
                : 'Select task category…'
          }
          options={taskCategories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          onChange={setTaskCategoryId}
        />
      </label>

      <label className="block text-sm">
        <span className="text-text2">Task type</span>
        <MenuSelect
          className={inputClass}
          value={taskTypeId}
          disabled={taskTypesLoading}
          required
          placeholder={
            taskTypesLoading
              ? 'Loading task types…'
              : taskTypes.length === 0
                ? 'No task types configured…'
                : 'Select task type…'
          }
          options={taskTypes.map((type) => ({ value: type.id, label: type.name }))}
          onChange={setTaskTypeId}
        />
      </label>

      {nonProject ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-text2">
              Task <span className="text-danger">*</span>
            </span>
            <textarea
              rows={3}
              required
              maxLength={4000}
              className={inputClass}
              value={nonProjectTaskDescription}
              placeholder="Describe the non-project task…"
              onChange={(e) => setNonProjectTaskDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text2">Module</span>
            <input
              type="text"
              maxLength={120}
              className={inputClass}
              value={nonProjectTaskModule}
              placeholder="Optional"
              onChange={(e) => setNonProjectTaskModule(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <>
      <label className="block text-sm">
        <span className="text-text2">Project</span>
        <MenuSelect
          className={inputClass}
          value={projectId}
          disabled={!engineeringManager || projectsLoading}
          required
          placeholder={
            !engineeringManager
              ? 'Select an engineering manager first…'
              : projectsLoading
                ? 'Loading projects…'
                : projects.length === 0
                  ? 'No projects for this manager…'
                  : 'Select project…'
          }
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
          onChange={setProjectId}
        />
      </label>

      <div className="space-y-2">
        <label className="block text-sm">
          <span className="text-text2">Search RDs</span>
          <input
            type="search"
            className={inputClass}
            value={issueSearch}
            disabled={!projectId}
            placeholder="Search by description or RD number…"
            onChange={(e) => setIssueSearch(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">RD</span>
          <MenuSelect
            className={inputClass}
            value={issueId}
            disabled={!projectId || issuesLoading}
            placeholder={
              !projectId
                ? 'Select a project first…'
                : issuesLoading
                  ? 'Loading RDs…'
                  : availableIssues.length === 0
                    ? issueSearch.trim()
                      ? 'No matching RDs…'
                      : 'No open RDs on this project…'
                    : 'None — use a project-level task'
            }
            options={[
              {
                value: '',
                label:
                  !projectId
                    ? 'Select a project first…'
                    : issuesLoading
                      ? 'Loading RDs…'
                      : availableIssues.length === 0
                        ? issueSearch.trim()
                          ? 'No matching RDs…'
                          : 'No open RDs on this project…'
                        : 'None — use a project-level task',
              },
              ...availableIssues.map((issue) => ({
                value: issue.id,
                label: `${issueDisplayKey(issue)} — ${issue.title}`,
              })),
            ]}
            onChange={setIssueId}
          />
        </label>
        {selectedIssue?.description && (
          <p className="line-clamp-3 text-xs text-text2">{selectedIssue.description}</p>
        )}
      </div>

      {!issueId && (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="text-text2">Project task</span>
              <MenuSelect
                className={inputClass}
                value={projectTaskId}
                disabled={!projectId || projectTasksLoading}
                required={!issueId && !addingProjectTask}
                placeholder={
                  !projectId
                    ? 'Select a project first…'
                    : projectTasksLoading
                      ? 'Loading project tasks…'
                      : projectTasks.length === 0
                        ? 'No project-level tasks…'
                        : 'Select project task…'
                }
                options={projectTasks.map((task) => ({
                  value: task.id,
                  label: taskOptionLabel(task, 'project', projectTaskPrefix),
                }))}
                onChange={setProjectTaskId}
              />
            </label>
            {!!projectId && canAddProjectTask && !addingProjectTask && (
              <button
                type="button"
                onClick={() => {
                  setAddingProjectTask(true);
                  createProjectTask.reset();
                }}
                className="mb-px inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-2 text-xs hover:bg-bg3"
              >
                <Plus size={12} />
                New
              </button>
            )}
          </div>
          {addingProjectTask && (
            <InlineNewTask
              title="New project task"
              numberPreview={formatProjectTaskDisplayKey(
                projectTaskPrefix,
                nextTaskNumber(projectTasks),
              )}
              loading={createProjectTask.isPending}
              error={createProjectTask.error}
              onCancel={() => {
                setAddingProjectTask(false);
                createProjectTask.reset();
              }}
              onCreate={(payload) => {
                createProjectTask.mutate(payload, {
                  onSuccess: (task) => {
                    setProjectTaskId(task.id);
                    setAddingProjectTask(false);
                    createProjectTask.reset();
                  },
                });
              }}
            />
          )}
        </div>
      )}

      {!!issueId && (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="text-text2">RD task</span>
              <MenuSelect
                className={inputClass}
                value={rdTaskId}
                disabled={rdTasksLoading}
                placeholder={
                  rdTasksLoading
                    ? 'Loading RD tasks…'
                    : rdTasks.length === 0
                      ? 'None — allocate to this RD'
                      : 'Optional — or allocate to this RD'
                }
                options={[
                  {
                    value: '',
                    label: rdTasksLoading
                      ? 'Loading RD tasks…'
                      : rdTasks.length === 0
                        ? 'None — allocate to this RD'
                        : 'Optional — or allocate to this RD',
                  },
                  ...rdTasks.map((task) => ({
                    value: task.id,
                    label: taskOptionLabel(task, 'rd', rdTaskPrefix),
                  })),
                ]}
                onChange={setRdTaskId}
              />
            </label>
            {canAddRdTask && !addingRdTask && (
              <button
                type="button"
                onClick={() => {
                  setAddingRdTask(true);
                  createIssueTask.reset();
                }}
                className="mb-px inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-2 text-xs hover:bg-bg3"
              >
                <Plus size={12} />
                New
              </button>
            )}
          </div>
          {addingRdTask && (
            <InlineNewTask
              title="New RD task"
              numberPreview={formatTaskDisplayKey(rdTaskPrefix, nextTaskNumber(rdTasks))}
              loading={createIssueTask.isPending}
              error={createIssueTask.error}
              onCancel={() => {
                setAddingRdTask(false);
                createIssueTask.reset();
              }}
              onCreate={(payload) => {
                createIssueTask.mutate(payload, {
                  onSuccess: (task) => {
                    setRdTaskId(task.id);
                    setAddingRdTask(false);
                    createIssueTask.reset();
                  },
                });
              }}
            />
          )}
        </div>
      )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-text2">Start date</span>
          <input
            type="date"
            required
            className={inputClass}
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              const next = e.target.value;
              setFromDate(next);
              if (toDate && next && toDate < next) {
                setToDate(next);
              }
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">End date</span>
          <input
            type="date"
            required
            className={inputClass}
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
      </div>
      {datesInvalid && (
        <p className="text-xs text-danger">Start date must be on or before End date.</p>
      )}

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
