import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Maximize2, X } from 'lucide-react';
import {
  fetchCrStatusMatrix,
  type CrStatusColumn,
  type CrStatusMatrix,
  type CrStatusMatrixRow,
} from '@/api/crMatrix.api';
import { downloadEmCrMatrixExcel, downloadEmCrMatrixPdf } from '@/utils/emCrMatrixExport';
import { IssueTrackerTable } from '@/components/IssueTrackerTable';
import { useIssues } from '@/hooks/useIssues';
import type { Issue } from '@/types';

interface EmMatrixDrillDown {
  /** When set, filter to this project; otherwise use the matrix project scope. */
  projectId?: string;
  /** Empty = all statuses; otherwise multi-status filter (e.g. active = non-terminal). */
  statusIds: string[];
  label: string;
}

interface EmCrMatrixTabProps {
  projectId?: string;
  enabled?: boolean;
  onIssueClick?: (issue: Issue) => void;
}

type DisplayRow = {
  row: CrStatusMatrixRow;
  showEm: boolean;
  em: string;
  isLastInEmGroup: boolean;
};

/** Soft fills matching the DirectFN EM CR spreadsheet status band. */
const STATUS_BG: Record<string, string> = {
  'on hold': '#f8d7da',
  'quotation approved / dev not started': '#e8f0e8',
  'dev in progress': '#ffe8cc',
  'dev completed': '#d4edda',
  'uat testing': '#f5e6c8',
  'sit testing': '#f5e6c8',
  'uat signed off / pending production': '#eef0f2',
  cancelled: '#ffd8b8',
  'in production': '#c3e6cb',
  completed: '#8fd19e',
};

function statusBg(status: CrStatusColumn): string | undefined {
  return STATUS_BG[status.name.trim().toLowerCase()];
}

/** Pastel status fills stay light in every theme — use dark text on those; otherwise theme text. */
function statusTone(status: CrStatusColumn): { background?: string; textClass: string } {
  const background = statusBg(status);
  if (background) {
    return { background, textClass: 'text-slate-900' };
  }
  return { textClass: 'text-text' };
}

function cell(n: number | undefined): string {
  return n && n > 0 ? String(n) : '';
}

function activeStatusIds(statuses: CrStatusColumn[]): string[] {
  return statuses.filter((s) => !s.terminal).map((s) => s.id);
}

function buildDisplayRows(rows: CrStatusMatrixRow[]): DisplayRow[] {
  let lastEm = '\0';
  const mapped = rows.map((row) => {
    const em = row.emName?.trim() || 'Unassigned EM';
    const showEm = em !== lastEm;
    lastEm = em;
    return { row, showEm, em };
  });
  return mapped.map((item, index) => ({
    ...item,
    isLastInEmGroup: index === mapped.length - 1 || mapped[index + 1]!.showEm,
  }));
}

/**
 * Engineering Manager CR/RD status matrix — Excel-style pivot for Backlog Tracker.
 * Clicking a count opens a matching RD grid beneath the matrix (stays on this tab).
 * Full view opens a read-only popup (no number clicks).
 */
