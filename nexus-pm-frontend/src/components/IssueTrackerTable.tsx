import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import type { Issue } from '@/types';
import { PriorityBadge } from '@/components/PriorityBadge';
import { StatusPill } from '@/components/StatusPill';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { issueAssigneeName, issueDisplayKey, filterIssuesBySearch } from '@/utils/issueUi';
import { buildIssueTreeRows, collectParentIdsWithChildren } from '@/utils/issueTree';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteIssue } from '@/hooks/useIssues';
import { P } from '@/utils/permissions';
import {
  buildBacklogColumns,
  CATEGORY_THEME,
  customFieldKey,
  type BacklogColumn,
  type BacklogDensity,
} from '@/utils/backlogGridColumns';

interface IssueTrackerTableProps {
  issues: Issue[];
  hideProject?: boolean;
  /** Live search text — filters the table immediately. */
  searchQuery?: string;
  /** When set, ID/title open this callback instead of navigating to the full issue page. */
  onIssueClick?: (issue: Issue) => void;
  /** Cap height and enable vertical scroll (e.g. ~10 rows under EM matrix). */
  maxHeightClassName?: string;
  /** Default density for the RD-style grid. */
  defaultDensity?: BacklogDensity;
}

function deleteConfirmMessage(issue: Issue, hasChildren: boolean): string {
  const lines = [
    `Mark "${issue.title}" as deleted?`,
    '',
    'All allocations on this issue will also be marked deleted.',
  ];
  if (hasChildren) {
    lines.push('', 'Child items under this item will remain in the backlog.');
  }
  return lines.join('\n');
}

function cfValue(issue: Issue, key: string): string {
  const value = issue.customFields?.[key];
  return value != null && String(value).trim() !== '' ? String(value) : '—';
}

function formatCellDate(value: string): string {
  if (!value || value === '—') return '—';
  // Prefer readable date when ISO YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m[2]) - 1] ?? m[2];
  return `${m[3]}-${month}-${m[1]}`;
}

