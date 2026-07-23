import { Link, useNavigate } from 'react-router-dom';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Plus, Search } from 'lucide-react';
import { ListViewToggle, type ListViewMode } from '@/components/ListViewToggle';
import { IssueCard } from '@/components/IssueCard';
import { IssueTrackerTable } from '@/components/IssueTrackerTable';
import { IssueSlideOverPanel } from '@/components/IssueSlideOverPanel';
import { IssueCreateSlideOverPanel } from '@/components/IssueCreateSlideOverPanel';
import { EmCrMatrixTab } from '@/components/EmCrMatrixTab';
import { RdStatusSummary } from '@/components/RdStatusSummary';
import { ListPagination } from '@/components/ListPagination';
import { MultiStatusFilter } from '@/components/MultiStatusFilter';
import { fetchProjects } from '@/api/projects.api';
import { exportBacklogExcel, fetchIssueStatusCounts } from '@/api/issues.api';
import { fetchPriorities, fetchIssueTypes, fetchIssueStatuses } from '@/api/lookup.api';
import { useIssues, useDeleteIssue } from '@/hooks/useIssues';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { isAdminRole, isManagerOrAboveRole } from '@/utils/orgRoles';
import { filterIssuesBySearch, looksLikeIssueIdSearch } from '@/utils/issueUi';
import type { Issue } from '@/types';

