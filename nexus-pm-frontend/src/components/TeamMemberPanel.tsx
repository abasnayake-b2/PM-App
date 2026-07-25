import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, X } from 'lucide-react';
import type { Allocation, Capacity, Issue } from '@/types';
import { AllocationForm } from '@/components/AllocationForm';
import { ResourceIssueAllocateForm } from '@/components/ResourceIssueAllocateForm';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { useCreateAllocation, useDeleteAllocation, useUpdateAllocation } from '@/hooks/useResources';
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard';
import {
  capacityPeriodView,
  formatAllocationDateRange,
  projectColor,
  roleLabel,
} from '@/utils/allocationUi';
import { isOpenIssueStatus } from '@/utils/issueLifecycle';

interface TeamMemberPanelProps {
  row: Capacity;
  rangeFrom: string;
  rangeTo: string;
  issues: Issue[];
  issuesLoading?: boolean;
  canEdit?: boolean;
  /** System profile / roster links — managers only; hide for employee viewers. */
  showProfileLink?: boolean;
  initialEditingAllocationId?: string | null;
  onClose: () => void;
  onEditAllocationClosed?: () => void;
}

export function TeamMemberPanel({
  row,
  rangeFrom,
  rangeTo,
  issues,
  issuesLoading,
  canEdit = false,
  showProfileLink = false,
  initialEditingAllocationId = null,
  onClose,
  onEditAllocationClosed,
}: TeamMemberPanelProps) {
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [allocating, setAllocating] = useState(false);
  const createAllocation = useCreateAllocation();
  const updateAllocation = useUpdateAllocation();
  const deleteAllocation = useDeleteAllocation();
  const formOpen = allocating || editingAllocation != null;
  const unsaved = useUnsavedCloseGuard(formOpen);
  const { setDirty, confirmOpen, keepEditing, requestClose: guardClose } = unsaved;

  useEffect(() => {
    if (!formOpen) setDirty(false);
  }, [formOpen, setDirty]);

  const { allocations, totalPercentage, availablePercentage } = capacityPeriodView(
    row,
    rangeFrom,
    rangeTo,
  );

  useEffect(() => {
    setAllocating(false);
  }, [row.employeeId]);

  useEffect(() => {
    if (!initialEditingAllocationId || !canEdit) {
      setEditingAllocation(null);
      return;
    }
    const allocation = allocations.find((item) => item.id === initialEditingAllocationId) ?? null;
    setEditingAllocation(allocation);
    if (allocation) setAllocating(false);
  }, [initialEditingAllocationId, allocations, canEdit, row.employeeId]);

  const openIssues = issues.filter((i) => isOpenIssueStatus(i.statusName));

  const employeeOption = useMemo(
    () => [
      {
        id: row.employeeId,
        label: row.employeeName,
        designationName: row.designationName,
      },
    ],
    [row],
  );

  const handleRemoveAllocation = (allocation: Allocation) => {
    if (!window.confirm(`Remove ${row.employeeName} from "${allocation.issueTitle}"?`)) return;
    deleteAllocation.mutate(allocation.id, {
      onSuccess: () => {
        if (editingAllocation?.id === allocation.id) {
          setEditingAllocation(null);
        }
      },
    });
  };

  const requestClose = useCallback(() => {
    guardClose(onClose);
  }, [guardClose, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (confirmOpen) {
        keepEditing();
        return;
      }
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen, keepEditing, requestClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={requestClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l glass-panel">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <ResourceAvatar name={row.employeeName} size="md" imageUrl={row.profilePictureUrl} />
            <div>
              <h2 className="text-lg font-bold">{row.employeeName}</h2>
              <p className="text-sm text-text2">{roleLabel(row)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-1.5 text-text2 hover:bg-bg3 hover:text-text"
          >
            <X size={20} />
          </button>
        </div>

        <div
          ref={unsaved.contentRef}
          className="flex-1 overflow-y-auto p-5"
          onInputCapture={unsaved.markDirtyFromEvent}
          onChangeCapture={unsaved.markDirtyFromEvent}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-bg3 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-text2">Allocated</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{totalPercentage}%</p>
              <p className="mt-1 text-[11px] text-text3">Avg over selected dates</p>
            </div>
            <div className="rounded-xl border border-border bg-bg3 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-text2">Available</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-accent">{availablePercentage}%</p>
              <p className="mt-1 text-[11px] text-text3">Remaining capacity</p>
            </div>
          </div>

          {canEdit && allocating && !editingAllocation && (
            <div className="mt-6">
              <ResourceIssueAllocateForm
                row={row}
                loading={createAllocation.isPending}
                submitError={createAllocation.error}
                onCancel={() => {
                  setAllocating(false);
                  createAllocation.reset();
                }}
                onSubmit={(payload) => {
                  createAllocation.mutate(payload, {
                    onSuccess: () => {
                      setAllocating(false);
                      createAllocation.reset();
                    },
                  });
                }}
              />
            </div>
          )}

          <section className="mt-6">
            <h3 className="text-sm font-semibold">Issue allocations</h3>
            {canEdit && editingAllocation && (
              <div className="mt-3">
                <AllocationForm
                  title="Edit allocation"
                  editingAllocation={editingAllocation}
                  employees={employeeOption}
                  enableEngineeringManagerFilter={false}
                  loading={updateAllocation.isPending}
                  submitError={updateAllocation.error}
                  onCancel={() => {
                    setEditingAllocation(null);
                    updateAllocation.reset();
                    onEditAllocationClosed?.();
                  }}
                  onSubmit={() => {}}
                  onUpdate={(allocationId, payload) => {
                    updateAllocation.mutate(
                      { id: allocationId, payload },
                      {
                        onSuccess: () => {
                          setEditingAllocation(null);
                          updateAllocation.reset();
                          onEditAllocationClosed?.();
                        },
                      },
                    );
                  }}
                />
              </div>
            )}

            {allocations.length === 0 ? (
              <p className="mt-2 text-sm text-text2">No issue allocations in this period.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {allocations.map((allocation) =>
                  editingAllocation?.id === allocation.id ? null : (
                    <li key={allocation.id}>
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <Link to={`/issues/${allocation.issueId}`} className="font-medium hover:text-accent">
                          {allocation.issueTitle}
                        </Link>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-text2">{allocation.percentage}%</span>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  updateAllocation.reset();
                                  setAllocating(false);
                                  setEditingAllocation(allocation);
                                }}
                                disabled={updateAllocation.isPending || deleteAllocation.isPending}
                                className="rounded-lg p-1 text-text2 hover:bg-bg3 hover:text-accent disabled:opacity-50"
                                title="Edit allocation"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAllocation(allocation)}
                                disabled={updateAllocation.isPending || deleteAllocation.isPending}
                                className="rounded-lg p-1 text-text2 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                                title="Remove allocation"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-text2">{allocation.projectName}</p>
                      {allocation.roleOnProject && (
                        <p className="text-xs text-text2">{allocation.roleOnProject}</p>
                      )}
                      <p className="text-xs text-text2">{formatAllocationDateRange(allocation)}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg3">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(allocation.percentage, 100)}%`,
                            backgroundColor: projectColor(allocation.projectId, allocation.projectName),
                          }}
                        />
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-semibold">Active issues assigned</h3>
            {issuesLoading && <p className="mt-2 text-sm text-text2">Loading…</p>}
            {!issuesLoading && openIssues.length === 0 && (
              <p className="mt-2 text-sm text-text2">No open issues assigned.</p>
            )}
            <ul className="mt-3 space-y-2">
              {openIssues.slice(0, 5).map((issue) => (
                <li key={issue.id}>
                  <Link
                    to={`/issues/${issue.id}`}
                    className="block rounded-lg border border-border bg-bg3 px-3 py-2 text-sm hover:border-accent/40"
                  >
                    <p className="font-medium">{issue.title}</p>
                    <p className="text-xs text-text2">{issue.statusName}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {(showProfileLink || canEdit) && (
          <div className="flex flex-wrap gap-2 border-t border-border p-5">
            {showProfileLink &&
              (row.employeeId ? (
                <Link
                  to={`/resources/${row.employeeId}`}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg3"
                >
                  System profile
                </Link>
              ) : (
                <Link
                  to="/team/employees"
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg3"
                >
                  Employee roster
                </Link>
              ))}
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setEditingAllocation(null);
                  onEditAllocationClosed?.();
                  createAllocation.reset();
                  setAllocating(true);
                }}
                disabled={allocating}
                className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ color: 'var(--accent-fg)' }}
              >
                Allocate on issue
              </button>
            )}
          </div>
        )}
      </aside>

      <UnsavedChangesDialog
        open={unsaved.confirmOpen}
        saving={unsaved.saving}
        onSave={() => void unsaved.save()}
        onKeepChanging={unsaved.keepEditing}
        onCancel={unsaved.discard}
      />
    </>
  );
}
