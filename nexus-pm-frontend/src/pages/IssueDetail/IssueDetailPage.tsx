import { Link, Navigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { StatusPill } from '@/components/StatusPill';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { AllocationBar } from '@/components/AllocationBar';
import { AllocationForm } from '@/components/AllocationForm';
import { useIssue, useIssueChildren, useDeleteIssue } from '@/hooks/useIssues';
import { useAllocations, useCreateAllocation, useDeleteAllocation, useUpdateAllocation } from '@/hooks/useResources';
import { fetchRosterAllocationResources } from '@/api/resources.api';
import { fetchIssueTypes } from '@/api/lookup.api';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { fetchActiveIssueFields } from '@/api/issueFields.api';
import { IssueCustomFieldsView } from '@/components/IssueCustomFields';
import { IssueRisksSection } from '@/components/IssueRisksSection';
import { IssueQuarterlyCompletionSection } from '@/components/IssueQuarterlyCompletionSection';
import { IssueNotesSection } from '@/components/IssueNotesSection';
import { allowedChildWorkflowCodes, canHaveChildren, childCreateUrl } from '@/utils/issueHierarchy';

export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const canDeleteIssue = can(P.ISSUES_DELETE);
  const canManageAllocations =
    can(P.ALLOCATIONS_CREATE) || can(P.ALLOCATIONS_UPDATE) || can(P.ALLOCATIONS_DELETE);

  const [addingAllocation, setAddingAllocation] = useState(false);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);

  const { data: issue, isLoading, error } = useIssue(id);
  const { data: childIssues, isLoading: childrenLoading } = useIssueChildren(
    canHaveChildren(issue?.issueTypeWorkflowCode) ? id : undefined,
  );
  const deleteIssue = useDeleteIssue();
  const { data: issueAllocations, isLoading: allocationsLoading, error: allocationsError } = useAllocations(
    { issueId: id },
    { enabled: !!id },
  );

  const createAllocation = useCreateAllocation(id, issue?.projectId);
  const updateAllocation = useUpdateAllocation(id, issue?.projectId);
  const deleteAllocation = useDeleteAllocation(id, issue?.projectId);

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

  if (id === 'new') {
    return <Navigate to="/issues/new" replace />;
  }

  if (isLoading) {
    return <p className="text-text2">Loading issue…</p>;
  }

  if (error || !issue) {
    return (
      <div>
        <Link to="/issues" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft size={16} />
          Back to issues
        </Link>
        <p className="mt-4 text-danger">Issue not found or access denied.</p>
      </div>
    );
  }

  const handleRemoveAllocation = (allocationId: string, employeeName: string) => {
    if (window.confirm(`Remove ${employeeName} from this issue?`)) {
      deleteAllocation.mutate(allocationId);
    }
  };

  return (
    <div>
      <Link to="/issues" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
        <ArrowLeft size={16} />
        Back to issues
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <IssueTypeIcon
              name={issue.issueTypeName}
              workflowCode={issue.issueTypeWorkflowCode}
              size={18}
              showLabel
            />
          </div>
          <h1 className="mt-2 text-2xl font-bold">{issue.title}</h1>
          {issue.parentIssueId && (
            <p className="mt-1 text-sm text-text2">
              Under{' '}
              <Link to={`/issues/${issue.parentIssueId}`} className="text-accent hover:underline">
                {issue.parentIssueTitle ?? 'parent item'}
              </Link>
            </p>
          )}
          <p className="mt-1 text-text2">
            <Link to={`/projects/${issue.projectId}`} className="hover:text-accent">
              {issue.projectName}
            </Link>
            {' · '}
            {issue.releaseName ?? 'Backlog (no release)'}
          </p>
        </div>
        <StatusPill label={issue.statusName} colour={issue.statusColour} />
        {canDeleteIssue && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Mark issue "${issue.title}" as deleted?\n\nAll allocations on this issue will also be marked deleted.`,
                )
              ) {
                deleteIssue.mutate(issue.id);
              }
            }}
            disabled={deleteIssue.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Delete issue
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-bg2 p-6">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-text2">
              {issue.description || 'No description provided.'}
            </p>
          </div>

          {canHaveChildren(issue.issueTypeWorkflowCode) && (
            <div className="rounded-xl border border-border bg-bg2 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Child items</h2>
                  <p className="mt-1 text-sm text-text2">
                    {childIssues?.length ?? 0} item{(childIssues?.length ?? 0) !== 1 ? 's' : ''} under
                    this {issue.issueTypeName?.toLowerCase() ?? 'item'}
                  </p>
                </div>
                {childTypeOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {childTypeOptions.map((type) => (
                      <Link
                        key={type.id}
                        to={childCreateUrl(issue.id, issue.projectId, type.workflowCode)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg3 px-3 py-1.5 text-sm hover:border-accent"
                      >
                        <Plus size={14} />
                        <IssueTypeIcon
                          name={type.name}
                          workflowCode={type.workflowCode}
                          size={14}
                          showLabel
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {childrenLoading && <p className="mt-4 text-sm text-text2">Loading child items…</p>}

              {!childrenLoading && childIssues && childIssues.length > 0 && (
                <div className="mt-4 space-y-2">
                  {childIssues.map((child) => (
                    <Link
                      key={child.id}
                      to={`/issues/${child.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg3/50 px-4 py-3 hover:border-accent"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <IssueTypeIcon
                            name={child.issueTypeName}
                            workflowCode={child.issueTypeWorkflowCode}
                            size={14}
                            showLabel
                          />
                          <StatusPill label={child.statusName ?? '—'} colour={child.statusColour} />
                        </div>
                        <p className="mt-1 truncate font-medium">{child.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {!childrenLoading && (!childIssues || childIssues.length === 0) && (
                <p className="mt-4 text-sm text-text2">No child items yet.</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-bg2 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Resource allocation</h2>
              </div>
              {canManageAllocations && !addingAllocation && !editingAllocationId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAllocationId(null);
                    setAddingAllocation(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium"
                  style={{ color: 'var(--accent-fg)' }}
                >
                  <Plus size={16} />
                  Allocate resource
                </button>
              )}
            </div>

            {canManageAllocations && editingAllocation && (
              <div className="mt-4 max-w-2xl">
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
              <div className="mt-4 max-w-2xl">
                <AllocationForm
                  title="Allocate to this issue"
                  defaultIssueId={id}
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

            {allocationsError && (
              <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                Could not load allocations. Check that the database schema is up to date (allocation.issue_id).
              </p>
            )}

            {allocationsLoading && <p className="mt-4 text-sm text-text2">Loading allocations…</p>}

            {!allocationsLoading && issueAllocations && issueAllocations.length > 0 ? (
              <div className="mt-4 space-y-3">
                {issueAllocations.map((allocation) =>
                  editingAllocationId === allocation.id ? null : (
                  <div key={allocation.id} className="rounded-lg border border-border bg-bg3/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{allocation.employeeName}</h3>
                        <p className="text-sm text-text2">{allocation.roleOnProject ?? '—'}</p>
                        <p className="text-xs text-text2">
                          <Link to={`/projects/${allocation.projectId}`} className="hover:text-accent">
                            {allocation.projectName}
                          </Link>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">{allocation.percentage}%</span>
                        {canManageAllocations && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingAllocation(false);
                                setEditingAllocationId(allocation.id);
                                createAllocation.reset();
                              }}
                              disabled={updateAllocation.isPending}
                              className="rounded-lg p-1.5 text-text2 hover:bg-bg3 hover:text-accent disabled:opacity-50"
                              title="Edit allocation"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveAllocation(allocation.id, allocation.employeeName)}
                              disabled={deleteAllocation.isPending}
                              className="rounded-lg p-1.5 text-text2 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                              title="Remove allocation"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <AllocationBar percentage={allocation.percentage} />
                    </div>
                    <p className="mt-2 text-xs text-text2">
                      {allocation.fromDate}
                      {allocation.toDate ? ` → ${allocation.toDate}` : ' → ongoing'}
                      {!allocation.billable && ' · non-billable'}
                    </p>
                  </div>
                  ),
                )}
              </div>
            ) : (
              !allocationsLoading &&
              !addingAllocation &&
              !editingAllocationId && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-text2">No resources allocated to this issue yet.</p>
                  {canManageAllocations && (
                    <button
                      type="button"
                      onClick={() => setAddingAllocation(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                    >
                      <Plus size={14} />
                      Allocate resource
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg2 p-6">
          <h2 className="font-semibold">Details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text2">JIRA ID</dt>
              <dd className="font-mono">{issue.jiraId?.trim() ? issue.jiraId : '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text2">BMS ID</dt>
              <dd className="font-mono">{issue.bmsId?.trim() ? issue.bmsId : '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text2">Type</dt>
              <dd>
                <IssueTypeIcon
                  name={issue.issueTypeName}
                  workflowCode={issue.issueTypeWorkflowCode}
                  size={14}
                  showLabel
                />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text2">Priority</dt>
              <dd>{issue.priorityLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text2">Current Stage</dt>
              <dd>{issue.statusName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text2">Reporter</dt>
              <dd>{issue.reportedByName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text2">Capitalization</dt>
              <dd>
                {issue.capitalizable == null
                  ? '—'
                  : issue.capitalizable
                    ? 'Yes'
                    : 'No'}
              </dd>
            </div>
            {issue.utilizationPct != null && issue.utilizationPct > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-text2">Utilization</dt>
                <dd>{issue.utilizationPct}%</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-bg2 p-6">
          <h2 className="mb-3 font-semibold">Additional fields</h2>
          <IssueDetailCustomFields values={issue.customFields} />
        </section>

        <IssueNotesSection issueId={issue.id} mode="view" />

        <IssueQuarterlyCompletionSection issueId={issue.id} mode="view" />

        <IssueDetailRisks issueId={issue.id} values={issue.customFields} />
      </div>
    </div>
  );
}

function IssueDetailCustomFields({ values }: { values?: Record<string, string> | null }) {
  const { data: fields = [] } = useQuery({
    queryKey: ['issue-fields-active'],
    queryFn: fetchActiveIssueFields,
  });
  return <IssueCustomFieldsView fields={fields} values={values} />;
}

function IssueDetailRisks({
  issueId,
  values,
}: {
  issueId: string;
  values?: Record<string, string> | null;
}) {
  const { data: fields = [] } = useQuery({
    queryKey: ['issue-fields-active'],
    queryFn: fetchActiveIssueFields,
  });
  return (
    <IssueRisksSection
      issueId={issueId}
      mode="view"
      customFields={fields}
      customFieldValues={values}
    />
  );
}