export function IssuesPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { can } = usePermissions();
  const isAdmin = isAdminRole(role);
  const isManagerOrAbove = isManagerOrAboveRole(role);

  const [projectId, setProjectId] = useState('');
  const [issueTypeId, setIssueTypeId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [statusIds, setStatusIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [view, setView] = useState<ListViewMode>('grid');
  const [trackerTab, setTrackerTab] = useState<'list' | 'matrix'>('list');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canDeleteIssue = can(P.ISSUES_DELETE);
  const deleteIssue = useDeleteIssue({ redirectTo: false });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-issues'],
    queryFn: () => fetchProjects({ size: 100 }),
  });
  const { data: priorities } = useQuery({ queryKey: ['priorities'], queryFn: fetchPriorities });
  const { data: issueTypes } = useQuery({ queryKey: ['issue-types'], queryFn: fetchIssueTypes });
  const { data: statuses } = useQuery({ queryKey: ['issue-statuses'], queryFn: fetchIssueStatuses });

  const canQuery = can(P.ISSUES_VIEW) && (isManagerOrAbove || !!projectId);
  const searching = deferredSearch.length > 0;
  const statusFiltering = statusIds.length > 0;
  const idSearch = looksLikeIssueIdSearch(deferredSearch);

  useEffect(() => {
    setPage(0);
  }, [projectId, issueTypeId, priorityId, statusIds.join(','), deferredSearch, pageSize]);

  // Full-set status counts for RD overview — never tied to grid pagination.
  const { data: statusCounts, isFetching: countsFetching } = useQuery({
    queryKey: [
      'issue-status-counts',
      projectId || null,
      issueTypeId || null,
      priorityId || null,
    ],
    queryFn: () =>
      fetchIssueStatusCounts({
        projectId: projectId || undefined,
        issueTypeId: issueTypeId || undefined,
        priorityId: priorityId || undefined,
      }),
    enabled: canQuery && trackerTab === 'list',
  });

  const { data, isLoading, error } = useIssues(
    {
      projectId: projectId || undefined,
      issueTypeId: issueTypeId || undefined,
      priorityId: priorityId || undefined,
      statusIds: statusFiltering ? statusIds : undefined,
      ...(searching ? { q: deferredSearch } : {}),
      page: searching ? 0 : page,
      size: searching ? Math.max(pageSize, idSearch ? 2000 : 500) : pageSize,
      sort: ['project.name,asc', 'rdNumber,asc', 'childNumber,asc'],
    },
    { enabled: canQuery && trackerTab === 'list' },
  );

  const countsByStatusId = statusCounts?.countsByStatusId ?? {};

  const issues = useMemo(() => {
    const list = canQuery ? (data?.content ?? []) : [];
    return filterIssuesBySearch(list, search);
  }, [canQuery, data, search]);

  const initialLoad = isLoading && !data;

  const summaryLine = useMemo(() => {
    if (!canQuery) return 'Select a project to view your issues.';
    if (trackerTab === 'matrix') {
      return projectId
        ? 'EM status matrix for this project'
        : isAdmin
          ? 'EM status matrix across all projects'
          : 'EM status matrix across my projects';
    }
    if (initialLoad) return 'Loading issues…';
    if (error) return 'Failed to load issues.';

    if (search.trim() || statusFiltering) {
      return `${issues.length} match${issues.length !== 1 ? 'es' : ''}${
        search.trim() ? ` for “${search.trim()}”` : ''
      }`;
    }

    const total = statusCounts?.total ?? data?.totalElements ?? 0;
    const scope = projectId ? 'in this project' : isAdmin ? 'across all projects' : 'across my projects';
    return `${total} issue${total !== 1 ? 's' : ''} ${scope}`;
  }, [
    canQuery,
    trackerTab,
    initialLoad,
    error,
    data,
    statusCounts,
    projectId,
    isAdmin,
    search,
    statusFiltering,
    issues.length,
  ]);

  const handleDeleteIssue = (issue: Issue) => {
    if (
      !window.confirm(
        `Mark "${issue.title}" as deleted?\n\nAll allocations on this issue will also be marked deleted.`,
      )
    ) {
      return;
    }
    setDeletingId(issue.id);
    deleteIssue.mutate(issue.id, {
      onSettled: () => setDeletingId(null),
    });
  };

  const handleExportExcel = async () => {
    if (!canQuery || exporting) return;
    setExporting(true);
    try {
      await exportBacklogExcel({
        projectId: projectId || undefined,
        issueTypeId: issueTypeId || undefined,
        priorityId: priorityId || undefined,
        statusIds: statusFiltering ? statusIds : undefined,
        q: deferredSearch || undefined,
      });
    } catch {
      window.alert('Failed to export backlog Excel. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const selectedProjectLabel = projectsData?.content?.find((p) => p.id === projectId)?.name;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Backlog Tracker</h1>
          <p className="mt-1 text-sm text-text2">{summaryLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canQuery && trackerTab === 'list' && can(P.ISSUES_VIEW) && (
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg3 disabled:opacity-60"
            >
              <Download size={16} />
              {exporting ? 'Exporting…' : 'Export Excel'}
            </button>
          )}
          {can(P.ALLOCATIONS_CREATE) && (
            <Link
              to="/resources"
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg3"
            >
              + Allocate Resource
            </Link>
          )}
          {can(P.ISSUES_CREATE) && (
            <button
              type="button"
              onClick={() => {
                if (projectId) {
                  setCreating(true);
                } else {
                  void navigate('/issues/new');
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium"
              style={{ color: 'var(--accent-fg)' }}
            >
              <Plus size={16} />
              New Item
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        {canQuery && (
          <div className="inline-flex rounded-lg border border-border bg-bg3 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setTrackerTab('list')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                trackerTab === 'list' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setTrackerTab('matrix')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                trackerTab === 'matrix' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              EM matrix
            </button>
          </div>
        )}

        {canQuery && trackerTab === 'list' && <ListViewToggle view={view} onChange={setView} />}

        <label className="text-sm">
          <span className="text-text2">Project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 block min-w-[140px] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">
              {isAdmin ? 'All projects' : isManagerOrAbove ? 'My projects' : 'Select project…'}
            </option>
            {projectsData?.content?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        {trackerTab === 'list' && (
          <>
            <label className="text-sm">
              <span className="text-text2">Type</span>
              <select
                value={issueTypeId}
                onChange={(e) => setIssueTypeId(e.target.value)}
                disabled={!canQuery}
                className="mt-1 block min-w-[120px] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                {issueTypes?.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-text2">Priority</span>
              <select
                value={priorityId}
                onChange={(e) => setPriorityId(e.target.value)}
                disabled={!canQuery}
                className="mt-1 block min-w-[120px] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
              >
                <option value="">All priorities</option>
                {priorities?.map((priority) => (
                  <option key={priority.id} value={priority.id}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>

            <MultiStatusFilter
              statuses={statuses ?? []}
              selectedIds={statusIds}
              onChange={setStatusIds}
              disabled={!canQuery}
            />

            <label className="relative ml-auto text-sm">
              <span className="sr-only">Search</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text2"
              />
              <input
                type="search"
                placeholder="Search title, project, key (SABI-GBL-RD-1)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!canQuery}
                className="mt-1 w-64 rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
              />
            </label>
          </>
        )}
      </div>

      {!canQuery && <p className="mt-8 text-text2">Select a project to view your issues.</p>}

      {canQuery && trackerTab === 'matrix' && (
        <EmCrMatrixTab
          projectId={projectId || undefined}
          enabled={canQuery}
          onIssueClick={(issue) => setSelectedIssueId(issue.id)}
        />
      )}

      {canQuery && trackerTab === 'list' && initialLoad && (
        <p className="mt-8 text-text2">Loading issues…</p>
      )}
      {canQuery && trackerTab === 'list' && error && (
        <p className="mt-8 text-danger">Failed to load issues.</p>
      )}

      {canQuery && trackerTab === 'list' && !initialLoad && !error && (
        <div className="mt-6 space-y-6">
          <RdStatusSummary
            statuses={statuses ?? []}
            countsByStatusId={countsByStatusId}
            selectedStatusIds={statusIds}
            loading={countsFetching && !statusCounts}
            onSelectStatus={(statusId) => setStatusIds(statusId ? [statusId] : [])}
          />

          {data && !search.trim() && (
            <ListPagination
              page={data}
              pageIndex={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="issues"
            />
          )}

          {issues.length === 0 ? (
            <p className="text-sm text-text2">
              {search.trim() || statusFiltering
                ? 'No issues match the current filters.'
                : 'No issues match your filters.'}
            </p>
          ) : view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  canDelete={canDeleteIssue}
                  deleting={deletingId === issue.id}
                  onDelete={handleDeleteIssue}
                  onClick={(item) => setSelectedIssueId(item.id)}
                />
              ))}
            </div>
          ) : (
            <IssueTrackerTable
              issues={issues}
              onIssueClick={(issue) => setSelectedIssueId(issue.id)}
              maxHeightClassName="max-h-[calc(2.75rem+2.75rem*20)]"
            />
          )}
        </div>
      )}

      {creating && projectId && (
        <IssueCreateSlideOverPanel
          projectId={projectId}
          projectLabel={selectedProjectLabel}
          onClose={() => setCreating(false)}
          onCreated={(issueId) => {
            setCreating(false);
            setSelectedIssueId(issueId);
          }}
        />
      )}

      {selectedIssueId && !creating && (
        <IssueSlideOverPanel
          issueId={selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
          onOpenIssue={setSelectedIssueId}
        />
      )}
    </div>
  );
}