export function EmCrMatrixTab({ projectId, enabled = true, onIssueClick }: EmCrMatrixTabProps) {
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<EmMatrixDrillDown | null>(null);
  const [fullViewOpen, setFullViewOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cr-status-matrix', projectId ?? 'all'],
    queryFn: () => fetchCrStatusMatrix(projectId),
    enabled,
  });

  useEffect(() => {
    setDrillDown(null);
  }, [projectId]);

  useEffect(() => {
    if (!fullViewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullViewOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullViewOpen]);

  const drillProjectId = drillDown?.projectId ?? projectId;
  const drillStatusIds = drillDown?.statusIds ?? [];
  const statusFiltering = drillStatusIds.length > 0;

  const {
    data: drillIssuesPage,
    isLoading: drillLoading,
    error: drillError,
  } = useIssues(
    {
      projectId: drillProjectId,
      statusIds: statusFiltering ? drillStatusIds : undefined,
      page: 0,
      size: 2000,
      sort: ['project.name,asc', 'rdNumber,asc', 'childNumber,asc'],
    },
    { enabled: enabled && !!drillDown },
  );

  const drillIssues = drillIssuesPage?.content ?? [];

  const displayRows = useMemo(() => (data?.rows ? buildDisplayRows(data.rows) : []), [data]);

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!data) return;
    setExportError(null);
    setExporting(format);
    try {
      if (format === 'excel') {
        await downloadEmCrMatrixExcel(data);
      } else {
        downloadEmCrMatrixPdf(data);
      }
    } catch {
      setExportError(`Failed to export ${format === 'excel' ? 'Excel' : 'PDF'}.`);
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return <p className="mt-6 text-sm text-text2">Loading EM matrix…</p>;
  }
  if (error) {
    return <p className="mt-6 text-sm text-danger">Failed to load EM status matrix.</p>;
  }
  if (!data || data.rows.length === 0) {
    return <p className="mt-6 text-sm text-text2">No projects with backlog items to show.</p>;
  }

  const statuses = data.statuses;
  const activeIds = activeStatusIds(statuses);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text2">
          One row per project · grouped by EM · click a count to load matching RDs below
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {exportError && <p className="text-xs text-danger">{exportError}</p>}
          <button
            type="button"
            onClick={() => setFullViewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg3"
          >
            <Maximize2 size={14} />
            Full view
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void handleExport('excel')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg3 disabled:opacity-50"
          >
            <Download size={14} />
            {exporting === 'excel' ? 'Preparing…' : 'Excel'}
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void handleExport('pdf')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg3 disabled:opacity-50"
          >
            <Download size={14} />
            {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="max-h-[calc(5.5rem+1.75rem*10)] overflow-auto rounded-lg border border-border bg-bg2 shadow-sm">
        <EmMatrixTable
          data={data}
          displayRows={displayRows}
          activeIds={activeIds}
          onDrillDown={setDrillDown}
        />
      </div>

      {drillDown && (
        <div className="space-y-3 rounded-lg border border-border bg-bg2 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-text">{drillDown.label}</h2>
              <p className="text-xs text-text2">
                {drillLoading
                  ? 'Loading RDs…'
                  : drillError
                    ? 'Failed to load RDs.'
                    : `${drillIssues.length} RD${drillIssues.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrillDown(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-bg3"
            >
              <X size={14} />
              Close
            </button>
          </div>

          {!drillLoading && !drillError && drillIssues.length === 0 && (
            <p className="text-sm text-text2">No RDs match this selection.</p>
          )}
          {!drillLoading && !drillError && drillIssues.length > 0 && (
            <IssueTrackerTable
              issues={drillIssues}
              onIssueClick={onIssueClick}
              maxHeightClassName="max-h-[calc(2.75rem+2.75rem*10)]"
            />
          )}
        </div>
      )}

      {fullViewOpen && (
        <EmMatrixFullViewModal
          data={data}
          displayRows={displayRows}
          onClose={() => setFullViewOpen(false)}
          onExportExcel={() => void handleExport('excel')}
          onExportPdf={() => void handleExport('pdf')}
          exporting={exporting}
        />
      )}
    </div>
  );
}

function EmMatrixFullViewModal({
  data,
  displayRows,
  onClose,
  onExportExcel,
  onExportPdf,
  exporting,
}: {
  data: CrStatusMatrix;
  displayRows: DisplayRow[];
  onClose: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  exporting: 'excel' | 'pdf' | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close full view"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="em-matrix-full-view-title"
        className="relative z-10 flex h-full w-full max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-bg2 shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="em-matrix-full-view-title" className="text-lg font-bold">
              EM status matrix
            </h2>
            <p className="text-xs text-text2">Full view · read-only (counts are not clickable)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!!exporting}
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg3 disabled:opacity-50"
            >
              <Download size={14} />
              {exporting === 'excel' ? 'Preparing…' : 'Excel'}
            </button>
            <button
              type="button"
              disabled={!!exporting}
              onClick={onExportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg3 disabled:opacity-50"
            >
              <Download size={14} />
              {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-bg3"
            >
              <X size={14} />
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <EmMatrixTable data={data} displayRows={displayRows} />
        </div>
      </div>
    </div>
  );
}

function EmMatrixTable({
  data,
  displayRows,
  activeIds = [],
  onDrillDown,
}: {
  data: CrStatusMatrix;
  displayRows: DisplayRow[];
  activeIds?: string[];
  onDrillDown?: (filter: EmMatrixDrillDown) => void;
}) {
  const statuses = data.statuses;
  const interactive = !!onDrillDown;

  return (
    <table className="min-w-max border-collapse text-left text-[11px] text-text">
      <thead className="sticky top-0 z-10">
        <tr className="bg-bg3">
          <MetaHead>EM</MetaHead>
          <MetaHead>Architect</MetaHead>
          <MetaHead>Country</MetaHead>
          <MetaHead>Client</MetaHead>
          <MetaHead>NTP/GBL</MetaHead>
          <MetaHead>PM</MetaHead>
          <MetaHead>DM</MetaHead>
          <MetaHead className="text-center">Total CR</MetaHead>
          <MetaHead className="text-center">Active CR</MetaHead>
          {statuses.map((status) => {
            const tone = statusTone(status);
            return (
              <th
                key={status.id}
                className={`max-w-[5.5rem] border border-border bg-bg3 px-1.5 py-2 text-center align-top font-semibold leading-tight ${tone.textClass}`}
                style={tone.background ? { background: tone.background } : undefined}
                title={status.name}
              >
                {status.name}
              </th>
            );
          })}
        </tr>
        <tr className="bg-[#1e3a5f] font-semibold text-white">
          <td className="border border-[#16304f] bg-[#1e3a5f] px-2 py-1 text-white" colSpan={7}>
            Totals
          </td>
          <td className="border border-[#16304f] bg-[#1e3a5f] px-2 py-1 text-center tabular-nums text-white">
            <CountCell
              value={data.totals.totalCr}
              alwaysShow
              className="text-white"
              title={interactive ? 'Show all RDs below' : undefined}
              onClick={
                interactive
                  ? () => onDrillDown({ statusIds: [], label: 'All RDs' })
                  : undefined
              }
            />
          </td>
          <td className="border border-[#16304f] bg-[#1e3a5f] px-2 py-1 text-center tabular-nums text-white">
            <CountCell
              value={data.totals.activeCr}
              alwaysShow
              className="text-white"
              title={interactive ? 'Show active RDs below' : undefined}
              onClick={
                interactive
                  ? () =>
                      onDrillDown({
                        statusIds: activeIds,
                        label: 'Active RDs',
                      })
                  : undefined
              }
            />
          </td>
          {statuses.map((status) => (
            <td
              key={`total-${status.id}`}
              className="border border-[#16304f] bg-[#1e3a5f] px-1.5 py-1 text-center tabular-nums text-white"
            >
              <CountCell
                value={data.totals.statusCounts[status.id]}
                className="text-white"
                title={interactive ? `Show ${status.name} RDs below` : undefined}
                onClick={
                  interactive
                    ? () =>
                        onDrillDown({
                          statusIds: [status.id],
                          label: status.name,
                        })
                    : undefined
                }
              />
            </td>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayRows.map(({ row, showEm, em, isLastInEmGroup }) => (
          <MatrixDataRow
            key={row.projectId}
            row={row}
            emLabel={showEm ? em : ''}
            statuses={statuses}
            activeIds={activeIds}
            isLastInEmGroup={isLastInEmGroup}
            onDrillDown={onDrillDown}
          />
        ))}
      </tbody>
    </table>
  );
}

function MetaHead({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap border border-border bg-bg3 px-2 py-2 align-top font-semibold text-text ${className}`}
    >
      {children}
    </th>
  );
}

function CountCell({
  value,
  onClick,
  title,
  alwaysShow = false,
  className = '',
}: {
  value: number | undefined;
  onClick?: () => void;
  title?: string;
  alwaysShow?: boolean;
  className?: string;
}) {
  const n = value ?? 0;
  const label = alwaysShow ? String(n) : cell(n);
  if (!label) return null;
  if (!onClick || n <= 0) {
    return <span className={className}>{label}</span>;
  }
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`cursor-pointer rounded-sm underline decoration-dotted underline-offset-2 hover:font-bold hover:decoration-solid focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${className}`}
    >
      {label}
    </button>
  );
}