export function IssueTrackerTable({
  issues,
  hideProject = false,
  searchQuery = '',
  onIssueClick,
  maxHeightClassName,
  defaultDensity = 'compact',
}: IssueTrackerTableProps) {
  const { can } = usePermissions();
  const canDeleteIssue = can(P.ISSUES_DELETE);
  const deleteIssue = useDeleteIssue({ redirectTo: false });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [density, setDensity] = useState<BacklogDensity>(defaultDensity);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const syncing = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);

  const { columns, categorySpans } = useMemo(
    () => buildBacklogColumns({ hideProject, density }),
    [hideProject, density],
  );

  const visibleIssues = useMemo(
    () => filterIssuesBySearch(issues, searchQuery),
    [issues, searchQuery],
  );

  const parentIdsWithChildren = useMemo(
    () => collectParentIdsWithChildren(visibleIssues),
    [visibleIssues],
  );
  const treeRows = useMemo(
    () => buildIssueTreeRows(visibleIssues, collapsedIds),
    [visibleIssues, collapsedIds],
  );

  const measureScrollWidth = () => {
    const table = tableRef.current;
    if (table) {
      setScrollWidth(table.scrollWidth);
    }
  };

  useLayoutEffect(() => {
    measureScrollWidth();
  }, [treeRows, columns, density, hideProject, canDeleteIssue]);

  useEffect(() => {
    const onResize = () => measureScrollWidth();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const syncFrom = (source: 'top' | 'body') => {
    if (syncing.current) return;
    const top = topScrollRef.current;
    const body = bodyScrollRef.current;
    if (!top || !body) return;
    syncing.current = true;
    if (source === 'top') {
      body.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = body.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  const toggleCollapsed = (issueId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());
  const collapseAll = () => setCollapsedIds(new Set(parentIdsWithChildren));

  const hasHierarchy = parentIdsWithChildren.length > 0;
  const compact = density === 'compact';
  const cellPad = compact ? 'px-2 py-1' : 'px-3 py-2.5';
  const headPad = compact ? 'px-2 py-1' : 'px-3 py-2';
  const textSize = compact ? 'text-xs' : 'text-sm';

  const handleDelete = (issue: Issue, hasChildren: boolean) => {
    if (!window.confirm(deleteConfirmMessage(issue, hasChildren))) {
      return;
    }
    setDeletingId(issue.id);
    deleteIssue.mutate(issue.id, {
      onSettled: () => setDeletingId(null),
    });
  };

  const renderCell = (column: BacklogColumn, issue: Issue, depth: number, hasChildren: boolean, childCount: number) => {
    const theme = CATEGORY_THEME[column.category];
    const isCollapsed = collapsedIds.has(issue.id);
    const base = compact
      ? `${cellPad} border-b border-border align-middle`
      : `${cellPad} ${theme.cell} border-r border-black/5 align-middle`;
    const stickyId = column.key === 'displayKey' && !compact ? 'sticky left-0 z-[1]' : '';

    switch (column.key) {
      case 'displayKey': {
        return (
          <td
            key={column.key}
            className={`${base} ${stickyId} font-mono ${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'text-text2' : theme.text}`}
          >
            <div
              className="flex min-w-0 items-center gap-0.5"
              style={{ paddingLeft: `${depth * (compact ? 0.75 : 1.1)}rem` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleCollapsed(issue.id)}
                  className="inline-flex shrink-0 rounded p-0.5 text-text2 hover:bg-bg3 hover:text-text"
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `Expand ${issue.title}` : `Collapse ${issue.title}`}
                >
                  {isCollapsed ? <ChevronRight size={compact ? 14 : 16} /> : <ChevronDown size={compact ? 14 : 16} />}
                </button>
              ) : (
                <span className="inline-block w-4 shrink-0" aria-hidden />
              )}
              {onIssueClick ? (
                <button
                  type="button"
                  onClick={() => onIssueClick(issue)}
                  className="shrink-0 text-left hover:text-accent"
                >
                  {issueDisplayKey(issue)}
                </button>
              ) : (
                <Link to={`/issues/${issue.id}`} className="shrink-0 hover:text-accent">
                  {issueDisplayKey(issue)}
                </Link>
              )}
              {hasChildren && isCollapsed && (
                <span className="shrink-0 rounded-full bg-bg3 px-1 py-0.5 text-[10px] font-sans text-text2">
                  {childCount}
                </span>
              )}
            </div>
          </td>
        );
      }
      case 'title':
        return (
          <td key={column.key} className={`${base} max-w-xs font-medium ${theme.text}`}>
            {onIssueClick ? (
              <button type="button" onClick={() => onIssueClick(issue)} className="text-left hover:text-accent">
                <span className={compact ? 'line-clamp-1' : 'line-clamp-2'}>{issue.title}</span>
              </button>
            ) : (
              <Link to={`/issues/${issue.id}`} className="hover:text-accent">
                <span className={compact ? 'line-clamp-1' : 'line-clamp-2'}>{issue.title}</span>
              </Link>
            )}
          </td>
        );
      case 'description':
        return (
          <td key={column.key} className={`${base} max-w-sm text-text2`}>
            <span className={compact ? 'line-clamp-1' : 'line-clamp-2'}>
              {issue.description?.trim() ? issue.description : '—'}
            </span>
          </td>
        );
      case 'status':
        return (
          <td key={column.key} className={base}>
            <StatusPill label={issue.statusName ?? '—'} colour={issue.statusColour} />
          </td>
        );
      case 'priority':
        return (
          <td key={column.key} className={base}>
            <PriorityBadge label={issue.priorityLabel ?? '—'} colour={issue.priorityColour} />
          </td>
        );
      case 'type':
        return (
          <td key={column.key} className={`${base} text-text2`}>
            <IssueTypeIcon
              name={issue.issueTypeName}
              workflowCode={issue.issueTypeWorkflowCode}
              size={compact ? 12 : 14}
              showLabel
            />
          </td>
        );
      case 'project':
        return (
          <td key={column.key} className={`${base} text-text2`}>
            {issue.projectName ?? '—'}
          </td>
        );
      case 'capitalizable':
        return (
          <td key={column.key} className={`${base} text-text2`}>
            {issue.capitalizable == null ? '—' : issue.capitalizable ? 'Yes' : 'No'}
          </td>
        );
      case 'assignee': {
        const assignee = issueAssigneeName(issue);
        return (
          <td key={column.key} className={base}>
            {assignee ? (
              <div className="flex items-center gap-1.5">
                {!compact && <ResourceAvatar name={assignee.split(',')[0].trim()} size="sm" />}
                <span className={`text-text2 ${compact ? 'line-clamp-1' : ''}`}>{assignee}</span>
              </div>
            ) : (
              <span className="text-text2">Unassigned</span>
            )}
          </td>
        );
      }
      case 'utilization':
        return (
          <td key={column.key} className={`${base} text-text2`}>
            {issue.utilizationPct != null && issue.utilizationPct > 0 ? (
              <span
                className={
                  issue.utilizationPct >= 100
                    ? 'font-medium text-danger'
                    : issue.utilizationPct >= 80
                      ? 'font-medium text-warning'
                      : ''
                }
              >
                {issue.utilizationPct}%
              </span>
            ) : (
              '—'
            )}
          </td>
        );
      default: {
        const fieldKey = customFieldKey(column.key);
        if (!fieldKey) return <td key={column.key} className={base}>—</td>;
        const raw = cfValue(issue, fieldKey);
        const looksDate = fieldKey.includes('_date') || fieldKey.endsWith('_eta');
        const display = looksDate ? formatCellDate(raw) : raw;
        return (
          <td key={column.key} className={`${base} whitespace-nowrap text-text2`}>
            <span className={compact ? 'line-clamp-1' : fieldKey.includes('description') || fieldKey === 'notes' || fieldKey === 'risk_mitigation' ? 'line-clamp-2 whitespace-normal' : ''}>
              {display}
            </span>
          </td>
        );
      }
    }
  };

  const actionColSpan = canDeleteIssue ? 1 : 0;
  const totalColSpan = columns.length + actionColSpan;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-bg3 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setDensity('compact')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
              density === 'compact' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
            }`}
            title="Show key columns only"
          >
            <Minimize2 size={13} />
            Compact
          </button>
          <button
            type="button"
            onClick={() => setDensity('expanded')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
              density === 'expanded' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
            }`}
            title="Show all RD fields"
          >
            <Maximize2 size={13} />
            Expanded
          </button>
        </div>

        {hasHierarchy && (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border border-border px-3 py-1.5 text-text2 hover:bg-bg3 hover:text-text"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-border px-3 py-1.5 text-text2 hover:bg-bg3 hover:text-text"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      {/* Top horizontal scrollbar — mainly useful in expanded view */}
      <div
        ref={topScrollRef}
        className={`overflow-x-auto overflow-y-hidden rounded-t-xl border border-b-0 border-border bg-bg2 ${
          density === 'compact' ? 'hidden' : ''
        }`}
        onScroll={() => syncFrom('top')}
        aria-label="Horizontal scroll"
      >
        <div style={{ width: Math.max(scrollWidth, 1), height: 10 }} />
      </div>

      <div
        ref={bodyScrollRef}
        onScroll={() => syncFrom('body')}
        className={`border border-border ${
          density === 'compact' ? 'rounded-xl' : 'rounded-b-xl'
        } ${maxHeightClassName ? `${maxHeightClassName} overflow-auto` : 'overflow-x-auto'}`}
      >
        <table
          ref={tableRef}
          className={`border-collapse text-left ${textSize} ${
            density === 'compact' ? 'w-full min-w-0' : 'w-max min-w-full'
          }`}
        >
          <thead className={maxHeightClassName ? 'sticky top-0 z-10' : ''}>
            {categorySpans.length > 0 && (
              <tr>
                {categorySpans.map(({ category, span }) => {
                  const theme = CATEGORY_THEME[category];
                  return (
                    <th
                      key={category}
                      colSpan={span}
                      className={`${headPad} border-b border-r border-black/10 text-center text-[10px] font-bold uppercase tracking-wider ${theme.banner}`}
                    >
                      {category}
                    </th>
                  );
                })}
                {canDeleteIssue && (
                  <th
                    className={`${headPad} border-b border-black/10 bg-slate-200 text-center text-[10px] font-bold uppercase tracking-wider text-slate-800`}
                  >
                    Actions
                  </th>
                )}
              </tr>
            )}
            <tr>
              {columns.map((column) => {
                const theme = CATEGORY_THEME[column.category];
                const headerClass =
                  density === 'compact'
                    ? `${headPad} ${column.minWidth} border-b border-border bg-bg2 text-[10px] font-semibold uppercase tracking-wide text-text2`
                    : `${headPad} ${column.minWidth} border-b border-r border-black/10 text-[10px] font-semibold uppercase tracking-wide ${theme.header} ${
                        column.sticky ? 'sticky left-0 z-[2]' : ''
                      }`;
                return (
                  <th key={column.key} className={headerClass}>
                    {column.header}
                  </th>
                );
              })}
              {canDeleteIssue && (
                <th
                  className={
                    density === 'compact'
                      ? `${headPad} w-14 border-b border-border bg-bg2 text-[10px] font-semibold uppercase tracking-wide text-text2`
                      : `${headPad} w-14 border-b border-black/10 bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-700`
                  }
                >
                  {density === 'compact' ? 'Actions' : 'Del'}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {treeRows.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan} className="px-4 py-6 text-center text-text2">
                  No issues to display.
                </td>
              </tr>
            ) : (
              treeRows.map(({ issue, depth, hasChildren, childCount }) => (
                <tr key={issue.id} className="border-t border-border/80 hover:brightness-[0.98]">
                  {columns.map((column) => renderCell(column, issue, depth, hasChildren, childCount))}
                  {canDeleteIssue && (
                    <td className={`${cellPad} ${compact ? '' : 'bg-slate-50/80'} align-middle`}>
                      <button
                        type="button"
                        onClick={() => handleDelete(issue, hasChildren)}
                        disabled={deletingId === issue.id}
                        className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
                        title="Delete item"
                        aria-label={`Delete ${issue.title}`}
                      >
                        <Trash2 size={compact ? 14 : 16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
