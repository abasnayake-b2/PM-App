import { useMemo, useRef, useState, type RefObject, type UIEvent } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Users } from 'lucide-react';
import { SlideOverListPanel } from '@/components/SlideOverListPanel';
import type {
  AllocationHeatmap,
  CapacityUtilisationDashboard,
  EmOrgBreakdownRow,
  EmOrgEngineerItem,
  GroupMember,
  GroupUtilisationBar,
  OrgBreakdownProject,
  UtilisationBand,
  UtilisationBands,
} from '@/types';
import type { SlideOverEntry, SlideOverGroup } from '@/utils/breakdownProjects';
import {
  groupBreakdownProjects,
  groupEngineersByDesignation,
} from '@/utils/breakdownProjects';

type BreakdownPanel = {
  title: string;
  subtitle: string;
  items?: SlideOverEntry[];
  groups?: SlideOverGroup[];
};

/** Shared row height so EM table and heatmap stay visually aligned. */
const ALIGNED_ROW = 'h-11';
const ALIGNED_HEADER = 'h-[4.75rem]';
const ALIGNED_THEAD = 'h-10';

function normalizeName(name?: string | null) {
  return (name ?? '').trim().toLowerCase();
}

function dedupeMembers(members: GroupMember[]): GroupMember[] {
  const seen = new Set<string>();
  const out: GroupMember[] = [];
  for (const member of members) {
    const key = member.employeeId || normalizeName(member.employeeName);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(member);
  }
  return out;
}

type CombinedEmRow = {
  key: string;
  name: string;
  isAll: boolean;
  util?: GroupUtilisationBar;
  org?: EmOrgBreakdownRow;
  avgPct: number;
  engineerCount: number;
  projectCount: number;
  engineers: EmOrgEngineerItem[];
  projects: OrgBreakdownProject[];
};

const BAND_COLORS: Record<string, string> = {
  zero: 'bg-slate-300',
  low: 'bg-emerald-400',
  mid: 'bg-sky-400',
  full: 'bg-amber-400',
  over: 'bg-rose-500',
};

function bandList(bands: UtilisationBands): UtilisationBand[] {
  return [bands.zero, bands.low, bands.mid, bands.full, bands.over];
}

function heatmapColor(pct: number): string {
  if (pct <= 0) return 'heat-cell heat-cell-0';
  if (pct <= 50) return 'heat-cell heat-cell-low';
  if (pct < 100) return 'heat-cell heat-cell-mid';
  if (pct === 100) return 'heat-cell heat-cell-full';
  return 'heat-cell heat-cell-over';
}

