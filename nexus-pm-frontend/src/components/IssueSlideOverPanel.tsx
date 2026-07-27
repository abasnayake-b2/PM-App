import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { StatusPill } from '@/components/StatusPill';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { AllocationBar } from '@/components/AllocationBar';
import { AllocationForm } from '@/components/AllocationForm';
import { IssueEditForm } from '@/components/IssueEditForm';
import { PriorityBadge } from '@/components/PriorityBadge';
import {
  useIssue,
  useIssueChildren,
  useDeleteIssue,
  useUpdateIssue,
  useTransitionIssue,
  type UpdateIssuePayload,
} from '@/hooks/useIssues';
import {
  useAllocations,
  useCreateAllocation,
  useDeleteAllocation,
  useUpdateAllocation,
} from '@/hooks/useResources';
import { fetchRosterAllocationResources } from '@/api/resources.api';
import { fetchIssueTypes, fetchPriorities, fetchIssueStatuses } from '@/api/lookup.api';
import { fetchActiveIssueFields } from '@/api/issueFields.api';
import {
  IssueCustomFieldsView,
  RdSectionCard,
} from '@/components/IssueCustomFields';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { sumAllocationPercent } from '@/utils/allocationUi';
import { issueDisplayKey } from '@/utils/issueUi';
import { allowedChildWorkflowCodes, canHaveChildren, childCreateUrl } from '@/utils/issueHierarchy';

interface IssueSlideOverPanelProps {
  issueId: string;
  onClose: () => void;
  /** Switch panel to another issue (e.g. child item) without closing. */
  onOpenIssue?: (issueId: string) => void;
}

