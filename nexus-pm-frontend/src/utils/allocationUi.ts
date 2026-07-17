import type { Allocation, Capacity } from '@/types';

export interface ProjectUtilisationRow {
  employeeId: string;
  employeeName: string;
  totalPercentage: number;
  overAllocated: boolean;
  allocations: Allocation[];
}

export function isAllocationActive(allocation: Allocation, asOf: string): boolean {
  if (allocation.fromDate > asOf) return false;
  if (allocation.toDate && allocation.toDate < asOf) return false;
  return true;
}

export function filterActiveAllocations(
  allocations: Allocation[],
  asOf: string = todayLocalIso(),
): Allocation[] {
  return allocations.filter((allocation) => isAllocationActive(allocation, asOf));
}

export type AllocationTiming = 'active' | 'upcoming' | 'ended';

export function allocationTiming(
  allocation: Allocation,
  asOf: string = todayLocalIso(),
): AllocationTiming {
  if (allocation.fromDate > asOf) return 'upcoming';
  if (allocation.toDate && allocation.toDate < asOf) return 'ended';
  return 'active';
}

export function partitionAllocations(
  allocations: Allocation[],
  asOf: string = todayLocalIso(),
): { active: Allocation[]; upcoming: Allocation[]; ended: Allocation[] } {
  const active: Allocation[] = [];
  const upcoming: Allocation[] = [];
  const ended: Allocation[] = [];
  for (const allocation of allocations) {
    const timing = allocationTiming(allocation, asOf);
    if (timing === 'active') active.push(allocation);
    else if (timing === 'upcoming') upcoming.push(allocation);
    else ended.push(allocation);
  }
  const byStart = (a: Allocation, b: Allocation) => a.fromDate.localeCompare(b.fromDate);
  active.sort(byStart);
  upcoming.sort(byStart);
  ended.sort(byStart);
  return { active, upcoming, ended };
}

export function sumAllocationPercent(allocations: Allocation[]): number {
  return allocations.reduce((sum, allocation) => sum + allocation.percentage, 0);
}

/** Allocations visible in the Resources date-range view (matches timeline). */
export function capacityAllocations(row: Capacity): Allocation[] {
  // Empty period list is authoritative — do not fall back to today's snapshot.
  return row.periodAllocations ?? row.allocations;
}

function allocationCoversDay(allocation: Allocation, day: string): boolean {
  if (allocation.fromDate > day) return false;
  if (allocation.toDate && allocation.toDate < day) return false;
  return true;
}

/** Average daily allocation % over an inclusive From–To window (matches backend). */
export function averageAllocatedPct(
  allocations: Allocation[],
  rangeFrom: string,
  rangeTo: string,
): number {
  const dayCount = inclusiveDayCount(rangeFrom, rangeTo);
  if (dayCount <= 0 || allocations.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < dayCount; i++) {
    const day = shiftIsoDate(rangeFrom, i);
    let dayPct = 0;
    for (const allocation of allocations) {
      if (allocationCoversDay(allocation, day)) {
        dayPct += allocation.percentage;
      }
    }
    sum += dayPct;
  }
  return Math.round(sum / dayCount);
}

/**
 * Capacity for the Resources date-range view.
 * Prefer period allocations + optional From–To; never show today's snapshot % when the period is empty.
 */
export function capacityPeriodView(
  row: Capacity,
  rangeFrom?: string,
  rangeTo?: string,
): {
  allocations: Allocation[];
  totalPercentage: number;
  availablePercentage: number;
  overAllocated: boolean;
} {
  const allocations = capacityAllocations(row);

  // Period list (including empty) is the source of truth for this screen.
  if (row.periodAllocations !== undefined) {
    let totalPercentage: number;
    if (allocations.length === 0) {
      totalPercentage = 0;
    } else if (rangeFrom && rangeTo) {
      totalPercentage = averageAllocatedPct(allocations, rangeFrom, rangeTo);
    } else if (row.availablePercentage !== undefined) {
      // New API already averaged over the requested range.
      totalPercentage = row.totalPercentage;
    } else {
      // Legacy API still returned today's snapshot in totalPercentage — do not use it.
      totalPercentage = sumAllocationPercent(allocations);
    }
    const availablePercentage = Math.max(0, 100 - totalPercentage);
    return {
      allocations,
      totalPercentage,
      availablePercentage,
      overAllocated: totalPercentage > 100,
    };
  }

  const totalPercentage = row.totalPercentage;
  const availablePercentage =
    row.availablePercentage ?? Math.max(0, 100 - totalPercentage);
  return {
    allocations,
    totalPercentage,
    availablePercentage,
    overAllocated: row.overAllocated,
  };
}

