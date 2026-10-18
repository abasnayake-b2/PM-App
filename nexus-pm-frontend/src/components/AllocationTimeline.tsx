import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CalendarDays, CalendarRange, ChevronRight } from 'lucide-react';
import type { Capacity, Allocation } from '@/types';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import {
  EmProjectRdSummaryHeader,
  EmProjectRdSummaryRows,
  PROJECT_RD_GRID_WIDTH,
  PROJECT_RD_ROW_PX,
} from '@/components/EmProjectRdSummaryGrid';
import { fetchEmProjectRdSummary } from '@/api/issues.api';
import { fetchProjects } from '@/api/projects.api';
import {
  UNASSIGNED_FUNCTIONAL_UNIT,
  groupCapacityByFuManagerProject,
  type CapacityProjectHint,
} from '@/utils/capacityGroups';
import {
  GANTT_BAR_FILL,
  RD_STATUS_BUCKETS,
  rdStatusBarFontColor,
  monthsBetween,
  monthIndex,
  daysBetween,
  weeksBetween,
  groupDaysByMonth,
  barSpanInRange,
  dayIndex,
  weekIndex,
  allocationTargetLabel,
  formatAllocationDateRange,
  timelineBarLabel,
  packAllocationLanes,
  timelineRowHeightPx,
  shiftIsoByGranularity,
  columnDateRange,
  type TimelineGranularity,
  type TimelineDay,
  type TimelineWeek,
} from '@/utils/allocationUi';

const FU_LABEL_WIDTH = 132;
const EM_LABEL_WIDTH = 112;
const MEMBER_LABEL_WIDTH = 200;
const RD_GRID_RAIL_WIDTH = 28;
const HEADER_HEIGHT_MONTHLY = '3rem';
const HEADER_HEIGHT_WITH_GRID = '5rem';
const HEADER_HEIGHT_DAILY = '4.5rem';
const GRID_MAX_HEIGHT = 'min(32rem, calc(100vh - 14rem))';
const BAR_HEIGHT_PX = 28;
const LANE_GAP_PX = 4;
const ROW_PAD_PX = 10;
const DRAG_THRESHOLD_PX = 4;

type DragMode = 'move' | 'resize-start' | 'resize-end';

interface AllocationDateChange {
  fromDate: string;
  toDate?: string;
}

interface AllocationTimelineProps {
  rows: Capacity[];
  from: string;
  to: string;
  onRowSelect?: (row: Capacity) => void;
  canEdit?: boolean;
  onAllocationEdit?: (row: Capacity, allocation: Allocation) => void;
  onAllocationDatesChange?: (
    row: Capacity,
    allocation: Allocation,
    next: AllocationDateChange,
  ) => void;
  datesSaving?: boolean;
}