export function IssueSlideOverPanel({ issueId, onClose, onOpenIssue }: IssueSlideOverPanelProps) {
  const { can } = usePermissions();
  const canDeleteIssue = can(P.ISSUES_DELETE);
  const canEditIssue = can(P.ISSUES_UPDATE);
  const canManageAllocations =
    can(P.ALLOCATIONS_CREATE) || can(P.ALLOCATIONS_UPDATE) || can(P.ALLOCATIONS_DELETE);

  const [editing, setEditing] = useState(false);
  const [addingAllocation, setAddingAllocation] = useState(false);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    setEditing(false);
    setAddingAllocation(false);
    setEditingAllocationId(null);
    setSaveError(null);
  }, [issueId]);

  const { data: issue, isLoading, error } = useIssue(issueId);
  const { data: childIssues, isLoading: childrenLoading } = useIssueChildren(
    canHaveChildren(issue?.issueTypeWorkflowCode) ? issueId : undefined,
  );
  const deleteIssue = useDeleteIssue({ redirectTo: false });
  const updateIssue = useUpdateIssue();
  const transitionIssue = useTransitionIssue();
  const { data: issueAllocations, isLoading: allocationsLoading } = useAllocations(
    { issueId },
    { enabled: !!issueId },
  );

  const createAllocation = useCreateAllocation(issueId, issue?.projectId);
  const updateAllocation = useUpdateAllocation(issueId, issue?.projectId);
  const deleteAllocation = useDeleteAllocation(issueId, issue?.projectId);

  const editingAllocation = issueAllocations?.find((a) => a.id === editingAllocationId);

  const { data: rosterResources } = useQuery({
    queryKey: ['roster-allocation-resources'],
    queryFn: fetchRosterAllocationResources,
    enabled: (addingAllocation || !!editingAllocationId) && canManageAllocations,
  });

  const { data: issueTypes } = useQuery({
    queryKey: ['issue-types'],
    queryFn: fetchIssueTypes,
  });

  const { data: priorities = [] } = useQuery({
    queryKey: ['priorities'],
    queryFn: fetchPriorities,
    enabled: editing && canEditIssue,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['issue-statuses'],
    queryFn: fetchIssueStatuses,
    enabled: editing && canEditIssue,
  });

  const { data: customFieldDefs = [] } = useQuery({
    queryKey: ['issue-fields-active'],
    queryFn: fetchActiveIssueFields,
    enabled: !!issueId,
  });

  const childTypeOptions = useMemo(() => {
    if (!issue?.issueTypeWorkflowCode) return [];
    const allowed = new Set(allowedChildWorkflowCodes(issue.issueTypeWorkflowCode));
    return (issueTypes ?? []).filter((type) => allowed.has(type.workflowCode.toUpperCase()));
  }, [issue?.issueTypeWorkflowCode, issueTypes]);

  const allocationResourceOptions = useMemo(
    () =>
      rosterResources?.map((r) => ({
        id: r.employeeId,
        label: r.fullName,
        designationName: r.designationName,
        teamName: r.teamName,
        engineeringManagerName: r.engineeringManagerName,
      })) ?? [],
    [rosterResources],
  );

  const totalAllocated = useMemo(
    () => sumAllocationPercent(issueAllocations ?? []),
    [issueAllocations],
  );

  const saving = updateIssue.isPending || transitionIssue.isPending;

  const handleSave = async (payload: UpdateIssuePayload, nextStatusId: string) => {
    if (!issue) return;
    setSaveError(null);
    try {
      await updateIssue.mutateAsync({ id: issue.id, ...payload });
      if (nextStatusId && nextStatusId !== issue.statusId) {
        await transitionIssue.mutateAsync({ id: issue.id, statusId: nextStatusId });
      }
      setEditing(false);
    } catch (err) {
      setSaveError(err);
    }
  };

  const title = issue ? issueDisplayKey(issue) : 'Issue';
  const subtitle = issue?.title;

  return (
    <SlideOverPanel title={title} subtitle={subtitle} onClose={onClose} size="third" accent>
      {isLoading && <p className="text-text2">Loading issue…</p>}
      {error && !isLoading && <p className="text-danger">Issue not found or access denied.</p>}

      {issue && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg2 p-2.5 shadow-sm">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <IssueTypeIcon
                  name={issue.issueTypeName}
                  workflowCode={issue.issueTypeWorkflowCode}
                  size={16}
                  showLabel
                />
                <PriorityBadge label={issue.priorityLabel ?? '—'} colour={issue.priorityColour} />
                <StatusPill label={issue.statusName} colour={issue.statusColour} />
                <span className="text-xs text-text2">
                  {issue.projectName}
                  {' · '}
                  {issue.releaseName ?? 'Backlog (no release)'}
                </span>
              </div>
              {issue.parentIssueId && (
                <p className="text-xs text-text2">
                  Under{' '}
                  {onOpenIssue ? (
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => onOpenIssue(issue.parentIssueId!)}
                    >
                      {issue.parentIssueTitle ?? 'parent item'}
                    </button>
                  ) : (
                    <Link to={`/issues/${issue.parentIssueId}`} className="text-accent hover:underline">
                      {issue.parentIssueTitle ?? 'parent item'}
                    </Link>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditIssue && !editing && (
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null);
                    setAddingAllocation(false);
                    setEditingAllocationId(null);
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium shadow-sm"
                  style={{ color: 'var(--accent-fg)' }}
                >
                  <Pencil size={14} />
                  Edit
                </button>
              )}
              {canDeleteIssue && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Mark issue "${issue.title}" as deleted?\n\nAll allocations on this issue will also be marked deleted.`,
                      )
                    ) {
                      deleteIssue.mutate(issue.id, {
                        onSuccess: () => onClose(),
                      });
                    }
                  }}
                  disabled={deleteIssue.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          </div>

          {editing ? (
            <IssueEditForm
              issue={issue}
              priorities={priorities}
              statuses={statuses}
              loading={saving}
              submitError={saveError}
              onCancel={() => {
                setEditing(false);
                setSaveError(null);
              }}
              onSave={handleSave}
            />
          ) : (
            <>
          <RdSectionCard title="Description" sectionCode="OTHER" mode="view">
            <p className="whitespace-pre-wrap text-xs text-text2">
              {issue.description || 'No description provided.'}
            </p>
          </RdSectionCard>

          <RdSectionCard title="Details" sectionCode="GENERAL" mode="view">
            <dl className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
              <div className="col-span-2 min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5 sm:col-span-4">
                <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                  JIRA ID
                </dt>
                <dd className="mt-0.5 break-words font-mono font-medium text-text">
                  {issue.jiraId?.trim() ? issue.jiraId : '—'}
                </dd>
              </div>
              <div className="col-span-2 min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5 sm:col-span-4">
                <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                  Change Request Name
                </dt>
                <dd className="mt-0.5 break-words font-medium text-text">{issue.title}</dd>
              </div>
              <div className="min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5">
                <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                  Priority
                </dt>
                <dd className="mt-0.5 font-medium text-text">{issue.priorityLabel ?? '—'}</dd>
              </div>
              <div className="min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5">
                <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                  Current Stage
                </dt>
                <dd className="mt-0.5 font-medium text-text">{issue.statusName ?? '—'}</dd>
              </div>
              <div className="min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5">
                <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                  Capitalization
                </dt>
                <dd className="mt-0.5 font-medium text-text">
                  {issue.capitalizable == null
                    ? '—'
                    : issue.capitalizable
                      ? 'Yes'
                      : 'No'}
                </dd>
              </div>
              <div className="min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5">
                <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                  Reporter
                </dt>
                <dd className="mt-0.5 font-medium text-text">{issue.reportedByName ?? '—'}</dd>
              </div>
              {issue.utilizationPct != null && issue.utilizationPct > 0 && (
                <div className="min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5">
                  <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                    Utilization
                  </dt>
                  <dd className="mt-0.5 font-medium text-text">{issue.utilizationPct}%</dd>
                </div>
              )}
            </dl>
          </RdSectionCard>

          <IssueCustomFieldsView fields={customFieldDefs} values={issue.customFields} />

          <div
            className={
              canHaveChildren(issue.issueTypeWorkflowCode)
                ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'
                : undefined
            }
          >
          {canHaveChildren(issue.issueTypeWorkflowCode) && (
            <section className="rounded-lg border border-border bg-bg2 p-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Child items · {childIssues?.length ?? 0}
                </h3>
                {childTypeOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {childTypeOptions.map((type) => (
                      <Link
                        key={type.id}
                        to={childCreateUrl(issue.id, issue.projectId, type.workflowCode)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg3 px-1.5 py-0.5 text-[11px] hover:border-accent"
                      >
                        <Plus size={11} />
                        {type.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {childrenLoading && <p className="mt-2 text-xs text-text2">Loading…</p>}
              {!childrenLoading && childIssues && childIssues.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {childIssues.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        onClick={() => onOpenIssue?.(child.id)}
                        className="flex w-full items-start justify-between gap-2 rounded-md border border-border bg-bg px-2 py-1.5 text-left hover:border-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{child.title}</p>
                          <p className="mt-0.5 text-[10px] text-text2">{issueDisplayKey(child)}</p>
                        </div>
                        <StatusPill label={child.statusName ?? '—'} colour={child.statusColour} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!childrenLoading && (!childIssues || childIssues.length === 0) && (
                <p className="mt-2 text-xs text-text2">No child items yet.</p>
              )}
            </section>
          )}

          <section className="rounded-lg border border-border bg-bg2 p-2.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Resource allocation</h3>
                <p className="mt-0.5 text-xs text-text2">
                  {issueAllocations?.length ?? 0} resource
                  {(issueAllocations?.length ?? 0) !== 1 ? 's' : ''} · {totalAllocated}%
                </p>
              </div>
              {canManageAllocations && !addingAllocation && !editingAllocationId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAllocationId(null);
                    setAddingAllocation(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium"
                  style={{ color: 'var(--accent-fg)' }}
                >
                  <Plus size={14} />
                  Allocate
                </button>
              )}
            </div>

            {canManageAllocations && editingAllocation && (
              <div className="mt-3">
                <AllocationForm
                  title="Edit allocation"
                  editingAllocation={editingAllocation}
                  employees={allocationResourceOptions}
                  loading={updateAllocation.isPending}
                  submitError={updateAllocation.error}
                  onCancel={() => {
                    setEditingAllocationId(null);
                    updateAllocation.reset();
                  }}
                  onSubmit={() => {}}
                  onUpdate={(allocationId, payload) => {
                    updateAllocation.mutate(
                      { id: allocationId, payload },
                      {
                        onSuccess: () => {
                          setEditingAllocationId(null);
                          updateAllocation.reset();
                        },
                      },
                    );
                  }}
                />
              </div>
            )}

            {canManageAllocations && addingAllocation && !editingAllocationId && (
              <div className="mt-3">
                <AllocationForm
                  title="Allocate to this issue"
                  defaultIssueId={issueId}
                  employees={allocationResourceOptions}
                  loading={createAllocation.isPending}
                  submitError={createAllocation.error}
                  onCancel={() => {
                    setAddingAllocation(false);
                    createAllocation.reset();
                  }}
                  onSubmit={(payload) => {
                    createAllocation.mutate(payload, {
                      onSuccess: () => {
                        setAddingAllocation(false);
                        createAllocation.reset();
                      },
                    });
                  }}
                />
              </div>
            )}

            {totalAllocated > 0 && (
              <div className="mt-3">
                <AllocationBar
                  percentage={totalAllocated}
                  showLabel
                  overAllocated={totalAllocated > 100}
                />
              </div>
            )}

            {allocationsLoading && <p className="mt-3 text-xs text-text2">Loading allocations…</p>}

            {!allocationsLoading && issueAllocations && issueAllocations.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {issueAllocations.map((allocation) =>
                  editingAllocationId === allocation.id ? null : (
                    <li
                      key={allocation.id}
                      className="rounded-md border border-border bg-bg px-2 py-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{allocation.employeeName}</p>
                          <p className="text-[10px] text-text2">
                            {allocation.fromDate}
                            {allocation.toDate ? ` → ${allocation.toDate}` : ' → ongoing'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs font-semibold tabular-nums">
                            {allocation.percentage}%
                          </span>
                          {canManageAllocations && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingAllocation(false);
                                  setEditingAllocationId(allocation.id);
                                  createAllocation.reset();
                                }}
                                className="rounded p-1 text-text2 hover:bg-bg3 hover:text-accent"
                                title="Edit allocation"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Remove ${allocation.employeeName} from this issue?`,
                                    )
                                  ) {
                                    deleteAllocation.mutate(allocation.id);
                                  }
                                }}
                                className="rounded p-1 text-text2 hover:bg-danger/10 hover:text-danger"
                                title="Remove allocation"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <AllocationBar percentage={allocation.percentage} />
                      </div>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              !allocationsLoading &&
              !addingAllocation &&
              !editingAllocationId && (
                <p className="mt-2 text-xs text-text2">No resources allocated yet.</p>
              )
            )}
          </section>
          </div>
            </>
          )}
        </div>
      )}
    </SlideOverPanel>
  );
}