function UtilisationBandsChart({
  bands,
  peopleCount,
  weeksLabel = '12 weeks',
}: {
  bands: UtilisationBands;
  peopleCount: number;
  weeksLabel?: string;
}) {
  const items = bandList(bands);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Utilisation bands</h3>
          <p className="mt-1 text-sm text-text2">
            Share of {peopleCount} people by average allocation over the next {weeksLabel}
          </p>
        </div>
      </div>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-bg3">
        {items.map((band) =>
          band.count > 0 ? (
            <div
              key={band.key}
              className={`${BAND_COLORS[band.key] ?? 'bg-slate-300'}`}
              style={{ width: `${Math.max(band.pctOfPeople, band.count > 0 ? 2 : 0)}%` }}
              title={`${band.label}: ${band.count} (${band.pctOfPeople}%)`}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((band) => (
          <li key={band.key} className="rounded-lg border border-border bg-bg3/40 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-text2">
              <span className={`h-2.5 w-2.5 rounded-sm ${BAND_COLORS[band.key] ?? 'bg-slate-300'}`} />
              {band.label}
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">{band.count}</p>
            <p className="text-xs text-text2">{band.pctOfPeople}% of people</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function memberToEntry(member: GroupMember): SlideOverEntry {
  const projects = member.projects?.length ? member.projects.join(' · ') : 'No projects';
  return {
    label: member.employeeName,
    meta:
      member.allocatedPct > 0
        ? `${member.allocatedPct}% allocated · ${projects}`
        : `${member.freePct}% free · ${member.teamName ?? 'No team'}`,
  };
}

export function CombinedEmUtilisationTable({
  utilRows,
  emBreakdown = [],
  onOpenBreakdown,
  scrollRef,
  onBodyScroll,
  compactHeader = false,
  weeksLabel = '12 weeks',
}: {
  utilRows: GroupUtilisationBar[];
  emBreakdown?: EmOrgBreakdownRow[];
  onOpenBreakdown?: (panel: BreakdownPanel) => void;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onBodyScroll?: (event: UIEvent<HTMLDivElement>) => void;
  compactHeader?: boolean;
  weeksLabel?: string;
}) {
  const [selected, setSelected] = useState<GroupUtilisationBar | null>(null);

  const combined = useMemo(() => {
    const utilByName = new Map(utilRows.map((row) => [normalizeName(row.name), row]));
    const orgByName = new Map(emBreakdown.map((row) => [normalizeName(row.emName), row]));
    const names = new Set([...utilByName.keys(), ...orgByName.keys()]);

    const emRows: CombinedEmRow[] = [...names]
      .map((key) => {
        const util = utilByName.get(key);
        const org = orgByName.get(key);
        const name = util?.name ?? org?.emName ?? key;
        return {
          key,
          name,
          isAll: false,
          util,
          org,
          avgPct: util?.avgPct ?? 0,
          engineerCount: org?.engineerCount ?? util?.peopleCount ?? 0,
          projectCount: org?.projectCount ?? 0,
          engineers: org?.engineers ?? [],
          projects: org?.projects ?? [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const peopleTotal = utilRows.reduce((sum, row) => sum + row.peopleCount, 0);
    const weightedAvg = peopleTotal
      ? Math.round(utilRows.reduce((sum, row) => sum + row.avgPct * row.peopleCount, 0) / peopleTotal)
      : 0;

    const allEngineers = emRows.flatMap((row) => row.engineers);
    const allProjects = emRows.flatMap((row) => row.projects);
    const uniqueEngineers = (() => {
      const seen = new Set<string>();
      return allEngineers.filter((item) => {
        const key = normalizeName(item.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })();
    const uniqueProjects = (() => {
      const seen = new Set<string>();
      return allProjects.filter((item) => {
        const key = normalizeName(item.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })();

    const allocated = dedupeMembers(utilRows.flatMap((row) => row.allocatedMembers ?? []));
    const unallocated = dedupeMembers(utilRows.flatMap((row) => row.unallocatedMembers ?? []));
    const engineerFallback = peopleTotal || emRows.reduce((sum, row) => sum + row.engineerCount, 0);

    const allUtil: GroupUtilisationBar = {
      name: 'All',
      avgPct: weightedAvg,
      peopleCount: peopleTotal || engineerFallback,
      overAllocatedCount: utilRows.reduce((sum, row) => sum + row.overAllocatedCount, 0),
      allocatedMembers: allocated,
      unallocatedMembers: unallocated,
    };

    const allRow: CombinedEmRow = {
      key: '__all__',
      name: 'All',
      isAll: true,
      util: utilRows.length > 0 ? allUtil : undefined,
      avgPct: weightedAvg,
      engineerCount: uniqueEngineers.length || engineerFallback,
      projectCount: uniqueProjects.length || emRows.reduce((sum, row) => sum + row.projectCount, 0),
      engineers: uniqueEngineers,
      projects: uniqueProjects,
    };

    return [allRow, ...emRows];
  }, [utilRows, emBreakdown]);

  const maxPct = Math.max(100, ...combined.map((row) => row.avgPct), 1);

  const panelGroups: SlideOverGroup[] = useMemo(() => {
    if (!selected) return [];
    return [
      {
        title: `Allocated (${selected.allocatedMembers?.length ?? 0})`,
        items: (selected.allocatedMembers ?? []).map(memberToEntry),
      },
      {
        title: `Not allocated (${selected.unallocatedMembers?.length ?? 0})`,
        items: (selected.unallocatedMembers ?? []).map(memberToEntry),
      },
    ];
  }, [selected]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
        <div
          className={`flex shrink-0 flex-col justify-center border-b border-border px-5 ${ALIGNED_HEADER}`}
        >
          <h3 className="font-semibold">By Engineering Manager</h3>
          {!compactHeader && (
            <p className="mt-1 text-sm text-text2">
              Engineers, projects, and avg utilisation over the next {weeksLabel} — click a bar for
              allocated vs free
            </p>
          )}
          {compactHeader && (
            <p className="mt-1 text-sm text-text2">
              Next {weeksLabel} · click a bar for allocated vs free
            </p>
          )}
        </div>
        {combined.length <= 1 && !combined[0]?.util && combined[0]?.engineerCount === 0 ? (
          <p className="px-5 py-6 text-sm text-text2">No engineering manager data.</p>
        ) : (
          <div
            ref={scrollRef}
            onScroll={onBodyScroll}
            className="min-h-0 flex-1 overflow-auto"
          >
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-9" />
                <col className="w-[15rem]" />
                <col className="w-12" />
                <col className="w-12" />
                <col />
              </colgroup>
              <thead className="sticky top-0 z-[1] bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
                <tr className={ALIGNED_THEAD}>
                  <th className="px-2">#</th>
                  <th className="px-2">EM</th>
                  <th className="px-1.5 text-right">Eng</th>
                  <th className="px-1.5 text-right">Proj</th>
                  <th className="px-2">Utilisation</th>
                </tr>
              </thead>
              <tbody>
                {combined.map((row, index) => {
                  const widthPct = Math.min((row.avgPct / maxPct) * 100, 100);
                  const barColor =
                    row.avgPct > 100 ? 'bg-rose-500' : row.avgPct >= 90 ? 'bg-amber-400' : 'bg-sky-500';
                  const displayIndex = row.isAll ? '—' : String(index);
                  return (
                    <tr
                      key={row.key}
                      className={`border-t border-border hover:bg-bg2/40 ${row.isAll ? 'bg-bg2/30 font-medium' : ''}`}
                    >
                      <td className={`px-2 tabular-nums text-text2 ${ALIGNED_ROW}`}>{displayIndex}</td>
                      <td className={`whitespace-nowrap px-2 ${ALIGNED_ROW}`} title={row.name}>
                        {row.name}
                      </td>
                      <td className={`px-1.5 text-right tabular-nums ${ALIGNED_ROW}`}>
                        {onOpenBreakdown && row.engineers.length > 0 ? (
                          <button
                            type="button"
                            className="font-semibold text-accent hover:underline"
                            onClick={() =>
                              onOpenBreakdown({
                                title: 'Engineers',
                                subtitle: row.name,
                                groups: groupEngineersByDesignation(row.engineers),
                              })
                            }
                          >
                            {row.engineerCount}
                          </button>
                        ) : (
                          row.engineerCount
                        )}
                      </td>
                      <td className={`px-1.5 text-right tabular-nums ${ALIGNED_ROW}`}>
                        {onOpenBreakdown && row.projects.length > 0 ? (
                          <button
                            type="button"
                            className="font-semibold text-accent hover:underline"
                            onClick={() =>
                              onOpenBreakdown({
                                title: 'Projects',
                                subtitle: row.name,
                                groups: groupBreakdownProjects(row.projects),
                              })
                            }
                          >
                            {row.projectCount}
                          </button>
                        ) : (
                          row.projectCount
                        )}
                      </td>
                      <td className={`px-2 ${ALIGNED_ROW}`}>
                        <button
                          type="button"
                          disabled={!row.util}
                          onClick={() => row.util && setSelected(row.util)}
                          className="group relative flex h-8 w-full items-center overflow-hidden rounded-md bg-bg3 text-left ring-offset-2 enabled:hover:ring-2 enabled:hover:ring-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
                          title={
                            row.util
                              ? `View allocated and non-allocated people for ${row.name}`
                              : 'No utilisation data'
                          }
                        >
                          <div
                            className={`absolute inset-y-0 left-0 ${barColor} transition group-hover:brightness-110`}
                            style={{ width: `${Math.max(widthPct, row.avgPct > 0 ? 6 : 0)}%` }}
                          />
                          <span className="relative z-[1] flex w-full items-center justify-between gap-2 px-2 text-xs font-semibold">
                            <span className={widthPct > 22 ? 'text-white' : 'text-text'}>
                              {row.avgPct}%
                            </span>
                            <span
                              className={`truncate text-[11px] font-medium ${
                                widthPct > 55 ? 'text-white/90' : 'text-text2'
                              }`}
                            >
                              {(row.util?.allocatedMembers?.length ?? 0)} alloc ·{' '}
                              {(row.util?.unallocatedMembers?.length ?? 0)} free
                            </span>
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <SlideOverListPanel
          title={selected.name}
          subtitle={`${selected.avgPct}% average utilisation · ${selected.peopleCount} people`}
          groups={panelGroups}
          emptyMessage="No people in this group."
          defaultExpanded
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export function GroupBarsChart({
  title,
  subtitle,
  rows,
  className = '',
}: {
  title: string;
  subtitle: string;
  rows: GroupUtilisationBar[];
  className?: string;
}) {
  const [selected, setSelected] = useState<GroupUtilisationBar | null>(null);
  const maxPct = Math.max(100, ...rows.map((row) => row.avgPct), 1);

  const panelGroups: SlideOverGroup[] = useMemo(() => {
    if (!selected) return [];
    return [
      {
        title: `Allocated (${selected.allocatedMembers?.length ?? 0})`,
        items: (selected.allocatedMembers ?? []).map(memberToEntry),
      },
      {
        title: `Not allocated (${selected.unallocatedMembers?.length ?? 0})`,
        items: (selected.unallocatedMembers ?? []).map(memberToEntry),
      },
    ];
  }, [selected]);

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-text2">{subtitle}</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-text2">No group data.</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {rows.map((row) => {
              const widthPct = Math.min((row.avgPct / maxPct) * 100, 100);
              const barColor =
                row.avgPct > 100 ? 'bg-rose-500' : row.avgPct >= 90 ? 'bg-amber-400' : 'bg-sky-500';
              return (
                <li key={row.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{row.name}</span>
                    <span className="shrink-0 tabular-nums text-text2">
                      {row.peopleCount} people
                      {row.overAllocatedCount > 0 ? ` · ${row.overAllocatedCount} over` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    className="group relative flex h-11 w-full items-center overflow-hidden rounded-xl bg-bg3 text-left ring-offset-2 hover:ring-2 hover:ring-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    title={`View allocated and non-allocated people for ${row.name}`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${barColor} transition group-hover:brightness-110`}
                      style={{ width: `${Math.max(widthPct, row.avgPct > 0 ? 8 : 0)}%` }}
                    />
                    <span className="relative z-[1] flex w-full items-center justify-between gap-3 px-3 text-sm font-semibold">
                      <span className={widthPct > 35 ? 'text-white' : 'text-text'}>
                        {row.avgPct}% avg
                      </span>
                      <span className={`text-xs font-medium ${widthPct > 70 ? 'text-white/90' : 'text-text2'}`}>
                        {(row.allocatedMembers?.length ?? 0)} allocated ·{' '}
                        {(row.unallocatedMembers?.length ?? 0)} free
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected && (
        <SlideOverListPanel
          title={selected.name}
          subtitle={`${selected.avgPct}% average utilisation · ${selected.peopleCount} people`}
          groups={panelGroups}
          emptyMessage="No people in this group."
          defaultExpanded
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export function AllocationHeatmapGrid({
  heatmap,
  orderedLabels,
  hideGroupColumn = false,
  scrollRef,
  onBodyScroll,
}: {
  heatmap: AllocationHeatmap;
  /** When set, rows follow this order (e.g. All + EM names matching the left table). */
  orderedLabels?: string[];
  hideGroupColumn?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onBodyScroll?: (event: UIEvent<HTMLDivElement>) => void;
}) {
  const rows = useMemo(() => {
    const weekCount = heatmap.weekLabels.length;
    const zeros = () => Array.from({ length: weekCount }, () => 0);
    const byLabel = new Map(heatmap.rows.map((row) => [normalizeName(row.label), row]));

    if (!orderedLabels?.length) {
      return heatmap.rows;
    }

    const ordered = orderedLabels.map((label) => {
      const existing = byLabel.get(normalizeName(label));
      if (existing) {
        return existing;
      }
      // EM present in org/util table but not in capacity heatmap — keep rows aligned.
      return { label, values: zeros() };
    });

    const used = new Set(ordered.map((row) => normalizeName(row.label)));
    const rest = heatmap.rows.filter((row) => !used.has(normalizeName(row.label)));
    return [...ordered, ...rest];
  }, [heatmap.rows, heatmap.weekLabels.length, orderedLabels]);

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div
        className={`flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 ${ALIGNED_HEADER}`}
      >
        <div>
          <h3 className="font-semibold">Allocation heatmap</h3>
          <p className="mt-1 text-sm text-text2">
            Avg utilisation by EM · next {heatmap.weekLabels.length} weeks
          </p>
        </div>
        <div className="hidden flex-wrap gap-1.5 text-[10px] text-text2 sm:flex">
          <span className="heat-cell heat-cell-0 rounded px-1.5 py-0.5">0</span>
          <span className="heat-cell heat-cell-low rounded px-1.5 py-0.5">1–50</span>
          <span className="heat-cell heat-cell-mid rounded px-1.5 py-0.5">51–99</span>
          <span className="heat-cell heat-cell-full rounded px-1.5 py-0.5">100</span>
          <span className="heat-cell heat-cell-over rounded px-1.5 py-0.5">&gt;100</span>
        </div>
      </div>
      <div ref={scrollRef} onScroll={onBodyScroll} className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-[1] bg-bg2">
            <tr className={ALIGNED_THEAD}>
              {!hideGroupColumn && (
                <th className="sticky left-0 z-[1] bg-bg2 px-2 font-medium text-text2">EM</th>
              )}
              {heatmap.weekLabels.map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className="min-w-[2.75rem] px-0.5 text-center font-medium text-text2"
                  title={heatmap.weekStarts[index]}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={`border-t border-border ${
                  normalizeName(row.label) === 'all' ? 'bg-bg2/30 font-medium' : ''
                }`}
              >
                {!hideGroupColumn && (
                  <th
                    className={`sticky left-0 z-[1] min-w-[9rem] max-w-[12rem] bg-bg2 px-2 text-left font-medium ${ALIGNED_ROW}`}
                    title={row.label}
                  >
                    {row.label}
                  </th>
                )}
                {row.values.map((value, index) => (
                  <td key={`${row.label}-${index}`} className={`p-0.5 ${ALIGNED_ROW}`}>
                    <div
                      className={`flex h-8 items-center justify-center rounded tabular-nums ${heatmapColor(value)}`}
                      title={`${row.label} · ${heatmap.weekLabels[index]}: ${value}%`}
                    >
                      {value > 0 ? value : '—'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Side-by-side EM utilisation + heatmap with matching All row, order, height, and scroll. */
export function EmUtilisationWithHeatmap({
  utilRows,
  emBreakdown = [],
  heatmap,
  onOpenBreakdown,
  weeksLabel = '12 weeks',
}: {
  utilRows: GroupUtilisationBar[];
  emBreakdown?: EmOrgBreakdownRow[];
  heatmap?: AllocationHeatmap;
  onOpenBreakdown?: (panel: BreakdownPanel) => void;
  weeksLabel?: string;
}) {
  const emScrollRef = useRef<HTMLDivElement>(null);
  const heatScrollRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const orderedLabels = useMemo(() => {
    const utilByName = new Map(utilRows.map((row) => [normalizeName(row.name), row.name]));
    const orgByName = new Map(emBreakdown.map((row) => [normalizeName(row.emName), row.emName]));
    const names = new Set([...utilByName.keys(), ...orgByName.keys()]);
    const emNames = [...names]
      .map((key) => utilByName.get(key) ?? orgByName.get(key) ?? key)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return ['All', ...emNames];
  }, [utilRows, emBreakdown]);

  const syncScroll = (source: 'em' | 'heat') => (event: UIEvent<HTMLDivElement>) => {
    if (syncing.current) return;
    syncing.current = true;
    const top = event.currentTarget.scrollTop;
    const other = source === 'em' ? heatScrollRef.current : emScrollRef.current;
    if (other) other.scrollTop = top;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  return (
    <div className="grid min-h-[28rem] gap-4 xl:grid-cols-2 xl:items-stretch">
      <CombinedEmUtilisationTable
        utilRows={utilRows}
        emBreakdown={emBreakdown}
        onOpenBreakdown={onOpenBreakdown}
        scrollRef={emScrollRef}
        onBodyScroll={syncScroll('em')}
        compactHeader
        weeksLabel={weeksLabel}
      />
      {heatmap && (
        <AllocationHeatmapGrid
          heatmap={heatmap}
          orderedLabels={orderedLabels}
          scrollRef={heatScrollRef}
          onBodyScroll={syncScroll('heat')}
        />
      )}
    </div>
  );
}

interface CapacityUtilisationSectionProps {
  data?: CapacityUtilisationDashboard;
  isLoading?: boolean;
  error?: boolean;
  /** When false, omit team bars (e.g. already shown beside Organisation overview). */
  showTeamBars?: boolean;
  /** When false, omit heatmap (e.g. already shown beside By Engineering Manager). */
  showHeatmap?: boolean;
  weeksLabel?: string;
}

export function CapacityUtilisationSection({
  data,
  isLoading,
  error,
  showTeamBars = true,
  showHeatmap = true,
  weeksLabel = '12 weeks',
}: CapacityUtilisationSectionProps) {
  if (isLoading) {
    return <p className="text-sm text-text2">Loading capacity utilisation…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">Failed to load capacity utilisation.</p>;
  }
  if (!data) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-accent" />
          <div>
            <h2 className="text-lg font-semibold">Capacity &amp; utilisation</h2>
            <p className="text-sm text-text2">
              As of {data.asOf} · next {weeksLabel} · {data.peopleCount} people in scope
            </p>
          </div>
        </div>
        <Link
          to="/resources"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bg3"
        >
          <Users size={14} />
          Open Resource Utilization
        </Link>
      </div>

      <UtilisationBandsChart
        bands={data.bands}
        peopleCount={data.peopleCount}
        weeksLabel={weeksLabel}
      />

      {showTeamBars && (
        <GroupBarsChart
          title="Utilisation by team"
          subtitle={`Average allocation % over the next ${weeksLabel} — click a bar for allocated vs free`}
          rows={data.byTeam}
        />
      )}

      {showHeatmap && <AllocationHeatmapGrid heatmap={data.heatmap} />}
    </section>
  );
}