function allocationTooltip(allocation: Allocation, showDates: boolean): string {
  const item = allocationTargetLabel(allocation);
  const dates = formatAllocationDateRange(allocation);
  return `${item} · ${allocation.projectName} · ${dates}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ensureOrderedDates(fromDate: string, toDate?: string): AllocationDateChange {
  if (!toDate) return { fromDate, toDate };
  if (toDate < fromDate) return { fromDate: toDate, toDate: fromDate };
  return { fromDate, toDate };
}

function AllocationBars({
  items,
  colCount,
  columnTemplate,
  showDates,
  getSpan,
  canEdit,
  granularity,
  days,
  weeks,
  months,
  rangeTo,
  onAllocationDoubleClick,
  onAllocationDatesChange,
  datesSaving,
}: {
  items: Allocation[];
  colCount: number;
  columnTemplate: string;
  showDates: boolean;
  getSpan: (a: Allocation) => { start: number; span: number } | null;
  canEdit?: boolean;
  granularity: TimelineGranularity;
  days: TimelineDay[];
  weeks: TimelineWeek[];
  months: { key: string }[];
  rangeTo: string;
  onAllocationDoubleClick?: (allocation: Allocation) => void;
  onAllocationDatesChange?: (allocation: Allocation, next: AllocationDateChange) => void;
  datesSaving?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    allocation: Allocation;
    mode: DragMode;
    originCol: number;
    pointerId: number;
    startX: number;
    moved: boolean;
    previewFrom: string;
    previewTo?: string;
    hadOpenEnd: boolean;
  } | null>(null);
  const [drag, setDrag] = useState<typeof dragRef.current>(null);

  const displayItems = useMemo(() => {
    if (!drag) return items;
    return items.map((item) =>
      item.id === drag.allocation.id
        ? { ...item, fromDate: drag.previewFrom, toDate: drag.previewTo }
        : item,
    );
  }, [items, drag]);

  const { lanes, laneCount } = useMemo(
    () => packAllocationLanes(displayItems, getSpan),
    [displayItems, getSpan],
  );
  const rowHeight = timelineRowHeightPx(laneCount, displayItems.length > 0);

  const colFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || colCount <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const col = Math.floor((x / rect.width) * colCount);
      return clamp(col, 0, colCount - 1);
    },
    [colCount],
  );

  const computePreview = useCallback(
    (
      allocation: Allocation,
      mode: DragMode,
      originCol: number,
      currentCol: number,
      hadOpenEnd: boolean,
    ) => {
      const delta = currentCol - originCol;
      if (mode === 'move') {
        const fromDate = shiftIsoByGranularity(allocation.fromDate, delta, granularity);
        const toDate = allocation.toDate
          ? shiftIsoByGranularity(allocation.toDate, delta, granularity)
          : undefined;
        return ensureOrderedDates(fromDate, toDate);
      }

      if (mode === 'resize-start') {
        const range = columnDateRange(currentCol, granularity, days, weeks, months);
        const fromDate = range?.start ?? shiftIsoByGranularity(allocation.fromDate, delta, granularity);
        const toDate = hadOpenEnd ? allocation.toDate : (allocation.toDate ?? rangeTo);
        return ensureOrderedDates(fromDate, toDate);
      }

      const range = columnDateRange(currentCol, granularity, days, weeks, months);
      const toDate =
        range?.end ?? shiftIsoByGranularity(allocation.toDate ?? rangeTo, delta, granularity);
      return ensureOrderedDates(allocation.fromDate, toDate);
    },
    [days, weeks, months, granularity, rangeTo],
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const moved = current.moved || Math.abs(event.clientX - current.startX) >= DRAG_THRESHOLD_PX;
      const currentCol = colFromClientX(event.clientX);
      const preview = computePreview(
        current.allocation,
        current.mode,
        current.originCol,
        currentCol,
        current.hadOpenEnd,
      );
      const next = {
        ...current,
        moved,
        previewFrom: preview.fromDate,
        previewTo: preview.toDate,
      };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const currentCol = colFromClientX(event.clientX);
      const preview = computePreview(
        current.allocation,
        current.mode,
        current.originCol,
        currentCol,
        current.hadOpenEnd,
      );
      const changed =
        current.moved &&
        (preview.fromDate !== current.allocation.fromDate ||
          (preview.toDate ?? '') !== (current.allocation.toDate ?? ''));
      dragRef.current = null;
      setDrag(null);
      if (changed) {
        onAllocationDatesChange?.(current.allocation, preview);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, colFromClientX, computePreview, onAllocationDatesChange]);

  const beginDrag = (
    event: ReactPointerEvent,
    allocation: Allocation,
    mode: DragMode,
  ) => {
    if (!canEdit || datesSaving || !onAllocationDatesChange) return;
    event.preventDefault();
    event.stopPropagation();
    const originCol = colFromClientX(event.clientX);
    const next = {
      allocation,
      mode,
      originCol,
      pointerId: event.pointerId,
      startX: event.clientX,
      moved: false,
      previewFrom: allocation.fromDate,
      previewTo: allocation.toDate,
      hadOpenEnd: !allocation.toDate,
    };
    dragRef.current = next;
    setDrag(next);
  };

  return (
    <div
      ref={trackRef}
      className="relative overflow-hidden"
      style={{
        height: rowHeight,
        display: 'grid',
        gridTemplateColumns: columnTemplate,
      }}
    >
      {Array.from({ length: colCount }).map((_, i) => (
        <div
          key={i}
          className={`timeline-v-line h-full first:border-l-0${
            granularity === 'daily' && days[i]?.isWeekend ? ' timeline-weekend' : ''
          }`}
        />
      ))}
      {displayItems.length === 0 ? (
        <div
          className="absolute inset-x-2 flex h-7 items-center justify-center rounded border border-dashed border-border text-xs text-text2"
          style={{ top: ROW_PAD_PX }}
        >
          — on bench —
        </div>
      ) : (
        lanes.map(({ allocation: a, start, span, lane }) => {
          const isDragging = drag?.allocation.id === a.id;
          return (
            <div
              key={a.id}
              role={canEdit ? 'button' : undefined}
              tabIndex={canEdit ? 0 : undefined}
              className={`absolute z-[1] mx-0.5 flex items-center overflow-hidden rounded px-2 text-xs font-medium ${
                canEdit && onAllocationDatesChange
                  ? `touch-none ${
                      isDragging
                        ? 'cursor-grabbing ring-2 ring-slate-400/70'
                        : 'cursor-grab hover:ring-2 hover:ring-slate-400/50'
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/70`
                  : canEdit
                    ? 'cursor-pointer hover:ring-2 hover:ring-slate-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/70'
                    : ''
              } ${datesSaving ? 'opacity-70' : ''}`}
              style={{
                left: `calc((100% / ${colCount}) * ${start} + 2px)`,
                width: `calc((100% / ${colCount}) * ${span} - 4px)`,
                top: ROW_PAD_PX + lane * (BAR_HEIGHT_PX + LANE_GAP_PX),
                height: BAR_HEIGHT_PX,
                backgroundColor: GANTT_BAR_FILL,
                color: rdStatusBarFontColor(a.issueStatusSequence),
              }}
              title={
                canEdit
                  ? `${allocationTooltip(a, showDates)} · Drag to move · Drag ends to resize · Double-click for details`
                  : allocationTooltip(a, showDates)
              }
              onPointerDown={
                canEdit && onAllocationDatesChange
                  ? (e) => beginDrag(e, a, 'move')
                  : undefined
              }
              onDoubleClick={
                canEdit
                  ? (e) => {
                      e.stopPropagation();
                      if (dragRef.current?.moved) return;
                      onAllocationDoubleClick?.(a);
                    }
                  : undefined
              }
              onKeyDown={
                canEdit
                  ? (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onAllocationDoubleClick?.(a);
                      }
                    }
                  : undefined
              }
            >
              {canEdit && onAllocationDatesChange && (
                <>
                  <span
                    className="absolute inset-y-0 left-0 z-[2] w-2 cursor-ew-resize rounded-l hover:bg-white/25"
                    onPointerDown={(e) => beginDrag(e, a, 'resize-start')}
                    title="Resize start"
                  />
                  <span
                    className="absolute inset-y-0 right-0 z-[2] w-2 cursor-ew-resize rounded-r hover:bg-white/25"
                    onPointerDown={(e) => beginDrag(e, a, 'resize-end')}
                    title="Resize end"
                  />
                </>
              )}
              <span className="pointer-events-none truncate pl-1">{timelineBarLabel(a, showDates)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

export function AllocationTimeline({
  rows,
  from,
  to,
  onRowSelect,
  canEdit = false,
  onAllocationEdit,
  onAllocationDatesChange,
  datesSaving = false,
}: AllocationTimelineProps) {
  const [granularity, setGranularity] = useState<TimelineGranularity>('daily');
  const [showDates, setShowDates] = useState(true);
  const [showRdGrid, setShowRdGrid] = useState(false);

  const { data: rdSummary } = useQuery({
    queryKey: ['em-project-rd-summary'],
    queryFn: fetchEmProjectRdSummary,
  });
  const { data: projectsPage } = useQuery({
    queryKey: ['projects', 'utilization-hints'],
    queryFn: () => fetchProjects({ size: 500 }),
  });
  const projectHints = useMemo<CapacityProjectHint[]>(() => {
    const hints = new Map<string, CapacityProjectHint>();
    const add = (hint: CapacityProjectHint) => {
      const key = `${hint.functionalUnit.toLowerCase()}|${hint.manager.toLowerCase()}|${hint.projectName.toLowerCase()}`;
      hints.set(key, hint);
    };
    for (const project of projectsPage?.content ?? []) {
      const functionalUnit = project.workCategoryName?.trim();
      if (!functionalUnit) continue;
      add({
        projectId: project.id,
        projectName: project.name,
        manager: project.engineeringManagerName?.trim() || 'Unassigned',
        functionalUnit,
      });
    }
    for (const project of rdSummary?.projects ?? []) {
      const functionalUnit = project.workCategoryName?.trim();
      if (!functionalUnit) continue;
      add({
        projectId: project.projectId,
        projectName: project.projectName,
        manager: project.emName?.trim() || 'Unassigned',
        functionalUnit,
      });
    }
    return [...hints.values()];
  }, [projectsPage, rdSummary]);

  const rdProjectsByFuEm = useMemo(() => {
    const fuByProjectId = new Map(
      (projectsPage?.content ?? [])
        .filter((project) => project.workCategoryName?.trim())
        .map((project) => [project.id, project.workCategoryName!.trim()] as const),
    );
    const map = new Map<string, NonNullable<typeof rdSummary>['projects']>();
    for (const project of rdSummary?.projects ?? []) {
      const fu =
        project.workCategoryName?.trim() ||
        fuByProjectId.get(project.projectId) ||
        UNASSIGNED_FUNCTIONAL_UNIT;
      const em = (project.emName?.trim() || 'Unassigned').toLowerCase();
      const key = `${fu.toLowerCase()}|${em}`;
      const list = map.get(key) ?? [];
      list.push(project);
      map.set(key, list);
    }
    return map;
  }, [rdSummary, projectsPage]);

  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);

  const months = useMemo(() => monthsBetween(from, to, showDates), [from, to, showDates]);
  const days = useMemo(() => daysBetween(from, to), [from, to]);
  const weeks = useMemo(() => weeksBetween(from, to, showDates), [from, to, showDates]);
  const monthGroups = useMemo(() => groupDaysByMonth(days), [days]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) =>
      (r.periodAllocations ?? r.allocations).forEach((a) => {
        if (a.projectId && a.projectName) map.set(a.projectId, a.projectName);
      }),
    );
    return map;
  }, [rows]);

  const colCount =
    granularity === 'monthly' ? months.length : granularity === 'weekly' ? weeks.length : days.length;

  const minColPx = granularity === 'daily' ? 24 : granularity === 'weekly' ? 72 : 56;
  const columnTemplate = `repeat(${colCount}, minmax(${minColPx}px, 1fr))`;
  const timelineMinWidth = colCount * minColPx;

  const getMonthSpan = useCallback(
    (a: Allocation) => barSpanInRange(a, months.length, (d) => monthIndex(d, months), from, to),
    [months, from, to],
  );
  const getWeekSpan = useCallback(
    (a: Allocation) => barSpanInRange(a, weeks.length, (d) => weekIndex(d, weeks), from, to),
    [weeks, from, to],
  );
  const getDaySpan = useCallback(
    (a: Allocation) => barSpanInRange(a, days.length, (d) => dayIndex(d, days), from, to),
    [days, from, to],
  );

  const getSpan =
    granularity === 'monthly' ? getMonthSpan : granularity === 'weekly' ? getWeekSpan : getDaySpan;

  const fuGroups = useMemo(() => {
    return groupCapacityByFuManagerProject(rows, projectHints).map((fu) => {
      const managers = fu.managers.map((mgr) => {
        const rdProjects =
          rdProjectsByFuEm.get(`${fu.functionalUnit.toLowerCase()}|${mgr.manager.toLowerCase()}`) ??
          [];
        const membersById = new Map<
          string,
          { row: Capacity; items: Allocation[] }
        >();
        for (const project of mgr.projects) {
          for (const leaf of project.leaves) {
            const existing = membersById.get(leaf.employeeId);
            if (existing) {
              existing.items.push(...leaf.items);
            } else {
              membersById.set(leaf.employeeId, { row: leaf.row, items: [...leaf.items] });
            }
          }
        }
        const members = [...membersById.values()]
          .map((member) => {
            const packed = packAllocationLanes(member.items, getSpan);
            return {
              row: member.row,
              items: member.items,
              height: timelineRowHeightPx(packed.laneCount, member.items.length > 0),
            };
          })
          .sort((a, b) =>
            a.row.employeeName.localeCompare(b.row.employeeName, undefined, { sensitivity: 'base' }),
          );
        const membersHeight = members.reduce((sum, member) => sum + member.height, 0);
        const rdHeight = showRdGrid ? rdProjects.length * PROJECT_RD_ROW_PX : 0;
        const minHeight = members.length === 0 ? Math.max(rdHeight, 28) : 0;
        return {
          manager: mgr.manager,
          members,
          rdProjects,
          height: Math.max(membersHeight, rdHeight, minHeight),
        };
      }).filter((manager) => manager.members.length > 0);
      if (managers.length === 0) return null;
      return {
        functionalUnit: fu.functionalUnit,
        managers,
        height: managers.reduce((sum, manager) => sum + manager.height, 0),
      };
    }).filter((fu): fu is NonNullable<typeof fu> => fu != null);
  }, [rows, getSpan, projectHints, rdProjectsByFuEm, showRdGrid]);

  const rowLayouts = useMemo(
    () =>
      fuGroups.flatMap((fu) =>
        fu.managers.flatMap((manager) =>
          manager.members.length > 0
            ? manager.members
            : [{ row: null, items: [] as Allocation[], height: manager.height }],
        ),
      ),
    [fuGroups],
  );

  const granularityOptions: { key: TimelineGranularity; label: string; icon: typeof Calendar }[] = [
    { key: 'monthly', label: 'Monthly', icon: Calendar },
    { key: 'weekly', label: 'Weekly', icon: CalendarRange },
    { key: 'daily', label: 'Month & days', icon: CalendarDays },
  ];

  const headerHeight = showRdGrid
    ? HEADER_HEIGHT_WITH_GRID
    : granularity === 'daily'
      ? HEADER_HEIGHT_DAILY
      : HEADER_HEIGHT_MONTHLY;
  const leftWidth =
    (showRdGrid ? PROJECT_RD_GRID_WIDTH : RD_GRID_RAIL_WIDTH) +
    FU_LABEL_WIDTH +
    EM_LABEL_WIDTH +
    MEMBER_LABEL_WIDTH;

  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (syncingScroll.current) return;
    const left = leftBodyRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    syncingScroll.current = true;
    if (source === 'right') {
      left.scrollTop = right.scrollTop;
    } else {
      right.scrollTop = left.scrollTop;
    }
    syncingScroll.current = false;
  }, []);

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-bg2 px-3 py-2 text-xs">
        <span className="font-medium text-text2">RD status font colour</span>
        {RD_STATUS_BUCKETS.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex h-5 items-center rounded px-1.5 font-semibold"
              style={{ backgroundColor: GANTT_BAR_FILL, color: item.color }}
            >
              {item.name}
            </span>
            <span className="text-text2">({item.sequences})</span>
          </span>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border p-0.5">
          {granularityOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setGranularity(key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                granularity === key ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text2">
          <input
            type="checkbox"
            checked={showDates}
            onChange={(e) => setShowDates(e.target.checked)}
            className="rounded border-border"
          />
          Show dates
        </label>
        {canEdit && (
          <span className="text-xs text-text2">
            Drag bars to move · drag ends to resize · double-click for full edit
          </span>
        )}
        {granularity === 'daily' && days.length > 120 && (
          <span className="text-xs text-text2">
            Narrow the From/To range for easier day-by-day reading.
          </span>
        )}
      </div>

      <div
        className="flex w-full min-w-0 overflow-hidden rounded-xl border border-border bg-bg"
        style={{ maxHeight: GRID_MAX_HEIGHT }}
      >
        <div
          className="flex shrink-0 border-r border-border bg-bg2"
          style={{ width: leftWidth }}
        >
          {!showRdGrid && (
            <button
              type="button"
              onClick={() => setShowRdGrid(true)}
              className="flex shrink-0 flex-col items-center gap-2 border-r border-border bg-bg2 pt-3 text-text2 hover:bg-bg3 hover:text-accent"
              style={{ width: RD_GRID_RAIL_WIDTH }}
              title="Reveal project RD grid"
              aria-label="Reveal project RD grid"
            >
              <ChevronRight size={14} />
              <span className="text-[10px] font-medium tracking-wide [writing-mode:vertical-rl] rotate-180">
                Project RDs
              </span>
            </button>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex shrink-0 border-b border-border text-sm font-medium text-text2"
            style={{ height: headerHeight }}
          >
            {showRdGrid && (
              <div className="shrink-0 border-r border-border" style={{ width: PROJECT_RD_GRID_WIDTH }}>
                <EmProjectRdSummaryHeader onCollapse={() => setShowRdGrid(false)} />
              </div>
            )}
            <div
              className="flex items-start border-r border-border px-3 pt-2"
              style={{ width: FU_LABEL_WIDTH }}
            >
              Functional unit
            </div>
            <div
              className="flex items-start border-r border-border px-3 pt-2"
              style={{ width: EM_LABEL_WIDTH }}
            >
              Manager
            </div>
            <div className="flex items-center px-3" style={{ width: MEMBER_LABEL_WIDTH }}>
              Engineer
            </div>
          </div>
          <div
            ref={leftBodyRef}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
            onScroll={() => syncScroll('left')}
          >
            {fuGroups.map((fu) => (
              <div key={`fu:${fu.functionalUnit}`} className="flex border-b border-border">
                {showRdGrid && (
                  <div
                    className="shrink-0 border-r border-border bg-bg"
                    style={{ width: PROJECT_RD_GRID_WIDTH, minHeight: fu.height }}
                  >
                    {fu.managers.map((manager) => (
                      <div
                        key={`rd:${fu.functionalUnit}:${manager.manager}`}
                        className="overflow-y-auto"
                        style={{ minHeight: manager.height }}
                      >
                        <EmProjectRdSummaryRows projects={manager.rdProjects} />
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className="flex shrink-0 items-start justify-start border-r border-border bg-bg px-3 py-1.5 text-left"
                  style={{ width: FU_LABEL_WIDTH, minHeight: fu.height }}
                >
                  <p className="text-sm font-semibold leading-snug break-words">{fu.functionalUnit}</p>
                </div>
                <div className="min-w-0 flex-1">
                  {fu.managers.map((manager) => (
                    <div key={`em:${fu.functionalUnit}:${manager.manager}`} className="flex">
                      <div
                        className="flex shrink-0 items-start justify-start border-r border-border bg-bg px-3 py-1.5 text-left"
                        style={{ width: EM_LABEL_WIDTH, minHeight: manager.height }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug break-words">{manager.manager}</p>
                          <p className="text-[10px] text-text2">
                            {manager.members.length} engineer{manager.members.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0" style={{ width: MEMBER_LABEL_WIDTH }}>
                        {manager.members.map(({ row, height }) => {
                          const inactive = (row.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE';
                          return (
                            <button
                              key={`${fu.functionalUnit}:${manager.manager}:${row.employeeId}`}
                              type="button"
                              onClick={() => onRowSelect?.(row)}
                              className={`flex w-full items-center gap-2 border-b border-border px-3 text-left last:border-b-0 hover:bg-bg2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                                inactive ? 'bg-bg2/50 text-text3 grayscale' : 'bg-bg'
                              }`}
                              style={{ height }}
                            >
                              <ResourceAvatar name={row.employeeName} size="sm" />
                              <span className="truncate text-sm font-medium leading-none">
                                {row.employeeName}
                                {inactive ? ' (Inactive)' : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>

        <div
          ref={rightScrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-auto"
          onScroll={() => syncScroll('right')}
        >
          <div className="w-full" style={{ minWidth: timelineMinWidth }}>
            <div
              className="sticky top-0 z-10 shrink-0 border-b border-border bg-bg2"
              style={{ height: headerHeight }}
            >
              {granularity === 'daily' ? (
                <DailyHeader
                  days={days}
                  monthGroups={monthGroups}
                  showDates={showDates}
                  columnTemplate={columnTemplate}
                />
              ) : (
                <SimpleHeader
                  labels={
                    granularity === 'monthly'
                      ? months.map((m) => m.label)
                      : weeks.map((w) => w.label)
                  }
                  columnTemplate={columnTemplate}
                />
              )}
            </div>

            {rowLayouts.map(({ row, items, height }, index) => {
              if (!row) {
                return (
                  <div
                    key={`empty:${index}`}
                    className="border-b border-border bg-bg"
                    style={{ height }}
                  />
                );
              }
              const inactive = (row.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE';
              return (
              <div
                key={`${row.employeeId}:${index}`}
                className={`border-b border-border ${inactive ? 'bg-bg2/50 opacity-70 grayscale' : 'bg-bg'}`}
                style={{ height }}
              >
                <AllocationBars
                  items={items}
                  colCount={colCount}
                  columnTemplate={columnTemplate}
                  showDates={showDates}
                  getSpan={getSpan}
                  canEdit={canEdit && !inactive}
                  granularity={granularity}
                  days={days}
                  weeks={weeks}
                  months={months}
                  rangeTo={to}
                  datesSaving={datesSaving}
                  onAllocationDoubleClick={
                    inactive ? undefined : (allocation) => onAllocationEdit?.(row, allocation)
                  }
                  onAllocationDatesChange={
                    !inactive && onAllocationDatesChange
                      ? (allocation, next) => onAllocationDatesChange(row, allocation, next)
                      : undefined
                  }
                />
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {projects.size > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-text2">
          {[...projects.entries()].map(([id, name]) => (
            <span key={id}>{name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SimpleHeader({
  labels,
  columnTemplate,
}: {
  labels: string[];
  columnTemplate: string;
}) {
  return (
    <div className="grid h-full w-full" style={{ gridTemplateColumns: columnTemplate }}>
      {labels.map((label, i) => (
        <div
          key={i}
          className="timeline-v-line flex items-center justify-center px-1 text-center text-xs font-medium text-text2 first:border-l-0"
          title={label}
        >
          <span className="line-clamp-2">{label}</span>
        </div>
      ))}
    </div>
  );
}

function DailyHeader({
  days,
  monthGroups,
  showDates,
  columnTemplate,
}: {
  days: TimelineDay[];
  monthGroups: ReturnType<typeof groupDaysByMonth>;
  showDates: boolean;
  columnTemplate: string;
}) {
  return (
    <div
      className="grid h-full w-full"
      style={{
        gridTemplateColumns: columnTemplate,
        gridTemplateRows: '1fr 1fr',
      }}
    >
      {monthGroups.map((group) => (
        <div
          key={group.monthKey}
          className="px-2 py-2 text-center text-xs font-semibold text-text"
          style={{ gridColumn: `${group.start + 1} / span ${group.span}`, gridRow: 1 }}
        >
          {group.label}
        </div>
      ))}
      {days.map((day, i) => (
        <div
          key={day.key}
          className={`py-1 text-center text-[10px] text-text2 ${i === 0 ? '' : 'timeline-v-line'}${
            day.isWeekend ? ' timeline-weekend' : ''
          }`}
          style={{ gridColumn: i + 1, gridRow: 2 }}
          title={day.key}
        >
          {showDates ? day.dayOfMonth : i % 7 === 0 ? '·' : ''}
        </div>
      ))}
    </div>
  );
}
