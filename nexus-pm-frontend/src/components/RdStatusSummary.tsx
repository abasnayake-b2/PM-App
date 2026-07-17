import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { IssueStatus } from '@/api/lookup.api';

interface RdStatusSummaryProps {
  statuses: IssueStatus[];
  countsByStatusId: Record<string, number>;
  selectedStatusIds: string[];
  onSelectStatus: (statusId: string | null) => void;
  loading?: boolean;
}

type OverviewTab = 'pipeline' | 'groups';

const COLS = 6;
const SIDE_STATUSES = new Set(['cancelled', 'on hold']);

/** Legend rows: display label → exact issue_status.name in seed/DB. */
const OWNER_GROUPS: { title: string; rows: { label: string; match: string }[] }[] = [
  {
    title: 'Change Request With Client',
    rows: [
      { label: 'Requirements Initiated', match: 'Requirements Initiated' },
      { label: 'Pending High level BRD Approval', match: 'Pending BP Effort Approval' },
      { label: 'On Hold', match: 'On Hold' },
      { label: 'Pending Quotation Approval', match: 'Pending Quotation Approval' },
      { label: 'Pending Approval BP Effort', match: 'Pending BP Effort' },
      { label: 'Pending RD Approval', match: 'Pending RD Approval' },
      { label: 'RD Sign off', match: 'RD Signed Off' },
      { label: 'Cancelled', match: 'Cancelled' },
    ],
  },
  {
    title: 'Change Request With DFN',
    rows: [
      { label: 'Initial Requirement Gathering', match: 'Initial Requirement Gathering' },
      { label: 'Pending High level BRD Preparation', match: 'Pending BP Effort' },
      {
        label: 'Ballpark Accepted / Detail Requirement not started',
        match: 'Ballpark Accepted',
      },
      { label: 'RD Drafting', match: 'RD Drafting' },
      { label: 'Pending to Share Quotation', match: 'Pending Quotation Preparation' },
      {
        label: 'Quotation Approved / Dev not started',
        match: 'Quotation Approved / Dev not started',
      },
    ],
  },
  {
    title: 'Change Requests in Implementation',
    rows: [
      { label: 'Development in Progress', match: 'Dev in Progress' },
      { label: 'Development Completed', match: 'Dev Completed' },
      { label: 'SIT Testing', match: 'SIT Testing' },
      { label: 'UAT Testing', match: 'UAT Testing' },
      {
        label: 'UAT Signed off / Pending Production',
        match: 'UAT Signed Off / Pending Production',
      },
      { label: 'In Production', match: 'In Production' },
      { label: 'Completed', match: 'Completed' },
    ],
  },
];

/**
 * RD status overview — Pipeline (zigzag) or By owner (Client / DFN / Implementation).
 * Click a stage to filter the backlog grid.
 */
export function RdStatusSummary({
  statuses,
  countsByStatusId,
  selectedStatusIds,
  onSelectStatus,
  loading = false,
}: RdStatusSummaryProps) {
  const [view, setView] = useState<OverviewTab>('pipeline');

  const statusByName = useMemo(() => {
    const map = new Map<string, IssueStatus>();
    for (const s of statuses) {
      map.set(s.name.trim().toLowerCase(), s);
    }
    return map;
  }, [statuses]);

  const { flow, side } = useMemo(() => {
    const ordered = [...statuses].sort((a, b) => a.sequence - b.sequence);
    return {
      flow: ordered.filter((s) => !SIDE_STATUSES.has(s.name.trim().toLowerCase())),
      side: ordered.filter((s) => SIDE_STATUSES.has(s.name.trim().toLowerCase())),
    };
  }, [statuses]);

  const rows = useMemo(() => {
    const chunks: IssueStatus[][] = [];
    for (let i = 0; i < flow.length; i += COLS) {
      chunks.push(flow.slice(i, i + COLS));
    }
    return chunks;
  }, [flow]);

  const activeId = selectedStatusIds.length === 1 ? selectedStatusIds[0] : null;
  const multiActive = selectedStatusIds.length > 1;
  const filterActive = Boolean(activeId || multiActive);

  const totalCount = useMemo(
    () => Object.values(countsByStatusId).reduce((sum, n) => sum + n, 0),
    [countsByStatusId],
  );

  const handleClick = (statusId: string) => {
    if (activeId === statusId && !multiActive) {
      onSelectStatus(null);
      return;
    }
    onSelectStatus(statusId);
  };

  if (statuses.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-bg2 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-text">RD status overview</h3>
          <p className="mt-0.5 text-xs text-text2">
            {totalCount} item{totalCount !== 1 ? 's' : ''} · click a stage to filter the grid
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filterActive && (
            <button
              type="button"
              onClick={() => onSelectStatus(null)}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent-muted"
            >
              Clear filter
            </button>
          )}
          <div className="inline-flex rounded-lg border border-border bg-bg3 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView('pipeline')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                view === 'pipeline' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              Pipeline
            </button>
            <button
              type="button"
              onClick={() => setView('groups')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                view === 'groups' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              By owner
            </button>
          </div>
        </div>
      </header>

      <div className={`overflow-visible px-3 py-3 sm:px-5 ${loading ? 'opacity-60' : ''}`}>
        {view === 'pipeline' ? (
          <PipelineView
            rows={rows}
            side={side}
            countsByStatusId={countsByStatusId}
            selectedStatusIds={selectedStatusIds}
            filterActive={filterActive}
            onClick={handleClick}
          />
        ) : (
          <OwnerGroupsView
            statusByName={statusByName}
            countsByStatusId={countsByStatusId}
            selectedStatusIds={selectedStatusIds}
            filterActive={filterActive}
            onClick={handleClick}
          />
        )}
      </div>
    </section>
  );
}

