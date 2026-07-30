import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Allocation, Issue, Release } from '@/types';
import { useUpdateIssue } from '@/hooks/useIssues';
import { useDeleteRelease } from '@/hooks/useProjects';
import { ReleaseIssueTree } from '@/components/ReleaseIssueTree';
import { ReleaseRisksSection } from '@/components/ReleaseRisksSection';

interface ReleaseBoardProps {
  projectId: string;
  releases: Release[];
  issues: Issue[];
  allocations: Allocation[];
  canManage: boolean;
}

export function ReleaseBoard({
  projectId,
  releases,
  issues,
  allocations,
  canManage,
}: ReleaseBoardProps) {
  const updateIssue = useUpdateIssue();
  const deleteRelease = useDeleteRelease(projectId);
  const [addingToReleaseId, setAddingToReleaseId] = useState<string | null>(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [removingIssueId, setRemovingIssueId] = useState<string | null>(null);

  const backlog = useMemo(() => issues.filter((issue) => !issue.releaseId), [issues]);

  const issuesByRelease = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const release of releases) {
      map.set(release.id, []);
    }
    for (const issue of issues) {
      if (issue.releaseId && map.has(issue.releaseId)) {
        map.get(issue.releaseId)!.push(issue);
      }
    }
    return map;
  }, [issues, releases]);

  const toggleIssue = (issueId: string) => {
    setSelectedIssueIds((current) =>
      current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId],
    );
  };

  const openAddIssues = (releaseId: string) => {
    setAddingToReleaseId(releaseId);
    setSelectedIssueIds([]);
  };

  const assignSelected = async () => {
    if (!addingToReleaseId || selectedIssueIds.length === 0) return;
    for (const issueId of selectedIssueIds) {
      await updateIssue.mutateAsync({ id: issueId, releaseId: addingToReleaseId });
    }
    setAddingToReleaseId(null);
    setSelectedIssueIds([]);
  };

  const removeIssue = async (issueId: string) => {
    setRemovingIssueId(issueId);
    try {
      await updateIssue.mutateAsync({ id: issueId, clearRelease: true });
    } finally {
      setRemovingIssueId(null);
    }
  };

  const handleDeleteRelease = (release: Release, issueCount: number) => {
    const suffix =
      issueCount > 0
        ? ` ${issueCount} RD${issueCount === 1 ? '' : 's'} will return to the backlog.`
        : '';
    if (!window.confirm(`Delete release "${release.name}"?${suffix}`)) return;
    deleteRelease.mutate(release.id);
  };

  return (
    <div className="space-y-6">
      {releases.map((release) => {
        const releaseIssues = issuesByRelease.get(release.id) ?? [];
        const isAdding = addingToReleaseId === release.id;

        return (
          <section key={release.id} className="rounded-xl border border-border bg-bg2 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{release.name}</h3>
                <p className="mt-1 text-sm text-text2">
                  {release.version ? `v${release.version} · ` : ''}
                  {release.status}
                  {release.targetDate ? ` · target ${release.targetDate}` : ''}
                  {releaseIssues.length > 0 && (
                    <> · {releaseIssues.length} issue{releaseIssues.length !== 1 ? 's' : ''}</>
                  )}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  {!isAdding && backlog.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openAddIssues(release.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium"
                      style={{ color: 'var(--accent-fg)' }}
                    >
                      <Plus size={14} />
                      Add RDs
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteRelease(release, releaseIssues.length)}
                    disabled={deleteRelease.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-danger hover:bg-bg3 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>

            {isAdding && (
              <div className="mt-4 rounded-lg border border-border bg-bg3 p-4">
                <p className="text-sm font-medium">Select backlog RDs to add</p>
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {backlog.map((issue) => (
                    <li key={issue.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedIssueIds.includes(issue.id)}
                          onChange={() => toggleIssue(issue.id)}
                          className="rounded border-border"
                        />
                        <span>{issue.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={assignSelected}
                    disabled={selectedIssueIds.length === 0 || updateIssue.isPending}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    style={{ color: 'var(--accent-fg)' }}
                  >
                    {updateIssue.isPending ? 'Adding…' : `Add ${selectedIssueIds.length || ''} RD(s)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingToReleaseId(null);
                      setSelectedIssueIds([]);
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bg2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <ReleaseIssueTree
              issues={releaseIssues}
              allocations={allocations}
              canRemove={canManage}
              removingIssueId={removingIssueId}
              onRemove={removeIssue}
            />

            <div className="mt-4">
              <ReleaseRisksSection releaseId={release.id} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
