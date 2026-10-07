import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useTeamManagement } from '@/hooks/useTeamRoster';
import type { TeamManagement } from '@/api/teamRoster.api';
import { partitionManagementRoster } from '@/utils/managementRoles';
import { downloadRosterExcel, downloadRosterPdf } from '@/utils/orgStructureRosterExport';
import { isActiveRosterStatus } from '@/utils/rosterStatus';

const HEADERS = ['#', 'Name', 'Role', 'First name', 'Last name', 'Supervisor', 'Status'];
const EXPORT_HEADERS = ['#', 'Category', ...HEADERS.slice(1)];

const SECTIONS: {
  key: keyof ReturnType<typeof partitionManagementRoster>;
  title: string;
  description: string;
  empty: string;
}[] = [
  {
    key: 'cLevel',
    title: 'C-level',
    description: 'CEO, COO, CTO, CPO, CXO, and other chief roles.',
    empty: 'No C-level records yet.',
  },
  {
    key: 'vp',
    title: 'VP',
    description: 'Vice presidents and VP-level roles.',
    empty: 'No VP records yet.',
  },
  {
    key: 'engineering',
    title: 'Engineering Managers',
    description: 'Software engineering managers, SEM / Sr SEM, and similar engineering management roles.',
    empty: 'No engineering manager records yet.',
  },
  {
    key: 'delivery',
    title: 'Delivery Managers',
    description: 'Software delivery managers and other delivery management roles.',
    empty: 'No delivery manager records yet.',
  },
  {
    key: 'coe',
    title: 'COE Managers',
    description: 'COE managers and Center of Excellence management roles.',
    empty: 'No COE manager records yet.',
  },
  {
    key: 'other',
    title: 'Other',
    description:
      'Leadership records that do not match C-level, VP, engineering manager, delivery manager, or COE manager titles.',
    empty: 'No other leadership records.',
  },
];

function toExportRow(row: TeamManagement, index: number, category: string): (string | number)[] {
  return [
    index + 1,
    category,
    row.fullName,
    row.roleTitle,
    row.firstName,
    row.lastName,
    row.supervisorFullName ?? row.supervisorName ?? '',
    row.status,
  ];
}

function LeadershipGrid({
  title,
  description,
  rows,
  emptyMessage,
  search,
}: {
  title: string;
  description: string;
  rows: TeamManagement[];
  emptyMessage: string;
  search: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
      </div>
      <div className="rounded-xl border border-border">
        <div className="max-h-[min(50vh,520px)] overflow-auto">
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
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-border hover:bg-bg2/50">
                  <td className="whitespace-nowrap px-3 py-2 text-center text-xs tabular-nums text-text2">
                    {index + 1}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{row.fullName}</td>
                  <td className="whitespace-nowrap px-4 py-2">{row.roleTitle}</td>
                  <td className="whitespace-nowrap px-4 py-2">{row.firstName}</td>
                  <td className="whitespace-nowrap px-4 py-2">{row.lastName}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-text2">
                    {row.supervisorFullName ?? row.supervisorName ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{row.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={HEADERS.length} className="px-4 py-8 text-center text-text2">
                    {search ? `No ${title.toLowerCase()} matching "${search}".` : emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-xs text-text2">
          {rows.length} {title.toLowerCase()} record{rows.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      </div>
    </section>
  );
}

export function OrgStructureManagersTab() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: managementRows = [], isLoading, error } = useTeamManagement(search);
  const rows = useMemo(
    () => managementRows.filter((row) => isActiveRosterStatus(row.status)),
    [managementRows],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const groups = useMemo(() => partitionManagementRoster(rows), [rows]);

  const visibleSections = useMemo(
    () => SECTIONS.filter((section) => section.key !== 'other' || groups.other.length > 0),
    [groups.other.length],
  );

  const exportRows = useMemo(
    () =>
      visibleSections.flatMap((section) =>
        groups[section.key].map((row, index) => toExportRow(row, index, section.title)),
      ),
    [groups, visibleSections],
  );

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExportError(null);
    setExporting(format);
    try {
      if (format === 'excel') {
        await downloadRosterExcel({
          title: 'Leadership',
          sheetName: 'Leadership',
          filenamePrefix: 'org-structure-leadership',
          headers: EXPORT_HEADERS,
          rows: exportRows,
          columnWidths: [6, 24, 28, 34, 16, 16, 28, 12],
        });
      } else {
        downloadRosterPdf({
          title: 'Leadership',
          filenamePrefix: 'org-structure-leadership',
          headers: EXPORT_HEADERS,
          rows: exportRows,
        });
      }
    } catch (err) {
      console.error(err);
      setExportError('Could not export leadership. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-[14rem] flex-1 text-sm">
          <span className="text-text2">Search</span>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text2" size={16} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, role, supervisor…"
              className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Download size={14} className="text-text2" />
          <button
            type="button"
            disabled={!!exporting || rows.length === 0}
            onClick={() => void handleExport('excel')}
            className="text-accent hover:underline disabled:opacity-50"
          >
            {exporting === 'excel' ? 'Preparing…' : 'Excel'}
          </button>
          <span className="text-text2">/</span>
          <button
            type="button"
            disabled={!!exporting || rows.length === 0}
            onClick={() => void handleExport('pdf')}
            className="text-accent hover:underline disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      {exportError && <p className="text-sm text-danger">{exportError}</p>}
      {isLoading && <p className="text-text2">Loading leadership…</p>}
      {error && <p className="text-danger">Failed to load leadership roster.</p>}

      {!isLoading && !error && (
        <div className="space-y-8">
          {visibleSections.map((section) => (
            <LeadershipGrid
              key={section.key}
              title={section.title}
              description={section.description}
              rows={groups[section.key]}
              emptyMessage={section.empty}
              search={search}
            />
          ))}
        </div>
      )}
    </div>
  );
}
