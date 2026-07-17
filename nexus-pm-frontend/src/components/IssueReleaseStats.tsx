import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Allocation, Issue } from '@/types';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { issueDisplayKey } from '@/utils/issueUi';

interface ReleaseGroup {
  releaseId: string;
  releaseName: string;
  projectName?: string;
  issues: Issue[];
}

interface BacklogGroup {
  groupId: string;
  projectName: string;
  issues: Issue[];
}

interface IssueReleaseStatsProps {
  issues: Issue[];
  allocations: Allocation[];
  loading?: boolean;
  showBacklogStat?: boolean;
  showReleaseTree?: boolean;
  /** When set, used for the backlog stat card instead of counting the current page. */
  totalBacklogCount?: number;
  backlogStatSubtitle?: string;
}

export function IssueReleaseStats({
  issues,
  allocations,
  loading = false,
  showBacklogStat = true,
  showReleaseTree = true,
  totalBacklogCount,
  backlogStatSubtitle = 'Not assigned to a release',
}: IssueReleaseStatsProps) {
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const backlogCount = useMemo(() => issues.filter((issue) => !issue.releaseId).length, [issues]);
  const displayedBacklogCount = totalBacklogCount ?? backlogCount;

  const allocationsByIssue = useMemo(() => {
    const map = new Map<string, Allocation[]>();
    for (const allocation of allocations) {
      const list = map.get(allocation.issueId) ?? [];
      list.push(allocation);
      map.set(allocation.issueId, list);
    }
    return map;
  }, [allocations]);

  const releaseGroups = useMemo(() => {
    const map = new Map<string, ReleaseGroup>();
    for (const issue of issues) {
      if (!issue.releaseId) continue;
      if (!map.has(issue.releaseId)) {
        map.set(issue.releaseId, {
          releaseId: issue.releaseId,
          releaseName: issue.releaseName ?? 'Release',
          projectName: issue.projectName,
          issues: [],
        });
      }
      map.get(issue.releaseId)!.issues.push(issue);
    }
    return Array.from(map.values()).sort((a, b) => a.releaseName.localeCompare(b.releaseName));
  }, [issues]);

  const backlogGroups = useMemo(() => {
    const map = new Map<string, BacklogGroup>();
    for (const issue of issues) {
      if (issue.releaseId) continue;
      if (!map.has(issue.projectId)) {
        map.set(issue.projectId, {
          groupId: `backlog:${issue.projectId}`,
          projectName: issue.projectName ?? 'Project',
          issues: [],
        });
      }
      map.get(issue.projectId)!.issues.push(issue);
    }
    return Array.from(map.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [issues]);

  const treeGroups = useMemo(
    () => [
      ...releaseGroups.map((group) => ({
        id: group.releaseId,
        label: group.releaseName,
        subtitle: group.projectName,
        issues: group.issues,
      })),
      ...backlogGroups.map((group) => ({
        id: group.groupId,
        label: 'Backlog (no release)',
        subtitle: group.projectName,
        issues: group.issues,
      })),
    ],
    [releaseGroups, backlogGroups],
  );

  const releaseIssueCount = useMemo(
    () => releaseGroups.reduce((sum, group) => sum + group.issues.length, 0),
    [releaseGroups],
  );

  const toggleRelease = (releaseId: string) => {
    setExpandedReleases((current) => {
      const next = new Set(current);
      if (next.has(releaseId)) next.delete(releaseId);
      else next.add(releaseId);
      return next;
    });
  };

  const toggleIssue = (issueId: string) => {
    setExpandedIssues((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  if (loading) {
    return <p className="text-sm text-text2">Loading statistics…</p>;
  }

  return (
    <div className="space-y-4">
      {showBacklogStat && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text2">Backlog items</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{displayedBacklogCount}</p>
            <p className="mt-0.5 text-xs text-text2">{backlogStatSubtitle}</p>
          </div>
          {showReleaseTree && (
            <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text2">In releases</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{releaseIssueCount}</p>
              <p className="mt-0.5 text-xs text-text2">
                {releaseGroups.length} release{releaseGroups.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {showReleaseTree && treeGroups.length > 0 && (
        <section className="rounded-xl border border-border bg-bg2 p-4">
          <h3 className="text-sm font-semibold">Releases &amp; resource allocation</h3>
          <p className="mt-1 text-xs text-text2">
            Expand a group to see its issues and allocated resources. Backlog items have no release yet.
          </p>
          <ul className="mt-4 space-y-2">
            {treeGroups.map((group) => {
              const releaseOpen = expandedReleases.has(group.id);
              return (
                <li key={group.id} className="rounded-lg border border-border bg-bg3">
                  <button
                    type="button"
                    onClick={() => toggleRelease(group.id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-bg2/50"
                  >
                    {releaseOpen ? (
                      <ChevronDown size={16} className="shrink-0 text-text2" />
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-text2" />
                    )}
                    <span className="font-medium">{group.label}</span>
                    {group.subtitle && (
                      <span className="text-text2">· {group.subtitle}</span>
                    )}
                    <span className="ml-auto text-xs text-text2">
                      {group.issues.length} issue{group.issues.length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {releaseOpen && (
                    <ul className="border-t border-border px-3 py-2">
                      {group.issues.map((issue) => {
                        const issueAllocations = allocationsByIssue.get(issue.id) ?? [];
                        const issueOpen = expandedIssues.has(issue.id);
                        return (
                          <li key={issue.id} className="py-1">
                            <button
                              type="button"
                              onClick={() => toggleIssue(issue.id)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-bg2/50"
                            >
                              {issueOpen ? (
                                <ChevronDown size={14} className="shrink-0 text-text2" />
                              ) : (
                                <ChevronRight size={14} className="shrink-0 text-text2" />
                              )}
                              <span className="font-mono text-xs text-text2">{issueDisplayKey(issue)}</span>
                              <Link
                                to={`/issues/${issue.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium hover:text-accent"
                              >
                                {issue.title}
                              </Link>
                              <span className="ml-auto text-xs text-text2">
                                {issueAllocations.length} resource
                                {issueAllocations.length !== 1 ? 's' : ''}
                              </span>
                            </button>

                            {issueOpen && (
                              <ul className="ml-6 mt-1 space-y-1 border-l border-border pl-3">
                                {issueAllocations.length === 0 ? (
                                  <li className="py-1 text-xs text-text2">No resources allocated</li>
                                ) : (
                                  issueAllocations.map((allocation) => (
                                    <li
                                      key={allocation.id}
                                      className="flex items-center justify-between gap-3 py-1 text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <ResourceAvatar name={allocation.employeeName} size="sm" />
                                        <span>{allocation.employeeName}</span>
                                        {allocation.roleOnProject && (
                                          <span className="text-xs text-text2">
                                            · {allocation.roleOnProject}
                                          </span>
                                        )}
                                      </div>
                                      <span className="shrink-0 text-xs font-medium tabular-nums text-text2">
                                        {allocation.percentage}%
                                      </span>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {showReleaseTree && treeGroups.length === 0 && !showBacklogStat && (
        <p className="text-sm text-text2">No issues assigned to releases yet.</p>
      )}
    </div>
  );
}
