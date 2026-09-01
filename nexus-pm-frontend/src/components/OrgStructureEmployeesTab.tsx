import { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Search } from 'lucide-react';
import { TeamRosterMemberForm } from '@/components/TeamRosterMemberForm';
import { TeamRosterMemberPanel } from '@/components/TeamRosterMemberPanel';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import {
  RosterMemberFilterBar,
  useRosterMemberFilters,
} from '@/components/RosterMemberFilterBar';
import {
  useTeamRosterMembers,
  useUpdateTeamRosterMember,
} from '@/hooks/useTeamRoster';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { TeamRosterMember } from '@/api/teamRoster.api';
import { downloadRosterExcel, downloadRosterPdf } from '@/utils/orgStructureRosterExport';

const HEADERS = [
  '#',
  'Name',
  'Code',
  'Designation',
  'Team',
  'EM',
  'NTP/GBL',
  'Country',
  'Product',
  'Skills',
  'Exp. total',
  'DFN',
  'Email',
  'Tel',
];

export function OrgStructureEmployeesTab() {
  const { can } = usePermissions();
  const canEdit = can(P.TEAM_UPDATE);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamRosterMember | null>(null);
  const [selected, setSelected] = useState<TeamRosterMember | null>(null);

  const { data: rows = [], isLoading, error } = useTeamRosterMembers(search);
  const filters = useRosterMemberFilters(rows);
  const visibleRows = filters.filteredRows;
  const updateRow = useUpdateTeamRosterMember(editing?.id ?? '');

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const exportRows = useMemo(
    () =>
      visibleRows.map((row, index) => [
        index + 1,
        row.fullName,
        row.designationCode ?? '',
        row.designation ?? '',
        row.teamName ?? '',
        row.engineeringManagerName ?? '',
        row.workType ?? '',
        row.country ?? '',
        row.product ?? '',
        row.skillNames?.join(', ') ?? '',
        row.totalYearsOfExperience != null ? String(row.totalYearsOfExperience) : '',
        row.experienceInDfn != null ? String(row.experienceInDfn) : '',
        row.email ?? '',
        row.phone ?? '',
      ]),
    [visibleRows],
  );

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExportError(null);
    setExporting(format);
    try {
      if (format === 'excel') {
        await downloadRosterExcel({
          title: 'Engineers',
          sheetName: 'Engineers',
          filenamePrefix: 'org-structure-engineers',
          headers: HEADERS,
          rows: exportRows,
          columnWidths: [6, 26, 10, 28, 22, 24, 12, 14, 16, 22, 12, 10, 28, 14],
        });
      } else {
        downloadRosterPdf({
          title: 'Engineers',
          filenamePrefix: 'org-structure-engineers',
          headers: HEADERS,
          rows: exportRows,
        });
      }
    } catch (err) {
      console.error(err);
      setExportError('Could not export engineers. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const openEdit = (row: TeamRosterMember) => {
    setSelected(null);
    setEditing(row);
  };

  const closeEdit = () => setEditing(null);

  const cellClass = 'whitespace-nowrap px-4 py-2';
  const colCount = HEADERS.length + (canEdit ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[14rem] flex-1 flex-col gap-3">
          <label className="text-sm">
            <span className="text-text2">Search</span>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text2" size={16} />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, VP, EM, designation, team, skills, product, country…"
                className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>
          <RosterMemberFilterBar filters={filters} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Download size={14} className="text-text2" />
          <button
            type="button"
            disabled={!!exporting || visibleRows.length === 0}
            onClick={() => void handleExport('excel')}
            className="text-accent hover:underline disabled:opacity-50"
          >
            {exporting === 'excel' ? 'Preparing…' : 'Excel'}
          </button>
          <span className="text-text2">/</span>
          <button
            type="button"
            disabled={!!exporting || visibleRows.length === 0}
            onClick={() => void handleExport('pdf')}
            className="text-accent hover:underline disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      {exportError && <p className="text-sm text-danger">{exportError}</p>}
      {isLoading && <p className="text-text2">Loading engineers…</p>}
      {error && <p className="text-danger">Failed to load engineer roster.</p>}

      {!isLoading && !error && (
        <div className="rounded-xl border border-border">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-max min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
                <tr className="whitespace-nowrap">
                  {HEADERS.map((header) => (
                    <th
                      key={header}
                      className={header === '#' ? 'w-12 px-3 py-2 text-center' : 'px-4 py-2'}
                    >
                      {header}
                    </th>
                  ))}
                  {canEdit && <th className="px-4 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className="border-t border-border hover:bg-bg2/50">
                    <td className="whitespace-nowrap px-3 py-2 text-center text-xs tabular-nums text-text2">
                      {index + 1}
                    </td>
                    <td className={cellClass}>
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="max-w-[220px] truncate font-medium text-accent hover:underline"
                        title={row.fullName}
                      >
                        {row.fullName}
                      </button>
                    </td>
                    <td className={`${cellClass} text-text2`}>{row.designationCode ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.designation ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.teamName ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.engineeringManagerName ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.workType ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.country ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.product ?? '—'}</td>
                    <td
                      className={`${cellClass} max-w-[180px] truncate text-text2`}
                      title={row.skillNames?.length ? row.skillNames.join(', ') : undefined}
                    >
                      {row.skillNames?.length ? row.skillNames.join(', ') : '—'}
                    </td>
                    <td className={`${cellClass} text-text2`}>
                      {row.totalYearsOfExperience != null ? row.totalYearsOfExperience : '—'}
                    </td>
                    <td className={`${cellClass} text-text2`}>
                      {row.experienceInDfn != null ? row.experienceInDfn : '—'}
                    </td>
                    <td className={`${cellClass} text-text2`}>{row.email ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.phone ?? '—'}</td>
                    {canEdit && (
                      <td className={cellClass}>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded p-1 text-text2 hover:bg-bg3"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="px-4 py-8 text-center text-text2">
                      {filters.hasFilters || search
                        ? 'No engineers match the current search or filters.'
                        : 'No engineers.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-text2">
            {visibleRows.length} engineer{visibleRows.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
            {filters.hasFilters ? ' with filters applied' : ''}
          </p>
        </div>
      )}

      {selected && (
        <TeamRosterMemberPanel
          member={selected}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
      )}

      {editing && canEdit && (
        <SlideOverPanel title={`Edit ${editing.fullName}`} subtitle="Engineer" onClose={closeEdit} wide>
          <TeamRosterMemberForm
            key={editing.id}
            initial={editing}
            lockName
            loading={updateRow.isPending}
            onCancel={closeEdit}
            onSubmit={(payload) => {
              updateRow.mutate(payload, {
                onSuccess: () => {
                  closeEdit();
                  setSelected(null);
                },
              });
            }}
          />
        </SlideOverPanel>
      )}
    </div>
  );
}
