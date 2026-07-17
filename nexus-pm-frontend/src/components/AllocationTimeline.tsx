import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import type { Capacity, Allocation } from '@/types';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import {
  projectColor,
  monthsBetween,
  monthIndex,
  daysBetween,
  weeksBetween,
  groupDaysByMonth,
  barSpanInRange,
  dayIndex,
  weekIndex,
  allocationIssueTooltip,
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

const LABEL_WIDTH = 200;
const HEADER_HEIGHT_MONTHLY = '3rem';
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
  const issue = allocationIssueTooltip(allocation);
  const dates = formatAllocationDateRange(allocation);
  return `${issue} · ${dates}`;
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
              className={`absolute z-[1] mx-0.5 flex items-center overflow-hidden rounded px-2 text-xs font-medium text-white ${
                canEdit && onAllocationDatesChange
                  ? `touch-none ${
                      isDragging
                        ? 'cursor-grabbing ring-2 ring-white/50'
                        : 'cursor-grab hover:ring-2 hover:ring-white/40'
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60`
                  : canEdit
                    ? 'cursor-pointer hover:ring-2 hover:ring-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
                    : ''
              } ${datesSaving ? 'opacity-70' : ''}`}
              style={{
                left: `calc((100% / ${colCount}) * ${start} + 2px)`,
                width: `calc((100% / ${colCount}) * ${span} - 4px)`,
                top: ROW_PAD_PX + lane * (BAR_HEIGHT_PX + LANE_GAP_PX),
                height: BAR_HEIGHT_PX,
                backgroundColor: projectColor(a.projectId, a.projectName),
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
        map.set(a.projectId, a.projectName);
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

  const rowLayouts = useMemo(
    () =>
      rows.map((row) => {
        const items = row.periodAllocations ?? row.allocations;
        const packed = packAllocationLanes(items, getSpan);
        return {
          row,
          items,
          laneCount: packed.laneCount,
          height: timelineRowHeightPx(packed.laneCount, items.length > 0),
        };
      }),
    [rows, getSpan],
  );

  const granularityOptions: { key: TimelineGranularity; label: string; icon: typeof Calendar }[] = [
    { key: 'monthly', label: 'Monthly', icon: Calendar },
    { key: 'weekly', label: 'Weekly', icon: CalendarRange },
    { key: 'daily', label: 'Month & days', icon: CalendarDays },
  ];

  const headerHeight = granularity === 'daily' ? HEADER_HEIGHT_DAILY : HEADER_HEIGHT_MONTHLY;

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
          className="flex shrink-0 flex-col border-r border-border bg-bg2"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="flex shrink-0 items-center border-b border-border px-4 text-sm font-medium text-text2"
            style={{ height: headerHeight }}
          >
            Team member
          </div>
          <div
            ref={leftBodyRef}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
            onScroll={() => syncScroll('left')}
          >
            {rowLayouts.map(({ row, height }) => (
              <button
                key={row.employeeId}
                type="button"
                onClick={() => onRowSelect?.(row)}
                className="flex w-full items-center gap-2 border-b border-border bg-bg px-3 text-left hover:bg-bg2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                style={{ height }}
              >
                <ResourceAvatar name={row.employeeName} size="sm" />
                <span className="truncate text-sm font-medium leading-none">{row.employeeName}</span>
              </button>
            ))}
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

            {rowLayouts.map(({ row, items, height }) => (
              <div key={row.employeeId} className="border-b border-border bg-bg" style={{ height }}>
                <AllocationBars
                  items={items}
                  colCount={colCount}
                  columnTemplate={columnTemplate}
                  showDates={showDates}
                  getSpan={getSpan}
                  canEdit={canEdit}
                  granularity={granularity}
                  days={days}
                  weeks={weeks}
                  months={months}
                  rangeTo={to}
                  datesSaving={datesSaving}
                  onAllocationDoubleClick={(allocation) => onAllocationEdit?.(row, allocation)}
                  onAllocationDatesChange={
                    onAllocationDatesChange
                      ? (allocation, next) => onAllocationDatesChange(row, allocation, next)
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {projects.size > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-text2">
          {[...projects.entries()].map(([id, name]) => (
            <span key={id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: projectColor(id, name) }}
              />
              {name}
            </span>
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