/** Inclusive calendar days between ISO dates (YYYY-MM-DD). */
export function inclusiveDayCount(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

/** Duration-weighted allocation % so stacked bars match period-average total. */
export function durationWeightedAllocations(
  allocations: Allocation[],
  rangeFrom: string,
  rangeTo: string,
): Allocation[] {
  const rangeDays = inclusiveDayCount(rangeFrom, rangeTo);
  if (rangeDays <= 0 || allocations.length === 0) return [];
  return allocations
    .map((allocation) => {
      const overlapStart = allocation.fromDate > rangeFrom ? allocation.fromDate : rangeFrom;
      const allocEnd = allocation.toDate ?? rangeTo;
      const overlapEnd = allocEnd < rangeTo ? allocEnd : rangeTo;
      const overlapDays = inclusiveDayCount(overlapStart, overlapEnd);
      if (overlapDays <= 0) return null;
      const weighted = Math.round((allocation.percentage * overlapDays) / rangeDays);
      if (weighted <= 0) return null;
      return { ...allocation, percentage: weighted };
    })
    .filter((a): a is Allocation => a != null);
}

export function aggregateProjectUtilisation(
  allocations: Allocation[],
  asOf?: string,
): ProjectUtilisationRow[] {
  const scoped = asOf ? filterActiveAllocations(allocations, asOf) : allocations;
  const byEmployee = new Map<string, ProjectUtilisationRow>();
  for (const allocation of scoped) {
    const existing = byEmployee.get(allocation.employeeId);
    if (existing) {
      existing.totalPercentage += allocation.percentage;
      existing.allocations.push(allocation);
    } else {
      byEmployee.set(allocation.employeeId, {
        employeeId: allocation.employeeId,
        employeeName: allocation.employeeName,
        totalPercentage: allocation.percentage,
        overAllocated: false,
        allocations: [allocation],
      });
    }
  }
  return [...byEmployee.values()]
    .map((row) => ({ ...row, overAllocated: row.totalPercentage > 100 }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

const PALETTE = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#eab308', // yellow
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export function projectColor(projectId: string, projectName: string): string {
  let hash = 0;
  const key = projectId || projectName;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function teamProjectSummary(row: Capacity): string {
  const allocations = capacityAllocations(row);
  if (allocations.length === 0) {
    return row.benchStatus === 'BENCH' ? 'On bench — Available' : 'No active projects';
  }
  const total = sumAllocationPercent(allocations);
  if (allocations.length === 1) {
    const name = allocations[0].projectName;
    return total <= 25 ? `${shortProjectName(name)} only` : shortProjectName(name);
  }
  return allocations.map((a) => shortProjectName(a.projectName)).join(' · ');
}

function shortProjectName(name: string): string {
  return name.split(/\s+/)[0];
}

export function roleLabel(row: Capacity): string {
  const parts = [row.designationName, row.departmentName].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Team member';
}

export function availabilityLabel(totalPercentage: number): string {
  const free = Math.max(0, 100 - totalPercentage);
  if (totalPercentage >= 100) return 'No capacity';
  if (totalPercentage >= 90) return `${free}% free only`;
  if (totalPercentage >= 75) return `${free}% available`;
  if (totalPercentage >= 50) return 'Mostly available';
  if (totalPercentage > 0) return 'Partially available';
  return 'Fully available';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatAllocationDateRange(allocation: Allocation): string {
  return allocation.toDate
    ? `${allocation.fromDate} → ${allocation.toDate}`
    : `${allocation.fromDate} → ongoing`;
}

export function formatAllocationCardLabel(allocation: Allocation): string {
  return `${allocation.projectName}: ${allocation.percentage}%: ${formatAllocationDateRange(allocation)}`;
}

export function allocationIssueTooltip(allocation: Allocation): string {
  return allocation.issueTitle;
}

export function defaultDateRange(): { from: string; to: string } {
  const year = new Date().getFullYear();
  const from = new Date(year, 5, 26);
  const to = new Date(year, 11, 31);
  return { from: toIso(from), to: toIso(to) };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalIso(): string {
  return toIso(new Date());
}

export function monthsBetween(
  from: string,
  to: string,
  showDates = false,
): { key: string; label: string }[] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const months: { key: string; label: string }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: showDates
        ? cursor.toLocaleString('default', { month: 'short', year: 'numeric' })
        : cursor.toLocaleString('default', { month: 'short' }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function monthIndex(dateStr: string, months: { key: string }[]): number {
  const d = new Date(`${dateStr}T00:00:00`);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return months.findIndex((m) => m.key === key);
}

export interface TimelineDay {
  key: string;
  dayOfMonth: number;
  monthKey: string;
  monthLabel: string;
  /** Saturday or Sunday */
  isWeekend: boolean;
}

export interface TimelineWeek {
  key: string;
  start: string;
  end: string;
  label: string;
}

export interface TimelineMonthGroup {
  monthKey: string;
  label: string;
  start: number;
  span: number;
}

export type TimelineGranularity = 'monthly' | 'weekly' | 'daily';

/** Shift a calendar date by days (can be negative). */
export function shiftIsoDate(iso: string, dayDelta: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dayDelta);
  return toIso(d);
}

export function shiftIsoByGranularity(
  iso: string,
  columnDelta: number,
  granularity: TimelineGranularity,
): string {
  if (columnDelta === 0) return iso;
  const d = new Date(`${iso}T00:00:00`);
  if (granularity === 'daily') {
    d.setDate(d.getDate() + columnDelta);
  } else if (granularity === 'weekly') {
    d.setDate(d.getDate() + columnDelta * 7);
  } else {
    d.setMonth(d.getMonth() + columnDelta);
  }
  return toIso(d);
}

export function lastDayOfMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 0);
  return toIso(d);
}

export function columnDateRange(
  index: number,
  granularity: TimelineGranularity,
  days: TimelineDay[],
  weeks: TimelineWeek[],
  months: { key: string }[],
): { start: string; end: string } | null {
  if (granularity === 'daily') {
    const day = days[index];
    return day ? { start: day.key, end: day.key } : null;
  }
  if (granularity === 'weekly') {
    const week = weeks[index];
    return week ? { start: week.start, end: week.end } : null;
  }
  const month = months[index];
  if (!month) return null;
  return { start: `${month.key}-01`, end: lastDayOfMonthKey(month.key) };
}

export function daysBetween(from: string, to: string): TimelineDay[] {
  const days: TimelineDay[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const dow = cursor.getDay();
    days.push({
      key: toIso(cursor),
      dayOfMonth: cursor.getDate(),
      monthKey,
      monthLabel: cursor.toLocaleString('default', { month: 'short', year: 'numeric' }),
      isWeekend: dow === 0 || dow === 6,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function groupDaysByMonth(days: TimelineDay[]): TimelineMonthGroup[] {
  const groups: TimelineMonthGroup[] = [];
  for (let i = 0; days.length > 0 && i < days.length; ) {
    const monthKey = days[i].monthKey;
    const label = days[i].monthLabel;
    const start = i;
    while (i < days.length && days[i].monthKey === monthKey) i++;
    groups.push({ monthKey, label, start, span: i - start });
  }
  return groups;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleString('default', { day: 'numeric', month: 'short' });
}

export function weeksBetween(from: string, to: string, showDates = false): TimelineWeek[] {
  const weeks: TimelineWeek[] = [];
  const rangeEnd = new Date(`${to}T00:00:00`);
  let cursor = startOfWeekMonday(new Date(`${from}T00:00:00`));

  while (cursor <= rangeEnd) {
    const weekStart = toIso(cursor);
    const weekEndDate = new Date(cursor);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const visibleEnd = weekEndDate > rangeEnd ? rangeEnd : weekEndDate;
    const weekEnd = toIso(visibleEnd);
    const weekNum = getIsoWeek(cursor);
    weeks.push({
      key: weekStart,
      start: weekStart,
      end: weekEnd,
      label: showDates ? `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}` : `W${weekNum}`,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function barSpanInRange(
  allocation: Allocation,
  columnCount: number,
  indexForDate: (dateStr: string) => number,
  rangeFrom: string,
  rangeTo: string,
): { start: number; span: number } | null {
  const allocEnd = allocation.toDate ?? rangeTo;
  const visibleStart = allocation.fromDate < rangeFrom ? rangeFrom : allocation.fromDate;
  const visibleEnd = allocEnd > rangeTo ? rangeTo : allocEnd;
  if (visibleEnd < rangeFrom || visibleStart > rangeTo) return null;

  const startIdx = indexForDate(visibleStart);
  const endIdx = indexForDate(visibleEnd);
  if (startIdx < 0 && endIdx < 0) return null;

  const start = Math.max(0, startIdx < 0 ? 0 : startIdx);
  const end = Math.min(columnCount - 1, endIdx < 0 ? columnCount - 1 : endIdx);
  if (end < start) return null;
  return { start, span: end - start + 1 };
}

export function dayIndex(dateStr: string, days: TimelineDay[]): number {
  const d = new Date(`${dateStr}T00:00:00`);
  const key = toIso(d);
  return days.findIndex((day) => day.key === key);
}

export function weekIndex(dateStr: string, weeks: TimelineWeek[]): number {
  for (let i = 0; i < weeks.length; i++) {
    if (dateStr >= weeks[i].start && dateStr <= weeks[i].end) return i;
  }
  if (weeks.length === 0) return -1;
  if (dateStr < weeks[0].start) return 0;
  return weeks.length - 1;
}

export function timelineBarLabel(allocation: Allocation, showDates: boolean): string {
  if (showDates) {
    return `${allocation.projectName} ${allocation.percentage}% · ${formatAllocationDateRange(allocation)}`;
  }
  return `${allocation.projectName} ${allocation.percentage}%`;
}

export interface AllocationLaneSpan {
  allocation: Allocation;
  start: number;
  span: number;
  lane: number;
}

/** Pack overlapping allocation spans into separate vertical lanes (no overlap within a lane). */
export function packAllocationLanes(
  items: Allocation[],
  getSpan: (allocation: Allocation) => { start: number; span: number } | null,
): { lanes: AllocationLaneSpan[]; laneCount: number } {
  const withSpans = items
    .map((allocation) => {
      const span = getSpan(allocation);
      return span ? { allocation, start: span.start, span: span.span } : null;
    })
    .filter((item): item is { allocation: Allocation; start: number; span: number } => item != null)
    .sort((a, b) => a.start - b.start || b.span - a.span || a.allocation.id.localeCompare(b.allocation.id));

  const laneExclusiveEnds: number[] = [];
  const lanes: AllocationLaneSpan[] = [];

  for (const item of withSpans) {
    const exclusiveEnd = item.start + item.span;
    let lane = laneExclusiveEnds.findIndex((end) => end <= item.start);
    if (lane < 0) {
      lane = laneExclusiveEnds.length;
      laneExclusiveEnds.push(exclusiveEnd);
    } else {
      laneExclusiveEnds[lane] = exclusiveEnd;
    }
    lanes.push({ ...item, lane });
  }

  return {
    lanes,
    laneCount: Math.max(1, laneExclusiveEnds.length),
  };
}

export function timelineRowHeightPx(laneCount: number, hasAllocations: boolean): number {
  const barHeight = 28;
  const laneGap = 4;
  const verticalPad = 10;
  if (!hasAllocations) return 48;
  const lanes = Math.max(1, laneCount);
  return verticalPad * 2 + lanes * barHeight + (lanes - 1) * laneGap;
}

