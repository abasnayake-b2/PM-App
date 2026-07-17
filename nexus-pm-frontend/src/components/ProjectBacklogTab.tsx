import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { BacklogExcelUpload } from '@/components/BacklogExcelUpload';
import { IssueTrackerTable } from '@/components/IssueTrackerTable';
import { IssueSlideOverPanel } from '@/components/IssueSlideOverPanel';
import { IssueCreateSlideOverPanel } from '@/components/IssueCreateSlideOverPanel';
import { RdStatusSummary } from '@/components/RdStatusSummary';
import { ListPagination } from '@/components/ListPagination';
import { MultiStatusFilter } from '@/components/MultiStatusFilter';
import { fetchPriorities, fetchIssueTypes, fetchIssueStatuses } from '@/api/lookup.api';
import { useIssues } from '@/hooks/useIssues';
import { filterIssuesBySearch } from '@/utils/issueUi';

interface ProjectBacklogTabProps {
  projectId: string;
  projectLabel?: string;
  canImportBacklog: boolean;
  canCreateIssue: boolean;
}

/**
 * Project-scoped backlog — RD status board filters the grid; search is local.
 */
export function ProjectBacklogTab({
  projectId,
  projectLabel,
  canImportBacklog,
  canCreateIssue,
}: ProjectBacklogTabProps) {
  const [issueTypeId, setIssueTypeId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [statusIds, setStatusIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: priorities } = useQuery({ queryKey: ['priorities'], queryFn: fetchPriorities });
  const { data: issueTypes } = useQuery({ queryKey: ['issue-types'], queryFn: fetchIssueTypes });
  const { data: statuses } = useQuery({ queryKey: ['issue-statuses'], queryFn: fetchIssueStatuses });

  const searching = search.trim().length > 0;
  const statusFiltering = statusIds.length > 0;

  useEffect(() => {
    setPage(0);
  }, [issueTypeId, priorityId, statusIds.join(','), search, pageSize]);

  // Full project backlog (minus status filter) — powers the status board counts.
  const { data: countData, isFetching: countsFetching } = useIssues({
    projectId,
    unreleasedOnly: true,
    issueTypeId: issueTypeId || undefined,
    priorityId: priorityId || undefined,
    page: 0,
    size: 2000,
    sort: ['rdNumber,asc', 'childNumber,asc'],
  });

  const { data, isLoading, isFetching, error, refetch } = useIssues({
    projectId,
    unreleasedOnly: true,
    issueTypeId: issueTypeId || undefined,
    priorityId: priorityId || undefined,
    statusIds: statusFiltering ? statusIds : undefined,
    page: searching ? 0 : page,
    size: searching ? Math.max(pageSize, 2000) : pageSize,
    sort: ['rdNumber,asc', 'childNumber,asc'],
  });

  const countsByStatusId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const issue of countData?.content ?? []) {
      if (!issue.statusId) continue;
      map[issue.statusId] = (map[issue.statusId] ?? 0) + 1;
    }
    return map;
  }, [countData]);

  const issues = useMemo(() => {
    const list = data?.content ?? [];
    return filterIssuesBySearch(list, search);
  }, [data, search]);

  const initialLoad = isLoading && !data;
  const showEmpty = !initialLoad && !error && issues.length === 0;
  const showTable = !initialLoad && !error && issues.length > 0;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text2">
          {searching || statusFiltering
            ? `${issues.length} match${issues.length !== 1 ? 'es' : ''} in this project`
            : `${data?.totalElements ?? countData?.totalElements ?? 0} backlog item${
                (data?.totalElements ?? countData?.totalElements ?? 0) !== 1 ? 's' : ''
              } not yet assigned to a release`}
          {isFetching && data ? ' …' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(countData?.totalElements ?? 0) > 0 && canImportBacklog && (
            <BacklogExcelUpload
              variant="project"
              projectId={projectId}
              projectLabel={projectLabel}
              compact
              onImported={() => void refetch()}
            />
          )}
          {canCreateIssue && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium"
              style={{ color: 'var(--accent-fg)' }}
            >
              <Plus size={16} />
              New item
            </button>
          )}
        </div>
      </div>

      <RdStatusSummary
        statuses={statuses ?? []}
        countsByStatusId={countsByStatusId}
        selectedStatusIds={statusIds}
        loading={countsFetching && !countData}
        onSelectStatus={(statusId) => setStatusIds(statusId ? [statusId] : [])}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-text2">Type</span>
          <select
            value={issueTypeId}
            onChange={(e) => setIssueTypeId(e.target.value)}
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
        />

        <label className="relative ml-auto text-sm">
          <span className="sr-only">Search this project</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text2"
          />
          <input
            type="search"
            placeholder="Search title, assignee, key (…-RD-1)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-64 rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      {initialLoad && <p className="text-text2">Loading backlog…</p>}
      {error && <p className="text-danger">Failed to load backlog.</p>}

      {showTable && (
        <>
          {!searching && data && (
            <ListPagination
              page={data}
              pageIndex={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="backlog items"
            />
          )}
          <IssueTrackerTable
            issues={issues}
            hideProject
            onIssueClick={(issue) => setSelectedIssueId(issue.id)}
            maxHeightClassName="max-h-[calc(2.75rem+2.75rem*20)]"
          />
        </>
      )}

      {creating && (
        <IssueCreateSlideOverPanel
          projectId={projectId}
          projectLabel={projectLabel}
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

      {showEmpty && (
        <div className="space-y-4">
          {!searching && !statusFiltering && canImportBacklog && (
            <BacklogExcelUpload
              variant="project"
              projectId={projectId}
              projectLabel={projectLabel}
              onImported={() => void refetch()}
            />
          )}
          <p className="text-sm text-text2">
            {searching || statusFiltering ? (
              <>No items in this project match the current filters.</>
            ) : (
              <>
                No backlog items yet.
                {canImportBacklog && ' Upload your RD Excel above or'}
                {canCreateIssue && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="text-accent hover:underline"
                    >
                      create one
                    </button>
                    .
                  </>
                )}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
