import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { AllocationForm } from '@/components/AllocationForm';
import { ListViewToggle, type ListViewMode } from '@/components/ListViewToggle';
import { ProjectUtilisationCard } from '@/components/ProjectUtilisationCard';
import { ProjectUtilisationGrid } from '@/components/ProjectUtilisationGrid';
import { useIssues } from '@/hooks/useIssues';
import {
  useAllocations,
  useCreateAllocation,
  useDeleteAllocation,
  useUpdateAllocation,
} from '@/hooks/useResources';
import { fetchRosterAllocationResources } from '@/api/resources.api';
import type { Allocation } from '@/types';
import { aggregateProjectUtilisation, todayLocalIso } from '@/utils/allocationUi';

interface ProjectUtilisationSectionProps {
  projectId: string;
  canEdit: boolean;
}

export function ProjectUtilisationSection({ projectId, canEdit }: ProjectUtilisationSectionProps) {
  const [view, setView] = useState<ListViewMode>('grid');
  const [addingAllocation, setAddingAllocation] = useState(false);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);

  const asOf = todayLocalIso();
  const { data: projectAllocations, isLoading, error } = useAllocations(
    { projectId, asOf },
    { enabled: !!projectId },
  );
  const { data: projectIssues } = useIssues({ projectId }, { enabled: !!projectId });

  const createAllocation = useCreateAllocation(undefined, projectId);
  const updateAllocation = useUpdateAllocation(undefined, projectId);
  const deleteAllocation = useDeleteAllocation(undefined, projectId);

  const editingAllocation = projectAllocations?.find((a) => a.id === editingAllocationId);

  const { data: rosterResources } = useQuery({
    queryKey: ['roster-allocation-resources'],
    queryFn: fetchRosterAllocationResources,
    enabled: canEdit && (addingAllocation || !!editingAllocationId),
  });

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

  const issueOptions = useMemo(
    () =>
      (projectIssues?.content ?? []).map((issue) => ({
        id: issue.id,
        label: issue.title,
      })),
    [projectIssues],
  );

  const projectUtilisation = useMemo(
    () => aggregateProjectUtilisation(projectAllocations ?? []),
    [projectAllocations],
  );

  const closeForm = () => {
    setAddingAllocation(false);
    setEditingAllocationId(null);
    createAllocation.reset();
    updateAllocation.reset();
  };

  const startEdit = (allocation: Allocation) => {
    setAddingAllocation(false);
    setEditingAllocationId(allocation.id);
    createAllocation.reset();
  };

  const handleDelete = (allocation: Allocation) => {
    if (
      window.confirm(
        `Remove ${allocation.employeeName} from "${allocation.issueTitle}" (${allocation.percentage}%)?`,
      )
    ) {
      deleteAllocation.mutate(allocation.id, {
        onSuccess: () => {
          if (editingAllocationId === allocation.id) {
            setEditingAllocationId(null);
          }
        },
      });
    }
  };

  const showForm = canEdit && (addingAllocation || editingAllocationId);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text2">
          Current utilisation on this project (active today). Allocate resources to issues on this
          project — changes roll up here automatically.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit && !showForm && (
            <button
              type="button"
              onClick={() => {
                setEditingAllocationId(null);
                setAddingAllocation(true);
              }}
              disabled={(projectIssues?.content.length ?? 0) === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              style={{ color: 'var(--accent-fg)' }}
              title={
                (projectIssues?.content.length ?? 0) === 0
                  ? 'Add issues to this project first'
                  : undefined
              }
            >
              <Plus size={16} />
              Allocate resource
            </button>
          )}
          <ListViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {showForm && (
        <div className="max-w-2xl">
          <AllocationForm
            title={editingAllocation ? 'Edit allocation' : 'Allocate to project issue'}
            editingAllocation={editingAllocation}
            issues={issueOptions}
            employees={allocationResourceOptions}
            loading={createAllocation.isPending || updateAllocation.isPending}
            submitError={editingAllocation ? updateAllocation.error : createAllocation.error}
            onCancel={closeForm}
            onSubmit={(payload) => {
              createAllocation.mutate(payload, { onSuccess: closeForm });
            }}
            onUpdate={(allocationId, payload) => {
              updateAllocation.mutate(
                { id: allocationId, payload },
                { onSuccess: closeForm },
              );
            }}
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          Could not load utilisation data.
        </p>
      )}

      {isLoading && <p className="text-text2">Loading utilisation…</p>}

      {!isLoading && projectUtilisation.length > 0 && view === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {projectUtilisation.map((row) => (
            <ProjectUtilisationCard
              key={row.employeeId}
              row={row}
              canEdit={canEdit}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {!isLoading && projectUtilisation.length > 0 && view === 'grid' && (
        <ProjectUtilisationGrid
          rows={projectUtilisation}
          canEdit={canEdit}
          onEdit={startEdit}
          onDelete={handleDelete}
        />
      )}

      {!isLoading && projectUtilisation.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-text2">No active allocations on this project.</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setAddingAllocation(true)}
              disabled={(projectIssues?.content.length ?? 0) === 0}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline disabled:opacity-50"
            >
              <Plus size={14} />
              Allocate resource
            </button>
          )}
          {(projectIssues?.content.length ?? 0) === 0 && (
            <p className="mt-2 text-xs text-text2">Create issues on the Backlog tab first.</p>
          )}
        </div>
      )}
    </div>
  );
}