function PipelineView({
  rows,
  side,
  countsByStatusId,
  selectedStatusIds,
  filterActive,
  onClick,
}: {
  rows: IssueStatus[][];
  side: IssueStatus[];
  countsByStatusId: Record<string, number>;
  selectedStatusIds: string[];
  filterActive: boolean;
  onClick: (statusId: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        {rows.map((row, rowIndex) => {
          const rtl = rowIndex % 2 === 1;
          const items = rtl ? [...row].reverse() : row;
          const hasNext = rowIndex < rows.length - 1;
          const emptySlots = Math.max(0, COLS - items.length);

          return (
            <div key={rowIndex}>
              <div className="flex items-stretch">
                {rtl &&
                  Array.from({ length: emptySlots }).map((_, i) => (
                    <div key={`empty-l-${i}`} className="min-w-0 flex-1" />
                  ))}

                {items.map((status, index) => {
                  const count = countsByStatusId[status.id] ?? 0;
                  const selected = selectedStatusIds.includes(status.id);
                  const isFlowEnd = rtl ? index === 0 : index === items.length - 1;
                  const showTurn = isFlowEnd && hasNext;
                  const showChevron = index < items.length - 1;
                  return (
                    <div key={status.id} className="flex min-w-0 flex-1 items-stretch">
                      <div className="relative min-w-0 flex-1">
                        <StatusCell
                          step={String(status.sequence).padStart(2, '0')}
                          label={status.name}
                          count={count}
                          colour={status.colour}
                          selected={selected}
                          dimmed={filterActive && !selected}
                          onClick={() => onClick(status.id)}
                        />
                        {showTurn && <CurvedTurn side={rtl ? 'left' : 'right'} />}
                      </div>
                      {!showChevron ? null : (
                        <span
                          className="mx-px flex w-3 shrink-0 items-center justify-center text-[#C45C26] sm:w-3.5"
                          aria-hidden
                        >
                          {rtl ? (
                            <ChevronLeft size={14} strokeWidth={2.5} />
                          ) : (
                            <ChevronRight size={14} strokeWidth={2.5} />
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}

                {!rtl &&
                  Array.from({ length: emptySlots }).map((_, i) => (
                    <div key={`empty-r-${i}`} className="min-w-0 flex-1" />
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {side.length > 0 && (
        <div className="mt-5 border-t border-dashed border-border pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text2">
            Parked
          </p>
          <div className="flex max-w-xl gap-2">
            {side.map((status) => {
              const count = countsByStatusId[status.id] ?? 0;
              const selected = selectedStatusIds.includes(status.id);
              return (
                <div key={status.id} className="min-w-0 flex-1">
                  <StatusCell
                    step={null}
                    label={status.name}
                    count={count}
                    colour={status.colour}
                    selected={selected}
                    dimmed={filterActive && !selected}
                    onClick={() => onClick(status.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function OwnerGroupsView({
  statusByName,
  countsByStatusId,
  selectedStatusIds,
  filterActive,
  onClick,
}: {
  statusByName: Map<string, IssueStatus>;
  countsByStatusId: Record<string, number>;
  selectedStatusIds: string[];
  filterActive: boolean;
  onClick: (statusId: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {OWNER_GROUPS.map((group) => (
        <div
          key={group.title}
          className="overflow-hidden rounded-md border border-border bg-bg2 shadow-sm"
        >
          <div className="border-b border-border bg-[#E9E7E1] px-3 py-2 text-center text-xs font-semibold text-text">
            {group.title}
          </div>
          <table className="w-full border-collapse text-left text-xs">
            <tbody>
              {group.rows.map((row, index) => {
                const status = statusByName.get(row.match.trim().toLowerCase());
                const count = status ? (countsByStatusId[status.id] ?? 0) : 0;
                const selected = status ? selectedStatusIds.includes(status.id) : false;
                const disabled = !status;
                return (
                  <tr key={`${group.title}-${row.match}`}>
                    <td className="w-8 border-b border-border bg-bg3 px-2 py-1.5 text-center font-semibold tabular-nums text-text2">
                      {index + 1}
                    </td>
                    <td className="border-b border-border p-0">
                      <button
                        type="button"
                        disabled={disabled}
                        title={
                          disabled
                            ? `Status not configured: ${row.match}`
                            : `${row.label}: ${count} — click to filter`
                        }
                        onClick={() => status && onClick(status.id)}
                        className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition ${
                          selected
                            ? 'bg-accent-muted font-medium text-text ring-inset ring-1 ring-accent/30'
                            : 'bg-bg2 text-text hover:bg-bg3'
                        } ${filterActive && !selected ? 'opacity-50' : ''} ${
                          disabled ? 'cursor-not-allowed opacity-40' : ''
                        }`}
                      >
                        <span className="min-w-0 leading-snug">{row.label}</span>
                        <span
                          className={`shrink-0 rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums dark:bg-bg3 ${
                            count > 0 ? 'text-text' : 'text-text2'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function CurvedTurn({ side }: { side: 'left' | 'right' }) {
  const stroke = '#C45C26';
  const common = {
    fill: 'none' as const,
    stroke,
    strokeWidth: 1.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (side === 'right') {
    return (
      <span
        className="pointer-events-none absolute left-full top-[72%] z-10 -ml-px"
        aria-hidden
      >
        <svg width="11" height="34" viewBox="0 0 11 34" className="overflow-visible">
          <path {...common} d="M1 1 H6 C9 1 10 2.5 10 5 V24 C10 27.5 9 29 6 29 H3" />
          <path {...common} d="M6 26 L2 29 L6 32" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="pointer-events-none absolute right-full top-[72%] z-10 -mr-px"
      aria-hidden
    >
      <svg width="11" height="34" viewBox="0 0 11 34" className="overflow-visible">
        <path {...common} d="M10 1 H5 C2 1 1 2.5 1 5 V24 C1 27.5 2 29 5 29 H8" />
        <path {...common} d="M5 26 L9 29 L5 32" />
      </svg>
    </span>
  );
}

function StatusCell({
  step,
  label,
  count,
  colour,
  selected,
  dimmed,
  onClick,
}: {
  step: string | null;
  label: string;
  count: number;
  colour?: string;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${count} — click to filter`}
      className={`flex w-full min-w-0 overflow-hidden rounded-md border text-left transition ${
        selected
          ? 'border-accent shadow-sm ring-2 ring-accent/20'
          : 'border-border hover:border-border-strong hover:shadow-sm'
      } ${dimmed ? 'opacity-40' : ''}`}
    >
      <span
        className="w-[3px] shrink-0 self-stretch"
        style={{ background: colour || 'var(--border-strong)' }}
        aria-hidden
      />
      <span className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center gap-0.5 bg-[#E9E7E1] px-1.5 py-1.5 dark:bg-bg3">
        {step && (
          <span className="text-[9px] font-bold tabular-nums leading-none text-text2">{step}.</span>
        )}
        <span className="line-clamp-2 text-[10px] font-medium leading-snug text-[#1c1c1c] dark:text-text">
          {label}
        </span>
      </span>
      <span className="flex w-8 shrink-0 items-center justify-center border-l border-border bg-white dark:bg-bg2 sm:w-9">
        <span
          className={`text-sm font-semibold tabular-nums leading-none ${
            count > 0 ? 'text-text' : 'text-text2'
          }`}
        >
          {count}
        </span>
      </span>
    </button>
  );
}