function MatrixDataRow({
  row,
  emLabel,
  statuses,
  activeIds,
  isLastInEmGroup,
  onDrillDown,
}: {
  row: CrStatusMatrixRow;
  emLabel: string;
  statuses: CrStatusColumn[];
  activeIds: string[];
  isLastInEmGroup: boolean;
  onDrillDown?: (filter: EmMatrixDrillDown) => void;
}) {
  const groupEnd = isLastInEmGroup ? 'border-b-[3px] border-b-border-strong' : '';
  const metaClass = `border border-border bg-bg3 px-2 py-1 whitespace-nowrap text-text ${groupEnd}`;
  const numClass = `border border-border bg-bg2 px-2 py-1 text-center tabular-nums text-text ${groupEnd}`;
  const projectId = row.projectId;
  const projectName = row.projectName;
  return (
    <tr className="hover:bg-bg3/80">
      <td className={`${metaClass} font-medium`}>{emLabel}</td>
      <td className={metaClass}>{row.architectName ?? ''}</td>
      <td className={metaClass}>{row.countryName ?? ''}</td>
      <td className={metaClass}>{row.clientName ?? ''}</td>
      <td className={metaClass}>{row.product ?? ''}</td>
      <td className={metaClass}>{row.pmName ?? ''}</td>
      <td className={metaClass}>{row.dmName ?? ''}</td>
      <td className={`${numClass} font-semibold`}>
        <CountCell
          value={row.totalCr}
          alwaysShow
          className="text-text"
          title={onDrillDown ? `Show all RDs for ${projectName}` : undefined}
          onClick={
            onDrillDown
              ? () =>
                  onDrillDown({
                    projectId,
                    statusIds: [],
                    label: `${projectName} · All RDs`,
                  })
              : undefined
          }
        />
      </td>
      <td className={numClass}>
        <CountCell
          value={row.activeCr}
          alwaysShow
          className="text-text"
          title={onDrillDown ? `Show active RDs for ${projectName}` : undefined}
          onClick={
            onDrillDown
              ? () =>
                  onDrillDown({
                    projectId,
                    statusIds: activeIds,
                    label: `${projectName} · Active RDs`,
                  })
              : undefined
          }
        />
      </td>
      {statuses.map((status) => {
        const tone = statusTone(status);
        return (
          <td
            key={status.id}
            className={`border border-border bg-bg2 px-1.5 py-1 text-center tabular-nums ${tone.textClass} ${groupEnd}`}
            style={tone.background ? { background: tone.background } : undefined}
          >
            <CountCell
              value={row.statusCounts[status.id]}
              className={tone.textClass}
              title={onDrillDown ? `Show ${status.name} RDs for ${projectName}` : undefined}
              onClick={
                onDrillDown
                  ? () =>
                      onDrillDown({
                        projectId,
                        statusIds: [status.id],
                        label: `${projectName} · ${status.name}`,
                      })
                  : undefined
              }
            />
          </td>
        );
      })}
    </tr>
  );
}
